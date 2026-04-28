<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Team
 *
 * @property mixed $id
 * @property mixed $user_id
 * @property mixed|null $slot_1_adquired_xuxemon_id
 * @property mixed|null $slot_2_adquired_xuxemon_id
 * @property mixed|null $slot_3_adquired_xuxemon_id
 * @property mixed|null $slot_4_adquired_xuxemon_id
 * @property mixed|null $slot_5_adquired_xuxemon_id
 * @property mixed|null $slot_6_adquired_xuxemon_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Team extends Model
{
    protected $fillable = [
        'user_id',
        'slot_1_adquired_xuxemon_id',
        'slot_2_adquired_xuxemon_id',
        'slot_3_adquired_xuxemon_id',
        'slot_4_adquired_xuxemon_id',
        'slot_5_adquired_xuxemon_id',
        'slot_6_adquired_xuxemon_id',
    ];

    public function slot1()
    {
        return $this->belongsTo(AdquiredXuxemon::class, 'slot_1_adquired_xuxemon_id');
    }

    public function slot2()
    {
        return $this->belongsTo(AdquiredXuxemon::class, 'slot_2_adquired_xuxemon_id');
    }

    public function slot3()
    {
        return $this->belongsTo(AdquiredXuxemon::class, 'slot_3_adquired_xuxemon_id');
    }

    public function slot4()
    {
        return $this->belongsTo(AdquiredXuxemon::class, 'slot_4_adquired_xuxemon_id');
    }

    public function slot5()
    {
        return $this->belongsTo(AdquiredXuxemon::class, 'slot_5_adquired_xuxemon_id');
    }

    public function slot6()
    {
        return $this->belongsTo(AdquiredXuxemon::class, 'slot_6_adquired_xuxemon_id');
    }
}
