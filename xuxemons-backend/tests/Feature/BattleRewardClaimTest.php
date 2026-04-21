<?php

namespace Tests\Feature;

use App\Models\AdquiredXuxemon;
use App\Models\Battle;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BattleRewardClaimTest extends TestCase
{
    use RefreshDatabase;

    public function test_winner_can_claim_reward_after_battle_has_a_winner(): void
    {
        [$winner, $loser, $loserXuxemon] = $this->createBattleRewardScenario();

        $battle = Battle::create([
            'user_id' => $winner->id,
            'opponent_user_id' => $loser->id,
            'winner_id' => $winner->id,
            'status' => 'accepted',
            'turn' => 5,
            'battle_log' => ['Winner takes the prize'],
        ]);

        $response = $this->actingAs($winner, 'api')->postJson("/api/battles/{$battle->id}/finish", [
            'winner_id' => $winner->id,
            'loser_xuxemon_id' => $loserXuxemon->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('battle.status', 'completed')
            ->assertJsonPath('stolen_xuxemon.adquired_id', $loserXuxemon->id)
            ->assertJsonPath('stolen_xuxemon.name', 'Prizemon');

        $this->assertSame($winner->id, $loserXuxemon->fresh()->user_id);
        $this->assertNull(Team::where('user_id', $loser->id)->first()?->slot_1_adquired_xuxemon_id);
    }

    public function test_loser_cannot_claim_reward_for_completed_battle(): void
    {
        [$winner, $loser, $loserXuxemon] = $this->createBattleRewardScenario();

        $battle = Battle::create([
            'user_id' => $winner->id,
            'opponent_user_id' => $loser->id,
            'winner_id' => $winner->id,
            'status' => 'accepted',
            'turn' => 5,
            'battle_log' => ['Winner takes the prize'],
        ]);

        $response = $this->actingAs($loser, 'api')->postJson("/api/battles/{$battle->id}/finish", [
            'winner_id' => $winner->id,
            'loser_xuxemon_id' => $loserXuxemon->id,
        ]);

        $response
            ->assertForbidden()
            ->assertJsonPath('message', 'Only the winner can claim the battle reward');

        $this->assertSame($loser->id, $loserXuxemon->fresh()->user_id);
    }

    /**
     * @return array{0: User, 1: User, 2: AdquiredXuxemon}
     */
    private function createBattleRewardScenario(): array
    {
        $winner = User::factory()->create([
            'id' => 'winner-user',
            'surname' => 'Winner',
        ]);

        $loser = User::factory()->create([
            'id' => 'loser-user',
            'surname' => 'Loser',
        ]);

        $typeId = DB::table('types')->insertGetId([
            'name' => 'Test Type',
            'icon_path' => 'types/test-type.png',
            'counter' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $attackOneId = DB::table('attacks')->insertGetId([
            'name' => 'Test Attack One',
            'description' => 'Attack used in tests',
            'dmg' => 10,
            'status_effect_id' => null,
            'status_chance' => 0,
        ]);

        $attackTwoId = DB::table('attacks')->insertGetId([
            'name' => 'Test Attack Two',
            'description' => 'Attack used in tests',
            'dmg' => 12,
            'status_effect_id' => null,
            'status_chance' => 0,
        ]);

        DB::table('sizes')->insert([
            'id' => 1,
            'size' => 'Small',
            'requirement_progress' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $xuxemonId = DB::table('xuxemons')->insertGetId([
            'name' => 'Prizemon',
            'description' => 'Battle reward target',
            'type_id' => $typeId,
            'attack_1_id' => $attackOneId,
            'attack_2_id' => $attackTwoId,
            'hp' => 40,
            'attack' => 15,
            'defense' => 12,
            'icon_path' => 'xuxemons/prizemon.png',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $loserXuxemon = AdquiredXuxemon::create([
            'user_id' => $loser->id,
            'xuxemon_id' => $xuxemonId,
            'level' => 5,
            'experience' => 0,
            'size_id' => 1,
            'requirement_progress' => 0,
            'bonus_hp' => 0,
            'bonus_attack' => 0,
            'bonus_defense' => 0,
            'current_hp' => 25,
        ]);

        Team::create([
            'user_id' => $loser->id,
            'slot_1_adquired_xuxemon_id' => $loserXuxemon->id,
        ]);

        return [$winner, $loser, $loserXuxemon];
    }
}
