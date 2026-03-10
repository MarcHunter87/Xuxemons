<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Bag;
use App\Models\BagItem;

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
     * @return \Illuminate\Http\JsonResponse
     */
    public function getInventory()
    {
        try {
            // Obtener el usuario autenticado
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null
                ], 401);
            }

            // Obtener la mochila del usuario
            $bag = Bag::where('user_id', $user->id)->first();

            if (!$bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null
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
                            'id' => $bagItem->item_id . '-stack-' . $stackIndex,
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
                            'id' => $bagItem->item_id . '-unit-' . $i,
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
                    'items' => $inventory
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving inventory',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtiene un item específico del inventario
     * 
     * @param int $itemId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getInventoryItem($itemId)
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null
                ], 401);
            }

            $bag = Bag::where('user_id', $user->id)->first();

            if (!$bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null
                ], 404);
            }

            $bagItem = BagItem::where('bag_id', $bag->id)
                ->where('item_id', $itemId)
                ->with('item')
                ->first();

            if (!$bagItem) {
                return response()->json([
                    'message' => 'Item not found in inventory',
                    'data' => null
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
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving item',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtiene los slots máximos de la mochila del usuario
     * Calcula slots considerando items stackeables vs no stackeables y max_quantity
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getMaxSlots()
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'User not authenticated',
                    'data' => null
                ], 401);
            }

            $bag = Bag::where('user_id', $user->id)->first();

            if (!$bag) {
                return response()->json([
                    'message' => 'User does not have a bag',
                    'data' => null
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
                    'available_slots' => $bag->max_slots - $usedSlots
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving max slots',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
