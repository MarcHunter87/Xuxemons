<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Size extends Model
{
    protected $table = 'sizes';

    protected $fillable = [
        'size',
        'requirement_progress',
    ];

    protected $casts = [
        'requirement_progress' => 'integer',
    ];

    public static function resolveForProgress(int $progress): ?self
    {
        return static::query()
            ->where('requirement_progress', '<=', $progress)
            ->orderByDesc('requirement_progress')
            ->orderByDesc('id')
            ->first();
    }

    public static function resolveIdForProgress(int $progress): int
    {
        return self::resolveForProgress($progress)?->id ?? 1;
    }

    public static function reconcileAllAdquiredXuxemonSizes(): void
    {
        AdquiredXuxemon::query()->orderBy('id')->chunkById(500, function ($rows) {
            foreach ($rows as $adquired) {
                $correctId = self::resolveIdForProgress((int) $adquired->requirement_progress);
                if ((int) $adquired->size_id !== $correctId) {
                    AdquiredXuxemon::query()->whereKey($adquired->id)->update(['size_id' => $correctId]);
                }
            }
        });
    }
}
