<?php

namespace App\Http\Controllers;

use App\Models\Xuxemon;
use App\Models\AdquiredXuxemon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class XuxemonController extends Controller
{
    public function index()
    {
        try {
            return response()->json(Xuxemon::with('type')->get());
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
        }
    }

    public function myXuxemons()
    {
        $userId = Auth::guard('api')->id();
        if (!$userId) {
            return response()->json([], 401);
        }

        $myXuxemons = AdquiredXuxemon::where('user_id', $userId)
            ->with(['xuxemon.type'])
            ->get()
            ->map(function ($adquired) {
                return $adquired->xuxemon;
            })
            ->filter()
            ->values();

        return response()->json($myXuxemons);
    }

    public function awardRandom()
    {
        $userId = Auth::guard('api')->id();
        if (!$userId) {
            Log::error('awardRandom: Unauthorized');
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        
        $randomXuxemon = Xuxemon::with('type')->inRandomOrder()->first();
        
        if (!$randomXuxemon) {
            Log::error('awardRandom: No Xuxemons available');
            return response()->json(['message' => 'No Xuxemons available'], 404);
        }

        try {
            AdquiredXuxemon::create([
                'user_id' => $userId,
                'xuxemon_id' => $randomXuxemon->id,
                'level' => 1,
                'experience' => 0,
            ]);
            Log::info('awardRandom: Success for user ' . $userId);
        } catch (\Exception $e) {
            Log::error('awardRandom: Error saving xuxemon: ' . $e->getMessage());
            return response()->json(['message' => 'Error saving xuxemon'], 500);
        }

        return response()->json($randomXuxemon);
    }
}
