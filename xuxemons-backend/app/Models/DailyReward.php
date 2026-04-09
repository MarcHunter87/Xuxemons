<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\DailyReward
 *
 * @property mixed $id
 * @property string|null $time
 * @property int $quantity
 * @property mixed $item_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class DailyReward extends Model
{
    protected $table = 'daily_rewards';

    protected $fillable = [
        'time',
        'quantity',
        'item_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}

