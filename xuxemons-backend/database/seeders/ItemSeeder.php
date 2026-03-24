<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Item;

class ItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Item::create([
            'name' => 'Gacha Ticket',
            'description' => 'A ticket that allows you to spin the Gacha Machine.',
            'effect_type' => 'Gacha Ticket',
            'effect_value' => null,
            'is_stackable' => true,
            'max_quantity' => 99,
            'status_effect_id' => null,
            'icon_path' => 'items/gacha_ticket.png',
        ]);
        
        Item::create([
            'name' => 'Healing Potion',
            'description' => 'A glowing green potion that restores a portion of your Xuxemon\'s health points during battle.',
            'effect_type' => 'Heal',
            'effect_value' => 45,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/healing_potion.png',
        ]);

        Item::create([
            'name' => 'Max Potion',
            'description' => 'A brilliant azure potion that completely restores a Xuxemon\'s full health in a single dose.',
            'effect_type' => 'Heal',
            'effect_value' => 100,
            'is_stackable' => true,
            'max_quantity' => 3,
            'status_effect_id' => null,
            'icon_path' => 'items/max_potion.png',
        ]);

        Item::create([
            'name' => 'Healing Herb',
            'description' => 'A fragrant emerald herb that gently restores a portion of your Xuxemon\'s health during battles.',
            'effect_type' => 'Heal',
            'effect_value' => 20,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/healing_herb.png',
        ]);

        Item::create([
            'name' => 'DMG Potion',
            'description' => 'A fiery crimson potion that temporarily amplifies a Xuxemon\'s attack power and damage output.',
            'effect_type' => 'DMG Up',
            'effect_value' => 10,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/dmg_potion.png',
        ]);

        Item::create([
            'name' => 'Defense Potion',
            'description' => 'A shimmering golden potion that hardens a Xuxemon\'s defenses and reduces damage taken.',
            'effect_type' => 'Defense Up',
            'effect_value' => 10,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/defense_potion.png',
        ]);

        Item::create([
            'name' => 'Nulberry',
            'description' => 'A mystical purple berry that instantly purges all negative status conditions and ailments.',
            'effect_type' => 'Remove Status Effects',
            'effect_value' => null,
            'is_stackable' => false,
            'max_quantity' => 1,
            'status_effect_id' => null,
            'icon_path' => 'items/nulberry.png',
        ]);

        Item::create([
            'name' => 'Flash',
            'description' => 'A blinding burst of light that obscures an opponent\'s vision and reduces their attack accuracy.',
            'effect_type' => 'Apply Status Effects',
            'effect_value' => 50,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/flash.png',
        ]);

        Item::create([
            'name' => 'Paralyzing Knife',
            'description' => 'A venomous blade that induces temporary paralysis on an opponent Xuxemon, limiting their mobility.',
            'effect_type' => 'Apply Status Effects',
            'effect_value' => 40,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/paralyzing_knife.png',
        ]);

        Item::create([
            'name' => 'Sleeping Knife',
            'description' => 'A razor-sharp blade laced with soporific toxin that puts an opponent Xuxemon into deep slumber.',
            'effect_type' => 'Apply Status Effects',
            'effect_value' => 40,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/sleeping_knife.png',
        ]);
        Item::create([
            'name' => 'Special Meat',
            'description' => 'A rare delicacy that provides nourishment and mysterious enhancements to a Xuxemon\'s prowess.',
            'effect_type' => 'Evolve',
            'effect_value' => 20,
            'is_stackable' => true,
            'max_quantity' => 5,
            'status_effect_id' => null,
            'icon_path' => 'items/special_meat.png',
        ]);
    }
}
