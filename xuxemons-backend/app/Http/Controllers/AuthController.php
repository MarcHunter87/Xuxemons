<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:30',
            'surname' => 'required|string|max:30',
            'email' => 'required|string|email|max:120|unique:users',
            'password' => 'required|string|min:6',
        ]);

        $name = preg_replace('/\s+/', '', $validated['name']) ?? ''; // Eliminar espacios

        do {
            $number = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
            $finalId = "#{$name}{$number}";
        } while (User::where('id', $finalId)->exists());

        $isFirstUser = User::count() === 0;

        $user = User::create([
            'id' => $finalId,
            'name' => $validated['name'],
            'surname' => $validated['surname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $isFirstUser ? 'admin' : 'player',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|string',
            'password' => 'required|string',
        ]);

        $id = $validated['id'];

        if (!Auth::attempt(['id' => $id, 'password' => $validated['password']])) {
            return response()->json([
                'message' => 'User ID or password is incorrect. Please try again.'
            ], 401);
        }

        $user = User::where('id', $id)->firstOrFail();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully'
        ]);
    }
}
