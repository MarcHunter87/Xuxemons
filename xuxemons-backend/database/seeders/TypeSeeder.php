<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['name' => 'Power',     'icon_path' => 'badges/Power.webp'],
            ['name' => 'Speed',     'icon_path' => 'badges/Speed.webp'],
            ['name' => 'Technical', 'icon_path' => 'badges/Technical.webp'],
        ];

        foreach ($types as $type) {
            DB::table('types')->updateOrInsert(
                ['name' => $type['name']],
                [
                    'icon_path' => $type['icon_path'],
                    'counter' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        $powerId = DB::table('types')->where('name', 'Power')->value('id');
        $speedId = DB::table('types')->where('name', 'Speed')->value('id');
        $technicalId = DB::table('types')->where('name', 'Technical')->value('id');

        DB::table('types')->where('id', $speedId)->update(['counter' => $powerId]);
        DB::table('types')->where('id', $powerId)->update(['counter' => $technicalId]);
        DB::table('types')->where('id', $technicalId)->update(['counter' => $speedId]);
    }
}
