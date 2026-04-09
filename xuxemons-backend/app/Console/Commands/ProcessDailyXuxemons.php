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

    public function handle(): int
    {
        try {
            $reward = DailyReward::where('reward_type', 'daily_xuxemon')->first();

            if ($reward) {
                $item = Item::find($reward->item_id);
                $rewardDate = now()->toDateString();

                User::where('role', 'player')
                    ->where('is_active', true)
                    ->chunk(500, function ($players) use ($item, $reward, $rewardDate) {
                        foreach ($players as $player) {
                            if (! $item) {
                                continue;
                            }

                            $bag = Bag::firstOrCreate(
                                ['user_id' => $player->id],
                                ['max_slots' => Bag::MAX_SLOTS]
                            );

                            $bagItem = $bag->bagItems()
                                ->firstOrCreate(['item_id' => $item->id]);

                            $beforeQty = (int) $bagItem->quantity;
                            $maxQty = max(1, (int) ($item->max_quantity ?? 1));
                            $targetQty = min($beforeQty + (int) $reward->quantity, $maxQty);
                            $addedQty = max(0, $targetQty - $beforeQty);

                            $bagItem->quantity = $targetQty;
                            $bagItem->save();

                            if ($addedQty > 0) {
                                $this->upsertDailyNotification($player->id, $rewardDate, $addedQty);
                            }
                        }
                    });

                $this->info('All daily Gacha Tickets have been distributed');
            }

            return SymfonyCommand::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Error processing daily xuxemon rewards: ' . $e->getMessage());
            return SymfonyCommand::FAILURE;
        }
    }

    private function upsertDailyNotification(string $userId, string $rewardDate, int $addedGachaQty): void
    {
        $notification = DailyRewardNotification::query()
            ->where('user_id', $userId)
            ->where('reward_date', $rewardDate)
            ->first();

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

        $notification->gacha_ticket_quantity = (int) $notification->gacha_ticket_quantity + $addedGachaQty;
        $notification->shown_at = null;
        $notification->save();
    }
}
