<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Xuxemon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class XuxemonController extends Controller
{
    public function index(Request $request)
    {
        $query = Xuxemon::with(['type', 'attack1.statusEffect', 'attack2.statusEffect']);

        if ($request->filled('type')) {
            $query->whereHas('type', fn ($q) => $q->where('name', $request->input('type')));
        }

        $list = $query->get();
        return response()->json($list->map(fn ($x) => array_merge($x->toArray(), ['size' => 'Small'])));
    }

    public function collectionStats()
    {
        $userId = Auth::guard('api')->id();
        if (! $userId) {
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

    public function myXuxemons(Request $request)
    {
        $userId = Auth::guard('api')->id();
        if (! $userId) {
            return response()->json([], 401);
        }

        $query = AdquiredXuxemon::where('user_id', $userId)
            ->with(['xuxemon.type', 'xuxemon.attack1.statusEffect', 'xuxemon.attack2.statusEffect', 'statusEffect']);

        if ($request->filled('type')) {
            $query->whereHas('xuxemon.type', fn ($q) => $q->where('name', $request->input('type')));
        }
        if ($request->filled('size')) {
            $query->where('size', $request->input('size'));
        }

        $myXuxemons = $query->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($a) {
                if (! $a->xuxemon) {
                    return null;
                }
                $x = $a->xuxemon->toArray();
                $maxHp = $a->hp;
                $x['adquired_at'] = $a->created_at;
                $x['level'] = $a->level;
                $x['hp'] = $maxHp;
                $x['current_hp'] = $a->getAttribute('current_hp') !== null ? (int) $a->current_hp : $maxHp;
                $x['attack'] = $a->attack;
                $x['defense'] = $a->defense;
                $x['size'] = $a->size ?? 'Small';
                $x['adquired_id'] = $a->id;
                $x['status_effect_applied'] = $a->statusEffect;

                return $x;
            })
            ->filter()
            ->values();

        return response()->json($myXuxemons);
    }

    private function getRandomXuxemon(string $userId): ?array
    {
        $randomXuxemon = Xuxemon::with(['type', 'attack1.statusEffect', 'attack2.statusEffect'])->inRandomOrder()->first();
        if (! $randomXuxemon) {
            return null;
        }

        $adquired = AdquiredXuxemon::create([
            'user_id' => $userId,
            'xuxemon_id' => $randomXuxemon->id,
            'level' => 1,
            'experience' => 0,
            'bonus_hp' => rand(1, 100),
            'bonus_attack' => rand(1, 20),
            'bonus_defense' => rand(1, 20),
        ]);
        $maxHp = $adquired->hp;
        $adquired->update(['current_hp' => $maxHp]);

        $adquired->load('xuxemon.type', 'xuxemon.attack1.statusEffect', 'xuxemon.attack2.statusEffect');
        $xuxemon = $adquired->xuxemon->toArray();
        $xuxemon['level'] = $adquired->level;
        $xuxemon['hp'] = $maxHp;
        $xuxemon['current_hp'] = $maxHp;
        $xuxemon['attack'] = $adquired->attack;
        $xuxemon['defense'] = $adquired->defense;
        $xuxemon['size'] = $adquired->size ?? 'Small';

        return $xuxemon;
    }

    public function awardRandomXuxemon()
    {
        try {
            $userId = Auth::guard('api')->id();
            if (! $userId) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $xuxemon = $this->getRandomXuxemon($userId);
            if ($xuxemon === null) {
                return response()->json(['message' => 'No Xuxemons available'], 404);
            }

            return response()->json($xuxemon);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error: '.$e->getMessage()], 500);
        }
    }

    public function awardRandomXuxemonToUser(string $userId)
    {
        try {
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $xuxemon = $this->getRandomXuxemon($userId);
            if ($xuxemon === null) {
                return response()->json(['message' => 'No Xuxemons available'], 404);
            }

            return response()->json($xuxemon);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error: '.$e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $userId = Auth::guard('api')->id();
            if (! $userId) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $adquired = AdquiredXuxemon::where('id', $id)
                ->where('user_id', $userId)
                ->with('xuxemon.type', 'xuxemon.attack1.statusEffect', 'xuxemon.attack2.statusEffect')
                ->first();

            if (! $adquired) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            $allowed = ['level', 'experience', 'bonus_hp', 'bonus_attack', 'bonus_defense'];
            foreach ($allowed as $field) {
                if ($request->has($field)) {
                    $adquired->$field = $request->input($field);
                }
            }
            $adquired->save();

            return response()->json($adquired->xuxemon);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error: '.$e->getMessage()], 500);
        }
    }

    public function delete($id)
    {
        try {
            $userId = Auth::guard('api')->id();
            if (! $userId) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $adquired = AdquiredXuxemon::where('id', $id)
                ->where('user_id', $userId)
                ->first();

            if (! $adquired) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            $adquired->delete();

            return response()->json(['message' => 'Xuxemon released'], 200);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error: '.$e->getMessage()], 500);
        }
    }
}
