<?php

namespace App\Console\Commands;

use App\Models\Bag;
use App\Models\DailyReward;
use App\Models\DailyRewardNotification;
use App\Models\Item;
use App\Models\User;
use Illuminate\Console\Command;
use Symfony\Component\Console\Command\Command as SymfonyCommand;

class ProcessDailyXuxemons extends Command
{
    protected $signature = 'app:process-daily-xuxemons';

    protected $description = 'Distribute the daily Gacha Ticket to all active players';

    // Sirve para procesar los xuxemons diariamente
    public function handle(): int
    {
        try {
            // Se obtiene el reward diario de xuxemons
            $reward = DailyReward::where('reward_type', 'daily_xuxemon')->first();

            if ($reward) {
                // Se obtiene el item
                $item = Item::find($reward->item_id);
                // Se obtiene la fecha de recompensa
                $rewardDate = now()->toDateString();

                // Se obtienen los jugadores
                User::where('role', 'player')
                    ->where('is_active', true)
                    ->chunk(500, function ($players) use ($item, $reward, $rewardDate) {
                        foreach ($players as $player) {
                            // Se obtiene la mochila del jugador
                            if (! $item) {
                                continue;
                            }

                            // Se obtiene la mochila del jugador
                            $bag = Bag::firstOrCreate(
                                ['user_id' => $player->id],
                                ['max_slots' => Bag::MAX_SLOTS]
                            );

                            // Se obtiene el item de la mochila
                            $bagItem = $bag->bagItems()
                                ->firstOrCreate(['item_id' => $item->id]);

                            // Se obtiene la cantidad existente del item
                            $beforeQty = (int) $bagItem->quantity;
                            // Se obtiene la cantidad máxima del item
                            $maxQty = max(1, (int) ($item->max_quantity ?? 1));
                            // Se calcula la cantidad objetivo del item
                            $targetQty = min($beforeQty + (int) $reward->quantity, $maxQty);
                            // Se calcula la cantidad agregada del item
                            $addedQty = max(0, $targetQty - $beforeQty);

                            // Se actualiza la cantidad del item
                            $bagItem->quantity = $targetQty;
                            $bagItem->save();

                            // Si la cantidad agregada es mayor a 0, se actualiza la notificación diaria
                            if ($addedQty > 0) {
                                $this->upsertDailyNotification($player->id, $rewardDate, $addedQty);
                            }
                        }
                    });

                // Se informa que todos los xuxemons han sido distribuidos
                $this->info('All daily Gacha Tickets have been distributed');
            }

            // Se devuelve el resultado
            return SymfonyCommand::SUCCESS;
        } catch (\Exception $e) {
            // Se informa del error
            $this->error('Error processing daily xuxemon rewards: ' . $e->getMessage());
            // Se devuelve el resultado
            return SymfonyCommand::FAILURE;
        }
    }

    // Sirve para actualizar la notificación diaria
    private function upsertDailyNotification(string $userId, string $rewardDate, int $addedGachaQty): void
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
                'gacha_ticket_quantity' => $addedGachaQty,
                'items' => [],
                'shown_at' => null,
            ]);

            return;
        }

        // Se actualiza la cantidad de Gacha Tickets
        $notification->gacha_ticket_quantity = (int) $notification->gacha_ticket_quantity + $addedGachaQty;
        // Se actualiza la fecha de la notificación
        $notification->shown_at = null;
        $notification->save();
    }
}
