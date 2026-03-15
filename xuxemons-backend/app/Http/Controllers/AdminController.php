<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
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
}
