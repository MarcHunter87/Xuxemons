<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AttackSeeder extends Seeder
{
    public function run(): void
    {
        $paralysisId = DB::table('status_effects')->where('name', 'Paralysis')->value('id');
        $sleepId     = DB::table('status_effects')->where('name', 'Sleep')->value('id');
        $confusionId = DB::table('status_effects')->where('name', 'Confusion')->value('id');

        $attacks = [
            // TYPE ATTACKS
            ['name' => 'Power Attack',     'description' => 'A straightforward physical strike that embodies raw strength.',      'dmg' => null, 'status_effect_id' => null,   'status_chance' => null],
            ['name' => 'Speed Attack',     'description' => 'A swift, agile strike that catches the opponent off guard.',         'dmg' => null, 'status_effect_id' => null,   'status_chance' => null],
            ['name' => 'Technical Attack', 'description' => 'A precise, calculated blow that exploits the target\'s weaknesses.', 'dmg' => null, 'status_effect_id' => null,   'status_chance' => null],

            // UNIQUE ATTACKS

            // Confusion
            ['name' => 'Frenzy Attack',        'description' => 'Spreads the devastating Frenzy Virus. Gore Magala\'s signature move.',          'dmg' => 125, 'status_effect_id' => $confusionId, 'status_chance' => 40],
            ['name' => 'Leviathan Slam',       'description' => 'A colossal body slam that crushes everything beneath. Jin Dahaad\'s might.',    'dmg' => 115, 'status_effect_id' => $confusionId, 'status_chance' => 25],
            ['name' => 'Pinecone Snipe',       'description' => 'Fires razor scales in a spread pattern. Seregios\' signature move.',            'dmg' => 105, 'status_effect_id' => $confusionId, 'status_chance' => 35],
            ['name' => 'Wyverian Explosion',   'description' => 'Energy detonation from the Ruins of Wyveria. Zoh Shia\'s wrath.',               'dmg' => 118, 'status_effect_id' => $confusionId, 'status_chance' => 22],
            ['name' => 'Rending Claws',        'description' => 'Savage claws that cause deep bleeding wounds. G. Odogaron\'s cruelty.',         'dmg' => 112, 'status_effect_id' => $confusionId, 'status_chance' => 25],
            ['name' => 'Deadly Scale Barrage', 'description' => 'Supreme scale assault. Omega, the ultimate Seregios variant.',                  'dmg' => 118, 'status_effect_id' => $confusionId, 'status_chance' => 38],
            ['name' => 'Dazzling Flash',       'description' => 'Blinding light from the crest that confuses the target. Gypceros\' trick.',     'dmg' => 88, 'status_effect_id' => $confusionId, 'status_chance' => 40],
            ['name' => 'Pack Maul',            'description' => 'Devastating maul from pack-hunting strength. Doshaguma\'s fury.',               'dmg' => 108, 'status_effect_id' => $confusionId, 'status_chance' => 25],
            ['name' => 'Alpha Slam',           'description' => 'Overwhelming slam of the pack alpha. G. Doshaguma\'s dominance.',               'dmg' => 115, 'status_effect_id' => $confusionId, 'status_chance' => 28],
            ['name' => 'Body Slam',            'description' => 'Deep-sea leviathan slams its bulk to overwhelm the target. Uth Duna\'s might.', 'dmg' => 110, 'status_effect_id' => $confusionId, 'status_chance' => 26],

            // Paralysis
            ['name' => 'Thunder Jaws',     'description' => 'Electrified bite that shocks the target. Fulgur Anjanath\'s signature.',    'dmg' => 108, 'status_effect_id' => $paralysisId, 'status_chance' => 35],
            ['name' => 'Tar Beam',         'description' => 'Superheated tar fired in a devastating beam. Gogmazios\' ancient weapon.',  'dmg' => 128, 'status_effect_id' => $paralysisId, 'status_chance' => 28],
            ['name' => 'Venomous Bite',    'description' => 'Brutal bite that injects potent venom. Rompopolo\'s ferocity.',             'dmg' => 102, 'status_effect_id' => $paralysisId, 'status_chance' => 30],
            ['name' => 'Dorsal Discharge', 'description' => 'Electric discharge from dorsal spines. Lagiacrus, lord of storms.',         'dmg' => 105, 'status_effect_id' => $paralysisId, 'status_chance' => 35],
            ['name' => 'Venom Spit',       'description' => 'Deceptive spit that poisons and numbs the target. Lalabarina\'s trick.',    'dmg' => 98, 'status_effect_id' => $paralysisId, 'status_chance' => 28],
            ['name' => 'Storm Surge',      'description' => 'Thunder from the storm wyvern. Rey Dau dominates with lightning.',          'dmg' => 108, 'status_effect_id' => $paralysisId, 'status_chance' => 33],
            ['name' => 'Ice Ball',         'description' => 'A ball of ice hurled at the target. Blangonga\'s snow beast weapon.',       'dmg' => 98, 'status_effect_id' => $paralysisId, 'status_chance' => 28],
            ['name' => 'Venomous Tail',    'description' => 'Backflip tail strike with potent venom. Rathian, Queen of the Land.',       'dmg' => 112, 'status_effect_id' => $paralysisId, 'status_chance' => 35],
            ['name' => 'Draconic Burst',   'description' => 'Channels raw draconic energy into a fiery explosion.',                      'dmg' => 112, 'status_effect_id' => $paralysisId, 'status_chance' => 24],
            ['name' => 'Inferno Blast',    'description' => 'Amplified draconic flames. G. Arkveld\'s overwhelming power.',              'dmg' => 122, 'status_effect_id' => $paralysisId, 'status_chance' => 26],
            ['name' => 'Wind Cutter',      'description' => 'Razor-sharp air slash from levitating membranes. Hirabami\'s grace.',       'dmg' => 95, 'status_effect_id' => $paralysisId, 'status_chance' => 22],
            ['name' => 'Flame Pounce',     'description' => 'A fiery leap that burns on impact. Ajarakan\'s aggression.',                'dmg' => 102, 'status_effect_id' => $paralysisId, 'status_chance' => 25],
            ['name' => 'Sky Flame',        'description' => 'Fire from above. Guardian Rathalos\' aerial dominance.',                    'dmg' => 115, 'status_effect_id' => $paralysisId, 'status_chance' => 26],
            ['name' => 'Royal Fireball',   'description' => 'The King of the Skies\' signature flame projectile.',                       'dmg' => 112, 'status_effect_id' => $paralysisId, 'status_chance' => 25],
            ['name' => 'Crystal Blade',    'description' => 'Hardened mucus forms blade-like crystal weapons. Xu Wu\'s signature.',      'dmg' => 98, 'status_effect_id' => $paralysisId, 'status_chance' => 22],
            ['name' => 'Fireball Spit',    'description' => 'Flame projectile from sensitive ears. Yian Kut-Ku\'s fire sac.',            'dmg' => 95, 'status_effect_id' => $paralysisId, 'status_chance' => 24],
            ['name' => 'Aqua Surge',       'description' => 'High-pressure water blast. Chatacabra adapts to the currents.',             'dmg' => 92, 'status_effect_id' => $paralysisId, 'status_chance' => 20],
            ['name' => 'Inferno Burst',    'description' => 'Powerful flame burst. Quematrice\'s brute fire.',                           'dmg' => 112, 'status_effect_id' => $paralysisId, 'status_chance' => 26],
            ['name' => 'Oilsilt Ignition', 'description' => 'Flaming oil projectiles that explode on impact. Nu Udra\'s oilsilt wrath.', 'dmg' => 118, 'status_effect_id' => $paralysisId, 'status_chance' => 25],

            // Sleep
            ['name' => 'Sleep Gas',     'description' => 'Emits a cloud of soporific gas that may put the target to sleep.',        'dmg' => 92, 'status_effect_id' => $sleepId, 'status_chance' => 30],
            ['name' => 'Sleep Stinger', 'description' => 'Stinger that induces sleep. Nerscylla\'s webbing predator.',              'dmg' => 98, 'status_effect_id' => $sleepId, 'status_chance' => 32],
            ['name' => 'Fetid Breath',  'description' => 'A noxious sleep gas from fermented mushrooms. Congalala\'s foul weapon.', 'dmg' => 88, 'status_effect_id' => $sleepId, 'status_chance' => 28],
        ];

        foreach ($attacks as $attack) {
            DB::table('attacks')->updateOrInsert(
                ['name' => $attack['name']],
                [
                    'description'      => $attack['description'],
                    'dmg'             => $attack['dmg'],
                    'status_effect_id' => $attack['status_effect_id'],
                    'status_chance'   => $attack['status_chance'],
                ]
            );
        }
    }
}
