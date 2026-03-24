<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
class SizeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $sizes = [
            ['size' => 'Small', 'requirement_progress' => 0],
            ['size' => 'Medium', 'requirement_progress' => 3],
            ['size' => 'Large', 'requirement_progress' => 8],
        ];

        foreach ($sizes as $size) {
            DB::table('sizes')->updateOrInsert(
                ['size' => $size['size']],
                [
                    'requirement_progress' => $size['requirement_progress'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}