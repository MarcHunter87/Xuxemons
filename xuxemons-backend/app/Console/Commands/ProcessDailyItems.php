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

    public function handle(): int
    {
        try {
            $reward = DailyReward::where('reward_type', 'daily_items')->first();

            if ($reward) {
                $attemptsPerPlayer = max(0, (int) $reward->quantity);
                $rewardDate = now()->toDateString();
                $itemPool = Item::query()
                    ->where('effect_type', '!=', 'Gacha Ticket')
                    ->get();

                if ($attemptsPerPlayer > 0 && $itemPool->isNotEmpty()) {
                    User::where('role', 'player')
                        ->where('is_active', true)
                        ->chunk(500, function ($players) use ($itemPool, $attemptsPerPlayer, $rewardDate) {
                            foreach ($players as $player) {
                                $bag = Bag::firstOrCreate(
                                    ['user_id' => $player->id],
                                    ['max_slots' => Bag::MAX_SLOTS]
                                );

                                $receivedItems = [];

                                for ($i = 0; $i < $attemptsPerPlayer; $i++) {
                                    /** @var Item $randomItem */
                                    $randomItem = $itemPool->random();

                                    if ($this->tryAddOneItemToBag($bag, $randomItem)) {
                                        $itemId = (int) $randomItem->id;
                                        if (! isset($receivedItems[$itemId])) {
                                            $receivedItems[$itemId] = [
                                                'item_id' => $itemId,
                                                'name' => $randomItem->name,
                                                'icon_path' => $randomItem->icon_path,
                                                'effect_type' => $randomItem->effect_type,
                                                'quantity' => 0,
                                            ];
                                        }

                                        $receivedItems[$itemId]['quantity']++;
                                    }
                                }

                                if (! empty($receivedItems)) {
                                    $this->upsertDailyNotification($player->id, $rewardDate, array_values($receivedItems));
                                }
                            }
                        });

                    $this->info("All daily items have been distributed");
                }
            }

            return SymfonyCommand::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Error processing daily item rewards: ' . $e->getMessage());
            return SymfonyCommand::FAILURE;
        }
    }

    private function tryAddOneItemToBag(Bag $bag, Item $item): bool
    {
        $bagItems = BagItem::where('bag_id', $bag->id)
            ->with('item')
            ->get();

        $usedSlots = $this->calculateUsedSlots($bagItems);

        $existing = BagItem::where('bag_id', $bag->id)
            ->where('item_id', $item->id)
            ->first();

        $existingQty = $existing ? (int) $existing->quantity : 0;

        $allowedAddQty = $this->calculateAllowedQuantity($bag, $item, $existingQty, $usedSlots);

        if ($allowedAddQty < 1) {
            return false;
        }

        if ($existing) {
            $existing->quantity += 1;
            $existing->save();
            return true;
        }

        BagItem::create([
            'bag_id' => $bag->id,
            'item_id' => $item->id,
            'quantity' => 1,
        ]);

        return true;
    }

    private function calculateUsedSlots(Collection $bagItems): int
    {
        $usedSlots = 0;

        foreach ($bagItems as $bagItem) {
            if (! $bagItem->item || $bagItem->item->excludedFromPlayerInventory()) {
                continue;
            }

            if ($bagItem->item->is_stackable) {
                $maxQty = max(1, (int) ($bagItem->item->max_quantity ?? 1));
                $usedSlots += (int) ceil($bagItem->quantity / $maxQty);
            } else {
                $usedSlots += (int) $bagItem->quantity;
            }
        }

        return $usedSlots;
    }

    private function calculateAllowedQuantity(Bag $bag, Item $item, int $existingQty, int $usedSlots): int
    {
        if ($item->is_stackable) {
            $maxQty = max(1, (int) ($item->max_quantity ?? 1));
            $oldStacks = $existingQty > 0 ? (int) ceil($existingQty / $maxQty) : 0;
            $freeStacksForItem = max(0, $bag->max_slots - ($usedSlots - $oldStacks));
            $maxTotalQty = $freeStacksForItem * $maxQty;
            return max(0, $maxTotalQty - $existingQty);
        }

        $freeSlotsForItem = max(0, $bag->max_slots - ($usedSlots - $existingQty));
        return max(0, $freeSlotsForItem - $existingQty);
    }

    private function upsertDailyNotification(string $userId, string $rewardDate, array $receivedItems): void
    {
        $notification = DailyRewardNotification::query()
            ->where('user_id', $userId)
            ->where('reward_date', $rewardDate)
            ->first();

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

        $mergedItems = collect($notification->items ?? [])
            ->keyBy(fn ($item) => (int) ($item['item_id'] ?? 0))
            ->all();

        foreach ($receivedItems as $item) {
            $itemId = (int) ($item['item_id'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 0);

            if ($itemId <= 0 || $quantity <= 0) {
                continue;
            }

            if (! isset($mergedItems[$itemId])) {
                $mergedItems[$itemId] = [
                    'item_id' => $itemId,
                    'name' => $item['name'] ?? 'Item',
                    'icon_path' => $item['icon_path'] ?? null,
                    'effect_type' => $item['effect_type'] ?? null,
                    'quantity' => 0,
                ];
            }

            if (empty($mergedItems[$itemId]['effect_type']) && ! empty($item['effect_type'])) {
                $mergedItems[$itemId]['effect_type'] = $item['effect_type'];
            }

            $mergedItems[$itemId]['quantity'] = (int) $mergedItems[$itemId]['quantity'] + $quantity;
        }

        $notification->items = array_values($mergedItems);
        $notification->shown_at = null;
        $notification->save();
    }
}
