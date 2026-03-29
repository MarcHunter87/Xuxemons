<?php

namespace App\Http\Controllers;

use App\Models\DailyRewardNotification;
use App\Models\Item;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class DailyRewardNotificationController extends Controller
{
    public function pending(): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::guard('api')->user();

        if (! $user || $user->role !== 'player') {
            return response()->json(['data' => null]);
        }

        $notification = DailyRewardNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('shown_at')
            ->orderBy('reward_date')
            ->orderBy('id')
            ->first();

        if (! $notification) {
            return response()->json(['data' => null]);
        }

        $rawItems = collect($notification->items ?? []);
        $itemIds = $rawItems
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values();

        $itemsById = Item::query()
            ->whereIn('id', $itemIds)
            ->get(['id', 'effect_type'])
            ->keyBy('id');

        $items = $rawItems
            ->map(function ($item) use ($itemsById) {
                $itemId = (int) ($item['item_id'] ?? 0);

                return [
                    'item_id' => $itemId,
                    'name' => $item['name'] ?? 'Item',
                    'icon_path' => $item['icon_path'] ?? null,
                    'effect_type' => $item['effect_type'] ?? $itemsById->get($itemId)?->effect_type,
                    'quantity' => (int) ($item['quantity'] ?? 0),
                ];
            })
            ->filter(fn ($item) => (int) ($item['quantity'] ?? 0) > 0)
            ->values()
            ->all();

        $gachaTicketItem = Item::query()->where('effect_type', 'Gacha Ticket')->first();

        return response()->json([
            'data' => [
                'id' => $notification->id,
                'reward_date' => optional($notification->reward_date)->toDateString(),
                'gacha_ticket' => [
                    'name' => $gachaTicketItem?->name ?? 'Gacha Ticket',
                    'icon_path' => $gachaTicketItem?->icon_path,
                    'effect_type' => $gachaTicketItem?->effect_type ?? 'Gacha Ticket',
                    'quantity' => (int) $notification->gacha_ticket_quantity,
                ],
                'items' => $items,
            ],
        ]);
    }

    public function acknowledge(int $id): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::guard('api')->user();

        if (! $user || $user->role !== 'player') {
            return response()->json(['message' => 'Notification not found'], 404);
        }

        $notification = DailyRewardNotification::query()
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (! $notification) {
            return response()->json(['message' => 'Notification not found'], 404);
        }

        $notification->delete();

        return response()->json(['message' => 'Daily rewards notification removed']);
    }
}