<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Bag;
use App\Models\BagItem;

class InventoryController extends Controller
{
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

            // Transformar los datos para el frontend
            $inventory = $bagItems->map(function ($bagItem) {
                return [
                    'id' => $bagItem->item_id,
                    'name' => $bagItem->item->name,
                    'description' => $bagItem->item->description,
                    'quantity' => $bagItem->quantity,
                    'icon_path' => $bagItem->item->icon_path,
                    'effect_type' => $bagItem->item->effect_type,
                    'effect_value' => $bagItem->item->effect_value,
                    'is_stackable' => $bagItem->item->is_stackable,
                    'max_quantity' => $bagItem->item->max_quantity,
                ];
            });

            return response()->json([
                'message' => 'Inventory retrieved successfully',
                'data' => [
                    'user_id' => $user->id,
                    'bag_id' => $bag->id,
                    'max_slots' => $bag->max_slots,
                    'used_slots' => $bagItems->count(),
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
}
