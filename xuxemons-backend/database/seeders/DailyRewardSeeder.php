<?php

namespace Database\Seeders;

use App\Models\Item;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DailyRewardSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $gachaTicketId = Item::query()
            ->where('effect_type', 'Gacha Ticket')
            ->value('id');

        DB::table('daily_rewards')->insert([
            [
                'time' => '08:00:00',
                'quantity' => 10,
                'item_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'time' => '08:00:00',
                'quantity' => 1,
                'item_id' => $gachaTicketId,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}

