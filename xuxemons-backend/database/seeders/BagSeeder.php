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
        
        $liqi_bag = Bag::where('user_id', '#Liqi1990')->first();
        
        foreach ($items as $index => $item) {
            if (strtolower($item->effect_type) === 'revive') {
                $quantity = 1;
            } elseif ($index === 0) {
                $quantity = 6;
            } else {
                $quantity = 5;
            }
            
            BagItem::create([
                'bag_id' => $liqi_bag->id,
                'item_id' => $item->id,
                'quantity' => $quantity,
            ]);
        }
    }
}
