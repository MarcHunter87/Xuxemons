<?php

namespace App\Http\Controllers;

use App\Models\DailyRewardNotification;
use App\Models\Item;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

// Sirve para manejar las notificaciones de recompensa diaria
class DailyRewardNotificationController extends Controller
{
    // Sirve para obtener las notificaciones de recompensa diaria pendientes
    public function pending(): JsonResponse
    {
        // Se obtiene el usuario autenticado
        /** @var User|null $user */
        $user = Auth::guard('api')->user();

        // Si el usuario no está autenticado o no es un jugador, se devuelve un error
        if (! $user || $user->role !== 'player') {
            return response()->json(['data' => null]);
        }

        // Se obtiene la notificación de recompensa diaria pendiente
        $notification = DailyRewardNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('shown_at')
            ->orderBy('reward_date')
            ->orderBy('id')
            ->first();

        // Si no se encontró la notificación, se devuelve un error
        if (! $notification) {
            return response()->json(['data' => null]);
        }

        // Se obtienen los items de la notificación
        $rawItems = collect($notification->items ?? []);
        $itemIds = $rawItems
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values();

        // Se obtienen los items por ID
        $itemsById = Item::query()
            ->whereIn('id', $itemIds)
            ->get(['id', 'effect_type'])
            ->keyBy('id');

        // Se mapean los items
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

        // Se obtiene el item de la gacha ticket
        $gachaTicketItem = Item::query()->where('effect_type', 'Gacha Ticket')->first();

        // Se devuelve la respuesta
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

    // Sirve para aceptar una notificación de recompensa diaria
    public function acknowledge(int $id): JsonResponse
    {
        // Se obtiene el usuario autenticado
        /** @var User|null $user */
        $user = Auth::guard('api')->user();

        // Si el usuario no está autenticado o no es un jugador, se devuelve un error
        if (! $user || $user->role !== 'player') {
            return response()->json(['message' => 'Notification not found'], 404);
        }

        // Se obtiene la notificación de recompensa diaria
        $notification = DailyRewardNotification::query()
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        // Si no se encontró la notificación, se devuelve un error
        if (! $notification) {
            return response()->json(['message' => 'Notification not found'], 404);
        }

        // Se elimina la notificación de recompensa diaria
        $notification->delete();

        // Se devuelve la respuesta
        return response()->json(['message' => 'Daily rewards notification removed']);
    }
}