<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * App\Models\AdquiredXuxemon
 *
 * @property mixed $id
 * @property mixed $user_id
 * @property mixed $xuxemon_id
 * @property int $level
 * @property int $experience
 * @property int $size_id
 * @property int $requirement_progress
 * @property int $bonus_hp
 * @property int $bonus_attack
 * @property int $bonus_defense
 * @property int $current_hp
 * @property mixed|null $status_effect_id
 * @property mixed|null $side_effect_id_1
 * @property mixed|null $side_effect_id_2
 * @property mixed|null $side_effect_id_3
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class AdquiredXuxemon extends Model
{
    protected $appends = ['hp', 'attack', 'defense', 'size', 'name', 'image_url', 'type'];

    protected $casts = [
        'current_hp' => 'integer',
        'level' => 'integer',
        'experience' => 'integer',
        'size_id' => 'integer',
        'requirement_progress' => 'integer',
        'bonus_hp' => 'integer',
        'bonus_attack' => 'integer',
        'bonus_defense' => 'integer',
        'status_effect_id' => 'integer',
        'side_effect_id_1' => 'integer',
        'side_effect_id_2' => 'integer',
        'side_effect_id_3' => 'integer',
    ];

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
        'side_effect_id_1',
        'side_effect_id_2',
        'side_effect_id_3',
    ];

    protected static function booted(): void
    {
        static::saving(function (AdquiredXuxemon $model): void {
            if (! $model->xuxemon_id) {
                return;
            }
            $model->loadMissing('xuxemon');
            $maxHp = $model->hp;
            $raw = $model->getAttributes()['current_hp'] ?? null;
            $model->current_hp = ($raw === null || $raw === '')
                ? $maxHp
                : min((int) $raw, $maxHp);
        });
    }

    public function xuxemon()
    {
        return $this->belongsTo(Xuxemon::class);
    }

    public function statusEffect()
    {
        return $this->belongsTo(StatusEffect::class);
    }

    public function sideEffect1()
    {
        return $this->belongsTo(SideEffect::class, 'side_effect_id_1');
    }

    public function sideEffect2()
    {
        return $this->belongsTo(SideEffect::class, 'side_effect_id_2');
    }

    public function sideEffect3()
    {
        return $this->belongsTo(SideEffect::class, 'side_effect_id_3');
    }

    public function getNameAttribute(): string
    {
        return $this->xuxemon?->name ?? 'Unknown';
    }

    public function getImageUrlAttribute(): string
    {
        return $this->xuxemon?->image_url ?? '';
    }

    public function getTypeAttribute()
    {
        return $this->xuxemon?->type;
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
