<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Friend extends Model
{
    protected $fillable = [
        'user_id',
        'friend_user_id',
    ];

    public function friendUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'friend_user_id');
    }
}
