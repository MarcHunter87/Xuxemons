<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * App\Models\Battle
 *
 * @property mixed $id
 * @property mixed $user_id
 * @property mixed $opponent_user_id
 * @property mixed|null $winner_id
 * @property int|null $turn
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Battle extends Model
{
    protected $fillable = [
        'user_id',
        'opponent_user_id',
        'winner_id',
        'completion_reason',
        'runner_id',
        'status',
        'turn',
        'user_active_adquired_xuxemon_id',
        'opponent_active_adquired_xuxemon_id',
        'battle_log',
    ];

    protected $casts = [
        'turn' => 'integer',
        'user_active_adquired_xuxemon_id' => 'integer',
        'opponent_active_adquired_xuxemon_id' => 'integer',
        'battle_log' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function opponentUser()
    {
        return $this->belongsTo(User::class, 'opponent_user_id');
    }

    public function winner()
    {
        return $this->belongsTo(User::class, 'winner_id');
    }
}
