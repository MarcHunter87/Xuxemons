<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtService
{
    private string $secret;

    private string $algo = 'HS256';

    private int $ttlSeconds = 60 * 60 * 24 * 7; // 7 days

    public function __construct()
    {
        $this->secret = config('app.key');
    }

    public function encode(User $user): string
    {
        $now = time();
        $payload = [
            'sub' => $user->id,
            'iat' => $now,
            'exp' => $now + $this->ttlSeconds,
        ];

        return JWT::encode($payload, $this->secret, $this->algo);
    }

    public function decode(string $token): ?string
    {
        try {
            $decoded = JWT::decode($token, new Key($this->secret, $this->algo));

            return $decoded->sub ?? null;
        } catch (\Throwable) {
            return null;
        }
    }
}
