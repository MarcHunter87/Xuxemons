<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Battle extends Model
{
    protected $fillable = [
        'user_id',
        'opponent_user_id',
        'winner_id',
        'turn',
    ];
}
