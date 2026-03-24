<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AdquiredXuxemonSeeder extends Seeder
{
    public function run(): void
    {
        $users = ['#Nipah1983', '#Marc1987', '#Liqi1990', '#Pau2000'];

        $goreMagalaId = DB::table('xuxemons')->where('name', 'Gore Magala')->value('id');
        $paralysisId = DB::table('status_effects')->where('name', 'Paralysis')->value('id');

        if (! $goreMagalaId || ! $paralysisId) {
            return;
        }

        foreach ($users as $userId) {
            DB::table('adquired_xuxemons')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'xuxemon_id' => $goreMagalaId,
                ],
                [
                    'level' => 1,
                    'experience' => 0,
                    'bonus_hp' => 7,
                    'bonus_attack' => 7,
                    'bonus_defense' => 7,
                    'status_effect_id' => $paralysisId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
