<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Attack
 *
 * @property mixed $id
 * @property string $name
 * @property string|null $description
 * @property int|null $dmg
 * @property mixed|null $status_effect_id
 * @property float|null $status_chance
 */
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

    public function statusEffect()
    {
        return $this->belongsTo(StatusEffect::class);
    }
}
