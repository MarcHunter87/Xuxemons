<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdquiredItem extends Model
{
    protected $fillable = [
        'user_id',
        'item_id',
        'quantity',
    ];
}
