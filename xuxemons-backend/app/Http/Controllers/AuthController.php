<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'id' => [
                'required',
                'string',
                'max:50',
                'regex:/^#[A-Za-z0-9]+\d{4}$/',
                Rule::unique('users', 'id'),
            ],
            'name' => 'required|string|max:30',
            'surname' => 'required|string|max:30',
            'email' => [
                'required',
                'string',
                'email',
                'max:120',
                Rule::unique('users', 'email')->where('is_active', true),
            ],
            'password' => 'required|string|min:6',
        ], [
            'email.unique' => 'This email is already in use.',
            'id.unique' => 'Server error. Please try again later.',
            'id.regex' => 'Invalid ID format. It must be #Name plus 4 digits.',
        ]);

        $isFirstUser = User::count() === 0;

        $user = User::create([
            'id' => $validated['id'],
            'name' => $validated['name'],
            'surname' => $validated['surname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $isFirstUser ? 'admin' : 'player',
        ]);

        $token = JWTAuth::fromUser($user);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->fresh(),
        ]);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|string',
            'password' => 'required|string',
        ]);

        $id = $validated['id'];

        if (!$token = Auth::guard('api')->attempt(['id' => $id, 'password' => $validated['password']])) {
            return response()->json([
                'message' => 'Login failed. Incorrect User or Password'
            ], 401);
        }

        /** @var User $user */
        $user = Auth::guard('api')->user();

        if (!$user->is_active) {
            Auth::guard('api')->logout();
            return response()->json([
                'message' => 'This account has been deleted.'
            ], 401);
        }

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function logout(Request $request)
    {
        Auth::guard('api')->logout();

        return response()->json([
            'message' => 'Logged out successfully'
        ]);
    }

    public function me(Request $request)
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();

        return response()->json($user->fresh());
    }

    public function updateProfile(Request $request)
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:30',
            'surname' => 'sometimes|string|max:30',
            'email' => 'sometimes|string|email|max:120|unique:users,email,' . $user->id,
            'password' => 'sometimes|string|min:6',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user->fresh(),
        ]);
    }

    public function deleteAccount(Request $request)
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();
        
        Auth::guard('api')->logout();
        $user->delete();

        return response()->json([
            'message' => 'Account deleted successfully'
        ]);
    }
}
