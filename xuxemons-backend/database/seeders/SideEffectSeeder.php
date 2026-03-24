<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SideEffectSeeder extends Seeder
{
    public function run(): void
    {
        $effects = [
            [
                'name'        => 'Sugar Drop',
                'description' => 'Has a 5% chance of being applied when consuming an item. The Xuxemon requires 2 more Special Meat per level to grow.',
                'icon_path'   => 'side effects/suggardrop.png',
                'apply_chance' => 5,
            ],
            [
                'name'        => 'Gluttony',
                'description' => 'Has a 15% chance of being applied when consuming an item. The Xuxemon cannot eat Special Meat.',
                'icon_path'   => 'side effects/gluttony.png',
                'apply_chance' => 15,
            ],
        ];

        foreach ($effects as $effect) {
            DB::table('side_effects')->updateOrInsert(
                ['name' => $effect['name']],
                [
                    'description' => $effect['description'],
                    'icon_path'   => $effect['icon_path'],
                    'apply_chance' => $effect['apply_chance'],
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]
            );
        }
    }
}
