<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * App\Models\Bag
 *
 * @property int $id
 * @property int $user_id
 * @property int $max_slots
 */
class Bag extends Model
{
    const MAX_SLOTS = 20;

    protected $fillable = [
        'user_id',
        'max_slots',
    ];

    /**
     * Relación con el usuario propietario de la mochila
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * Relación con los items en la mochila
     */
    public function bagItems(): HasMany
    {
        return $this->hasMany(BagItem::class);
    }

    /**
     * Obtiene los items de la mochila con sus detalles
     */
    public function items()
    {
        return $this->hasManyThrough(Item::class, BagItem::class, 'bag_id', 'id', 'id', 'item_id');
    }

    /**
     * Obtiene los slots usados en la mochila
     */
    public function getUsedSlotsAttribute(): int
    {
        return $this->bagItems()->count();
    }

    /**
     * Obtiene los slots disponibles en la mochila
     */
    public function getAvailableSlotsAttribute(): int
    {
        return $this->max_slots - $this->getUsedSlotsAttribute();
    }

    /**
     * Verifica si hay espacio disponible en la mochila
     */
    public function hasAvailableSlots(): bool
    {
        return $this->getAvailableSlotsAttribute() > 0;
    }
}
