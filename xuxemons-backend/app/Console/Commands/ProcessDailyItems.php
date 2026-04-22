<?php

namespace App\Console\Commands;

use App\Models\Bag;
use App\Models\BagItem;
use App\Models\DailyReward;
use App\Models\DailyRewardNotification;
use App\Models\Item;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Symfony\Component\Console\Command\Command as SymfonyCommand;

class ProcessDailyItems extends Command
{
    protected $signature = 'app:process-daily-items';

    protected $description = 'Distribute the daily Items to all active players';

    // Sirve para procesar los items diariamente
    public function handle(): int
    {
        try {
            // Se obtiene el reward diario de items
            $reward = DailyReward::where('reward_type', 'daily_items')->first();

            if ($reward) {
                // Se obtiene el número de intentos por jugador
                $attemptsPerPlayer = max(0, (int) $reward->quantity);
                // Se obtiene la fecha de recompensa
                $rewardDate = now()->toDateString();
                // Se obtiene el pool de items
                $itemPool = Item::query()
                    ->where('effect_type', '!=', 'Gacha Ticket')
                    ->get();

                // Si el número de intentos por jugador es mayor a 0 y el pool de items no está vacío, se procesan los items
                if ($attemptsPerPlayer > 0 && $itemPool->isNotEmpty()) {
                    // Se obtienen los jugadores
                    User::where('role', 'player')
                        ->where('is_active', true)
                        ->chunk(500, function ($players) use ($itemPool, $attemptsPerPlayer, $rewardDate) {
                            foreach ($players as $player) {
                                // Se obtiene la mochila del jugador
                                $bag = Bag::firstOrCreate(
                                    ['user_id' => $player->id],
                                    ['max_slots' => Bag::MAX_SLOTS]
                                );

                                // Se inicializa el array de items recibidos
                                $receivedItems = [];

                                // Se recorren los intentos por jugador
                                for ($i = 0; $i < $attemptsPerPlayer; $i++) {
                                    // Se obtiene un item aleatorio del pool
                                    /** @var Item $randomItem */
                                    $randomItem = $itemPool->random();

                                    // Si se puede agregar el item a la mochila, se agrega
                                    if ($this->tryAddOneItemToBag($bag, $randomItem)) {
                                        // Se obtiene el ID del item
                                        $itemId = (int) $randomItem->id;
                                        if (! isset($receivedItems[$itemId])) {
                                            // Se agrega el item al array de items recibidos
                                            $receivedItems[$itemId] = [
                                                'item_id' => $itemId,
                                                'name' => $randomItem->name,
                                                'icon_path' => $randomItem->icon_path,
                                                'effect_type' => $randomItem->effect_type,
                                                'quantity' => 0,
                                            ];
                                        }

                                        // Se incrementa la cantidad del item
                                        $receivedItems[$itemId]['quantity']++;
                                    }
                                }

                                // Si se recibieron items, se actualiza la notificación diaria
                                if (! empty($receivedItems)) {
                                    // Se actualiza la notificación diaria
                                    $this->upsertDailyNotification($player->id, $rewardDate, array_values($receivedItems));
                                }
                            }
                        });

                    // Se informa que todos los items han sido distribuidos
                    $this->info("All daily items have been distributed");
                }
            }

            // Se devuelve el resultado
            return SymfonyCommand::SUCCESS;
        } catch (\Exception $e) {
            // Se informa del error
            $this->error('Error processing daily item rewards: ' . $e->getMessage());
            // Se devuelve el resultado
            return SymfonyCommand::FAILURE;
        }
    }

    // Sirve para intentar agregar un item a la mochila
    private function tryAddOneItemToBag(Bag $bag, Item $item): bool
    {
        // Se obtienen los items de la mochila
        $bagItems = BagItem::where('bag_id', $bag->id)
            ->with('item')
            ->get();

        // Se calcula el número de slots usados
        $usedSlots = $this->calculateUsedSlots($bagItems);

        // Se obtiene el item existente
        $existing = BagItem::where('bag_id', $bag->id)
            ->where('item_id', $item->id)
            ->first();

        // Se obtiene la cantidad existente del item
        $existingQty = $existing ? (int) $existing->quantity : 0;

        // Se calcula la cantidad permitida de adición del item
        $allowedAddQty = $this->calculateAllowedQuantity($bag, $item, $existingQty, $usedSlots);

        // Si la cantidad permitida de adición del item es menor a 1, se devuelve false
        if ($allowedAddQty < 1) {
            return false;
        }

        // Si el item existe, se incrementa la cantidad
        if ($existing) {
            $existing->quantity += 1;
            $existing->save();
            return true;
        }

        // Se crea el item en la mochila
        BagItem::create([
            'bag_id' => $bag->id,
            'item_id' => $item->id,
            'quantity' => 1,
        ]);

        return true;
    }

    // Sirve para calcular el número de slots usados
    private function calculateUsedSlots(Collection $bagItems): int
    {
        $usedSlots = 0;

        // Se recorren los items de la mochila
        foreach ($bagItems as $bagItem) {
            // Si el item no existe o está excluido del inventario del jugador, se continua
            if (! $bagItem->item || $bagItem->item->excludedFromPlayerInventory()) {
                continue;
            }

            // Si el item es stackeable, se calcula el número de slots usados
            if ($bagItem->item->is_stackable) {
                $maxQty = max(1, (int) ($bagItem->item->max_quantity ?? 1));
                $usedSlots += (int) ceil($bagItem->quantity / $maxQty);
            } else {
                // Si el item no es stackeable, se calcula el número de slots usados
                $usedSlots += (int) $bagItem->quantity;
            }
        }

        return $usedSlots;
    }

    // Sirve para calcular la cantidad permitida de adición del item
    private function calculateAllowedQuantity(Bag $bag, Item $item, int $existingQty, int $usedSlots): int
    {
        // Si el item es stackeable, se calcula la cantidad permitida de adición del item
        if ($item->is_stackable) {
            $maxQty = max(1, (int) ($item->max_quantity ?? 1));
            $oldStacks = $existingQty > 0 ? (int) ceil($existingQty / $maxQty) : 0;
            $freeStacksForItem = max(0, $bag->max_slots - ($usedSlots - $oldStacks));
            // Se calcula la cantidad permitida de adición del item
            $maxTotalQty = $freeStacksForItem * $maxQty;
            return max(0, $maxTotalQty - $existingQty);
        }

        // Si el item no es stackeable, se calcula la cantidad permitida de adición del item
        $freeSlotsForItem = max(0, $bag->max_slots - ($usedSlots - $existingQty));
        return max(0, $freeSlotsForItem - $existingQty);
    }

    // Sirve para actualizar la notificación diaria
    private function upsertDailyNotification(string $userId, string $rewardDate, array $receivedItems): void
    {
        // Se obtiene la notificación diaria
        $notification = DailyRewardNotification::query()
            ->where('user_id', $userId)
            ->where('reward_date', $rewardDate)
            ->first();

        // Si no se encontró la notificación, se crea
        if (! $notification) {
            DailyRewardNotification::create([
                'user_id' => $userId,
                'reward_date' => $rewardDate,
                'gacha_ticket_quantity' => 0,
                'items' => $receivedItems,
                'shown_at' => null,
            ]);

            return;
        }

        // Se unen los items recibidos con los items existentes
        $mergedItems = collect($notification->items ?? [])
            ->keyBy(fn ($item) => (int) ($item['item_id'] ?? 0))
            ->all();

        // Se recorren los items recibidos
        foreach ($receivedItems as $item) {
            $itemId = (int) ($item['item_id'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 0);

            // Si el item no existe o la cantidad es menor a 1, se continua
            if ($itemId <= 0 || $quantity <= 0) {
                continue;
            }

            // Si el item no existe, se crea
            if (! isset($mergedItems[$itemId])) {
                $mergedItems[$itemId] = [
                    'item_id' => $itemId,
                    'name' => $item['name'] ?? 'Item',
                    'icon_path' => $item['icon_path'] ?? null,
                    'effect_type' => $item['effect_type'] ?? null,
                    'quantity' => 0,
                ];
            }

            // Si el efecto del item no existe, se agrega
            if (empty($mergedItems[$itemId]['effect_type']) && ! empty($item['effect_type'])) {
                $mergedItems[$itemId]['effect_type'] = $item['effect_type'];
            }

            // Se incrementa la cantidad del item
            $mergedItems[$itemId]['quantity'] = (int) $mergedItems[$itemId]['quantity'] + $quantity;
        }

        // Se actualiza la notificación diaria
        $notification->items = array_values($mergedItems);
        $notification->shown_at = null;
        $notification->save();
    }
}
