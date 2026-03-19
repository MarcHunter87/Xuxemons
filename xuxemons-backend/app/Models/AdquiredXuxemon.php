<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class AdquiredXuxemon extends Model
{
    protected $fillable = [
        'user_id',
        'xuxemon_id',
        'level',
        'experience',
        'size_id',
        'requirement_progress',
        'bonus_hp',
        'bonus_attack',
        'bonus_defense',
        'current_hp',
        'status_effect_id',
    ];

    public function xuxemon()
    {
        return $this->belongsTo(Xuxemon::class);
    }

    public function statusEffect()
    {
        return $this->belongsTo(StatusEffect::class);
    }

    public function getSizeAttribute(): string
    {
        $sizeId = $this->attributes['size_id'] ?? 1;

        return DB::table('sizes')->where('id', $sizeId)->value('size') ?? 'Small';
    }

    public function getHpAttribute(): int
    {
        $base = $this->xuxemon?->hp ?? 1;
        return $base + (int) round(($this->level - 1) * 1.2) + $this->bonus_hp;
    }

    public function getAttackAttribute(): int
    {
        $base = $this->xuxemon?->attack ?? 1;
        return $base + (int) round(($this->level - 1) * 1.2) + $this->bonus_attack;
    }

    public function getDefenseAttribute(): int
    {
        $base = $this->xuxemon?->defense ?? 1;
        return $base + (int) round(($this->level - 1) * 1.2) + $this->bonus_defense;
    }
}
