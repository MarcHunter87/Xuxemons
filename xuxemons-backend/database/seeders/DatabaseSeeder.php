<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            ItemSeeder::class,
            DailyRewardSeeder::class,
            TypeSeeder::class,
            BagSeeder::class,
            StatusEffectSeeder::class,
            SideEffectSeeder::class,
            AttackSeeder::class,
            XuxemonSeeder::class,
            AdquiredXuxemonSeeder::class,
            SizeSeeder::class,
        ]);
    }
}
