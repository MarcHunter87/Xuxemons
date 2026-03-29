<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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