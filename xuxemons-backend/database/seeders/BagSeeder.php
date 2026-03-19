<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Item;

class BagSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = ['#Nipah1983', '#Marc1987', '#Liqi1990', '#Pau2000'];
        
        foreach ($users as $userId) {
            Bag::create([
                'user_id' => $userId,
                'max_slots' => 20,
            ]);
        }

        $items = Item::all();

        foreach ($users as $userId) {
            $bag = Bag::where('user_id', $userId)->first();
            if (!$bag) {
                continue;
            }

            foreach ($items as $index => $item) {
                $effectType = strtolower($item->effect_type ?? '');

                if ($effectType === 'revive') {
                    $quantity = 1;
                } else if ($effectType === 'evolve') {
                    $quantity = 9;
                } else if ($effectType === 'remove status effects') {
                    $quantity = 2;
                } elseif ($index === 0) {
                    $quantity = 6;
                } else {
                    $quantity = 5;
                }

                BagItem::create([
                    'bag_id' => $bag->id,
                    'item_id' => $item->id,
                    'quantity' => $quantity,
                ]);
            }
        }
    }
}
