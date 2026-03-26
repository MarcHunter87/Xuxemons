<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Item;
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
            ->with(['xuxemon.type', 'xuxemon.attack1.statusEffect', 'xuxemon.attack2.statusEffect', 'statusEffect', 'sideEffect1', 'sideEffect2', 'sideEffect3']);

        if ($request->filled('type')) {
            $query->whereHas('xuxemon.type', fn ($q) => $q->where('name', $request->input('type')));
        }
        if ($request->filled('size')) {
            $sizeId = DB::table('sizes')->where('size', $request->input('size'))->value('id');
            $query->where('size_id', $sizeId);
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
                $x['size'] = $a->size;
                $x['adquired_id'] = $a->id;
                $x['status_effect_applied'] = $a->statusEffect;
                $x['side_effect_1'] = $a->sideEffect1;
                $x['side_effect_2'] = $a->sideEffect2;
                $x['side_effect_3'] = $a->sideEffect3;

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

        $adquired->load('xuxemon.type', 'xuxemon.attack1.statusEffect', 'xuxemon.attack2.statusEffect');
        $xuxemon = $adquired->xuxemon->toArray();
        $maxHp = $adquired->hp;
        $xuxemon['level'] = $adquired->level;
        $xuxemon['hp'] = $maxHp;
        $xuxemon['current_hp'] = (int) $adquired->current_hp;
        $xuxemon['attack'] = $adquired->attack;
        $xuxemon['defense'] = $adquired->defense;
        $xuxemon['size'] = $adquired->size;

        return $xuxemon;
    }

    public function awardRandomXuxemon()
    {
        try {
            $userId = Auth::guard('api')->id();
            if (! $userId) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if (! Xuxemon::query()->exists()) {
                return response()->json(['message' => 'No Xuxemons available'], 404);
            }

            $payload = DB::transaction(function () use ($userId) {
                $bag = Bag::where('user_id', $userId)->first();
                if (! $bag) {
                    return ['error' => 'no_bag'];
                }

                $ticketId = Item::where('effect_type', 'Gacha Ticket')->value('id');
                if (! $ticketId) {
                    return ['error' => 'config'];
                }

                $bagItem = BagItem::where('bag_id', $bag->id)->where('item_id', $ticketId)->first();
                if (! $bagItem || $bagItem->quantity < 1) {
                    return ['error' => 'no_tickets'];
                }

                $bagItem->reduceQuantity(1);

                $remaining = (int) (BagItem::where('bag_id', $bag->id)->where('item_id', $ticketId)->value('quantity') ?? 0);

                $xuxemon = $this->getRandomXuxemon($userId);
                if ($xuxemon === null) {
                    return ['error' => 'no_xuxemon'];
                }

                return ['xuxemon' => $xuxemon, 'remaining' => $remaining];
            });

            if (isset($payload['error'])) {
                if ($payload['error'] === 'no_tickets') {
                    return response()->json(['message' => 'Not enough gacha tickets'], 402);
                }
                if ($payload['error'] === 'no_xuxemon') {
                    return response()->json(['message' => 'No Xuxemons available'], 404);
                }
                if ($payload['error'] === 'no_bag') {
                    return response()->json(['message' => 'No bag found'], 500);
                }
                if ($payload['error'] === 'config') {
                    return response()->json(['message' => 'Gacha ticket item not configured'], 500);
                }
            }

            return response()->json(array_merge($payload['xuxemon'], [
                'gacha_tickets_remaining' => $payload['remaining'],
            ]));
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
