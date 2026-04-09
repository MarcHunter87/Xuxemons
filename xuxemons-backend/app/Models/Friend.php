<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\Friend
 *
 * @property mixed $id
 * @property mixed $user_id
 * @property mixed $friend_user_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
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
