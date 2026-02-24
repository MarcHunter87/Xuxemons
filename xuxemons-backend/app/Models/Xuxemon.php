<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Xuxemon extends Model
{
    protected $fillable = [
        'name',
        'description',
        'type_id',
        'status_effect_id',
        'attack_1_id',
        'attack_2_id',
        'hp',
        'attack',
        'defense',
        'icon_path',
    ];
}
