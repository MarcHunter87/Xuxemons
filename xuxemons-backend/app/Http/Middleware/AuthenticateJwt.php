<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateJwt
{
    public function __construct(
        private JwtService $jwt
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        if (!$header || !str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $token = substr($header, 7);
        $userId = $this->jwt->decode($token);
        if (!$userId) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $user = User::find($userId);
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 401);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
