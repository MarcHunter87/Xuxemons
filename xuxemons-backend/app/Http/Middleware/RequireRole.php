<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    // Sirve para manejar la solicitud
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user('api');

        // Si el usuario no está autenticado, se devuelve un error 401
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Si el usuario no tiene el rol requerido, se devuelve un error 403
        if ($roles === [] || ! in_array((string) $user->role, $roles, true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // Si el usuario tiene el rol requerido, se continúa con la solicitud
        return $next($request);
    }
}
