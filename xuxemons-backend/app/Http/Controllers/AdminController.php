<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Attack;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\DailyReward;
use App\Models\Item;
use App\Models\Size;
use App\Models\StatusEffect;
use App\Models\Type;
use App\Models\User;
use App\Models\Xuxemon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class AdminController extends Controller
{
    public function getAllDailyRewards(): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $rewards = DailyReward::query()
                ->with('item:id,name')
                ->orderBy('id')
                ->get(['id', 'time', 'quantity', 'item_id'])
                ->map(fn (DailyReward $reward) => [
                    'id' => $reward->id,
                    'time' => $reward->time,
                    'quantity' => (int) $reward->quantity,
                    'item_id' => $reward->item_id,
                    'item_name' => $reward->item?->name,
                ]);

            return response()->json(['data' => $rewards]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve daily rewards',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function getDailyReward(int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $reward = DailyReward::query()
                ->with('item:id,name')
                ->find($id);
            if (! $reward) {
                return response()->json(['message' => 'Daily reward not found'], 404);
            }

            return response()->json([
                'data' => [
                    'id' => $reward->id,
                    'time' => $reward->time,
                    'quantity' => (int) $reward->quantity,
                    'item_id' => $reward->item_id,
                    'item_name' => $reward->item?->name,
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve daily reward',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function updateDailyReward(Request $request, int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $reward = DailyReward::query()->find($id);
            if (! $reward) {
                return response()->json(['message' => 'Daily reward not found'], 404);
            }

            $validated = $request->validate([
                'time' => 'required|date_format:H:i',
                'quantity' => 'required|integer|min:1',
            ]);

            $reward->update([
                'time' => $validated['time'].':00',
                'quantity' => (int) $validated['quantity'],
            ]);
            $reward->loadMissing('item:id,name');

            return response()->json([
                'message' => 'Daily reward updated successfully',
                'data' => [
                    'id' => $reward->id,
                    'time' => $reward->time,
                    'quantity' => (int) $reward->quantity,
                    'item_id' => $reward->item_id,
                    'item_name' => $reward->item?->name,
                ],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not update daily reward',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function getAllUsers(): JsonResponse
    {
        try {
            /** @var User $user */
            $user = Auth::guard('api')->user();

            if (! $user->is_admin) {
                return response()->json([
                    'message' => 'Unauthorized',
                ], 403);
            }

            $users = User::where('is_active', true)
                ->where('role', 'player')
                ->select('id', 'name', 'surname', 'email', 'role')
                ->get();

            return response()->json([
                'data' => $users,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve users',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function checkBagStatus(string $userId): JsonResponse
    {
        try {
            /** @var User $user */
            $user = Auth::guard('api')->user();

            if (! $user->is_admin) {
                return response()->json([
                    'message' => 'Unauthorized',
                ], 403);
            }

            $targetUser = User::find($userId);
            if (! $targetUser) {
                return response()->json([
                    'message' => 'User not found',
                ], 404);
            }

            $bag = $targetUser->bag;
            if (! $bag) {
                return response()->json([
                    'message' => 'User has no bag',
                ], 404);
            }

            $bagItems = $bag->bagItems()->with('item')->get();
            $usedSlots = $this->calculateUsedSlots($bagItems);

            return response()->json([
                'data' => [
                    'max_slots' => $bag->max_slots,
                    'used_slots' => $usedSlots,
                    'available_slots' => $bag->max_slots - $usedSlots,
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not check bag status',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function banUser(string $userId): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $targetUser = User::where('id', $userId)
                ->where('is_active', true)
                ->first();

            if (! $targetUser) {
                return response()->json(['message' => 'User not found'], 404);
            }

            $targetUser->update([
                'is_active' => false,
                'email' => '',
            ]);

            return response()->json([
                'message' => 'User banned successfully.',
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => "Couldn't ban user.",
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function giveItemToUser(Request $request, string $userId): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $targetUser = User::find($userId);
            if (! $targetUser) {
                return response()->json(['message' => 'User not found'], 404);
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
                ['user_id' => $targetUser->id],
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
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Error giving item',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getCreationMeta(): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $types = Type::query()->select('id', 'name', 'icon_path')->orderBy('name')->get();
            $attacks = Attack::query()
                ->with('statusEffect:id,name,icon_path')
                ->get()
                ->sortBy(fn (Attack $a) => ($a->statusEffect?->name ?? "\u{FFFF}") . ' ' . $a->name)
                ->values()
                ->map(fn (Attack $a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'icon_path' => $a->statusEffect?->icon_path,
                ]);
            $statusEffects = StatusEffect::query()->select('id', 'name', 'icon_path')->orderBy('name')->get();

            return response()->json([
                'data' => [
                    'types' => $types,
                    'attacks' => $attacks,
                    'status_effects' => $statusEffects,
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve creation metadata',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function createItem(Request $request): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:items,name',
                'description' => 'required|string',
                'effect_type' => 'required|in:Heal,DMG Up,Defense Up,Gacha Ticket,Remove Status Effects,Apply Status Effects,Evolve',
                'effect_value' => 'nullable|integer|min:0',
                'is_stackable' => 'required|boolean',
                'max_quantity' => 'required|integer|min:1|max:99',
                'status_effect_id' => 'nullable|exists:status_effects,id',
                'icon' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:10240',
            ]);

            $name = trim((string) $validated['name']);
            $isStackable = (bool) $validated['is_stackable'];
            $maxLimit = $validated['effect_type'] === 'Gacha Ticket' ? 99 : 5;
            $maxQuantity = $isStackable ? min($maxLimit, max(1, (int) $validated['max_quantity'])) : 1;

            $iconFile = $request->file('icon');
            $ext = $iconFile->getClientOriginalExtension();
            $filename = Str::slug($name, '_').'.'.$ext;
            $publicPath = public_path('items');
            if (! file_exists($publicPath)) {
                mkdir($publicPath, 0755, true);
            }
            $iconFile->move($publicPath, $filename);

            $item = Item::create([
                'name' => $name,
                'description' => trim((string) $validated['description']),
                'effect_type' => $validated['effect_type'],
                'effect_value' => $validated['effect_value'] ?? null,
                'is_stackable' => $isStackable,
                'max_quantity' => $maxQuantity,
                'status_effect_id' => $validated['status_effect_id'] ?? null,
                'icon_path' => 'items/'.$filename,
            ]);

            return response()->json([
                'message' => 'Item created successfully',
                'data' => $item->load('statusEffect'),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not create item',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function createXuxemon(Request $request): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validated = $request->validate([
                'name' => 'required|string|max:128|unique:xuxemons,name',
                'description' => 'nullable|string',
                'type_id' => 'required|exists:types,id',
                'attack_1_id' => 'required|exists:attacks,id|different:attack_2_id',
                'attack_2_id' => 'required|exists:attacks,id|different:attack_1_id',
                'hp' => 'required|integer|min:1',
                'attack' => 'required|integer|min:1',
                'defense' => 'required|integer|min:1',
                'icon' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:10240',
            ]);

            $name = trim((string) $validated['name']);
            $iconFile = $request->file('icon');
            $ext = $iconFile->getClientOriginalExtension();
            $filename = Str::slug($name, '_').'.'.$ext;
            $publicPath = public_path('xuxemons');
            if (! file_exists($publicPath)) {
                mkdir($publicPath, 0755, true);
            }
            $iconFile->move($publicPath, $filename);

            $xuxemon = Xuxemon::create([
                'name' => $name,
                'description' => $validated['description'] ? trim((string) $validated['description']) : null,
                'type_id' => (int) $validated['type_id'],
                'attack_1_id' => (int) $validated['attack_1_id'],
                'attack_2_id' => (int) $validated['attack_2_id'],
                'hp' => (int) $validated['hp'],
                'attack' => (int) $validated['attack'],
                'defense' => (int) $validated['defense'],
                'icon_path' => 'xuxemons/'.$filename,
            ]);

            return response()->json([
                'message' => 'Xuxemon created successfully',
                'data' => $xuxemon->load(['type', 'attack1', 'attack2']),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not create Xuxemon',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function getItem(int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $item = Item::with('statusEffect')->find($id);
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            return response()->json(['data' => $item]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve item',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function getXuxemon(int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $xuxemon = Xuxemon::with(['type', 'attack1', 'attack2'])->find($id);
            if (! $xuxemon) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            return response()->json(['data' => $xuxemon]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve Xuxemon',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function updateItem(Request $request, int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $item = Item::find($id);
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            $rules = [
                'name' => 'required|string|max:255|unique:items,name,'.$id,
                'description' => 'required|string',
                'effect_type' => 'required|in:Heal,DMG Up,Defense Up,Gacha Ticket,Remove Status Effects,Apply Status Effects,Evolve',
                'effect_value' => 'nullable|integer|min:0',
                'is_stackable' => 'required|boolean',
                'max_quantity' => 'required|integer|min:1|max:99',
                'status_effect_id' => 'nullable|exists:status_effects,id',
                'icon' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:10240',
            ];
            $validated = $request->validate($rules);

            $name = trim((string) $validated['name']);
            $isStackable = (bool) $validated['is_stackable'];
            $maxLimit = $validated['effect_type'] === 'Gacha Ticket' ? 99 : 5;
            $maxQuantity = $isStackable ? min($maxLimit, max(1, (int) $validated['max_quantity'])) : 1;

            $update = [
                'name' => $name,
                'description' => trim((string) $validated['description']),
                'effect_type' => $validated['effect_type'],
                'effect_value' => $validated['effect_value'] ?? null,
                'is_stackable' => $isStackable,
                'max_quantity' => $maxQuantity,
                'status_effect_id' => $validated['status_effect_id'] ?? null,
            ];

            $iconFile = $request->file('icon');
            if ($iconFile) {
                $ext = $iconFile->getClientOriginalExtension();
                $filename = Str::slug($name, '_').'_'.Str::lower(Str::random(8)).'.'.$ext;
                $publicPath = public_path('items');
                if (! file_exists($publicPath)) {
                    mkdir($publicPath, 0755, true);
                }
                $iconFile->move($publicPath, $filename);
                $update['icon_path'] = 'items/'.$filename;
            }

            $item->update($update);

            return response()->json([
                'message' => 'Item updated successfully',
                'data' => $item->fresh()->load('statusEffect'),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not update item',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function updateXuxemon(Request $request, int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $xuxemon = Xuxemon::find($id);
            if (! $xuxemon) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            $rules = [
                'name' => 'required|string|max:128|unique:xuxemons,name,'.$id,
                'description' => 'nullable|string',
                'type_id' => 'required|exists:types,id',
                'attack_1_id' => 'required|exists:attacks,id|different:attack_2_id',
                'attack_2_id' => 'required|exists:attacks,id|different:attack_1_id',
                'hp' => 'required|integer|min:1',
                'attack' => 'required|integer|min:1',
                'defense' => 'required|integer|min:1',
                'icon' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:10240',
            ];
            $validated = $request->validate($rules);

            $name = trim((string) $validated['name']);
            $update = [
                'name' => $name,
                'description' => $validated['description'] ? trim((string) $validated['description']) : null,
                'type_id' => (int) $validated['type_id'],
                'attack_1_id' => (int) $validated['attack_1_id'],
                'attack_2_id' => (int) $validated['attack_2_id'],
                'hp' => (int) $validated['hp'],
                'attack' => (int) $validated['attack'],
                'defense' => (int) $validated['defense'],
            ];

            $iconFile = $request->file('icon');
            if ($iconFile) {
                $ext = $iconFile->getClientOriginalExtension();
                $filename = Str::slug($name, '_').'_'.Str::lower(Str::random(8)).'.'.$ext;
                $publicPath = public_path('xuxemons');
                if (! file_exists($publicPath)) {
                    mkdir($publicPath, 0755, true);
                }
                $iconFile->move($publicPath, $filename);
                $update['icon_path'] = 'xuxemons/'.$filename;
            }

            $xuxemon->update($update);

            return response()->json([
                'message' => 'Xuxemon updated successfully',
                'data' => $xuxemon->fresh()->load(['type', 'attack1', 'attack2']),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not update Xuxemon',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    private function calculateUsedSlots($bagItems): int
    {
        $usedSlots = 0;
        foreach ($bagItems as $bagItem) {
            if (! $bagItem->item || $bagItem->item->excludedFromPlayerInventory()) {
                continue;
            }
            if ($bagItem->item->is_stackable) {
                $maxQty = $bagItem->item->max_quantity ?? 1;
                $slots = ceil($bagItem->quantity / $maxQty);
                $usedSlots += $slots;
            } else {
                $usedSlots += $bagItem->quantity;
            }
        }

        return $usedSlots;
    }

    public function deleteItemCascade(int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $item = Item::find($id);
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            DB::transaction(function () use ($id, $item) {
                BagItem::where('item_id', $id)->delete();
                $item->delete();
            });

            return response()->json(['message' => 'Item deleted']);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not delete item',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function deleteXuxemonCascade(int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $xuxemon = Xuxemon::find($id);
            if (! $xuxemon) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            DB::transaction(function () use ($id, $xuxemon) {
                AdquiredXuxemon::where('xuxemon_id', $id)->delete();
                $xuxemon->delete();
            });

            return response()->json(['message' => 'Xuxemon deleted']);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not delete Xuxemon',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    public function getAllSizes(): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $sizes = Size::orderBy('id')->get();

            return response()->json(['data' => $sizes]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve sizes',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function getSize(int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $size = Size::find($id);
            if (! $size) {
                return response()->json(['message' => 'Size not found'], 404);
            }

            return response()->json(['data' => $size]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not retrieve size',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function updateSize(Request $request, int $id): JsonResponse
    {
        try {
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $size = Size::find($id);
            if (! $size) {
                return response()->json(['message' => 'Size not found'], 404);
            }

            if ($size->size === 'Small') {
                return response()->json(['message' => 'The Small size cannot be edited.'], 403);
            }

            $validated = $request->validate([
                'requirement_progress' => 'required|integer|min:0',
            ]);

            DB::transaction(function () use ($size, $validated) {
                $size->update([
                    'requirement_progress' => (int) $validated['requirement_progress'],
                ]);
                Size::reconcileAllAdquiredXuxemonSizes();
            });

            $size->refresh();

            return response()->json([
                'message' => 'Size updated successfully',
                'data' => $size,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not update size',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }
}
