<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\SideEffect
 *
 * @property mixed $id
 * @property string $name
 * @property string|null $description
 * @property string|null $icon_path
 * @property float|null $apply_chance
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class SideEffect extends Model
{
    protected $fillable = [
        'name',
        'description',
        'icon_path',
        'apply_chance',
    ];
}
