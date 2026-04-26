<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Battle
 *
 * @property mixed $id
 * @property mixed $user_id
 * @property mixed $opponent_user_id
 * @property mixed|null $winner_id
 * @property int|null $turn
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Battle extends Model
{
    protected $fillable = [
        'user_id',
        'opponent_user_id',
        'winner_id',
        'turn',
    ];
}
