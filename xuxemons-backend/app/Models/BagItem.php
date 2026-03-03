<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BagItem extends Model
{
    protected $table = 'bag_items';

    protected $fillable = [
        'bag_id',
        'item_id',
        'quantity',
    ];

    /**
     * Relación con la mochila
     */
    public function bag(): BelongsTo
    {
        return $this->belongsTo(Bag::class);
    }

    /**
     * Relación con el item
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * Verifica si se puede agregar más cantidad a este item
     */
    public function canAddQuantity(int $amount = 1): bool
    {
        return ($this->quantity + $amount) <= $this->item->max_quantity;
    }

    /**
     * Agrega cantidad al item (si es posible)
     */
    public function addQuantity(int $amount = 1): bool
    {
        if ($this->canAddQuantity($amount)) {
            $this->quantity += $amount;
            $this->save();
            return true;
        }
        return false;
    }

    /**
     * Reduce cantidad del item
     */
    public function reduceQuantity(int $amount = 1): bool
    {
        if ($this->quantity >= $amount) {
            $this->quantity -= $amount;
            if ($this->quantity === 0) {
                $this->delete();
            } else {
                $this->save();
            }
            return true;
        }
        return false;
    }
}
