<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Item;
use App\Models\Size;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Throwable;

class InventoryController extends Controller
{
    /**
     * Sirve para calcular los slots usados de la mochila.
     * En stackeables, divide por max_quantity; en no stackeables, cada unidad ocupa 1 slot.
     */
    private function calculateUsedSlots($bagItems)
    {
        $usedSlots = 0;
        foreach ($bagItems as $bagItem) {
            if (! $bagItem->item || $bagItem->item->excludedFromPlayerInventory()) {
                continue;
            }
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

    // Sirve para obtener la cantidad de tickets de gacha
    public function getGachaTicketCount(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();
            if (! $bag) {
                return response()->json(['data' => ['quantity' => 0]]);
            }

            // Se obtiene el ID del item de tickets de gacha
            $ticketItemId = Item::query()->where('effect_type', 'Gacha Ticket')->value('id');
            if (! $ticketItemId) {
                return response()->json(['data' => ['quantity' => 0]]);
            }

            // Se obtiene la cantidad de tickets de gacha
            $quantity = (int) (BagItem::query()
                ->where('bag_id', $bag->id)
                ->where('item_id', $ticketItemId)
                ->value('quantity') ?? 0);

            // Se devuelve la respuesta
            return response()->json(['data' => ['quantity' => $quantity]]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving gacha tickets',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /*
     * Sirve para obtener el inventario del usuario autenticado.
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
                if (! $bagItem->item || $bagItem->item->excludedFromPlayerInventory()) {
                    continue;
                }
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
                            'updated_at' => $bagItem->item->updated_at,
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
                            'updated_at' => $bagItem->item->updated_at,
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
     * Sirve para obtener un item específico del inventario
     *
     * @param  int  $itemId
     * @return JsonResponse
     */
    public function getInventoryItem($itemId)
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();

            if (! $user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null,
                ], 401);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();

            if (! $bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null,
                ], 404);
            }

            // Se obtiene el item de la mochila
            $bagItem = BagItem::where('bag_id', $bag->id)
                ->where('item_id', $itemId)
                ->with('item')
                ->first();

            // Si el item no existe, se devuelve un error
            if (! $bagItem) {
                return response()->json([
                    'message' => 'Item not found in inventory',
                    'data' => null,
                ], 404);
            }

            // Si el item está excluido del inventario, se devuelve un error
            if ($bagItem->item->excludedFromPlayerInventory()) {
                return response()->json([
                    'message' => 'Item not found in inventory',
                    'data' => null,
                ], 404);
            }

            // Se devuelve la respuesta
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

    /*
     * Sirve para añadir un item al inventario (mochila) del usuario.
     * Body: { "item_id": int, "quantity": int }
     *
     * @return JsonResponse
     */
    public function addItem(Request $request)
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            // Se obtiene el ID del item y la cantidad
            $itemId = (int) $request->input('item_id');
            $quantity = (int) $request->input('quantity', 1);
            if ($quantity < 1) {
                return response()->json(['message' => 'Quantity must be at least 1'], 422);
            }

            // Se obtiene el item
            $item = Item::find($itemId);
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::firstOrCreate(
                ['user_id' => $user->id],
                ['max_slots' => Bag::MAX_SLOTS]
            );

            // Se obtiene los items de la mochila
            $bagItems = BagItem::where('bag_id', $bag->id)->with('item')->get();
            $usedSlots = $this->calculateUsedSlots($bagItems);

            // Se obtiene el item existente
            $existing = BagItem::where('bag_id', $bag->id)->where('item_id', $itemId)->first();
            $existingQty = $existing ? (int) $existing->quantity : 0;
            $requestedQty = $quantity;
            // Se calcula la cantidad permitida de items
            $allowedAddQty = 0;

            if ($item->is_stackable) {
                // Si el item es stackeable, se calcula la cantidad permitida de stacks
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

            // Se calcula la cantidad de items a añadir
            $addedQty = min($requestedQty, $allowedAddQty);
            // Se calcula la cantidad de items a descartar
            $discardedQty = $requestedQty - $addedQty;

            // Si la cantidad de items a añadir es 0, se devuelve un error
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

            // Se calcula la nueva cantidad de items
            $newQty = $existingQty + $addedQty;
            if ($existing) {
                $existing->load('item');
            }

            // Si el item existe, se actualiza la cantidad
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

            // Se crea el item en la mochila
            $bagItem = BagItem::create([
                'bag_id' => $bag->id,
                'item_id' => $itemId,
                'quantity' => $addedQty,
            ]);

            // Se devuelve la respuesta
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

    /*
     * Sirve para actualizar la cantidad de un item en la mochila.
     * Body: { "quantity": int }. Si quantity es 0, se elimina el BagItem.
     *
     * @param  int  $bagItemId
     * @return JsonResponse
     */
    public function updateItem(Request $request, $bagItemId)
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            // Se obtiene la cantidad
            $quantity = (int) $request->input('quantity');
            if ($quantity < 0) {
                return response()->json(['message' => 'Quantity cannot be negative'], 422);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();
            if (! $bag) {
                return response()->json(['message' => 'User does not have a bag'], 404);
            }

            // Se obtiene el item de la mochila
            $bagItem = BagItem::where('id', $bagItemId)
                ->where('bag_id', $bag->id)
                ->with('item')
                ->first();

            if (! $bagItem) {
                return response()->json(['message' => 'Item not found in inventory'], 404);
            }

            // Si la cantidad es 0, se elimina el item
            if ($quantity === 0) {
                $bagItem->delete();

                return response()->json(['message' => 'Item removed from inventory', 'remaining' => 0], 200);
            }

            // Se actualiza la cantidad del item
            $bagItem->quantity = $quantity;
            $bagItem->save();

            // Se devuelve la respuesta
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

    /*
     * Sirve para eliminar una cantidad de un item de la mochila.
     * Si la cantidad a eliminar iguala o supera la cantidad actual, elimina el BagItem.
     * Si es menor, resta la cantidad.
     *
     * @param  int  $bagItemId  ID del BagItem
     * @return JsonResponse
     */
    public function discardItem(Request $request, $bagItemId)
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();

            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            // Se obtiene la cantidad
            $quantity = (int) $request->input('quantity', 1);
            if ($quantity < 1) {
                return response()->json(['message' => 'Quantity must be at least 1'], 422);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();

            if (! $bag) {
                return response()->json(['message' => 'User does not have a bag'], 404);
            }

            // Se obtiene el item de la mochila
            $bagItem = BagItem::where('id', $bagItemId)
                ->where('bag_id', $bag->id)
                ->first();

            if (! $bagItem) {
                return response()->json(['message' => 'Item not found in inventory'], 404);
            }

            // Si la cantidad a eliminar iguala o supera la cantidad actual, se elimina el item
            if ($quantity >= $bagItem->quantity) {
                $bagItem->delete();

                return response()->json(['message' => 'Item removed from inventory', 'remaining' => 0], 200);
            }

            // Se actualiza la cantidad del item
            $bagItem->quantity -= $quantity;
            $bagItem->save();

            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Item quantity updated',
                'remaining' => $bagItem->quantity,
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Error discarding item', 'error' => $e->getMessage()], 500);
        }
    }

    /*
     * Sirve para calcular los slots disponibles considerando items stackeables vs no stackeables y max_quantity
     * @return JsonResponse
     */
    public function getMaxSlots()
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();

            if (! $user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null,
                ], 401);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();

            // Si la mochila no existe, se devuelve un error
            if (! $bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null,
                ], 404);
            }

            // Se obtiene todos los items de la mochila con sus detalles
            $bagItems = BagItem::where('bag_id', $bag->id)
                ->with('item')
                ->get();

            // Se calculan los slots usados
            $usedSlots = $this->calculateUsedSlots($bagItems);

            // Se devuelve la respuesta
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

    // Sirve para usar un item
    public function useItem(Request $request): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            // Se obtiene el ID del item y el ID del Xuxemon adquirido
            $bagItemId = (int) $request->input('bag_item_id');
            $adquiredXuxemonId = (int) $request->input('adquired_xuxemon_id');
            $quantity = (int) $request->input('quantity', 1);
            // Si el ID del item o el ID del Xuxemon adquirido no son proporcionados, se devuelve un error
            if (! $bagItemId || ! $adquiredXuxemonId) {
                return response()->json(['message' => 'bag_item_id and adquired_xuxemon_id are required'], 422);
            }

            // Se obtiene la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();
            if (! $bag) {
                return response()->json(['message' => 'User does not have a bag'], 404);
            }

            // Se obtiene el item de la mochila
            $bagItem = BagItem::where('id', $bagItemId)
                ->where('bag_id', $bag->id)
                ->with('item')
                ->first();
            // Si el item no existe, se devuelve un error
            if (! $bagItem) {
                return response()->json(['message' => 'Item not found in inventory'], 404);
            }

            // Se obtiene el Xuxemon adquirido
            $adquired = AdquiredXuxemon::where('id', $adquiredXuxemonId)
                ->where('user_id', $user->id)
                ->first();
            // Si el Xuxemon adquirido no existe, se devuelve un error
            if (! $adquired) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            // Se obtiene el item
            $item = $bagItem->item;

            // Se aplica el efecto del item
            $data = match ($item->effect_type) {
                'Evolve' => $this->useSpecialMeat($bagItem, $adquired, $quantity),
                'Heal' => $this->applyHealing($bagItem, $adquired),
                'Defense Up' => $this->applyDefenseUp($bagItem, $adquired),
                'DMG Up' => $this->applyAttackUp($bagItem, $adquired),
                'Remove Status Effects' => $this->applyRemoveStatusEffects($bagItem, $adquired),
                default => null,
            };

            // Si el efecto del item no es válido, se devuelve un error
            if ($data === null) {
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

    // Sirve para aplicar los efectos secundarios a un Xuxemon adquirido
    private function applySideEffects(AdquiredXuxemon $adquired): array
    {
        $sideEffects = DB::table('side_effects')->get();

        // Se obtiene los efectos secundarios
        $appliedEffects = [];

        // Se obtiene los nombres de los atributos de los efectos secundarios
        $candidates = ['side_effect_id_1', 'side_effect_id_2', 'side_effect_id_3'];

        // Se obtiene los atributos que existen en el modelo
        $existingCandidates = array_values(array_filter($candidates, function ($k) use ($adquired) {
            return array_key_exists($k, $adquired->getAttributes());
        }));

        // Si no hay atributos que existan, se devuelve un error
        if (count($existingCandidates) === 0) {
            return ['applied_side_effects' => []];
        }

        // Se obtiene los IDs de los efectos secundarios aplicados
        $existingEffectIds = [];
        foreach ($existingCandidates as $k) {
            $val = $adquired->getAttribute($k);
            if ($val !== null) {
                $existingEffectIds[] = (int) $val;
            }
        }

        // Se obtiene los slots libres
        $freeSlots = [];
        foreach ($existingCandidates as $k) {
            if ($adquired->getAttribute($k) === null) {
                $freeSlots[] = $k;
            }
        }

        // Si no hay slots libres, se devuelve un error
        if (count($freeSlots) === 0) {
            return ['applied_side_effects' => []];
        }

        // Se obtiene los IDs de los efectos secundarios aplicados
        $appliedEffectIds = [];

        // Se aplican los efectos secundarios hasta que se agotan los slots libres o los efectos
        foreach ($sideEffects as $effect) {
            if (count($freeSlots) === 0) {
                break;
            }

            $effectId = (int) $effect->id;

            // Si el Xuxemon ya tiene este efecto secundario o ya se ha aplicado, se salta
            if (in_array($effectId, $existingEffectIds, true) || in_array($effectId, $appliedEffectIds, true)) {
                continue;
            }

            $chance = (int) ($effect->apply_chance ?? 0);
            if ($chance <= 0) {
                continue;
            }

            // Se obtiene un número aleatorio
            $roll = random_int(1, 100);
            if ($roll <= $chance) {
                $slot = array_shift($freeSlots);
                $adquired->setAttribute($slot, $effect->id);
                $appliedEffectIds[] = $effectId;
                $appliedEffects[] = [
                    'name' => $effect->name,
                    'description' => $effect->description,
                    'icon_path' => $effect->icon_path,
                    'slot' => $slot,
                ];
            }
        }

        // Si hay efectos secundarios aplicados, se guarda el Xuxemon y se aplican los efectos secundarios
        if (! empty($appliedEffects)) {
            $adquired->save();

            foreach ($appliedEffects as $effect) {
                if ($effect['name'] === 'Overdose') {
                    $this->applyOverdoseSizeReduction($adquired);
                    break;
                }
            }
        }

        // Se devuelve la respuesta
        return [
            'applied_side_effects' => $appliedEffects,
        ];
    }

    // Sirve para aplicar la reducción de tamaño por efecto de overdose
    private function applyOverdoseSizeReduction(AdquiredXuxemon $adquired): void
    {
        $currentSizeId = (int) $adquired->size_id;
        $prevSize = Size::where('id', '<', $currentSizeId)->orderByDesc('id')->first();
        if ($prevSize) {
            $adquired->size_id = $prevSize->id;
            $adquired->save();
        }
    }

    // Sirve para recalcular el tamaño del Xuxemon desde el progreso
    private function recalculateSizeFromProgress(AdquiredXuxemon $adquired): void
    {
        $correctSize = Size::resolveForProgress((int) $adquired->requirement_progress);
        if ($correctSize && (int) $adquired->size_id !== (int) $correctSize->id) {
            $adquired->size_id = $correctSize->id;
            $adquired->save();
        }
    }

    // Sirve para aplicar los efectos de estado a un Xuxemon adquirido
    private function applyRemoveStatusEffects(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;

        // Se obtiene el nombre del item
        $name = $item->name;

        // Si el item es Nulberry, se aplica el efecto de overdose
        if ($name === 'Nulberry') {
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            $hadOverdose = (
                ($adquired->sideEffect1?->name ?? null) === 'Overdose' ||
                ($adquired->sideEffect2?->name ?? null) === 'Overdose' ||
                ($adquired->sideEffect3?->name ?? null) === 'Overdose'
            );
            $adquired->status_effect_id = null;
            $adquired->side_effect_id_1 = null;
            $adquired->side_effect_id_2 = null;
            $adquired->side_effect_id_3 = null;
            $adquired->save();
            // Si el Xuxemon tenía efecto de overdose, se recalcula el tamaño
            if ($hadOverdose) {
                $this->recalculateSizeFromProgress($adquired);
            }
        }
        // Si el item es Yellow Mushroom, se aplica el efecto de gluttony
        elseif ($name === 'Yellow Mushroom') {
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            if ($adquired->sideEffect1?->name === 'Gluttony') {
                $adquired->side_effect_id_1 = null;
            }
            if ($adquired->sideEffect2?->name === 'Gluttony') {
                $adquired->side_effect_id_2 = null;
            }
            if ($adquired->sideEffect3?->name === 'Gluttony') {
                $adquired->side_effect_id_3 = null;
            }
            $adquired->save();
        }
        // Si el item es Red Mushroom, se aplica el efecto de starving
        elseif ($name === 'Red Mushroom') {
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            if ($adquired->sideEffect1?->name === 'Starving') {
                $adquired->side_effect_id_1 = null;
            }
            if ($adquired->sideEffect2?->name === 'Starving') {
                $adquired->side_effect_id_2 = null;
            }
            if ($adquired->sideEffect3?->name === 'Starving') {
                $adquired->side_effect_id_3 = null;
            }
            $adquired->save();
        }

        // Se reduce la cantidad del item
        $bagItem->reduceQuantity(1);

        return [
            'message' => 'Status effects removed',
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    // Sirve para aplicar el efecto de aumento de ataque a un Xuxemon adquirido
    private function applyAttackUp(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;
        // Se obtiene el item

        // Se asegura que la relación xuxemon esté cargada
        if (! $adquired->relationLoaded('xuxemon')) {
            $adquired->load('xuxemon');
        }

        // Se obtiene el valor del efecto
        $amount = max(0, (int) $item->effect_value);

        // Se obtiene el bonus de ataque anterior
        $previousBonus = (int) $adquired->bonus_attack;
        // Se obtiene el nuevo bonus de ataque
        $newBonus = $previousBonus + $amount;

        // Se actualiza el bonus de ataque
        $adquired->bonus_attack = $newBonus;
        $adquired->save();
        // Se aplican los efectos secundarios
        $this->applySideEffects($adquired);

        // Se reduce la cantidad del item
        $bagItem->reduceQuantity(1);

        // Se devuelve la respuesta
        return [
            'previous_attack' => $previousBonus,
            'attack_gained' => $amount,
            'current_attack' => $adquired->attack,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    // Sirve para aplicar el efecto de aumento de defensa a un Xuxemon adquirido
    private function applyDefenseUp(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;
        // Se obtiene el item

        // Se asegura que la relación xuxemon esté cargada
        if (! $adquired->relationLoaded('xuxemon')) {
            $adquired->load('xuxemon');
        }

        // Se obtiene el valor del efecto
        $amount = max(0, (int) $item->effect_value);

        // Se obtiene el bonus de defensa anterior
        $previousBonus = (int) $adquired->bonus_defense;
        // Se obtiene el nuevo bonus de defensa
        $newBonus = $previousBonus + $amount;

        // Se actualiza el bonus de defensa
        $adquired->bonus_defense = $newBonus;
        // Se aplican los efectos secundarios
        $adquired->save();
        $this->applySideEffects($adquired);

        // Se reduce la cantidad del item
        $bagItem->reduceQuantity(1);

        // Se devuelve la respuesta
        return [
            'previous_defense' => $adquired->getOriginal('bonus_defense') !== null
                                        ? ($adquired->xuxemon?->defense ?? 0) + (int) round(($adquired->level - 1) * 1.2) + $previousBonus
                                        : $previousBonus,
            'defense_gained' => $amount,
            'current_defense' => $adquired->defense,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    // Sirve para aplicar el efecto de curación a un Xuxemon adquirido
    private function applyHealing(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;

        // Se asegura que la relación xuxemon esté cargada
        if (! $adquired->relationLoaded('xuxemon')) {
            $adquired->load('xuxemon');
        }

        // Se obtiene el valor del efecto
        $percentage = max(0, (int) $item->effect_value);

        // Se obtiene la vida máxima
        $maxHp = $adquired->hp;
        $currentHp = (int) $adquired->current_hp;

        // Se calcula la cantidad curada
        $healAmount = (int) round($maxHp * $percentage / 100);

        // Se aplica la curación sin superar el máximo
        $newHp = min($currentHp + $healAmount, $maxHp);

        // Se actualiza la vida actual
        $adquired->current_hp = $newHp;
        // Se guarda el Xuxemon
        $adquired->save();
        // Se aplican los efectos secundarios
        $this->applySideEffects($adquired);
        // Consumir 1 unidad del ítem
        $bagItem->reduceQuantity(1);

        return [
            'previous_hp' => $currentHp,
            'healed_amount' => $newHp - $currentHp,
            'current_hp' => $newHp,
            'max_hp' => $maxHp,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    // Sirve para usar la carne especial a un Xuxemon adquirido
    private function useSpecialMeat(BagItem $bagItem, AdquiredXuxemon $adquired, int $quantity = 1): array
    {

        // Se asegura que la relación efectos secundarios esté cargada
        $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);

        // Se obtiene si el Xuxemon tiene el efecto secundario Gluttony
        $hasGluttony = (
            ($adquired->sideEffect1?->name ?? null) === 'Gluttony' ||
            ($adquired->sideEffect2?->name ?? null) === 'Gluttony' ||
            ($adquired->sideEffect3?->name ?? null) === 'Gluttony'
        );

        // Se obtiene si el Xuxemon tiene el efecto secundario Overdose
        $hasOverdose = (
            ($adquired->sideEffect1?->name ?? null) === 'Overdose' ||
            ($adquired->sideEffect2?->name ?? null) === 'Overdose' ||
            ($adquired->sideEffect3?->name ?? null) === 'Overdose'
        );

        // Si el Xuxemon tiene el efecto secundario Overdose, se bloquea el uso de la carne especial
        if ($hasOverdose) {
            return [
                'error' => true,
                'message' => 'Your Xuxemon is affected by Overdose, cannot eat Special Meat, and its size has been reduced.',
                'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
                'overdose_blocked' => true,
                'overdose_info' => 'This Xuxemon is affected by Overdose and cannot eat Special Meat until cured. Its size has been reduced.',
            ];
        }

        // Si el Xuxemon tiene el efecto secundario Gluttony, se bloquea el uso de la carne especial
        if ($hasGluttony) {
            return [
                'error' => true,
                'message' => 'Your Xuxemon is affected by Gluttony and cannot eat Special Meat.',
                'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
                'gluttony_blocked' => true,
                'gluttony_info' => 'This Xuxemon is affected by Gluttony and cannot eat Special Meat until cured.',
            ];
        }

        // Se obtiene si el Xuxemon tiene el efecto secundario Starving
        $hasStarving = (
            ($adquired->sideEffect1?->name ?? null) === 'Starving' ||
            ($adquired->sideEffect2?->name ?? null) === 'Starving' ||
            ($adquired->sideEffect3?->name ?? null) === 'Starving'
        );

        // Se obtiene el progreso actual
        $progress = (int) $adquired->requirement_progress;

        // Se obtiene el progreso máximo hasta Large
        $largeRequirement = (int) (Size::query()
            ->whereRaw('LOWER(size) = ?', ['large'])
            ->value('requirement_progress') ?? $progress);

        // Se obtiene el progreso total necesario
        $requirementTotal = $largeRequirement;

        // Se obtiene el progreso necesario
        $needed = max(0, $requirementTotal - $progress);
        if ($needed < 1) {
            return [
                'message' => 'This Xuxemon cannot evolve further.',
                'requirement_progress' => $progress,
                'requirement_total' => $requirementTotal,
                'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
            ];
        }

        // Se obtiene la cantidad máxima usable
        $maxUsable = 1;
        if ($hasStarving) {
            $maxUsable = min(floor($bagItem->quantity / 2), $needed);
        } else {
            $maxUsable = min($bagItem->quantity, $needed);
        }

        // Se obtiene la cantidad a usar
        $qtyToUse = max(1, min($quantity, $maxUsable));

        // Se inicializa el progreso ganado
        $progressGained = 0;

        // Se inicializa la cantidad de carne usada
        $meatUsed = 0;

        // Se inicializa la cantidad de efectos secundarios aplicados
        $sideEffectsApplications = 0;
        if ($hasStarving) {
            // Se obtiene la cantidad de carne necesaria
            $meatNeeded = $qtyToUse * 2;
            if ($bagItem->quantity < $meatNeeded) {
                return [
                    'error' => true,
                    'message' => 'Your Xuxemon is Starving and needs 2 Special Meat per progress, but you do not have enough.',
                    'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
                    'starving_blocked' => true,
                ];
            }
            // Se reduce la cantidad de carne
            $bagItem->reduceQuantity($meatNeeded);
            $progressGained = $qtyToUse;
            $meatUsed = $meatNeeded;
            $sideEffectsApplications = $meatNeeded;
        } else {
            if ($bagItem->quantity < $qtyToUse) {
                return [
                    'error' => true,
                    'message' => 'You do not have enough Special Meat.',
                    'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
                ];
            }
            $bagItem->reduceQuantity($qtyToUse);
            // Se actualiza el progreso ganado
            $progressGained = $qtyToUse;
            // Se actualiza la cantidad de carne usada
            $meatUsed = $qtyToUse;
            // Se actualiza la cantidad de efectos secundarios aplicados
            $sideEffectsApplications = $qtyToUse;
        }

        // Se actualiza el progreso
        $progress += $progressGained;
        // Se actualiza el progreso del Xuxemon
        $adquired->requirement_progress = $progress;
        // Se obtiene el nuevo tamaño
        $newSize = Size::resolveForProgress($progress);
        // Si el nuevo tamaño existe, se actualiza el tamaño del Xuxemon
        if ($newSize) {
            $adquired->size_id = $newSize->id;
        }
        // Se guarda el Xuxemon
        $adquired->save();

        // Se aplican los efectos secundarios una vez por cada carne consumida
        for ($i = 0; $i < $sideEffectsApplications; $i++) {
            $this->applySideEffects($adquired);
        }

        // Se devuelve la respuesta
        $response = [
            'xuxemon_size' => $newSize?->size ?? 'Small',
            'requirement_progress' => $adquired->requirement_progress,
            'requirement_total' => $requirementTotal,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
            'starving_penalty_applied' => $hasStarving,
            'progress_gained' => $progressGained,
            'meat_used' => $meatUsed,
        ];
        // Si el Xuxemon tiene el efecto secundario Starving, se actualiza la información
        if ($hasStarving) {
            $response['starving_info'] = 'Your Xuxemon is Starving and needs 2 Special Meat per progress. '.$meatUsed.' were consumed for '.$progressGained.' progress.';
        }

        return $response;
    }

    // Sirve para obtener todos los items
    public function getAllItems(): JsonResponse
    {
        try {
            // Se obtienen todos los items
            $items = Item::with('statusEffect')
                ->select('id', 'name', 'description', 'effect_type', 'effect_value', 'is_stackable', 'max_quantity', 'status_effect_id', 'icon_path', 'updated_at')
                ->orderBy('name')
                ->get();

            // Se devuelve la respuesta
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
