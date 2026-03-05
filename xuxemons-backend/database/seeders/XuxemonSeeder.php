<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class XuxemonSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('xuxemons')->delete();

        $typesData = [
            ['name' => 'Power',     'icon_path' => 'badges/Power.svg'],
            ['name' => 'Speed',     'icon_path' => 'badges/Speed.svg'],
            ['name' => 'Technical', 'icon_path' => 'badges/Technical.svg'],
        ];

        foreach ($typesData as $type) {
            DB::table('types')->updateOrInsert(
                ['name' => $type['name']],
                [
                    'icon_path'  => $type['icon_path'],
                    'counter'    => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        $powerId     = DB::table('types')->where('name', 'Power')->value('id');
        $speedId     = DB::table('types')->where('name', 'Speed')->value('id');
        $technicalId = DB::table('types')->where('name', 'Technical')->value('id');

        DB::table('types')->where('id', $speedId)->update(['counter'     => $powerId]);
        DB::table('types')->where('id', $powerId)->update(['counter'     => $technicalId]);
        DB::table('types')->where('id', $technicalId)->update(['counter' => $speedId]);

        $attacksData = [
            ['name' => 'Crushing Strike',  'description' => 'A devastating physical blow that ignores armor.',         'dmg' => 55],
            ['name' => 'Rage Burst',        'description' => 'Unleashes raw power in a single explosive strike.',       'dmg' => 65],
            ['name' => 'Wind Slash',        'description' => 'A razor-sharp air cut that reduces the target\'s defense.', 'dmg' => 48],
            ['name' => 'Fireball Dive',     'description' => 'A high-speed aerial dive wrapped in flames.',              'dmg' => 58],
            ['name' => 'Thunder Surge',     'description' => 'An electric discharge through water that paralyzes.',     'dmg' => 50],
            ['name' => 'Poison Mist',       'description' => 'A toxic cloud that poisons the target over time.',        'dmg' => 42],
        ];

        foreach ($attacksData as $attack) {
            DB::table('attacks')->updateOrInsert(
                ['name' => $attack['name']],
                [
                    'description'      => $attack['description'],
                    'dmg'              => $attack['dmg'],
                    'status_effect_id' => null,
                    'status_chance'    => 50,
                ]
            );
        }

        $atk1Power     = DB::table('attacks')->where('name', 'Crushing Strike')->value('id');
        $atk2Power     = DB::table('attacks')->where('name', 'Rage Burst')->value('id');
        $atk1Speed     = DB::table('attacks')->where('name', 'Wind Slash')->value('id');
        $atk2Speed     = DB::table('attacks')->where('name', 'Fireball Dive')->value('id');
        $atk1Technical = DB::table('attacks')->where('name', 'Thunder Surge')->value('id');
        $atk2Technical = DB::table('attacks')->where('name', 'Poison Mist')->value('id');

        $xuxemons = [
            [
                'name' => 'Arkveld', 'description' => 'Flying wyvern that channels devastating draconic energy.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 130, 'attack' => 95, 'defense' => 70, 'icon_path' => 'xuxemons/Arkveld.png',
            ],
            [
                'name' => 'G. Arkveld', 'description' => 'Guardian variant of Arkveld with amplified draconic power.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 145, 'attack' => 105, 'defense' => 80, 'icon_path' => 'xuxemons/G. Arkveld.png',
            ],
            [
                'name' => 'Rathalos', 'description' => 'King of the Skies, master of fire in flight.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 130, 'attack' => 95, 'defense' => 70, 'icon_path' => 'xuxemons/Rathalos.png',
            ],
            [
                'name' => 'G. Rathalos', 'description' => 'Guardian Rathalos, created by an ancient civilisation.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 140, 'attack' => 100, 'defense' => 75, 'icon_path' => 'xuxemons/G. Rathalos.png',
            ],
            [
                'name' => 'Rathian', 'description' => 'Queen of the Land, whose venomous tail is feared by all.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 125, 'attack' => 90, 'defense' => 75, 'icon_path' => 'xuxemons/Rathian.png',
            ],
            [
                'name' => 'Gravios', 'description' => 'Armoured wyvern that emits lethal fire and sleep gases.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 140, 'attack' => 85, 'defense' => 95, 'icon_path' => 'xuxemons/Gravios.png',
            ],
            [
                'name' => 'Rey Dau', 'description' => 'Storm wyvern that dominates with thunder-based attacks.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 120, 'attack' => 88, 'defense' => 65, 'icon_path' => 'xuxemons/Rey Dau.png',
            ],
            [
                'name' => 'Seregios', 'description' => 'Territorial wyvern with razor scales that cause bleeding.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 110, 'attack' => 92, 'defense' => 60, 'icon_path' => 'xuxemons/Seregios.png',
            ],
            [
                'name' => 'Omega', 'description' => 'Ultimate variant of Seregios, the supreme sky predator.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 120, 'attack' => 95, 'defense' => 65, 'icon_path' => 'xuxemons/Omega.png',
            ],
            [
                'name' => 'G. Odogaron', 'description' => 'Guardian Odogaron, a ferocious ruins predator.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 115, 'attack' => 100, 'defense' => 55, 'icon_path' => 'xuxemons/G. Odogaron.png',
            ],
            [
                'name' => 'Gypceros', 'description' => 'Elusive bird wyvern that blinds hunters with a dazzling light.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 80, 'attack' => 60, 'defense' => 50, 'icon_path' => 'xuxemons/Gypceros.png',
            ],
            [
                'name' => 'Yian Kut Ku', 'description' => 'Fire-breathing bird wyvern with oversized, sensitive ears.',
                'type_id' => $speedId, 'attack_1_id' => $atk1Speed, 'attack_2_id' => $atk2Speed,
                'hp' => 85, 'attack' => 70, 'defense' => 55, 'icon_path' => 'xuxemons/Yian Kut Ku.png',
            ],
            [
                'name' => 'Ajarakan', 'description' => 'Fast and aggressive fanged beast that attacks with fire.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 110, 'attack' => 85, 'defense' => 60, 'icon_path' => 'xuxemons/Ajarakan.png',
            ],
            [
                'name' => 'Blangonga', 'description' => 'Snow beast that hurls balls of ice at unsuspecting hunters.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 100, 'attack' => 75, 'defense' => 65, 'icon_path' => 'xuxemons/Blangonga.png',
            ],
            [
                'name' => 'Congalala', 'description' => 'Mischievous forest beast that weaponises mushroom spores.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 105, 'attack' => 70, 'defense' => 60, 'icon_path' => 'xuxemons/Congalala.png',
            ],
            [
                'name' => 'Doshaguma', 'description' => 'Enormous pack-hunting fanged beast of devastating strength.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 120, 'attack' => 80, 'defense' => 75, 'icon_path' => 'xuxemons/Doshaguma.png',
            ],
            [
                'name' => 'G. Doshaguma', 'description' => 'Alpha of the Doshaguma pack, with overwhelming physical power.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 135, 'attack' => 90, 'defense' => 85, 'icon_path' => 'xuxemons/G. Doshaguma.png',
            ],
            [
                'name' => 'Quematrice', 'description' => 'Brute wyvern that unleashes powerful flame bursts.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 115, 'attack' => 90, 'defense' => 70, 'icon_path' => 'xuxemons/Quematrice.png',
            ],
            [
                'name' => 'Rompopolo', 'description' => 'Brute wyvern that injects venom through brutal physical attacks.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 120, 'attack' => 85, 'defense' => 70, 'icon_path' => 'xuxemons/Rompopolo.png',
            ],
            [
                'name' => 'Gogmazios', 'description' => 'Colossal elder dragon, the Ancient Weapon of forgotten times.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 160, 'attack' => 115, 'defense' => 90, 'icon_path' => 'xuxemons/Gogmazios.png',
            ],
            [
                'name' => 'Gore Magala', 'description' => 'Demi-elder dragon that spreads the devastating Frenzy Virus.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 150, 'attack' => 110, 'defense' => 75, 'icon_path' => 'xuxemons/Gore Magala.png',
            ],
            [
                'name' => 'G. Anjanath', 'description' => 'Guardian Fulgur Anjanath, an artificially charged thunder beast.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 125, 'attack' => 90, 'defense' => 65, 'icon_path' => 'xuxemons/G. Anjanath.png',
            ],
            [
                'name' => 'Zoh Shia', 'description' => 'Guardian of the Ruins of Wyveria, producer of energy explosions.',
                'type_id' => $powerId, 'attack_1_id' => $atk1Power, 'attack_2_id' => $atk2Power,
                'hp' => 150, 'attack' => 105, 'defense' => 85, 'icon_path' => 'xuxemons/Zoh Shia.png',
            ],
            [
                'name' => 'Lagiacrus', 'description' => 'Thunder leviathan, undisputed lord of the stormy seas.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 130, 'attack' => 90, 'defense' => 75, 'icon_path' => 'xuxemons/Lagiacrus.png',
            ],
            [
                'name' => 'Uth Duna', 'description' => 'Deep-sea leviathan that commands powerful water currents.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 135, 'attack' => 90, 'defense' => 80, 'icon_path' => 'xuxemons/Uth Duna.png',
            ],
            [
                'name' => 'Hirabami', 'description' => 'Agile leviathan that levitates using its neck membranes.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 100, 'attack' => 75, 'defense' => 70, 'icon_path' => 'xuxemons/Hirabami.png',
            ],
            [
                'name' => 'Jin Dahaad', 'description' => 'Colossal leviathan of elder dragon-level power.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 155, 'attack' => 100, 'defense' => 100, 'icon_path' => 'xuxemons/Jin Dahaad.png',
            ],
            [
                'name' => 'Nu Udra', 'description' => 'Giant deep-sea cephalopod, a brand-new type introduced in Wilds.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 145, 'attack' => 95, 'defense' => 80, 'icon_path' => 'xuxemons/Nu Udra.png',
            ],
            [
                'name' => 'Xu Wu', 'description' => 'Crystalline cephalopod that detonates under elemental interference.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 110, 'attack' => 80, 'defense' => 75, 'icon_path' => 'xuxemons/Xu Wu.png',
            ],
            [
                'name' => 'Chatacabra', 'description' => 'Sturdy amphibian that adapts to both aquatic and land environments.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 90, 'attack' => 65, 'defense' => 55, 'icon_path' => 'xuxemons/Chatacabra.png',
            ],
            [
                'name' => 'Nerscylla', 'description' => 'Arachnid temnoceran that crafts armour from other monsters\' shells.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 100, 'attack' => 85, 'defense' => 60, 'icon_path' => 'xuxemons/Nerscylla.png',
            ],
            [
                'name' => 'Lalabarina', 'description' => 'Deceptive and venomous spider-like temnoceran.',
                'type_id' => $technicalId, 'attack_1_id' => $atk1Technical, 'attack_2_id' => $atk2Technical,
                'hp' => 95, 'attack' => 80, 'defense' => 65, 'icon_path' => 'xuxemons/Lalabarina.png',
            ],
        ];

        foreach ($xuxemons as $xuxemon) {
            DB::table('xuxemons')->insertOrIgnore([
                'name'             => $xuxemon['name'],
                'description'      => $xuxemon['description'],
                'type_id'          => $xuxemon['type_id'],
                'status_effect_id' => null,
                'attack_1_id'      => $xuxemon['attack_1_id'],
                'attack_2_id'      => $xuxemon['attack_2_id'],
                'hp'               => $xuxemon['hp'],
                'attack'           => $xuxemon['attack'],
                'defense'          => $xuxemon['defense'],
                'icon_path'        => $xuxemon['icon_path'],
                'size'             => 'Small',
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        }
    }
}
