<?php

namespace App\Http\Controllers;

use App\Models\Bag;
use App\Models\BagItem;
use App\Models\Item;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    // Sirve para registrar un nuevo usuario
    public function register(Request $request)
    {
        // Se valida la petición
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

        // Se verifica si es el primer usuario
        $isFirstUser = User::count() === 0;

        // Se crea el usuario
        $user = User::create([
            'id' => $validated['id'],
            'name' => $validated['name'],
            'surname' => $validated['surname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $isFirstUser ? 'admin' : 'player',
        ]);

        // Se crea la mochila del usuario
        $bag = Bag::firstOrCreate(['user_id' => $user->id]);

        // Se obtiene el ID del item de la gacha ticket
        $ticketId = Item::where('effect_type', 'Gacha Ticket')->value('id');
        // Si se encontró el item, se crea en la mochila del usuario
        if ($ticketId) {
            BagItem::updateOrCreate(
                ['bag_id' => $bag->id, 'item_id' => $ticketId],
                ['quantity' => 6]
            );
        }

        // Se genera el token
        $token = JWTAuth::fromUser($user);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->fresh(),
        ]);
    }

    // Sirve para iniciar sesión
    public function login(Request $request)
    {
        // Se valida la petición
        $validated = $request->validate([
            'id' => 'required|string',
            'password' => 'required|string',
        ]);

        // Se obtiene el ID
        $id = $validated['id'];
        // Se verifica si el usuario existe

        if (!$token = Auth::guard('api')->attempt(['id' => $id, 'password' => $validated['password']])) {
            // Si el usuario no existe, se devuelve un error
            return response()->json([
                'message' => 'Login failed. Incorrect User or Password'
            ], 401);
        }

        // Se obtiene el usuario
        /** @var User $user */
        $user = Auth::guard('api')->user();

        // Si el usuario no está activo, se cierra la sesión y se devuelve un error
        if (!$user->is_active) {
            Auth::guard('api')->logout();
            // Se devuelve la respuesta
            return response()->json([
                'message' => 'This account no longer exists.'
            ], 401);
        }

        // Se devuelve la respuesta
        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    // Sirve para cerrar sesión
    public function logout(Request $request)
    {
        // Se obtiene el usuario
        /** @var User|null $user */
        $user = Auth::guard('api')->user();
        // Si el usuario existe, se actualiza el tiempo de última vista y se cierra la sesión
        if ($user instanceof User) {
            $user->timestamps = false;
            $user->last_seen_at = null;
            $user->save();
        }

        // Se cierra la sesión
        Auth::guard('api')->logout();
        // Se devuelve la respuesta

        return response()->json([
            'message' => 'Logged out successfully'
        ]);
    }

    // Sirve para obtener los datos del usuario
    public function me(Request $request)
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();

        // Se devuelve la respuesta
        return response()->json($user->fresh());
    }

    // Sirve para actualizar los datos del usuario
    public function updateProfile(Request $request)
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();

        // Se valida la petición
        $validated = $request->validate([
            'name' => 'sometimes|string|max:30',
            'surname' => 'sometimes|string|max:30',
            'email' => 'sometimes|string|email|max:120|unique:users,email,' . $user->id,
            'password' => 'sometimes|string|min:6',
        ]);

        // Si se proporciona una nueva contraseña, se hash
        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        // Se actualiza el usuario
        $user->update($validated);

        // Se devuelve la respuesta
        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user->fresh(),
        ]);
    }

    // Sirve para eliminar la cuenta del usuario
    public function deleteAccount(Request $request)
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();
        // Se cierra la sesión
        Auth::guard('api')->logout();
        // Se elimina el usuario
        $user->delete();
        // Se devuelve la respuesta

        return response()->json([
            'message' => 'Account deleted successfully'
        ]);
    }
}
