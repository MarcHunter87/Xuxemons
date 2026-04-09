<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        /** @var User|null $user */
        $user = Auth::guard('api')->user();
        if ($user instanceof User) {
            if (!$user->last_seen_at || Carbon::parse($user->last_seen_at)->diffInMinutes(now()) >= 1) {
                $user->timestamps = false;
                $user->last_seen_at = now();
                $user->save();
            }
        }

        return $response;
    }
}
