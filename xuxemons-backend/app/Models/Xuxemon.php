<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Xuxemon
 *
 * @property mixed $id
 * @property string $name
 * @property string|null $description
 * @property mixed $type_id
 * @property mixed|null $attack_1_id
 * @property mixed|null $attack_2_id
 * @property int|null $hp
 * @property int|null $attack
 * @property int|null $defense
 * @property string|null $icon_path
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Xuxemon extends Model
{
    protected $fillable = [
        'name',
        'description',
        'type_id',
        'attack_1_id',
        'attack_2_id',
        'hp',
        'attack',
        'defense',
        'icon_path',
    ];

    public function type()
    {
        return $this->belongsTo(Type::class);
    }

    public function attack1()
    {
        return $this->belongsTo(Attack::class, 'attack_1_id');
    }

    public function attack2()
    {
        return $this->belongsTo(Attack::class, 'attack_2_id');
    }
}
