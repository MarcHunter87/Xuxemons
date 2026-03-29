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
        $YianKutKuId = DB::table('xuxemons')->where('name', 'Yian Kut Ku')->value('id');
        $LagiacrusId = DB::table('xuxemons')->where('name', 'Lagiacrus')->value('id');
        $jinDahaadId = DB::table('xuxemons')->where('name', 'Jin Dahaad')->value('id');
        
        $paralysisId = DB::table('status_effects')->where('name', 'Paralysis')->value('id');
        $gluttonyId  = DB::table('side_effects')->where('name', 'Gluttony')->value('id');
        $starvingId  = DB::table('side_effects')->where('name', 'Starving')->value('id');
        $overdoseId  = DB::table('side_effects')->where('name', 'Overdose')->value('id');

        $SizeSmallId = DB::table('sizes')->where('size', 'Small')->value('id');

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
                    'current_hp' => 123,
                    'status_effect_id' => $paralysisId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
            DB::table('adquired_xuxemons')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'xuxemon_id' => $YianKutKuId,
                ],
                [
                    'level' => 1,
                    'experience' => 0,
                    'bonus_hp' => 7,
                    'bonus_attack' => 7,
                    'bonus_defense' => 7,
                    'current_hp' => 123,
                    'side_effect_id_1' => $starvingId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
            DB::table('adquired_xuxemons')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'xuxemon_id' => $LagiacrusId,
                ],
                [
                    'level' => 1,
                    'experience' => 0,
                    'bonus_hp' => 7,
                    'bonus_attack' => 7,
                    'bonus_defense' => 7,
                    'current_hp' => 123,
                    'side_effect_id_1' => $gluttonyId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
            DB::table('adquired_xuxemons')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'xuxemon_id' => $jinDahaadId,
                ],
                [
                    'level' => 1,
                    'experience' => 0,
                    'bonus_hp' => 7,
                    'bonus_attack' => 7,
                    'bonus_defense' => 7,
                    'current_hp' => 123,
                    'size_id' => $SizeSmallId,
                    'requirement_progress' => 3,
                    'side_effect_id_1' => $overdoseId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
