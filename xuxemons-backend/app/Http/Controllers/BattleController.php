<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Attack;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Battle;
use App\Models\Size;
use App\Models\StatusEffect;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tymon\JWTAuth\Facades\JWTAuth;

class BattleController extends Controller
{
    public function requestBattle($friendId)
    {
        $userId = Auth::id();

        // Verificar que no haya ya una batalla pendiente entre ellos
        $existing = Battle::where(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $userId)->where('opponent_user_id', $friendId);
        })->orWhere(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $friendId)->where('opponent_user_id', $userId);
        })->whereIn('status', ['pending', 'accepted'])->first();

        if ($existing) {
            return response()->json(['message' => 'Already have a pending/active battle with this friend'], 400);
        }

        $battle = Battle::create([
            'user_id' => $userId,
            'opponent_user_id' => $friendId,
            'status' => 'pending',
        ]);

        return response()->json($battle, 201);
    }

    public function acceptBattle($battleId)
    {
        $battle = Battle::findOrFail($battleId);
        if ($battle->opponent_user_id != Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (count($this->getTeamXuxemons($battle->user_id)) === 0 || count($this->getTeamXuxemons($battle->opponent_user_id)) === 0) {
            return response()->json(['message' => 'Both players need at least one Xuxemon in their team'], 422);
        }

        $userActiveId = $this->getFirstAliveTeamMemberId($battle->user_id);
        $opponentActiveId = $this->getFirstAliveTeamMemberId($battle->opponent_user_id);

        if (! $userActiveId || ! $opponentActiveId) {
            return response()->json(['message' => 'Both players need at least one alive Xuxemon in their team'], 422);
        }

        $battle->status = 'accepted';
        $battle->turn = 0;
        $battle->user_active_adquired_xuxemon_id = $userActiveId;
        $battle->opponent_active_adquired_xuxemon_id = $opponentActiveId;
        $battle->battle_log = ['Battle started!'];
        $battle->save();

        return response()->json($this->buildBattlePayload($battle, Auth::id()));
    }

    public function rejectBattle($battleId)
    {
        $battle = Battle::findOrFail($battleId);
        if ($battle->opponent_user_id != Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $battle->status = 'rejected';
        $battle->save();

        return response()->json($battle);
    }

    public function getPendingBattles()
    {
        $userId = Auth::id();
        $battles = Battle::where('opponent_user_id', $userId)
            ->where('status', 'pending')
            ->with(['user'])
            ->get();

        return response()->json($battles);
    }

    public function getBattle($battleId)
    {
        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);
        $viewerId = Auth::id();

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($this->buildBattlePayload($battle, $viewerId));
    }

    public function streamBattle(Request $request, $battleId)
    {
        $token = (string) $request->query('token', '');

        if ($token === '') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $viewer = JWTAuth::setToken($token)->authenticate();
        } catch (\Throwable) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);
        $viewerId = (string) $viewer->id;

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->stream(function () use ($battleId, $viewerId) {
            ignore_user_abort(true);
            set_time_limit(0);

            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $lastPayloadHash = null;
            $streamDeadline = time() + 45;

            echo "retry: 1500\n\n";
            flush();

            while (! connection_aborted() && time() < $streamDeadline) {
                $battle = Battle::with(['user', 'opponentUser', 'winner'])->find($battleId);

                if (! $battle) {
                    echo "event: error\n";
                    echo 'data: '.json_encode(['message' => 'Battle not found'])."\n\n";
                    flush();
                    break;
                }

                $payload = $this->buildBattlePayload($battle, $viewerId);
                $payloadHash = md5((string) json_encode($payload));

                if ($payloadHash !== $lastPayloadHash) {
                    echo "event: battle\n";
                    echo 'data: '.json_encode($payload)."\n\n";
                    flush();
                    $lastPayloadHash = $payloadHash;
                } else {
                    echo ": keep-alive\n\n";
                    flush();
                }

                if ($payload['winner_id']) {
                    break;
                }

                usleep(900000);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function submitAction(Request $request, $battleId)
    {
        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);
        $viewerId = Auth::id();

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($battle->status !== 'accepted' || $battle->winner_id) {
            return response()->json(['message' => 'Battle is not active'], 422);
        }

        if ($this->getCurrentTurnOwnerId($battle) !== $viewerId) {
            return response()->json(['message' => 'It is not your turn'], 409);
        }

        $actionType = (string) $request->input('action_type');
        $context = $this->resolveParticipantFields($battle, $viewerId);

        $result = DB::transaction(function () use ($request, $battle, $context, $actionType) {
            return match ($actionType) {
                'attack' => $this->performAttackAction($battle, $context, (int) $request->input('attack_id')),
                'switch' => $this->performSwitchAction($battle, $context, (int) $request->input('target_adquired_xuxemon_id')),
                'use_item' => $this->performStatusItemAction($battle, $context, (int) $request->input('bag_item_id')),
                'run' => $this->performRunAction($battle, $context),
                'use_ally_item' => $this->performAllyItemAction(
                    $battle,
                    $context,
                    (int) $request->input('bag_item_id'),
                    (int) $request->input('target_adquired_xuxemon_id')
                ),
                default => response()->json(['message' => 'Unsupported battle action'], 422),
            };
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        return response()->json($this->buildBattlePayload($battle->fresh(['user', 'opponentUser', 'winner']), $viewerId));
    }

    public function useBattleItem(Request $request, $battleId)
    {
        $battle = Battle::findOrFail($battleId);
        $viewerId = Auth::id();

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($battle->status !== 'accepted') {
            return response()->json(['message' => 'Battle is not active'], 422);
        }

        $bagItemId = (int) $request->input('bag_item_id');
        $targetAdquiredXuxemonId = (int) $request->input('target_adquired_xuxemon_id');

        if (! $bagItemId || ! $targetAdquiredXuxemonId) {
            return response()->json(['message' => 'bag_item_id and target_adquired_xuxemon_id are required'], 422);
        }

        $opponentId = $viewerId === $battle->user_id ? $battle->opponent_user_id : $battle->user_id;
        $bag = Bag::where('user_id', $viewerId)->first();

        if (! $bag) {
            return response()->json(['message' => 'User does not have a bag'], 404);
        }

        $bagItem = BagItem::where('id', $bagItemId)
            ->where('bag_id', $bag->id)
            ->with(['item.statusEffect'])
            ->first();

        if (! $bagItem || ! $bagItem->item) {
            return response()->json(['message' => 'Item not found in inventory'], 404);
        }

        if ($bagItem->quantity < 1) {
            return response()->json(['message' => 'You do not have any of this item left'], 422);
        }

        if ($bagItem->item->effect_type !== 'Apply Status Effects') {
            return response()->json(['message' => 'This item cannot be used on the opponent'], 422);
        }

        $target = AdquiredXuxemon::where('id', $targetAdquiredXuxemonId)
            ->where('user_id', $opponentId)
            ->with([
                'xuxemon.type',
                'xuxemon.attack1.statusEffect',
                'xuxemon.attack2.statusEffect',
                'statusEffect',
                'sideEffect1',
                'sideEffect2',
                'sideEffect3',
            ])
            ->first();

        if (! $target) {
            return response()->json(['message' => 'Target Xuxemon not found'], 404);
        }

        if ((int) ($target->current_hp ?? 0) <= 0) {
            return response()->json(['message' => 'Target Xuxemon has already fainted'], 422);
        }

        if ($target->status_effect_id) {
            return response()->json(['message' => 'Target already has a status effect'], 422);
        }

        $statusEffect = $this->resolveBattleItemStatusEffect($bagItem->item->name, $bagItem->item->statusEffect);
        if (! $statusEffect) {
            return response()->json(['message' => 'This status item is not configured correctly'], 422);
        }

        DB::transaction(function () use ($target, $statusEffect, $bagItem) {
            $target->status_effect_id = $statusEffect->id;
            $target->save();
            $bagItem->reduceQuantity(1);
        });

        $target->refresh()->load([
            'xuxemon.type',
            'xuxemon.attack1.statusEffect',
            'xuxemon.attack2.statusEffect',
            'statusEffect',
            'sideEffect1',
            'sideEffect2',
            'sideEffect3',
        ]);

        return response()->json([
            'message' => 'Battle item used successfully',
            'data' => [
                'remaining_quantity' => (int) (BagItem::whereKey($bagItem->id)->value('quantity') ?? 0),
                'applied_status_effect' => $this->serializeStatusEffect($statusEffect),
                'target_xuxemon' => $this->serializeAdquiredXuxemon($target),
            ],
        ]);
    }

    public function usePracticeItem(Request $request)
    {
        $viewerId = Auth::id();
        $bagItemId = (int) $request->input('bag_item_id');

        if (! $viewerId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (! $bagItemId) {
            return response()->json(['message' => 'bag_item_id is required'], 422);
        }

        $bag = Bag::where('user_id', $viewerId)->first();
        if (! $bag) {
            return response()->json(['message' => 'User does not have a bag'], 404);
        }

        $bagItem = BagItem::where('id', $bagItemId)
            ->where('bag_id', $bag->id)
            ->with(['item.statusEffect'])
            ->first();

        if (! $bagItem || ! $bagItem->item) {
            return response()->json(['message' => 'Item not found in inventory'], 404);
        }

        if ($bagItem->quantity < 1) {
            return response()->json(['message' => 'You do not have any of this item left'], 422);
        }

        if ($bagItem->item->effect_type !== 'Apply Status Effects') {
            return response()->json(['message' => 'This item cannot be used in practice battles'], 422);
        }

        $statusEffect = $this->resolveBattleItemStatusEffect($bagItem->item->name, $bagItem->item->statusEffect);
        if (! $statusEffect) {
            return response()->json(['message' => 'This status item is not configured correctly'], 422);
        }

        $bagItem->reduceQuantity(1);

        return response()->json([
            'message' => 'Practice battle item used successfully',
            'data' => [
                'remaining_quantity' => (int) (BagItem::whereKey($bagItem->id)->value('quantity') ?? 0),
                'applied_status_effect' => $this->serializeStatusEffect($statusEffect),
            ],
        ]);
    }

    public function finishBattle(Request $request, $battleId)
    {
        $battle = Battle::findOrFail($battleId);
        $viewerId = Auth::id();

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($battle->status === 'completed' && $battle->winner_id) {
            return response()->json([
                'message' => 'Battle already completed',
                'battle' => $battle,
            ]);
        }

        $winnerId = (string) $request->input('winner_id');
        if (! in_array($winnerId, [$battle->user_id, $battle->opponent_user_id], true)) {
            return response()->json(['message' => 'Invalid winner'], 422);
        }

        $loserId = $winnerId === $battle->user_id ? $battle->opponent_user_id : $battle->user_id;
        $loserXuxemonId = $request->filled('loser_xuxemon_id') ? (int) $request->input('loser_xuxemon_id') : null;

        $stolenXuxemon = DB::transaction(function () use ($battle, $winnerId, $loserId, $loserXuxemonId) {
            $battle->winner_id = $winnerId;
            $battle->status = 'completed';
            $battle->save();

            $xuxemon = null;
            if ($loserXuxemonId) {
                $xuxemon = AdquiredXuxemon::where('id', $loserXuxemonId)
                    ->where('user_id', $loserId)
                    ->first();
            }

            if (! $xuxemon) {
                $xuxemon = AdquiredXuxemon::where('user_id', $loserId)
                    ->inRandomOrder()
                    ->first();
            }

            if (! $xuxemon) {
                return null;
            }

            $this->removeXuxemonFromTeam($loserId, $xuxemon->id);

            $xuxemon->user_id = $winnerId;
            $xuxemon->save();
            $xuxemon->load([
                'xuxemon.type',
                'xuxemon.attack1.statusEffect',
                'xuxemon.attack2.statusEffect',
                'statusEffect',
                'sideEffect1',
                'sideEffect2',
                'sideEffect3',
            ]);

            return $xuxemon;
        });

        return response()->json([
            'message' => $stolenXuxemon
                ? 'Battle finished and Xuxemon transferred'
                : 'Battle finished',
            'battle' => $battle->fresh(['user', 'opponentUser', 'winner']),
            'stolen_xuxemon' => $stolenXuxemon ? $this->serializeAdquiredXuxemon($stolenXuxemon) : null,
        ]);
    }

    private function getTeamXuxemons(string $userId): array
    {
        $team = Team::firstOrCreate(['user_id' => $userId]);
        $teamIds = collect([
            $team->slot_1_adquired_xuxemon_id,
            $team->slot_2_adquired_xuxemon_id,
            $team->slot_3_adquired_xuxemon_id,
            $team->slot_4_adquired_xuxemon_id,
            $team->slot_5_adquired_xuxemon_id,
            $team->slot_6_adquired_xuxemon_id,
        ])->filter()->map(fn ($id) => (int) $id)->values();

        if ($teamIds->isEmpty()) {
            return [];
        }

        $xuxemons = AdquiredXuxemon::where('user_id', $userId)
            ->whereIn('id', $teamIds)
            ->with([
                'xuxemon.type',
                'xuxemon.attack1.statusEffect',
                'xuxemon.attack2.statusEffect',
                'statusEffect',
                'sideEffect1',
                'sideEffect2',
                'sideEffect3',
            ])
            ->get()
            ->keyBy(fn (AdquiredXuxemon $adquired) => (int) $adquired->id);

        return $teamIds
            ->map(fn (int $id) => $xuxemons->has($id) ? $this->serializeAdquiredXuxemon($xuxemons[$id]) : null)
            ->filter()
            ->values()
            ->all();
    }

    private function getOrderedTeamIds(string $userId): array
    {
        $team = Team::firstOrCreate(['user_id' => $userId]);

        return collect([
            $team->slot_1_adquired_xuxemon_id,
            $team->slot_2_adquired_xuxemon_id,
            $team->slot_3_adquired_xuxemon_id,
            $team->slot_4_adquired_xuxemon_id,
            $team->slot_5_adquired_xuxemon_id,
            $team->slot_6_adquired_xuxemon_id,
        ])->filter()->map(fn ($id) => (int) $id)->values()->all();
    }

    private function getFirstAliveTeamMemberId(string $userId): ?int
    {
        foreach ($this->getOrderedTeamIds($userId) as $teamMemberId) {
            $xuxemon = AdquiredXuxemon::where('id', $teamMemberId)
                ->where('user_id', $userId)
                ->first();

            if ($xuxemon && (int) ($xuxemon->current_hp ?? 0) > 0) {
                return (int) $xuxemon->id;
            }
        }

        return null;
    }

    private function getOwnedXuxemons(string $userId): array
    {
        return AdquiredXuxemon::where('user_id', $userId)
            ->with([
                'xuxemon.type',
                'xuxemon.attack1.statusEffect',
                'xuxemon.attack2.statusEffect',
                'statusEffect',
                'sideEffect1',
                'sideEffect2',
                'sideEffect3',
            ])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (AdquiredXuxemon $adquired) => $this->serializeAdquiredXuxemon($adquired))
            ->values()
            ->all();
    }

    private function buildBattlePayload(Battle $battle, string $viewerId): array
    {
        $context = $this->resolveParticipantFields($battle, $viewerId);

        return [
            'id' => $battle->id,
            'user_id' => $battle->user_id,
            'opponent_user_id' => $battle->opponent_user_id,
            'winner_id' => $battle->winner_id,
            'completion_reason' => $battle->completion_reason,
            'runner_id' => $battle->runner_id,
            'status' => $battle->status,
            'turn' => (int) $battle->turn,
            'user' => $battle->user,
            'opponent_user' => $battle->opponentUser,
            'winner' => $battle->winner,
            'my_team' => $this->getTeamXuxemons($viewerId),
            'opponent_team' => $this->getTeamXuxemons($context['opponent_id']),
            'opponent_available_xuxemons' => $this->getOwnedXuxemons($context['opponent_id']),
            'my_active_xuxemon_id' => (int) ($battle->{$context['player_field']} ?? 0),
            'opponent_active_xuxemon_id' => (int) ($battle->{$context['opponent_field']} ?? 0),
            'battle_log' => array_values($battle->battle_log ?? []),
        ];
    }

    private function resolveParticipantFields(Battle $battle, string $viewerId): array
    {
        $isOwner = $viewerId === $battle->user_id;

        return [
            'player_id' => $viewerId,
            'opponent_id' => $isOwner ? $battle->opponent_user_id : $battle->user_id,
            'player_field' => $isOwner ? 'user_active_adquired_xuxemon_id' : 'opponent_active_adquired_xuxemon_id',
            'opponent_field' => $isOwner ? 'opponent_active_adquired_xuxemon_id' : 'user_active_adquired_xuxemon_id',
        ];
    }

    private function getCurrentTurnOwnerId(Battle $battle): string
    {
        return ((int) $battle->turn % 2 === 0)
            ? (string) $battle->user_id
            : (string) $battle->opponent_user_id;
    }

    private function performAttackAction(Battle $battle, array $context, int $attackId): ?JsonResponse
    {
        if (! $attackId) {
            return response()->json(['message' => 'attack_id is required'], 422);
        }

        $attacker = $this->loadBattleXuxemon((int) $battle->{$context['player_field']}, $context['player_id']);
        $defender = $this->loadBattleXuxemon((int) $battle->{$context['opponent_field']}, $context['opponent_id']);

        if (! $attacker || ! $defender) {
            return response()->json(['message' => 'Battle Xuxemon state is invalid'], 422);
        }

        if ((int) ($attacker->current_hp ?? 0) <= 0) {
            return response()->json(['message' => 'Your active Xuxemon has fainted and must switch'], 422);
        }

        $statusResponse = $this->resolvePreAttackStatus($battle, $attacker, $context['player_id']);
        if ($statusResponse instanceof JsonResponse) {
            return $statusResponse;
        }
        if ($statusResponse === false) {
            return null;
        }

        $attack = $this->findAttackForXuxemon($attacker, $attackId);
        if (! $attack) {
            return response()->json(['message' => 'Attack not available for this Xuxemon'], 422);
        }

        $roll = random_int(1, 6);
        $attackerStat = $attacker->attack ?: 10;
        $defenderStat = $defender->defense ?: 5;
        $modifiers = $this->calculateBattleModifiers($attacker, $defender);
        $baseDamage = $attack->dmg ?: 10;
        $rawDamage = $baseDamage + $roll + ($attackerStat / 2) - ($defenderStat / 4) + $modifiers;
        $damagePercent = max(5, min(60, $rawDamage * 0.4));
        $defenderMaxHp = $defender->hp ?: 100;
        $damageAmount = max(1, (int) round(($damagePercent / 100) * $defenderMaxHp));

        $defender->current_hp = max(0, (int) $defender->current_hp - $damageAmount);
        $defender->save();

        $this->appendBattleLog($battle, sprintf('%s used %s! (Roll: %d, -%d HP)', $attacker->name, $attack->name, $roll, $damageAmount));

        if ($modifiers > 0) {
            $this->appendBattleLog($battle, 'It\'s super effective!');
        } elseif ($modifiers < 0) {
            $this->appendBattleLog($battle, 'It\'s not very effective...');
        }

        if ((int) $defender->current_hp <= 0) {
            $this->appendBattleLog($battle, sprintf('%s fainted!', $defender->name));

            if ($this->hasAliveTeamMembers($context['opponent_id'], (int) $defender->id)) {
                $battle->turn = (int) $battle->turn + 1;
            } else {
                $battle->winner_id = $context['player_id'];
                $battle->status = 'completed';
                $this->appendBattleLog($battle, sprintf('%s wins the battle!', $attacker->name));
            }
        } else {
            $battle->turn = (int) $battle->turn + 1;
        }

        $battle->save();

        return null;
    }

    private function performSwitchAction(Battle $battle, array $context, int $targetId): ?JsonResponse
    {
        if (! $targetId) {
            return response()->json(['message' => 'target_adquired_xuxemon_id is required'], 422);
        }

        if (! in_array($targetId, $this->getOrderedTeamIds($context['player_id']), true)) {
            return response()->json(['message' => 'Selected Xuxemon is not in your team'], 422);
        }

        $target = $this->loadBattleXuxemon($targetId, $context['player_id']);
        if (! $target || (int) ($target->current_hp ?? 0) <= 0) {
            return response()->json(['message' => 'Selected Xuxemon cannot enter battle'], 422);
        }

        if ((int) $battle->{$context['player_field']} === $targetId) {
            return response()->json(['message' => 'That Xuxemon is already active'], 422);
        }

        $battle->{$context['player_field']} = $targetId;
        $battle->turn = (int) $battle->turn + 1;
        $this->appendBattleLog($battle, sprintf('%s enters the battle!', $target->name));
        $battle->save();

        return null;
    }

    private function performStatusItemAction(Battle $battle, array $context, int $bagItemId): ?JsonResponse
    {
        if (! $bagItemId) {
            return response()->json(['message' => 'bag_item_id is required'], 422);
        }

        $bag = Bag::where('user_id', $context['player_id'])->first();
        if (! $bag) {
            return response()->json(['message' => 'User does not have a bag'], 404);
        }

        $bagItem = BagItem::where('id', $bagItemId)
            ->where('bag_id', $bag->id)
            ->with(['item.statusEffect'])
            ->first();

        if (! $bagItem || ! $bagItem->item) {
            return response()->json(['message' => 'Item not found in inventory'], 404);
        }

        if ($bagItem->quantity < 1) {
            return response()->json(['message' => 'You do not have any of this item left'], 422);
        }

        if ($bagItem->item->effect_type !== 'Apply Status Effects') {
            return response()->json(['message' => 'This item cannot be used on the opponent'], 422);
        }

        $target = $this->loadBattleXuxemon((int) $battle->{$context['opponent_field']}, $context['opponent_id']);
        if (! $target) {
            return response()->json(['message' => 'Opponent active Xuxemon not found'], 404);
        }

        if ((int) ($target->current_hp ?? 0) <= 0) {
            return response()->json(['message' => 'Target Xuxemon has already fainted'], 422);
        }

        if ($target->status_effect_id) {
            return response()->json(['message' => 'Target already has a status effect'], 422);
        }

        $statusEffect = $this->resolveBattleItemStatusEffect($bagItem->item->name, $bagItem->item->statusEffect);
        if (! $statusEffect) {
            return response()->json(['message' => 'This status item is not configured correctly'], 422);
        }

        $target->status_effect_id = $statusEffect->id;
        $target->save();
        $bagItem->reduceQuantity(1);

        $battle->turn = (int) $battle->turn + 1;
        $this->appendBattleLog($battle, sprintf('%s used %s on %s!', $context['player_id'] === $battle->user_id ? $battle->user->name : $battle->opponentUser->name, $bagItem->item->name, $target->name));
        $battle->save();

        return null;
    }

    private function performRunAction(Battle $battle, array $context): ?JsonResponse
    {
        $runnerName = $context['player_id'] === $battle->user_id
            ? ($battle->user->name ?? 'A player')
            : ($battle->opponentUser->name ?? 'A player');

        $battle->winner_id = $context['opponent_id'];
        $battle->status = 'completed';
        $battle->completion_reason = 'runaway';
        $battle->runner_id = $context['player_id'];
        $this->appendBattleLog($battle, sprintf('%s fled the battle!', $runnerName));
        $battle->save();

        return null;
    }

    private function performAllyItemAction(Battle $battle, array $context, int $bagItemId, int $targetId): ?JsonResponse
    {
        if (! $bagItemId || ! $targetId) {
            return response()->json(['message' => 'bag_item_id and target_adquired_xuxemon_id are required'], 422);
        }

        if (! in_array($targetId, $this->getOrderedTeamIds($context['player_id']), true)) {
            return response()->json(['message' => 'Target Xuxemon is not in your team'], 422);
        }

        $target = $this->loadBattleXuxemon($targetId, $context['player_id']);
        if (! $target) {
            return response()->json(['message' => 'Target Xuxemon not found'], 404);
        }

        $bag = Bag::where('user_id', $context['player_id'])->first();
        if (! $bag) {
            return response()->json(['message' => 'User does not have a bag'], 404);
        }

        $bagItem = BagItem::where('id', $bagItemId)
            ->where('bag_id', $bag->id)
            ->with('item')
            ->first();

        if (! $bagItem || ! $bagItem->item) {
            return response()->json(['message' => 'Item not found in inventory'], 404);
        }

        if ($bagItem->quantity < 1) {
            return response()->json(['message' => 'You do not have any of this item left'], 422);
        }

        $effectData = match ($bagItem->item->effect_type) {
            'Heal' => $this->applyHealingDuringBattle($bagItem, $target),
            'Defense Up' => $this->applyDefenseUpDuringBattle($bagItem, $target),
            'DMG Up' => $this->applyAttackUpDuringBattle($bagItem, $target),
            'Remove Status Effects' => $this->applyRemoveStatusEffectsDuringBattle($bagItem, $target),
            default => null,
        };

        if ($effectData === null) {
            return response()->json(['message' => 'This item cannot be used during battle'], 422);
        }

        if (! empty($effectData['error'])) {
            return response()->json(['message' => $effectData['message'] ?? 'Unable to use this item'], 422);
        }

        $battle->turn = (int) $battle->turn + 1;
        $this->appendBattleLog($battle, sprintf('%s used %s on %s!', $context['player_id'] === $battle->user_id ? $battle->user->name : $battle->opponentUser->name, $bagItem->item->name, $target->name));
        $battle->save();

        return null;
    }

    private function loadBattleXuxemon(int $adquiredId, string $userId): ?AdquiredXuxemon
    {
        if (! $adquiredId) {
            return null;
        }

        return AdquiredXuxemon::where('id', $adquiredId)
            ->where('user_id', $userId)
            ->with([
                'xuxemon.type',
                'xuxemon.attack1.statusEffect',
                'xuxemon.attack2.statusEffect',
                'statusEffect',
                'sideEffect1',
                'sideEffect2',
                'sideEffect3',
            ])
            ->first();
    }

    private function findAttackForXuxemon(AdquiredXuxemon $adquired, int $attackId): ?Attack
    {
        $adquired->loadMissing(['xuxemon.attack1', 'xuxemon.attack2']);

        return collect([
            $adquired->xuxemon?->attack1,
            $adquired->xuxemon?->attack2,
        ])->first(fn ($attack) => $attack && (int) $attack->id === $attackId);
    }

    private function calculateBattleModifiers(AdquiredXuxemon $attacker, AdquiredXuxemon $defender): int
    {
        $modifiers = 0;
        $attackerType = strtolower((string) ($attacker->type->name ?? ''));
        $defenderType = strtolower((string) ($defender->type->name ?? ''));

        if (($attackerType === 'aigua' && $defenderType === 'terra')
            || ($attackerType === 'terra' && $defenderType === 'aire')
            || ($attackerType === 'aire' && $defenderType === 'aigua')) {
            $modifiers += 2;
        }

        if (($attackerType === 'terra' && $defenderType === 'aigua')
            || ($attackerType === 'aire' && $defenderType === 'terra')
            || ($attackerType === 'aigua' && $defenderType === 'aire')) {
            $modifiers -= 2;
        }

        if ($attacker->size === 'Large') {
            $modifiers += 1;
        }

        return $modifiers;
    }

    private function resolvePreAttackStatus(Battle $battle, AdquiredXuxemon $xuxemon, string $playerId): bool|JsonResponse
    {
        $statusName = $xuxemon->statusEffect?->name;
        if (! $statusName) {
            return true;
        }

        if ($statusName === 'Sleep') {
            $this->appendBattleLog($battle, sprintf('%s is asleep and cannot move!', $xuxemon->name));
            $xuxemon->status_effect_id = null;
            $xuxemon->save();
            $battle->turn = (int) $battle->turn + 1;
            $battle->save();

            return false;
        }

        if ($statusName === 'Paralysis' && random_int(1, 100) <= 35) {
            $this->appendBattleLog($battle, sprintf('%s is paralyzed and cannot move!', $xuxemon->name));
            $battle->turn = (int) $battle->turn + 1;
            $battle->save();

            return false;
        }

        if ($statusName === 'Confusion' && random_int(1, 100) <= 50) {
            $selfHitDamage = max(1, (int) round(($xuxemon->hp ?: 100) * 0.12));
            $xuxemon->current_hp = max(0, (int) $xuxemon->current_hp - $selfHitDamage);
            $xuxemon->save();

            $this->appendBattleLog($battle, sprintf('%s is confused and hurt itself!', $xuxemon->name));

            if ((int) $xuxemon->current_hp <= 0) {
                $this->appendBattleLog($battle, sprintf('%s fainted!', $xuxemon->name));

                if ($this->hasAliveTeamMembers($playerId, (int) $xuxemon->id)) {
                    $battle->turn = (int) $battle->turn + 1;
                    $battle->save();

                    return false;
                }

                $battle->winner_id = $playerId === $battle->user_id ? $battle->opponent_user_id : $battle->user_id;
                $battle->status = 'completed';
                $battle->save();

                return false;
            }

            $battle->turn = (int) $battle->turn + 1;
            $battle->save();

            return false;
        }

        return true;
    }

    private function hasAliveTeamMembers(string $userId, ?int $excludeId = null): bool
    {
        foreach ($this->getOrderedTeamIds($userId) as $teamMemberId) {
            if ($excludeId !== null && $teamMemberId === $excludeId) {
                continue;
            }

            $xuxemon = AdquiredXuxemon::where('id', $teamMemberId)
                ->where('user_id', $userId)
                ->first();

            if ($xuxemon && (int) ($xuxemon->current_hp ?? 0) > 0) {
                return true;
            }
        }

        return false;
    }

    private function appendBattleLog(Battle $battle, string $message): void
    {
        $logs = is_array($battle->battle_log) ? $battle->battle_log : [];
        array_unshift($logs, $message);
        $battle->battle_log = array_slice($logs, 0, 8);
    }

    private function applyHealingDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $adquired->loadMissing('xuxemon');
        $percentage = max(0, (int) $bagItem->item->effect_value);
        $maxHp = $adquired->hp;
        $currentHp = (int) $adquired->current_hp;
        $healAmount = (int) round($maxHp * $percentage / 100);
        $adquired->current_hp = min($currentHp + $healAmount, $maxHp);
        $adquired->save();
        $bagItem->reduceQuantity(1);

        return ['remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0];
    }

    private function applyAttackUpDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $amount = max(0, (int) $bagItem->item->effect_value);
        $adquired->bonus_attack = (int) $adquired->bonus_attack + $amount;
        $adquired->save();
        $bagItem->reduceQuantity(1);

        return ['remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0];
    }

    private function applyDefenseUpDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $amount = max(0, (int) $bagItem->item->effect_value);
        $adquired->bonus_defense = (int) $adquired->bonus_defense + $amount;
        $adquired->save();
        $bagItem->reduceQuantity(1);

        return ['remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0];
    }

    private function applyRemoveStatusEffectsDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $name = $bagItem->item->name;

        if ($name === 'Nulberry') {
            $adquired->status_effect_id = null;
            $adquired->side_effect_id_1 = null;
            $adquired->side_effect_id_2 = null;
            $adquired->side_effect_id_3 = null;
        } elseif ($name === 'Yellow Mushroom') {
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            if ($adquired->sideEffect1?->name === 'Gluttony') {
                $adquired->side_effect_id_1 = null;
            }
            if ($adquired->sideEffect2?->name === 'Gluttony') {
                $adquired->side_effect_id_2 = null;
            }
            if ($adquired->sideEffect3?->name === 'Gluttony') {
                $adquired->side_effect_id_3 = null;
            }
        } elseif ($name === 'Red Mushroom') {
            $adquired->load(['sideEffect1', 'sideEffect2', 'sideEffect3']);
            if ($adquired->sideEffect1?->name === 'Starving') {
                $adquired->side_effect_id_1 = null;
            }
            if ($adquired->sideEffect2?->name === 'Starving') {
                $adquired->side_effect_id_2 = null;
            }
            if ($adquired->sideEffect3?->name === 'Starving') {
                $adquired->side_effect_id_3 = null;
            }
        }

        $adquired->save();
        $bagItem->reduceQuantity(1);

        return ['remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0];
    }

    private function serializeAdquiredXuxemon(AdquiredXuxemon $adquired): array
    {
        if (! $adquired->xuxemon) {
            return [];
        }

        $xuxemon = $adquired->xuxemon->toArray();
        $maxHp = $adquired->hp;
        $progress = (int) $adquired->requirement_progress;
        $sizeBreakpoints = Size::orderBy('id')->get()->mapWithKeys(function ($size) {
            return [$size->size => (int) $size->requirement_progress];
        })->toArray();
        $nextSizeForRequirement = Size::where('id', '>', $adquired->size_id)
            ->orderBy('id')
            ->first();
        $nextSize = Size::resolveForProgress($progress + 1)?->size ?? $adquired->size;

        $xuxemon['adquired_at'] = $adquired->created_at;
        $xuxemon['level'] = $adquired->level;
        $xuxemon['hp'] = $maxHp;
        $xuxemon['current_hp'] = $adquired->getAttribute('current_hp') !== null ? (int) $adquired->current_hp : $maxHp;
        $xuxemon['attack'] = $adquired->attack;
        $xuxemon['defense'] = $adquired->defense;
        $xuxemon['size'] = $adquired->size;
        $xuxemon['adquired_id'] = $adquired->id;
        $xuxemon['requirement_progress'] = $progress;
        $xuxemon['requirement_total'] = $nextSizeForRequirement
            ? (int) $nextSizeForRequirement->requirement_progress
            : $progress;
        $xuxemon['size_breakpoints'] = $sizeBreakpoints;
        $xuxemon['requirement_total_max'] = $sizeBreakpoints['Large'] ?? $xuxemon['requirement_total'];
        $xuxemon['next_size'] = $nextSize;
        $xuxemon['will_evolve_next'] = $nextSize !== $xuxemon['size'];
        $xuxemon['status_effect_applied'] = $adquired->statusEffect;
        $xuxemon['side_effect_1'] = $adquired->sideEffect1;
        $xuxemon['side_effect_2'] = $adquired->sideEffect2;
        $xuxemon['side_effect_3'] = $adquired->sideEffect3;

        return $xuxemon;
    }

    private function removeXuxemonFromTeam(string $userId, int $adquiredXuxemonId): void
    {
        $team = Team::where('user_id', $userId)->first();
        if (! $team) {
            return;
        }

        foreach (range(1, 6) as $slotNumber) {
            $field = "slot_{$slotNumber}_adquired_xuxemon_id";
            if ((int) $team->{$field} === $adquiredXuxemonId) {
                $team->{$field} = null;
            }
        }

        $team->save();
    }

    private function resolveBattleItemStatusEffect(string $itemName, ?StatusEffect $configuredStatusEffect): ?StatusEffect
    {
        if ($configuredStatusEffect) {
            return $configuredStatusEffect;
        }

        return match ($itemName) {
            'Paralyzing Knife' => StatusEffect::where('name', 'Paralysis')->first(),
            'Sleeping Knife' => StatusEffect::where('name', 'Sleep')->first(),
            'Flash' => StatusEffect::where('name', 'Confusion')->first(),
            default => null,
        };
    }

    private function serializeStatusEffect(StatusEffect $statusEffect): array
    {
        return [
            'id' => $statusEffect->id,
            'name' => $statusEffect->name,
            'description' => $statusEffect->description,
            'icon_path' => $statusEffect->icon_path,
        ];
    }
}
