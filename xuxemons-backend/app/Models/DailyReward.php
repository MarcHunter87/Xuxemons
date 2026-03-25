<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

