<?php

namespace App\Http\Controllers;

use App\Models\Xuxemon;
use App\Models\AdquiredXuxemon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class XuxemonController extends Controller
{
    public function index()
    {
        return response()->json(Xuxemon::with('type')->get());
    }

    public function collectionStats()
    {
        $userId = Auth::guard('api')->id();
        if (!$userId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $total = Xuxemon::query()->count();
        $acquired = (int) DB::table('adquired_xuxemons')
            ->where('user_id', $userId)
            ->count(DB::raw('DISTINCT xuxemon_id'));

        return response()->json([
            'total' => $total,
            'acquired' => $acquired,
        ]);
    }

    public function myXuxemons()
    {
        $userId = Auth::guard('api')->id();
        if (!$userId) {
            return response()->json([], 401);
        }

        $myXuxemons = AdquiredXuxemon::where('user_id', $userId)
            ->with(['xuxemon.type'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($a) {
                if (!$a->xuxemon) return null;
                $x = $a->xuxemon;
                $x->adquired_at = $a->created_at;
                return $x;
            })
            ->filter()
            ->values();

        return response()->json($myXuxemons);
    }

    public function awardRandom()
    {
        try {
            $userId = Auth::guard('api')->id();
            if (!$userId) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $randomXuxemon = Xuxemon::with('type')->inRandomOrder()->first();
            if (!$randomXuxemon) {
                return response()->json(['message' => 'No Xuxemons available'], 404);
            }

            AdquiredXuxemon::create([
                'user_id' => $userId,
                'xuxemon_id' => $randomXuxemon->id,
                'level' => 1,
                'experience' => 0,
                'bonus_hp' => rand(1, 40),
                'bonus_defense' => rand(1, 20),
            ]);

            return response()->json($randomXuxemon);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error: ' . $e->getMessage()], 500);
        }
    }
}
