<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Chat
 *
 * @property mixed $id
 * @property mixed $sender_user_id
 * @property mixed $receiver_user_id
 * @property string $message
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Chat extends Model
{
    protected $fillable = [
        'sender_user_id',
        'receiver_user_id',
        'message',
    ];
}
