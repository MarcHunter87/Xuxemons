<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\DailyRewardNotification
 *
 * @property mixed $id
 * @property mixed $user_id
 * @property \Illuminate\Support\Carbon|null $reward_date
 * @property int $gacha_ticket_quantity
 * @property array $items
 * @property \Illuminate\Support\Carbon|null $shown_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class DailyRewardNotification extends Model
{
    protected $fillable = [
        'user_id',
        'reward_date',
        'gacha_ticket_quantity',
        'items',
        'shown_at',
    ];

    protected $casts = [
        'reward_date' => 'date',
        'gacha_ticket_quantity' => 'integer',
        'items' => 'array',
        'shown_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}