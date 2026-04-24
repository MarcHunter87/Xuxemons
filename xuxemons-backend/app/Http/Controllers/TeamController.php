<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\AdquiredXuxemon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TeamController extends Controller
{
    public function getTeam()
    {
        $userId = Auth::id();
        $team = Team::firstOrCreate(['user_id' => $userId]);
        
        // Cargar los Xuxemons con su información base
        $team->load([
            'slot1.xuxemon', 'slot1.statusEffect', 'slot1.sideEffect1', 'slot1.sideEffect2', 'slot1.sideEffect3',
            'slot2.xuxemon', 'slot2.statusEffect', 'slot2.sideEffect1', 'slot2.sideEffect2', 'slot2.sideEffect3',
            'slot3.xuxemon', 'slot3.statusEffect', 'slot3.sideEffect1', 'slot3.sideEffect2', 'slot3.sideEffect3',
            'slot4.xuxemon', 'slot4.statusEffect', 'slot4.sideEffect1', 'slot4.sideEffect2', 'slot4.sideEffect3',
            'slot5.xuxemon', 'slot5.statusEffect', 'slot5.sideEffect1', 'slot5.sideEffect2', 'slot5.sideEffect3',
            'slot6.xuxemon', 'slot6.statusEffect', 'slot6.sideEffect1', 'slot6.sideEffect2', 'slot6.sideEffect3',
        ]);

        return response()->json($team);
    }

    public function updateSlot(Request $request, $slotNumber)
    {
        if ($slotNumber < 1 || $slotNumber > 6) {
            return response()->json(['message' => 'Invalid slot number'], 400);
        }

        $userId = Auth::id();
        $team = Team::firstOrCreate(['user_id' => $userId]);
        
        $xuxemonId = $request->adquired_xuxemon_id;
        
        // Verificar que el Xuxemon pertenece al usuario
        if ($xuxemonId) {
            $exists = AdquiredXuxemon::where('id', $xuxemonId)->where('user_id', $userId)->exists();
            if (!$exists) {
                return response()->json(['message' => 'Xuxemon not found in your collection'], 404);
            }
        }

        $field = "slot_{$slotNumber}_adquired_xuxemon_id";
        $team->$field = $xuxemonId;
        $team->save();

        return response()->json($team);
    }
}
