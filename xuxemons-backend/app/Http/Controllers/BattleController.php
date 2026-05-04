<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Attack;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Battle;
use App\Models\Friend;
use App\Models\Size;
use App\Models\StatusEffect;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tymon\JWTAuth\Facades\JWTAuth;

class BattleController extends Controller
{
    // Sirve para crear una solicitud de batalla entre dos amigos validando estado previo.
    public function requestBattle($friendId)
    {
        $userId = Auth::id();

        if (! $userId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ((string) $friendId === (string) $userId) {
            return response()->json(['message' => 'You cannot challenge yourself'], 422);
        }

        $areFriends = Friend::where('user_id', $userId)
            ->where('friend_user_id', $friendId)
            ->exists();

        if (! $areFriends) {
            return response()->json(['message' => 'You can only challenge users in your friends list'], 403);
        }

        if (count($this->getOrderedTeamIds((string) $userId)) === 0) {
            return response()->json([
                'message' => 'You do not have any Xuxemons equipped. Equip at least one to challenge other players.',
            ], 422);
        }

        // Resolver la batalla mas reciente entre ambos jugadores y decidir por estado.
        $latestBattle = Battle::where(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $userId)->where('opponent_user_id', $friendId);
        })->orWhere(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $friendId)->where('opponent_user_id', $userId);
        })->latest('updated_at')->first();

        if ($latestBattle && in_array($latestBattle->status, ['pending', 'accepted'], true)) {
            $staleCutoff = now()->subMinutes(5);
            $isStale = ! $latestBattle->updated_at || $latestBattle->updated_at->lt($staleCutoff);

            if (! $isStale) {
                $isPending = $latestBattle->status === 'pending';

                return response()->json([
                    'message' => $isPending
                        ? 'Already have a pending challenge with this friend'
                        : 'Already have an active battle with this friend',
                    'battle_id' => $latestBattle->id,
                    'status' => $latestBattle->status,
                ], 409);
            }

            if ($latestBattle->status === 'pending') {
                $latestBattle->status = 'rejected';
                $latestBattle->completion_reason = $latestBattle->completion_reason ?: 'request_expired';
                $latestBattle->save();
            } else {
                $latestBattle->status = 'completed';
                $latestBattle->completion_reason = 'abandoned';
                $latestBattle->runner_id = $userId;
                $latestBattle->winner_id = $userId === $latestBattle->user_id
                    ? $latestBattle->opponent_user_id
                    : $latestBattle->user_id;
                $this->appendBattleLog($latestBattle, 'Battle auto-closed due to inactivity.');
                $latestBattle->save();
            }
        }

        $battle = Battle::create([
            'user_id' => $userId,
            'opponent_user_id' => $friendId,
            'status' => 'pending',
        ]);

        return response()->json($battle, 201);
    }

    // Sirve para aceptar una solicitud pendiente e inicializar el estado del combate.
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

    // Sirve para rechazar una solicitud de batalla pendiente.
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

    // Sirve para listar las invitaciones de batalla pendientes para el usuario autenticado.
    public function getPendingBattles()
    {
        $userId = Auth::id();
        $battles = Battle::where('opponent_user_id', $userId)
            ->where('status', 'pending')
            ->with(['user'])
            ->get();

        return response()->json($battles);
    }

    // Sirve para devolver el payload completo de una batalla a uno de sus participantes.
    public function getBattle($battleId)
    {
        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);
        $viewerId = Auth::id();

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($inactiveResponse = $this->buildInactiveBattleRouteResponse($battle)) {
            return response()->json($inactiveResponse['body'], $inactiveResponse['status']);
        }

        return response()->json($this->buildBattlePayload($battle, $viewerId));
    }

    // Sirve para abrir un stream SSE (Server-Sent Events es un protocolo de comunicación bidireccional entre el servidor y el cliente) con actualizaciones en tiempo real del combate.
    public function streamBattle(Request $request, $battleId)
    {
        $viewerId = $this->resolveViewerIdFromToken($request);

        if (! $viewerId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($inactiveResponse = $this->buildInactiveBattleRouteResponse($battle)) {
            return response()->json($inactiveResponse['body'], $inactiveResponse['status']);
        }

        return response()->stream(function () use ($battleId, $viewerId) {
            ignore_user_abort(true); // Ignora la interrupción del usuario para que el stream siga funcionando incluso si el usuario cierra la pestaña.
            set_time_limit(0); // No limita el tiempo de ejecución del stream.

            while (ob_get_level() > 0) { // Cierra todos los buffers de salida.
                ob_end_flush();
            }

            $lastPayloadHash = null;
            $streamDeadline = time() + 45;

            echo "retry: 1500\n\n"; // El cliente SSE esperará 1.5 segundos antes de reconectarse si la conexión se pierde.
            flush(); // Envía los datos al cliente.

            $shouldContinue = true;
            while ($shouldContinue && ! connection_aborted() && time() < $streamDeadline) {
                $battle = Battle::with(['user', 'opponentUser', 'winner'])->find($battleId);

                if (! $battle) {
                    echo "event: error\n";
                    echo 'data: '.json_encode(['message' => 'Battle not found'])."\n\n";
                    flush();
                    $shouldContinue = false;

                    continue;
                }

                // Construye el payload (estructura de datos que se envía al cliente) de la batalla.
                $payload = $this->buildBattlePayload($battle, $viewerId);
                $payloadHash = md5((string) json_encode($payload)); // Genera un hash del payload para evitar enviar datos redundantes.

                if ($payloadHash !== $lastPayloadHash) { // Si el hash del payload es diferente al último hash, envía el payload al cliente.
                    echo "event: battle\n";
                    echo 'data: '.json_encode($payload)."\n\n"; // Envía el payload al cliente.
                    flush();
                    $lastPayloadHash = $payloadHash;
                } else {
                    echo ": keep-alive\n\n";
                    flush();
                }

                if ($payload['winner_id']) {
                    $shouldContinue = false;

                    continue;
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

    // Sirve para registrar la desconexión del jugador del combate.
    public function disconnectBattle(Request $request, $battleId)
    {
        $viewerId = $this->resolveViewerIdFromToken($request);

        if (! $viewerId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($battle->status !== 'accepted' || $battle->winner_id) {
            return response()->json($this->buildBattlePayload($battle, $viewerId));
        }

        $context = $this->resolveParticipantFields($battle, $viewerId);

        DB::transaction(function () use ($battle, $context) {
            $this->completeBattleAsRunaway($battle, $context);
        });

        return response()->json($this->buildBattlePayload($battle->fresh(['user', 'opponentUser', 'winner']), $viewerId));
    }

    // Sirve para procesar acciones del turno (ataque, cambio o huida).
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

    // Sirve para aplicar un objeto de batalla sobre un objetivo válido del equipo.
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

        $statusEffect = $this->resolveBattleItemStatusEffect($bagItem->item->name, $bagItem->item->statusEffect);
        if (! $statusEffect) {
            return response()->json(['message' => 'This status item is not configured correctly'], 422);
        }

        DB::transaction(function () use ($target, $statusEffect, $bagItem) {
            $target->status_effect_id = $statusEffect->id;
            $statusName = $statusEffect->name;
            if ($statusName === 'Paralysis' || $statusName === 'Confusion') {
                $target->status_effect_turns = 3;
            } else {
                $target->status_effect_turns = null;
            }
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

    // Sirve para simular uso de objeto en modo práctica sin persistencia competitiva.
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

    // Sirve para cerrar el combate, asignar ganador y aplicar recompensas finales.
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

        if ($viewerId !== $winnerId) {
            return response()->json(['message' => 'Only the winner can claim the battle reward'], 403);
        }

        $loserId = $winnerId === $battle->user_id ? $battle->opponent_user_id : $battle->user_id;
        $loserXuxemonId = $request->filled('loser_xuxemon_id') ? (int) $request->input('loser_xuxemon_id') : null;

        $stolenXuxemon = DB::transaction(function () use ($battle, $winnerId, $loserId, $loserXuxemonId) {
            $shouldApplyRewards = ! $battle->winner_id;

            $battle->winner_id = $winnerId;
            $battle->status = 'completed';
            $battle->save();

            if ($shouldApplyRewards) {
                $this->applyBattleRewards($winnerId, $loserId);
            }

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

    // Sirve para recuperar los Xuxemons del equipo con sus datos listos para combate.
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

    // Sirve para devolver los IDs de slots en orden y sin valores nulos.
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

    // Sirve para resolver el primer Xuxemon vivo del equipo de un jugador.
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

    // Sirve para listar todos los Xuxemons que posee un usuario.
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

    // Sirve para construir el payload de batalla adaptado al jugador que consulta.
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
            'opponent_available_xuxemons' => $this->getTeamXuxemons($context['opponent_id']),
            'my_active_xuxemon_id' => (int) ($battle->{$context['player_field']} ?? 0),
            'opponent_active_xuxemon_id' => (int) ($battle->{$context['opponent_field']} ?? 0),
            'battle_log' => array_values($battle->battle_log ?? []),
        ];
    }

    // Sirve para impedir que una batalla no aceptada se use como ruta de combate viva.
    private function buildInactiveBattleRouteResponse(Battle $battle): ?array
    {
        if ($battle->status === 'accepted') {
            return null;
        }

        $status = (string) $battle->status;
        $httpStatus = $status === 'pending' ? 409 : 410;
        $message = match ($status) {
            'pending' => 'Battle challenge is still pending',
            'rejected' => 'Battle challenge was rejected',
            'completed' => 'Battle already completed',
            default => 'Battle is not active',
        };

        return [
            'status' => $httpStatus,
            'body' => [
                'message' => $message,
                'battle_id' => $battle->id,
                'status' => $status,
                'winner_id' => $battle->winner_id,
                'completion_reason' => $battle->completion_reason,
                'runner_id' => $battle->runner_id,
            ],
        ];
    }

    // Sirve para mapear campos user/opponent según la perspectiva del viewer.
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

    // Sirve para calcular a quién pertenece el turno actual.
    private function getCurrentTurnOwnerId(Battle $battle): string
    {
        return ((int) $battle->turn % 2 === 0)
            ? (string) $battle->user_id
            : (string) $battle->opponent_user_id;
    }

    // Sirve para ejecutar un ataque y persistir su resultado en la batalla.
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

        $defender->loadMissing('statusEffect');

        $roll = random_int(1, 6);
        $attackerStat = $attacker->attack ?: 10;
        $defenderStat = $defender->defense ?: 5;
        $modifiers = $this->calculateBattleModifiers($attacker, $defender);
        $typeMatchup = $this->calculateTypeMatchupModifier($attacker, $defender);
        $defenderMaxHp = $defender->hp ?: 100;
        $damageAmount = $this->calculateBattleDamageAmount(
            $attackerStat,
            $defenderStat,
            $attack->dmg,
            $roll,
            $modifiers,
            $defenderMaxHp,
        );

        $hadSleep = strtolower(trim((string) ($defender->statusEffect?->name ?? ''))) === 'sleep';

        if ($hadSleep) {
            $damageAmount = min((int) $defender->current_hp, $damageAmount * 2);
            $defender->status_effect_id = null;
            $defender->status_effect_turns = null;
        }

        $defender->current_hp = max(0, (int) $defender->current_hp - $damageAmount);
        $defender->save();

        if ($hadSleep) {
            $this->appendBattleLog($battle, sprintf('%s woke up taking double damage!', $defender->name));
        }

        $this->appendBattleLog($battle, sprintf('%s used %s! (Roll: %d, -%d HP)', $attacker->name, $attack->name, $roll, $damageAmount));

        if ($typeMatchup > 0) {
            $this->appendBattleLog($battle, 'It\'s super effective!');
        } elseif ($typeMatchup < 0) {
            $this->appendBattleLog($battle, 'It\'s not very effective...');
        }

        $this->applyAttackStatusEffectIfNeeded($battle, $attack, $defender);

        if ((int) $defender->current_hp <= 0) {
            $this->appendBattleLog($battle, sprintf('%s fainted!', $defender->name));

            if ($this->hasAliveTeamMembers($context['opponent_id'], (int) $defender->id)) {
                $battle->turn = (int) $battle->turn + 1;
            } else {
                $battle->winner_id = $context['player_id'];
                $this->applyBattleRewards($context['player_id'], $context['opponent_id']);
                $this->appendBattleLog($battle, sprintf('%s wins the battle!', $attacker->name));
            }
        } else {
            $battle->turn = (int) $battle->turn + 1;
        }

        $battle->save();

        return null;
    }

    // Sirve para cambiar el Xuxemon activo del jugador en su turno.
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

        $outgoingId = (int) $battle->{$context['player_field']};
        $outgoing = $outgoingId > 0
            ? AdquiredXuxemon::where('id', $outgoingId)->first()
            : null;
        $wasForcedSwitch = $outgoing !== null && (int) ($outgoing->current_hp ?? 0) <= 0;

        $battle->{$context['player_field']} = $targetId;

        if (! $wasForcedSwitch) {
            $battle->turn = (int) $battle->turn + 1;
        }

        $this->appendBattleLog($battle, sprintf('%s enters the battle!', $target->name));
        $battle->save();

        return null;
    }

    // Sirve para aplicar objetos de estado sobre el Xuxemon activo aliado.
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

        $statusEffect = $this->resolveBattleItemStatusEffect($bagItem->item->name, $bagItem->item->statusEffect);
        if (! $statusEffect) {
            return response()->json(['message' => 'This status item is not configured correctly'], 422);
        }

        $target->status_effect_id = $statusEffect->id;
        $statusName = $statusEffect->name;
        if ($statusName === 'Paralysis' || $statusName === 'Confusion') {
            $target->status_effect_turns = 3;
        } else {
            $target->status_effect_turns = null;
        }
        $target->save();
        $bagItem->reduceQuantity(1);

        $battle->turn = (int) $battle->turn + 1;
        $this->appendBattleLog($battle, sprintf('%s used %s on %s!', $context['player_id'] === $battle->user_id ? $battle->user->name : $battle->opponentUser->name, $bagItem->item->name, $target->name));
        $battle->save();

        return null;
    }

    // Sirve para rendirse y finalizar la batalla declarando ganador al oponente.
    public function forfeitBattle(Request $request, $battleId)
    {
        $battle = Battle::with(['user', 'opponentUser', 'winner'])->findOrFail($battleId);
        $viewerId = Auth::id();

        if ($viewerId !== $battle->user_id && $viewerId !== $battle->opponent_user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($battle->status !== 'accepted' || $battle->winner_id) {
            return response()->json(['message' => 'Battle is not active'], 422);
        }

        $context = $this->resolveParticipantFields($battle, $viewerId);

        DB::transaction(function () use ($battle, $context) {
            $this->completeBattleAsRunaway($battle, $context);
        });

        return response()->json($this->buildBattlePayload($battle->fresh(['user', 'opponentUser', 'winner']), $viewerId));
    }

    // Sirve para procesar la acción de huida y su resolución final.
    private function performRunAction(Battle $battle, array $context): ?JsonResponse
    {
        $this->completeBattleAsRunaway($battle, $context);

        return null;
    }

    // Sirve para resolver el ID de usuario autenticado desde JWT en stream/peticiones.
    private function resolveViewerIdFromToken(Request $request): ?string
    {
        $token = (string) ($request->query('token') ?: $request->input('token', ''));

        if ($token === '') {
            return null;
        }

        try {
            $viewer = JWTAuth::setToken($token)->authenticate();
        } catch (\Throwable) {
            return null;
        }

        return $viewer ? (string) $viewer->id : null;
    }

    // Sirve para cerrar la batalla cuando un jugador logra huir.
    private function completeBattleAsRunaway(Battle $battle, array $context): void
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

        $this->applyBattleRewards($context['opponent_id'], $context['player_id']);
    }

    // Sirve para aplicar recompensas de victoria/derrota al cerrar combate.
    private function applyBattleRewards(string $winnerId, string $loserId): void
    {
        $winner = User::query()->lockForUpdate()->find($winnerId);
        $loser = User::query()->lockForUpdate()->find($loserId);

        if (! $winner) {
            return;
        }

        $winner->win_streak = (int) $winner->win_streak + 1;
        $winner->total_battles = (int) $winner->total_battles + 1;
        $this->applyTrainerXpReward($winner, 100);
        $winner->save();

        $this->applyTeamXuxemonsXpReward($winnerId, 100);

        if ($loser) {
            $loser->total_battles = (int) $loser->total_battles + 1;
            $loser->save();
        }
    }

    // Sirve para sumar XP de victoria a cada Xuxemon del equipo del ganador.
    private function applyTeamXuxemonsXpReward(string $winnerUserId, int $xpReward): void
    {
        if ($xpReward <= 0) {
            return;
        }

        $ids = array_values(array_unique($this->getOrderedTeamIds($winnerUserId)));

        foreach ($ids as $adquiredId) {
            $adquired = AdquiredXuxemon::query()
                ->whereKey($adquiredId)
                ->where('user_id', $winnerUserId)
                ->lockForUpdate()
                ->first();

            if (! $adquired) {
                continue;
            }

            $this->applyAdquiredXuxemonXpReward($adquired, $xpReward);
        }
    }

    // Sirve para sumar XP a un Xuxemon y subir de nivel.
    private function applyAdquiredXuxemonXpReward(AdquiredXuxemon $adquired, int $xpReward): void
    {
        if ($xpReward <= 0) {
            return;
        }

        $pendingXp = max(0, (int) $adquired->experience + $xpReward);
        $currentLevel = max(1, (int) $adquired->level);

        while ($pendingXp >= ($currentLevel * 100)) {
            $pendingXp -= $currentLevel * 100;
            $currentLevel++;
        }

        $adquired->level = $currentLevel;
        $adquired->experience = $pendingXp;
        $adquired->save();
    }

    // Sirve para calcular y persistir la experiencia y nivel del entrenador.
    private function applyTrainerXpReward(User $user, int $xpReward): void
    {
        $pendingXp = max(0, (int) $user->xp + max(0, $xpReward));
        $currentLevel = max(1, (int) $user->level);

        while ($pendingXp >= ($currentLevel * 100)) {
            $pendingXp -= $currentLevel * 100;
            $currentLevel++;
        }

        $user->level = $currentLevel;
        $user->xp = $pendingXp;
    }

    // Sirve para usar un objeto aliado sobre un objetivo concreto del equipo.
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

    // Sirve para cargar un Xuxemon del combate verificando propiedad del usuario.
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

    // Sirve para validar que el ataque pertenece al moveset del Xuxemon.
    private function findAttackForXuxemon(AdquiredXuxemon $adquired, int $attackId): ?Attack
    {
        $adquired->loadMissing(['xuxemon.attack1', 'xuxemon.attack2']);

        return collect([
            $adquired->xuxemon?->attack1,
            $adquired->xuxemon?->attack2,
        ])->first(fn ($attack) => $attack && (int) $attack->id === $attackId);
    }

    // Sirve para calcular la bonificación o penalización de daño por tipo del atacante.
    private function calculateTypeMatchupModifier(AdquiredXuxemon $attacker, AdquiredXuxemon $defender): int
    {
        $attackerType = strtolower((string) ($attacker->xuxemon?->type?->name ?? ''));
        $defenderType = strtolower((string) ($defender->xuxemon?->type?->name ?? ''));

        // Speed > Power > Technical > Speed
        if (($attackerType === 'speed' && $defenderType === 'power')
            || ($attackerType === 'power' && $defenderType === 'technical')
            || ($attackerType === 'technical' && $defenderType === 'speed')) {
            return 1;
        }

        if (($attackerType === 'power' && $defenderType === 'speed')
            || ($attackerType === 'technical' && $defenderType === 'power')
            || ($attackerType === 'speed' && $defenderType === 'technical')) {
            return -1;
        }

        return 0;
    }

    /** Suma plana al daño: tipo (+1/−1/0) + Medium +1, Large +2. */
    private function calculateBattleModifiers(AdquiredXuxemon $attacker, AdquiredXuxemon $defender): int
    {
        $modifiers = $this->calculateTypeMatchupModifier($attacker, $defender);

        if ($attacker->size === 'Medium') {
            $modifiers += 1;
        } elseif ($attacker->size === 'Large') {
            $modifiers += 2;
        }

        return $modifiers;
    }

    // Sirve para calcular el daño final del ataque.
    private function calculateBattleDamageAmount(
        int $attackerStat,
        int $defenderStat,
        ?int $attackDamage,
        int $roll,
        int $modifiers,
        int $defenderMaxHp,
    ): int {
        $baseAttackDamage = max(1, (int) round($attackDamage ?? ($attackerStat ?: 10)));
        $rawDamage = $baseAttackDamage + $roll + $modifiers;
        $damageAmount = max(1, (int) round($rawDamage));

        return min($damageAmount, max(1, $defenderMaxHp));
    }

    // Sirve para aplicar efectos de estado del ataque cuando corresponde.
    private function applyAttackStatusEffectIfNeeded(Battle $battle, Attack $attack, AdquiredXuxemon $defender): void
    {
        if ((int) ($defender->current_hp ?? 0) <= 0 || $defender->status_effect_id) {
            return;
        }

        $attack->loadMissing('statusEffect');

        $statusEffect = $attack->statusEffect;
        $statusChance = (int) ($attack->status_chance ?? 0);

        if (! $statusEffect || $statusChance <= 0) {
            return;
        }

        if (random_int(1, 100) > $statusChance) {
            return;
        }

        $defender->status_effect_id = $statusEffect->id;
        $statusKey = strtolower(trim((string) $statusEffect->name));
        if ($statusKey === 'paralysis' || $statusKey === 'confusion') {
            $defender->status_effect_turns = 3;
        } else {
            $defender->status_effect_turns = null;
        }
        $defender->save();
        $this->appendBattleLog($battle, sprintf('%s is now affected by %s!', $defender->name, $statusEffect->name));
    }

    // Sirve para mapear nombres de estado principal a clave estable (insensible a mayúsculas).
    private function normalizePrimaryBattleStatusKey(?string $name): ?string
    {
        if ($name === null || $name === '') {
            return null;
        }

        return match (strtolower(trim($name))) {
            'sleep' => 'sleep',
            'paralysis' => 'paralysis',
            'confusion' => 'confusion',
            default => null,
        };
    }

    // Sirve para resolver bloqueos o daños de estado antes de atacar.
    private function resolvePreAttackStatus(Battle $battle, AdquiredXuxemon $xuxemon, string $playerId): bool|JsonResponse
    {
        $xuxemon->loadMissing('statusEffect');
        $key = $this->normalizePrimaryBattleStatusKey($xuxemon->statusEffect?->name);
        if ($key === null) {
            return true;
        }

        if ($key === 'sleep') {
            $this->appendBattleLog($battle, sprintf('%s is fast asleep and cannot attack!', $xuxemon->name));
            $battle->save();

            return false;
        }

        if ($key === 'paralysis') {
            $this->ensureStatusEffectTurnsInitialized($xuxemon, 3);

            if (random_int(1, 100) <= 50) {
                $this->appendBattleLog($battle, sprintf('%s is paralyzed and cannot move!', $xuxemon->name));
                $this->tickStatusEffectTurns($xuxemon);
                $xuxemon->save();
                $battle->turn = (int) $battle->turn + 1;
                $battle->save();

                return false;
            }

            $this->tickStatusEffectTurns($xuxemon);
            $xuxemon->save();

            return true;
        }

        if ($key === 'confusion') {
            $this->ensureStatusEffectTurnsInitialized($xuxemon, 3);

            if (random_int(1, 100) <= 50) {
                $selfHitDamage = max(1, (int) round(($xuxemon->hp ?: 100) * 0.12));
                $xuxemon->current_hp = max(1, (int) $xuxemon->current_hp - $selfHitDamage);
                $this->tickStatusEffectTurns($xuxemon);
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
                    $this->applyBattleRewards((string) $battle->winner_id, $playerId);
                    $battle->save();

                    return false;
                }

                $battle->turn = (int) $battle->turn + 1;
                $battle->save();

                return false;
            }

            $this->tickStatusEffectTurns($xuxemon);
            $xuxemon->save();

            return true;
        }

        return true;
    }

    // Sirve para inicializar el contador de turnos de Paralysis/Confusion en datos antiguos sin contador.
    private function ensureStatusEffectTurnsInitialized(AdquiredXuxemon $xuxemon, int $defaultTurns): void
    {
        if ($xuxemon->status_effect_turns === null) {
            $xuxemon->status_effect_turns = $defaultTurns;
        }
    }

    // Sirve para reducir en uno los turnos restantes de Paralysis/Confusion y limpiar el estado al llegar a cero.
    private function tickStatusEffectTurns(AdquiredXuxemon $xuxemon): void
    {
        $turns = (int) ($xuxemon->status_effect_turns ?? 0);
        if ($turns <= 0) {
            return;
        }

        $turns--;
        if ($turns <= 0) {
            $xuxemon->status_effect_id = null;
            $xuxemon->status_effect_turns = null;

            return;
        }

        $xuxemon->status_effect_turns = $turns;
    }

    // Sirve para verificar si aún quedan miembros vivos en el equipo.
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

    // Sirve para añadir una línea al log histórico del combate.
    private function appendBattleLog(Battle $battle, string $message): void
    {
        $logs = is_array($battle->battle_log) ? $battle->battle_log : [];
        $logs[] = $message;
        $battle->battle_log = array_slice($logs, -8);
    }

    // Sirve para aplicar curación de objetos durante combate.
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

    // Sirve para aplicar aumento de ataque mediante objeto.
    private function applyAttackUpDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $amount = max(0, (int) $bagItem->item->effect_value);
        $adquired->bonus_attack = (int) $adquired->bonus_attack + $amount;
        $adquired->save();
        $bagItem->reduceQuantity(1);

        return ['remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0];
    }

    // Sirve para aplicar aumento de defensa mediante objeto.
    private function applyDefenseUpDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $amount = max(0, (int) $bagItem->item->effect_value);
        $adquired->bonus_defense = (int) $adquired->bonus_defense + $amount;
        $adquired->save();
        $bagItem->reduceQuantity(1);

        return ['remaining_quantity' => $bagItem->exists ? $bagItem->quantity : 0];
    }

    // Sirve para limpiar estados alterados con objetos de soporte.
    private function applyRemoveStatusEffectsDuringBattle(BagItem $bagItem, AdquiredXuxemon $adquired): array
    {
        $name = $bagItem->item->name;

        if ($name === 'Nulberry') {
            $adquired->status_effect_id = null;
            $adquired->status_effect_turns = null;
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

    // Sirve para serializar un Xuxemon adquirido para respuestas de API.
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
        $xuxemon['status_effect_turns'] = $adquired->status_effect_turns;
        $xuxemon['side_effect_1'] = $adquired->sideEffect1;
        $xuxemon['side_effect_2'] = $adquired->sideEffect2;
        $xuxemon['side_effect_3'] = $adquired->sideEffect3;

        return $xuxemon;
    }

    // Sirve para retirar del equipo un Xuxemon robado por victoria.
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

    // Sirve para resolver qué efecto de estado aplica cada ítem de batalla.
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

    // Sirve para serializar efectos de estado para el frontend.
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
