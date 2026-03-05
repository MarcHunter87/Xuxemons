<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StatusEffectSeeder extends Seeder
{
    public function run(): void
    {
        $effects = [
            [
                'name'        => 'Paralysis',
                'description' => 'Immobilizes the target, preventing actions for a short duration.',
                'icon_path'   => 'status effects/Paralysis.png',
            ],
            [
                'name'        => 'Sleep',
                'description' => 'Puts the target to sleep. The next hit deals bonus damage.',
                'icon_path'   => 'status effects/Sleep.png',
            ],
            [
                'name'        => 'Confusion',
                'description' => 'Confuses the target, causing it to sometimes attack itself.',
                'icon_path'   => 'status effects/Confusion.png',
            ],
        ];

        foreach ($effects as $effect) {
            DB::table('status_effects')->updateOrInsert(
                ['name' => $effect['name']],
                [
                    'description' => $effect['description'],
                    'icon_path'   => $effect['icon_path'],
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]
            );
        }
    }
}
