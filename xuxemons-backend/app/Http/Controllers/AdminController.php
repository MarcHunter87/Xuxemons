<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Item;
use App\Models\User;
use App\Models\Xuxemon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Throwable;

class AdminController extends Controller
{
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

    private function calculateUsedSlots($bagItems): int
    {
        $usedSlots = 0;
        foreach ($bagItems as $bagItem) {
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
}
