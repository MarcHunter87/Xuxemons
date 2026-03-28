<?php

namespace App\Console\Commands;

use App\Models\DailyReward;
use App\Models\User;
use App\Models\Item;
use Illuminate\Console\Command;

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

                User::where('role', 'player')
                    ->where('is_active', true)
                    ->chunk(500, function ($players) use ($item, $reward) {
                        foreach ($players as $player) {
                            $bagItem = $player->bag->bagItems()
                                ->firstOrCreate(['item_id' => $item->id]);

                            $bagItem->quantity = min($bagItem->quantity + $reward->quantity, $item->max_quantity);
                            $bagItem->save();
                        }
                    });

                $this->info('All daily Gacha Tickets have been distributed');
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Error processing daily xuxemon rewards: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
