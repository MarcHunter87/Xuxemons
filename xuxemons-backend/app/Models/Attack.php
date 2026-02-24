<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attack extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'name',
        'description',
        'dmg',
        'status_effect_id',
        'status_chance',
    ];
}
