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
     * Calcula los slots usados considerando stackeables y max_quantity
     * Items stackeables: se dividen en múltiples slots si exceden max_quantity
     * Items no stackeables: cada unidad ocupa 1 slot
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

    public function getGachaTicketCount(): JsonResponse
    {
        try {
            $user = Auth::user();
            if (! $user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $bag = Bag::where('user_id', $user->id)->first();
            if (! $bag) {
                return response()->json(['data' => ['quantity' => 0]]);
            }

            $ticketItemId = Item::query()->where('effect_type', 'Gacha Ticket')->value('id');
            if (! $ticketItemId) {
                return response()->json(['data' => ['quantity' => 0]]);
            }

            $quantity = (int) (BagItem::query()
                ->where('bag_id', $bag->id)
                ->where('item_id', $ticketItemId)
                ->value('quantity') ?? 0);

            return response()->json(['data' => ['quantity' => $quantity]]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error retrieving gacha tickets',
                'error' => $e->getMessage(),
            ], 500);
        }
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

            if ($bagItem->item->excludedFromPlayerInventory()) {
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
            
            $data = match ($item->effect_type) {
                'Evolve'      => $this->useSpecialMeat($bagItem, $adquired),
                'Heal'        => $this->applyHealing($bagItem, $adquired),
                'Defense Up'  => $this->applyDefenseUp($bagItem, $adquired),
                'DMG Up'      => $this->applyAttackUp($bagItem, $adquired),
                'Remove Status Effects' => $this->applyRemoveStatusEffects($bagItem, $adquired),
                default       => null,
            };

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

    private function applySideEffects(AdquiredXuxemon $adquired): array
    {
        $sideEffects = DB::table('side_effects')->get();

        $appliedEffects = [];

        // Candidate attribute names (backwards-compatible): prefer base name then numeric suffixes
        $candidates = ['side_effect_id_1', 'side_effect_id_2', 'side_effect_id_3'];

        // Determine which candidate columns actually exist on the model (attributes)
        $existingCandidates = array_values(array_filter($candidates, function ($k) use ($adquired) {
            return array_key_exists($k, $adquired->getAttributes());
        }));

        if (count($existingCandidates) === 0) {
            return ['applied_side_effects' => []];
        }

        // Collect already-applied side effect IDs to avoid duplicates
        $existingEffectIds = [];
        foreach ($existingCandidates as $k) {
            $val = $adquired->getAttribute($k);
            if ($val !== null) {
                $existingEffectIds[] = (int) $val;
            }
        }

        // Find free slots
        $freeSlots = [];
        foreach ($existingCandidates as $k) {
            if ($adquired->getAttribute($k) === null) {
                $freeSlots[] = $k;
            }
        }

        if (count($freeSlots) === 0) {
            return ['applied_side_effects' => []];
        }

        // Track effects applied during this invocation to prevent duplicates
        $appliedEffectIds = [];

        // Try to apply side effects until we run out of free slots or effects
        foreach ($sideEffects as $effect) {
            if (count($freeSlots) === 0) break;

            $effectId = (int) $effect->id;

            // Skip if this Xuxemon already has this side effect or we've applied it already now
            if (in_array($effectId, $existingEffectIds, true) || in_array($effectId, $appliedEffectIds, true)) {
                continue;
            }

            $chance = (int) ($effect->apply_chance ?? 0);
            if ($chance <= 0) continue;

            // Use secure random
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

        if (! empty($appliedEffects)) {
            $adquired->save();
        }

        return [
            'applied_side_effects' => $appliedEffects,
        ];
    }

    private function applyRemoveStatusEffects(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;

        $name = $item->name;

        if ($name === 'Nulberry') {
            $adquired->status_effect_id = null;
            $adquired->side_effect_id_1 = null;
            $adquired->side_effect_id_2 = null;
            $adquired->side_effect_id_3 = null;
            $adquired->save();
        } elseif ($name === 'Yellow Mushroom'){
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            if ($adquired->sideEffect1?->name === 'Gluttony') $adquired->side_effect_id_1 = null;
            if ($adquired->sideEffect2?->name === 'Gluttony') $adquired->side_effect_id_2 = null;
            if ($adquired->sideEffect3?->name === 'Gluttony') $adquired->side_effect_id_3 = null;
            $adquired->save();
        } elseif ($name === 'Red Mushroom') {
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            if ($adquired->sideEffect1?->name === 'Starving') $adquired->side_effect_id_1 = null;
            if ($adquired->sideEffect2?->name === 'Starving') $adquired->side_effect_id_2 = null;
            if ($adquired->sideEffect3?->name === 'Starving') $adquired->side_effect_id_3 = null;
            $adquired->save();
        }

        $bagItem->reduceQuantity(1);

        return [
            'message' => 'Status effects removed',
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    private function applyAttackUp(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;

        if (! $adquired->relationLoaded('xuxemon')) {
            $adquired->load('xuxemon');
        }

        // effect_value es un valor plano de puntos de defensa bonus a añadir
        $amount = max(0, (int) $item->effect_value);

        $previousBonus  = (int) $adquired->bonus_attack;
        $newBonus       = $previousBonus + $amount;

        $adquired->bonus_attack = $newBonus;
        $adquired->save();
        $this->applySideEffects($adquired);

        $bagItem->reduceQuantity(1);

        return [
            'previous_attack'   => $previousBonus,
            'attack_gained'     => $amount,
            'current_attack'    => $adquired->attack,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }
    private function applyDefenseUp(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;

        if (! $adquired->relationLoaded('xuxemon')) {
            $adquired->load('xuxemon');
        }

        // effect_value es un valor plano de puntos de defensa bonus a añadir
        $amount = max(0, (int) $item->effect_value);

        $previousBonus  = (int) $adquired->bonus_defense;
        $newBonus       = $previousBonus + $amount;

        $adquired->bonus_defense = $newBonus;
        $adquired->save();
        $this->applySideEffects($adquired);

        $bagItem->reduceQuantity(1);

        return [
            'previous_defense'   => $adquired->getOriginal('bonus_defense') !== null
                                        ? ($adquired->xuxemon?->defense ?? 0) + (int) round(($adquired->level - 1) * 1.2) + $previousBonus
                                        : $previousBonus,
            'defense_gained'     => $amount,
            'current_defense'    => $adquired->defense,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    private function applyHealing(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $item = $bagItem->item;

        // Asegurar que la relación xuxemon esté cargada (necesaria para getHpAttribute)
        if (! $adquired->relationLoaded('xuxemon')) {
            $adquired->load('xuxemon');
        }

        // effect_value es el % de curación sobre la vida máxima
        $percentage = max(0, (int) $item->effect_value);

        // max_hp = xuxemon->hp (base) + bonus_hp + bonus por nivel (via accessor del modelo)
        $maxHp      = $adquired->hp;
        $currentHp  = (int) $adquired->current_hp;

        // Calcular cantidad curada (redondeado al entero más cercano)
        $healAmount = (int) round($maxHp * $percentage / 100);

        // Aplicar curación sin superar el máximo
        $newHp = min($currentHp + $healAmount, $maxHp);

        $adquired->current_hp = $newHp;
        $adquired->save();
        $this->applySideEffects($adquired);
        // Consumir 1 unidad del ítem
        $bagItem->reduceQuantity(1);

        return [
            'previous_hp'        => $currentHp,
            'healed_amount'      => $newHp - $currentHp,
            'current_hp'         => $newHp,
            'max_hp'             => $maxHp,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
        ];
    }

    private function useSpecialMeat(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        // Check if the Xuxemon has the side effect 'Gluttony'
        $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
        $hasGluttony = (
            ($adquired->sideEffect1?->name ?? null) === 'Gluttony' ||
            ($adquired->sideEffect2?->name ?? null) === 'Gluttony' ||
            ($adquired->sideEffect3?->name ?? null) === 'Gluttony'
        );
        if ($hasGluttony) {
            return [
                'error' => true,
                'message' => 'Your Xuxemon is affected by Gluttony and cannot eat Special Meat.',
                'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
                'gluttony_blocked' => true,
            ];
        }
        
        $progress = ((int) $adquired->requirement_progress) + 1;
        // Penalización: si tiene Starving, para la evolución se considera progress-2
        $hasStarving = (
            ($adquired->sideEffect1?->name ?? null) === 'Starving' ||
            ($adquired->sideEffect2?->name ?? null) === 'Starving' ||
            ($adquired->sideEffect3?->name ?? null) === 'Starving'
        );
        $progressForEvolution = $hasStarving ? $progress - 2 : $progress;
        $newSize = Size::resolveForProgress($progressForEvolution);
        $adquired->requirement_progress = $progress;
        if ($newSize) {
            $adquired->size_id = $newSize->id;
        }
        $adquired->save();
        $this->applySideEffects($adquired);

        $bagItem->reduceQuantity(1);

        return [
            'xuxemon_size' => $newSize?->size ?? 'Small',
            'requirement_progress' => $adquired->requirement_progress,
            'remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0,
            'starving_penalty_applied' => $hasStarving,
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
