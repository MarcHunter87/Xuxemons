<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Type
 *
 * @property mixed $id
 * @property string $name
 * @property int|null $counter
 * @property string|null $icon_path
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Type extends Model
{
    protected $fillable = [
        'name',
        'counter',
        'icon_path',
    ];
}
