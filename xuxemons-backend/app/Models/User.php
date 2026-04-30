<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

/**
 * App\Models\User
 *
 * @property string $id
 * @property string $name
 * @property int $level
 * @property int $total_wins
 * @property string|null $icon_path
 * @property \Illuminate\Support\Carbon|null $last_seen_at
 */

class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'name',
        'surname',
        'email',
        'password',
        'icon_path',
        'banner_path',
        'level',
        'xp',
        'theme',
        'role',
        'is_active',
        'last_seen_at',
        'win_streak',
        'total_battles',
        'view_animations',
        'theme',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'total_wins',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function getIsAdminAttribute(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Relación con la mochila del usuario
     */
    public function bag(): HasOne
    {
        return $this->hasOne(Bag::class, 'user_id', 'id');
    }

    public function wonBattles(): HasMany
    {
        return $this->hasMany(Battle::class, 'winner_id', 'id');
    }

    public function getTotalWinsAttribute(): int
    {
        return $this->wonBattles()->count();
    }

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [];
    }
}
