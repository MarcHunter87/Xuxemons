<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdquiredXuxemon extends Model
{
    protected $fillable = [
        'user_id',
        'xuxemon_id',
        'level',
        'experience',
    ];

    public function getHpAttribute(): int
    {
        $base = $this->xuxemon?->hp ?? 1;
        return $base + (int) round(($this->level - 1) * 1.2);
    }

    public function getAttackAttribute(): int
    {
        $base = $this->xuxemon?->attack ?? 1;
        return $base + (int) round(($this->level - 1) * 1.2);
    }

    public function getDefenseAttribute(): int
    {
        $base = $this->xuxemon?->defense ?? 1;
        return $base + (int) round(($this->level - 1) * 1.2);
    }
}
