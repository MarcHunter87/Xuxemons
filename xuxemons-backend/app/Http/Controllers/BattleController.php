<?php

namespace App\Http\Controllers;

use App\Models\Battle;
use App\Models\User;
use App\Models\AdquiredXuxemon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BattleController extends Controller
{
    public function requestBattle($friendId)
    {
        $userId = Auth::id();
        
        // Verificar que no haya ya una batalla pendiente entre ellos
        $existing = Battle::where(function($q) use ($userId, $friendId) {
            $q->where('user_id', $userId)->where('opponent_user_id', $friendId);
        })->orWhere(function($q) use ($userId, $friendId) {
            $q->where('user_id', $friendId)->where('opponent_user_id', $userId);
        })->whereIn('status', ['pending', 'accepted'])->first();

        if ($existing) {
            return response()->json(['message' => 'Already have a pending/active battle with this friend'], 400);
        }

        $battle = Battle::create([
            'user_id' => $userId,
            'opponent_user_id' => $friendId,
            'status' => 'pending'
        ]);

        return response()->json($battle, 201);
    }

    public function acceptBattle($battleId)
    {
        $battle = Battle::findOrFail($battleId);
        if ($battle->opponent_user_id != Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $battle->status = 'accepted';
        $battle->save();

        return response()->json($battle);
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
        $battle = Battle::with(['user', 'opponentUser'])->findOrFail($battleId);
        return response()->json($battle);
    }

    public function finishBattle(Request $request, $battleId)
    {
        $battle = Battle::findOrFail($battleId);
        $winnerId = $request->winner_id;
        $loserId = ($winnerId == $battle->user_id) ? $battle->opponent_user_id : $battle->user_id;
        $loserXuxemonId = $request->loser_xuxemon_id;

        $battle->winner_id = $winnerId;
        $battle->status = 'completed';
        $battle->save();

        // Transferir Xuxemon al ganador
        $xuxemon = AdquiredXuxemon::where('id', $loserXuxemonId)->where('user_id', $loserId)->first();
        if ($xuxemon) {
            $xuxemon->user_id = $winnerId;
            $xuxemon->save();
        }

        return response()->json(['message' => 'Battle finished and Xuxemon transferred', 'battle' => $battle]);
    }
}
