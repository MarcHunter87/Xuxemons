<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['id' => '#Nipah1983'],
            [
                'name' => 'Nipah',
                'surname' => 'Furude',
                'email' => 'nipah@gmail.com',
                'password' => '123456',
                'role' => 'admin',
                'icon_path' => '/users/icons/#Nipah1983.png',
                'banner_path' => '/users/banners/#Nipah1983.png',
            ]   
        );

        $players = [
            ['id' => '#Marc1987', 
            'name' => 'Marc', 
            'surname' => 'Baneres', 
            'email' => 'marc@gmail.com', 
            'password' => '123456',
            'role' => 'player',
            ],
            ['id' => '#Liqi1990', 
            'name' => 'Liqi', 
            'surname' => 'Yang', 
            'email' => 'liqi@gmail.com', 
            'password' => '123456',
            'role' => 'player',
            'icon_path' => '/users/icons/#Liqi1990.png',
            ],
            ['id' => '#Pau2000', 
            'name' => 'Pau', 
            'surname' => 'Guiu', 
            'email' => 'pau@gmail.com', 
            'password' => '123456',
            'role' => 'player',
            ],
        ];

        foreach ($players as $player) {
            User::updateOrCreate(
                ['id' => $player['id']],
                $player
            );
        }
    }
}
