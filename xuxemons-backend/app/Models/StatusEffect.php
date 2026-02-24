<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StatusEffect extends Model
{
    protected $fillable = [
        'name',
        'description',
        'icon_path',
    ];
}
