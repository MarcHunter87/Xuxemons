<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SideEffect extends Model
{
    protected $fillable = [
        'name',
        'description',
        'icon_path',
        'apply_chance',
    ];
}
