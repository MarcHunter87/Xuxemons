<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    protected $fillable = [
        'user_id',
        'slot_1_adquired_xuxemon_id',
        'slot_2_adquired_xuxemon_id',
        'slot_3_adquired_xuxemon_id',
        'slot_4_adquired_xuxemon_id',
        'slot_5_adquired_xuxemon_id',
        'slot_6_adquired_xuxemon_id',
    ];
}
