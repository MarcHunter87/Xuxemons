<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\StatusEffect
 *
 * @property mixed $id
 * @property string $name
 * @property string|null $description
 * @property string|null $icon_path
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class StatusEffect extends Model
{
    protected $fillable = [
        'name',
        'description',
        'icon_path',
    ];
}
