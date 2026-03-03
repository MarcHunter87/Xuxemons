<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    protected $fillable = [
        'name',
        'description',
        'effect_type',
        'effect_value',
        'is_stackable',
        'max_quantity',
        'status_effect_id',
        'icon_path',
    ];
}
