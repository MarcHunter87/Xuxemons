<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Xuxemon extends Model
{
    protected $fillable = [
        'name',
        'description',
        'type_id',
        'size',
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
