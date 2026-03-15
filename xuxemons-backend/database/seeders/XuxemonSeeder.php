<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class XuxemonSeeder extends Seeder
{
    public function run(): void
    {
        // TYPES
        $powerId     = DB::table('types')->where('name', 'Power')->value('id');
        $speedId     = DB::table('types')->where('name', 'Speed')->value('id');
        $technicalId = DB::table('types')->where('name', 'Technical')->value('id');

        // TYPE ATTACKS
        $atkPower     = DB::table('attacks')->where('name', 'Power Attack')->value('id');
        $atkSpeed     = DB::table('attacks')->where('name', 'Speed Attack')->value('id');
        $atkTechnical = DB::table('attacks')->where('name', 'Technical Attack')->value('id');

        // UNIQUE ATTACKS

        // Confusion
        $atkFrenzy       = DB::table('attacks')->where('name', 'Frenzy Attack')->value('id');
        $atkLeviathan    = DB::table('attacks')->where('name', 'Leviathan Slam')->value('id');
        $atkPinecone     = DB::table('attacks')->where('name', 'Pinecone Snipe')->value('id');
        $atkWyverian     = DB::table('attacks')->where('name', 'Wyverian Explosion')->value('id');
        $atkRending      = DB::table('attacks')->where('name', 'Rending Claws')->value('id');
        $atkDeadlyScale  = DB::table('attacks')->where('name', 'Deadly Scale Barrage')->value('id');
        $atkDazzling     = DB::table('attacks')->where('name', 'Dazzling Flash')->value('id');
        $atkPackMaul     = DB::table('attacks')->where('name', 'Pack Maul')->value('id');
        $atkAlphaSlam    = DB::table('attacks')->where('name', 'Alpha Slam')->value('id');
        $atkBodySlam     = DB::table('attacks')->where('name', 'Body Slam')->value('id');

        // Paralysis
        $atkThunderJaws  = DB::table('attacks')->where('name', 'Thunder Jaws')->value('id');
        $atkTarBeam      = DB::table('attacks')->where('name', 'Tar Beam')->value('id');
        $atkVenomBite    = DB::table('attacks')->where('name', 'Venomous Bite')->value('id');
        $atkDorsal       = DB::table('attacks')->where('name', 'Dorsal Discharge')->value('id');
        $atkVenomSpit    = DB::table('attacks')->where('name', 'Venom Spit')->value('id');
        $atkStormSurge   = DB::table('attacks')->where('name', 'Storm Surge')->value('id');
        $atkIceBall      = DB::table('attacks')->where('name', 'Ice Ball')->value('id');
        $atkVenomTail    = DB::table('attacks')->where('name', 'Venomous Tail')->value('id');
        $atkDraconic     = DB::table('attacks')->where('name', 'Draconic Burst')->value('id');
        $atkInferno      = DB::table('attacks')->where('name', 'Inferno Blast')->value('id');
        $atkWindCutter   = DB::table('attacks')->where('name', 'Wind Cutter')->value('id');
        $atkFlamePounce  = DB::table('attacks')->where('name', 'Flame Pounce')->value('id');
        $atkSkyFlame     = DB::table('attacks')->where('name', 'Sky Flame')->value('id');
        $atkRoyalFire    = DB::table('attacks')->where('name', 'Royal Fireball')->value('id');
        $atkCrystal      = DB::table('attacks')->where('name', 'Crystal Blade')->value('id');
        $atkFireball     = DB::table('attacks')->where('name', 'Fireball Spit')->value('id');
        $atkAquaSurge    = DB::table('attacks')->where('name', 'Aqua Surge')->value('id');
        $atkInfernoBurst = DB::table('attacks')->where('name', 'Inferno Burst')->value('id');
        $atkOilsilt      = DB::table('attacks')->where('name', 'Oilsilt Ignition')->value('id');

        // Sleep
        $atkSleep        = DB::table('attacks')->where('name', 'Sleep Gas')->value('id');
        $atkStinger      = DB::table('attacks')->where('name', 'Sleep Stinger')->value('id');
        $atkFetidBreath  = DB::table('attacks')->where('name', 'Fetid Breath')->value('id');

        $xuxemons = [
            // POWER (A–Z)
            ['name' => 'Arkveld',      'description' => 'Flying wyvern that channels devastating draconic energy.',           'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkDraconic, 'hp' => 455, 'attack' => 95,  'defense' => 70,  'icon_path' => 'xuxemons/Arkveld.png'],
            ['name' => 'Congalala',    'description' => 'Mischievous forest beast that weaponises mushroom spores.',           'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkFetidBreath,    'hp' => 370, 'attack' => 70,  'defense' => 60,  'icon_path' => 'xuxemons/Congalala.png'],
            ['name' => 'G. Anjanath',  'description' => 'Guardian Fulgur Anjanath, an artificially charged thunder beast.',   'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkThunderJaws,'hp' => 440, 'attack' => 90,  'defense' => 65,  'icon_path' => 'xuxemons/G. Anjanath.png'],
            ['name' => 'G. Arkveld',   'description' => 'Guardian variant of Arkveld with amplified draconic power.',          'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkInferno,   'hp' => 510, 'attack' => 105, 'defense' => 80,  'icon_path' => 'xuxemons/G. Arkveld.png'],
            ['name' => 'Gore Magala',  'description' => 'Demi-elder dragon that spreads the devastating Frenzy Virus.',     'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkFrenzy,   'hp' => 560, 'attack' => 115, 'defense' => 82,  'icon_path' => 'xuxemons/Gore Magala.png'],
            ['name' => 'Gravios',      'description' => 'Armoured wyvern that emits lethal fire and sleep gases.',            'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkSleep,    'hp' => 490, 'attack' => 85,  'defense' => 95,  'icon_path' => 'xuxemons/Gravios.png'],
            ['name' => 'Jin Dahaad',   'description' => 'Colossal leviathan of elder dragon-level power.',                    'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkLeviathan,  'hp' => 535, 'attack' => 105, 'defense' => 98, 'icon_path' => 'xuxemons/Jin Dahaad.png'],
            ['name' => 'Seregios',     'description' => 'Territorial wyvern with razor scales that cause bleeding.',          'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkPinecone,  'hp' => 385, 'attack' => 92,  'defense' => 60,  'icon_path' => 'xuxemons/Seregios.png'],
            ['name' => 'Uth Duna',     'description' => 'Deep-sea leviathan that commands powerful water currents.',          'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkBodySlam,  'hp' => 470, 'attack' => 90,  'defense' => 80,  'icon_path' => 'xuxemons/Uth Duna.png'],
            ['name' => 'Zoh Shia',     'description' => 'Guardian of the Ruins of Wyveria, producer of energy explosions.',    'type_id' => $powerId, 'attack_1_id' => $atkPower, 'attack_2_id' => $atkWyverian,  'hp' => 520, 'attack' => 105, 'defense' => 85,  'icon_path' => 'xuxemons/Zoh Shia.png'],

            // SPEED (A–Z)
            ['name' => 'Ajarakan',     'description' => 'Fast and aggressive fanged beast that attacks with fire.',            'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkFlamePounce,'hp' => 385, 'attack' => 85,  'defense' => 60,  'icon_path' => 'xuxemons/Ajarakan.png'],
            ['name' => 'G. Odogaron',  'description' => 'Guardian Odogaron, a ferocious ruins predator.',                       'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkRending,   'hp' => 400, 'attack' => 100, 'defense' => 55,  'icon_path' => 'xuxemons/G. Odogaron.png'],
            ['name' => 'G. Rathalos',  'description' => 'Guardian Rathalos, created by an ancient civilisation.',                'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkSkyFlame,  'hp' => 490, 'attack' => 100, 'defense' => 75,  'icon_path' => 'xuxemons/G. Rathalos.png'],
            ['name' => 'Gogmazios',    'description' => 'Colossal elder dragon, the Ancient Weapon of forgotten times.',       'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkTarBeam,   'hp' => 540, 'attack' => 112, 'defense' => 90,  'icon_path' => 'xuxemons/Gogmazios.png'],
            ['name' => 'Hirabami',     'description' => 'Agile leviathan that levitates using its neck membranes.',           'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkWindCutter,'hp' => 350, 'attack' => 75,  'defense' => 70,  'icon_path' => 'xuxemons/Hirabami.png'],
            ['name' => 'Lagiacrus',    'description' => 'Thunder leviathan, undisputed lord of the stormy seas.',             'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkDorsal,    'hp' => 455, 'attack' => 90,  'defense' => 75,  'icon_path' => 'xuxemons/Lagiacrus.png'],
            ['name' => 'Lalabarina',   'description' => 'Deceptive and venomous spider-like temnoceran.',                        'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkVenomSpit, 'hp' => 330, 'attack' => 80,  'defense' => 65,  'icon_path' => 'xuxemons/Lalabarina.png'],
            ['name' => 'Nerscylla',    'description' => 'Arachnid temnoceran that crafts armour from other monsters\' shells.', 'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkStinger,   'hp' => 350, 'attack' => 85,  'defense' => 60,  'icon_path' => 'xuxemons/Nerscylla.png'],
            ['name' => 'Rathalos',     'description' => 'King of the Skies, master of fire in flight.',                        'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkRoyalFire, 'hp' => 455, 'attack' => 95,  'defense' => 70,  'icon_path' => 'xuxemons/Rathalos.png'],
            ['name' => 'Rompopolo',    'description' => 'Brute wyvern that injects venom through brutal physical attacks.',   'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkVenomBite, 'hp' => 420, 'attack' => 85,  'defense' => 70,  'icon_path' => 'xuxemons/Rompopolo.png'],
            ['name' => 'Xu Wu',        'description' => 'Crystalline cephalopod that detonates under elemental interference.', 'type_id' => $speedId, 'attack_1_id' => $atkSpeed, 'attack_2_id' => $atkCrystal,  'hp' => 385, 'attack' => 80,  'defense' => 75,  'icon_path' => 'xuxemons/Xu Wu.png'],

            // TECHNICAL (A–Z)
            ['name' => 'Blangonga',    'description' => 'Snow beast that hurls balls of ice at unsuspecting hunters.',         'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkIceBall,   'hp' => 350, 'attack' => 75,  'defense' => 65,  'icon_path' => 'xuxemons/Blangonga.png'],
            ['name' => 'Chatacabra',   'description' => 'Sturdy amphibian that adapts to both aquatic and land environments.', 'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkAquaSurge,  'hp' => 315, 'attack' => 65,  'defense' => 55,  'icon_path' => 'xuxemons/Chatacabra.png'],
            ['name' => 'Doshaguma',    'description' => 'Enormous pack-hunting fanged beast of devastating strength.',        'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkPackMaul,   'hp' => 420, 'attack' => 80,  'defense' => 75,  'icon_path' => 'xuxemons/Doshaguma.png'],
            ['name' => 'G. Doshaguma', 'description' => 'Alpha of the Doshaguma pack, with overwhelming physical power.',       'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkAlphaSlam,  'hp' => 470, 'attack' => 90,  'defense' => 85,  'icon_path' => 'xuxemons/G. Doshaguma.png'],
            ['name' => 'Gypceros',     'description' => 'Elusive bird wyvern that blinds hunters with a dazzling light.',       'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkDazzling,   'hp' => 280, 'attack' => 60,  'defense' => 50,  'icon_path' => 'xuxemons/Gypceros.png'],
            ['name' => 'Nu Udra',      'description' => 'Giant fire cephalopod that ignites oilsilt when enraged.',            'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkOilsilt,    'hp' => 510, 'attack' => 95,  'defense' => 80,  'icon_path' => 'xuxemons/Nu Udra.png'],
            ['name' => 'Omega',        'description' => 'Ultimate variant of Seregios, the supreme sky predator.',              'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkDeadlyScale,'hp' => 420, 'attack' => 95,  'defense' => 65,  'icon_path' => 'xuxemons/Omega.png'],
            ['name' => 'Quematrice',   'description' => 'Brute wyvern that unleashes powerful flame bursts.',                  'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkInfernoBurst,'hp' => 400, 'attack' => 90,  'defense' => 70,  'icon_path' => 'xuxemons/Quematrice.png'],
            ['name' => 'Rathian',      'description' => 'Queen of the Land, whose venomous tail is feared by all.',            'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkVenomTail,  'hp' => 440, 'attack' => 90,  'defense' => 75,  'icon_path' => 'xuxemons/Rathian.png'],
            ['name' => 'Rey Dau',      'description' => 'Storm wyvern that dominates with thunder-based attacks.',            'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkStormSurge, 'hp' => 420, 'attack' => 88,  'defense' => 65,  'icon_path' => 'xuxemons/Rey Dau.png'],
            ['name' => 'Yian Kut Ku',  'description' => 'Fire-breathing bird wyvern with oversized, sensitive ears.',          'type_id' => $technicalId, 'attack_1_id' => $atkTechnical, 'attack_2_id' => $atkFireball,   'hp' => 300, 'attack' => 70,  'defense' => 55,  'icon_path' => 'xuxemons/Yian Kut Ku.png'],
        ];

        foreach ($xuxemons as $xuxemon) {
            DB::table('xuxemons')->updateOrInsert(
                ['name' => $xuxemon['name']],
                [
                    'description'   => $xuxemon['description'],
                    'type_id'       => $xuxemon['type_id'],
                    'size'          => 'Small',
                    'attack_1_id'   => $xuxemon['attack_1_id'],
                    'attack_2_id'   => $xuxemon['attack_2_id'],
                    'hp'            => $xuxemon['hp'],
                    'attack'        => $xuxemon['attack'],
                    'defense'       => $xuxemon['defense'],
                    'icon_path'     => $xuxemon['icon_path'],
                ]
            );
        }
    }
}
