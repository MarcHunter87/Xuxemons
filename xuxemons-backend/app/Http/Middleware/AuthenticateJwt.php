<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateJwt
{
    // Sirve para inyectar el servicio de JWT
    public function __construct(
        private JwtService $jwt
    ) {}

    // Sirve para manejar la solicitud
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        // Si el encabezado de autorización no está presente o no comienza con 'Bearer ', se devuelve un error 401
        if (!$header || !str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $token = substr($header, 7);
        // Se decodifica el token y se obtiene el ID del usuario
        $userId = $this->jwt->decode($token);
        // Si el token no es válido o ha expirado, se devuelve un error 401
        if (!$userId) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $user = User::find($userId);
        // Si el usuario no existe, se devuelve un error 401
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 401);
        }

        // Si el usuario no ha sido visto en los últimos 1 minuto, se actualiza el tiempo de última vista
        if (!$user->last_seen_at || \Carbon\Carbon::parse($user->last_seen_at)->diffInMinutes(now()) >= 1) {
            $user->timestamps = false;
            $user->last_seen_at = now();
            $user->save();
        }

        // Se establece el usuario en la solicitud
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
