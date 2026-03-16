<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Throwable;

class InventoryController extends Controller
{
    /**
     * Calcula los slots usados considerando stackeables y max_quantity
     * Items stackeables: se dividen en múltiples slots si exceden max_quantity
     * Items no stackeables: cada unidad ocupa 1 slot
     */
    private function calculateUsedSlots($bagItems)
    {
        $usedSlots = 0;
        foreach ($bagItems as $bagItem) {
            if ($bagItem->item->is_stackable) {
                // Items stackeables: dividir por max_quantity
                $maxQty = $bagItem->item->max_quantity ?? 1;
                $slots = ceil($bagItem->quantity / $maxQty);
                $usedSlots += $slots;
            } else {
                // Items no stackeables: 1 slot por cada unidad
                $usedSlots += $bagItem->quantity;
            }
        }

        return $usedSlots;
    }

    /**
     * Obtiene el inventario del usuario autenticado
     *
     * @return JsonResponse
     */
    public function getInventory()
    {
        try {
            // Obtener el usuario autenticado
            $user = Auth::user();

            if (! $user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null,
                ], 401);
            }

            // Obtener la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();

            if (! $bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null,
                ], 404);
            }

            // Obtener los items de la mochila con sus detalles
            $bagItems = BagItem::where('bag_id', $bag->id)
                ->with('item')
                ->get();

            // Calcular slots usados
            $usedSlots = $this->calculateUsedSlots($bagItems);

            // Transformar los datos para el frontend
            // Si item stackeable tiene más de max_quantity, se divide en múltiples items
            $inventory = [];
            foreach ($bagItems as $bagItem) {
                if ($bagItem->item->is_stackable) {
                    $maxQty = $bagItem->item->max_quantity ?? 1;
                    $remaining = $bagItem->quantity;
                    $stackIndex = 0;

                    // Dividir item stackeable en múltiples stacks si es necesario
                    while ($remaining > 0) {
                        $qty = min($remaining, $maxQty);
                        $inventory[] = [
                            'id' => $bagItem->item_id.'-stack-'.$stackIndex,
                            'name' => $bagItem->item->name,
                            'description' => $bagItem->item->description,
                            'quantity' => $qty,
                            'icon_path' => $bagItem->item->icon_path,
                            'effect_type' => $bagItem->item->effect_type,
                            'effect_value' => $bagItem->item->effect_value,
                            'is_stackable' => $bagItem->item->is_stackable,
                            'max_quantity' => $bagItem->item->max_quantity,
                            'bag_item_id' => $bagItem->id, // ID real del BagItem
                        ];
                        $remaining -= $qty;
                        $stackIndex++;
                    }
                } else {
                    // Items no stackeables: crear una entrada por cada unidad
                    for ($i = 0; $i < $bagItem->quantity; $i++) {
                        $inventory[] = [
                            'id' => $bagItem->item_id.'-unit-'.$i,
                            'name' => $bagItem->item->name,
                            'description' => $bagItem->item->description,
                            'quantity' => 1,
                            'icon_path' => $bagItem->item->icon_path,
                            'effect_type' => $bagItem->item->effect_type,
                            'effect_value' => $bagItem->item->effect_value,
                            'is_stackable' => $bagItem->item->is_stackable,
                            'max_quantity' => $bagItem->item->max_quantity,
                            'bag_item_id' => $bagItem->id, // ID real del BagItem
                        ];
                    }
                }
            }

            return response()->json([
                'message' => 'Inventory retrieved successfully',
                'data' => [
                    'max_slots' => $bag->max_slots,
                    'used_slots' => $usedSlots,
                    'items' => $inventory,
                ],
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving inventory',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtiene un item específico del inventario
     *
     * @param  int  $itemId
     * @return JsonResponse
     */
    public function getInventoryItem($itemId)
    {
        try {
            $user = Auth::user();

            if (! $user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null,
                ], 401);
            }

            $bag = Bag::where('user_id', $user->id)->first();

            if (! $bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null,
                ], 404);
            }

            $bagItem = BagItem::where('bag_id', $bag->id)
                ->where('item_id', $itemId)
                ->with('item')
                ->first();

            if (! $bagItem) {
                return response()->json([
                    'message' => 'Item not found in inventory',
                    'data' => null,
                ], 404);
            }

            return response()->json([
                'message' => 'Item retrieved successfully',
                'data' => [
                    'id' => $bagItem->item_id,
                    'name' => $bagItem->item->name,
                    'description' => $bagItem->item->description,
                    'quantity' => $bagItem->quantity,
                    'icon_path' => $bagItem->item->icon_path,
                    'effect_type' => $bagItem->item->effect_type,
                    'effect_value' => $bagItem->item->effect_value,
                    'is_stackable' => $bagItem->item->is_stackable,
                    'max_quantity' => $bagItem->item->max_quantity,
                ],
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving item',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Añade un item al inventario (mochila) del usuario.
     * Body: { "item_id": int, "quantity": int }
     *
     * @return JsonResponse
     */
    public function addItem(Request $request)
    {
        try {
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $itemId = (int) $request->input('item_id');
            $quantity = (int) $request->input('quantity', 1);
            if ($quantity < 1) {
                return response()->json(['message' => 'Quantity must be at least 1'], 422);
            }

            $item = Item::find($itemId);
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            $bag = Bag::firstOrCreate(
                ['user_id' => $user->id],
                ['max_slots' => Bag::MAX_SLOTS]
            );

            $bagItems = BagItem::where('bag_id', $bag->id)->with('item')->get();
            $usedSlots = $this->calculateUsedSlots($bagItems);

            $existing = BagItem::where('bag_id', $bag->id)->where('item_id', $itemId)->first();
            $existingQty = $existing ? (int) $existing->quantity : 0;
            $requestedQty = $quantity;
            $allowedAddQty = 0;

            if ($item->is_stackable) {
                $maxQty = max(1, (int) ($item->max_quantity ?? 1));
                $oldStacks = $existingQty > 0 ? (int) ceil($existingQty / $maxQty) : 0;
                $freeStacksForItem = $bag->max_slots - ($usedSlots - $oldStacks);
                $freeStacksForItem = max(0, $freeStacksForItem);
                $maxTotalQty = $freeStacksForItem * $maxQty;
                $allowedAddQty = max(0, $maxTotalQty - $existingQty);
            } else {
                $freeSlotsForItem = $bag->max_slots - ($usedSlots - $existingQty);
                $freeSlotsForItem = max(0, $freeSlotsForItem);
                $allowedAddQty = max(0, $freeSlotsForItem - $existingQty);
            }

            $addedQty = min($requestedQty, $allowedAddQty);
            $discardedQty = $requestedQty - $addedQty;

            if ($addedQty === 0) {
                return response()->json([
                    'message' => 'No slots available for this item',
                    'data' => [
                        'bag_item_id' => $existing ? $existing->id : null,
                        'item_id' => $itemId,
                        'quantity' => $existingQty,
                        'requested_quantity' => $requestedQty,
                        'added_quantity' => 0,
                        'discarded_quantity' => $discardedQty,
                    ],
                ], 200);
            }

            $newQty = $existingQty + $addedQty;
            if ($existing) {
                $existing->load('item');
            }

            if ($existing) {
                $existing->quantity = $newQty;
                $existing->save();
                $existing->load('item');

                return response()->json([
                    'message' => 'Item quantity updated',
                    'data' => [
                        'bag_item_id' => $existing->id,
                        'item_id' => $existing->item_id,
                        'quantity' => $existing->quantity,
                        'requested_quantity' => $requestedQty,
                        'added_quantity' => $addedQty,
                        'discarded_quantity' => $discardedQty,
                    ],
                ], 200);
            }

            $bagItem = BagItem::create([
                'bag_id' => $bag->id,
                'item_id' => $itemId,
                'quantity' => $addedQty,
            ]);

            return response()->json([
                'message' => 'Item added to inventory',
                'data' => [
                    'bag_item_id' => $bagItem->id,
                    'item_id' => $bagItem->item_id,
                    'quantity' => $bagItem->quantity,
                    'requested_quantity' => $requestedQty,
                    'added_quantity' => $addedQty,
                    'discarded_quantity' => $discardedQty,
                ],
            ], 201);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Error adding item', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Actualiza la cantidad de un item en la mochila.
     * Body: { "quantity": int }. Si quantity es 0, se elimina el BagItem.
     *
     * @param  int  $bagItemId
     * @return JsonResponse
     */
    public function updateItem(Request $request, $bagItemId)
    {
        try {
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $quantity = (int) $request->input('quantity');
            if ($quantity < 0) {
                return response()->json(['message' => 'Quantity cannot be negative'], 422);
            }

            $bag = Bag::where('user_id', $user->id)->first();
            if (! $bag) {
                return response()->json(['message' => 'User does not have a bag'], 404);
            }

            $bagItem = BagItem::where('id', $bagItemId)
                ->where('bag_id', $bag->id)
                ->with('item')
                ->first();

            if (! $bagItem) {
                return response()->json(['message' => 'Item not found in inventory'], 404);
            }

            if ($quantity === 0) {
                $bagItem->delete();

                return response()->json(['message' => 'Item removed from inventory', 'remaining' => 0], 200);
            }

            $bagItem->quantity = $quantity;
            $bagItem->save();

            return response()->json([
                'message' => 'Item quantity updated',
                'data' => [
                    'bag_item_id' => $bagItem->id,
                    'quantity' => $bagItem->quantity,
                ],
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Error updating item', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Elimina (descarta) una cantidad de un item de la mochila.
     * Si la cantidad a eliminar iguala o supera la cantidad actual, elimina el BagItem.
     * Si es menor, resta la cantidad.
     *
     * @param  int  $bagItemId  ID del BagItem
     * @return JsonResponse
     */
    public function discardItem(Request $request, $bagItemId)
    {
        try {
            $user = Auth::user();

            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $quantity = (int) $request->input('quantity', 1);
            if ($quantity < 1) {
                return response()->json(['message' => 'Quantity must be at least 1'], 422);
            }

            $bag = Bag::where('user_id', $user->id)->first();

            if (! $bag) {
                return response()->json(['message' => 'User does not have a bag'], 404);
            }

            $bagItem = BagItem::where('id', $bagItemId)
                ->where('bag_id', $bag->id)
                ->first();

            if (! $bagItem) {
                return response()->json(['message' => 'Item not found in inventory'], 404);
            }

            if ($quantity >= $bagItem->quantity) {
                $bagItem->delete();

                return response()->json(['message' => 'Item removed from inventory', 'remaining' => 0], 200);
            }

            $bagItem->quantity -= $quantity;
            $bagItem->save();

            return response()->json([
                'message' => 'Item quantity updated',
                'remaining' => $bagItem->quantity,
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Error discarding item', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Calcula slots considerando items stackeables vs no stackeables y max_quantity
     *
     * @return JsonResponse
     */
    public function getMaxSlots()
    {
        try {
            $user = Auth::user();

            if (! $user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null,
                ], 401);
            }

            $bag = Bag::where('user_id', $user->id)->first();

            if (! $bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null,
                ], 404);
            }

            // Obtener todos los items de la mochila con sus detalles
            $bagItems = BagItem::where('bag_id', $bag->id)
                ->with('item')
                ->get();

            // Calcular slots usados
            $usedSlots = $this->calculateUsedSlots($bagItems);

            return response()->json([
                'message' => 'Max slots retrieved successfully',
                'data' => [
                    'max_slots' => $bag->max_slots,
                    'used_slots' => $usedSlots,
                    'available_slots' => $bag->max_slots - $usedSlots,
                ],
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving max slots',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function useItem(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $bagItemId = (int) $request->input('bag_item_id');
            $adquiredXuxemonId = (int) $request->input('adquired_xuxemon_id');
            if (! $bagItemId || ! $adquiredXuxemonId) {
                return response()->json(['message' => 'bag_item_id and adquired_xuxemon_id are required'], 422);
            }

            $bag = Bag::where('user_id', $user->id)->first();
            if (! $bag) {
                return response()->json(['message' => 'User does not have a bag'], 404);
            }

            $bagItem = BagItem::where('id', $bagItemId)
                ->where('bag_id', $bag->id)
                ->with('item')
                ->first();
            if (! $bagItem) {
                return response()->json(['message' => 'Item not found in inventory'], 404);
            }

            $adquired = AdquiredXuxemon::where('id', $adquiredXuxemonId)
                ->where('user_id', $user->id)
                ->first();
            if (! $adquired) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            $item = $bagItem->item;

            if ($item->effect_type === 'Evolve') {
                $data = $this->useSpecialMeat($bagItem, $adquired);
            } else {
                return response()->json(['message' => 'This item cannot be used yet'], 400);
            }

            return response()->json([
                'message' => 'Item used successfully',
                'data' => $data,
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error using item', 'error' => $e->getMessage()], 500);
        }
    }

    private function useSpecialMeat(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $currentSize = $adquired->size ?? 'Small';
        $newSize = $currentSize === 'Small' ? 'Medium' : 'Large';
        $adquired->size = $newSize;
        $adquired->save();

        $bagItem->reduceQuantity(1);

        return [
            'xuxemon_size' => $newSize,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    public function getAllItems(): JsonResponse
    {
        try {
            $items = Item::with('statusEffect')
                ->select('id', 'name', 'description', 'effect_type', 'effect_value', 'is_stackable', 'max_quantity', 'status_effect_id', 'icon_path')
                ->orderBy('name')
                ->get();

            return response()->json([
                'data' => $items,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve items',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }
}
