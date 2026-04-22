<?php

namespace App\Http\Controllers;

use App\Models\Friend;
use App\Models\FriendRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Throwable;

class FriendController extends Controller
{

    // Sirve para buscar usuarios
    public function searchUsers(Request $request): JsonResponse
    {
        try {
            // Se obtiene el query
            $query = trim($request->input('q', ''));
            if (strlen($query) < 3) {
                return response()->json(['data' => []]);
            }

            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se obtienen los IDs de los amigos
            $friendIds = Friend::where('user_id', $currentUser->id)
                ->pluck('friend_user_id');

            // Se obtienen los IDs de las peticiones de amistad enviadas
            $pendingSentIds = FriendRequest::where('sender_id', $currentUser->id)
                ->pluck('receiver_id');

            // Se obtienen los IDs de las peticiones de amistad recibidas
            $pendingReceivedIds = FriendRequest::where('receiver_id', $currentUser->id)
                ->pluck('sender_id');

            // Se obtienen los usuarios
            $users = User::where('id', 'like', '%' . $query . '%')
                ->where('id', '!=', $currentUser->id)
                ->where('is_active', true)
                ->select(['id', 'name', 'level', 'icon_path'])
                ->limit(20)
                ->get()
                ->map(function (User $user) use ($friendIds, $pendingSentIds, $pendingReceivedIds) {
                    // Se devuelve la respuesta
                    return [
                        'id'               => $user->id,
                        'name'             => $user->name,
                        'level'            => $user->level,
                        'icon_path'        => $user->icon_path,
                        'is_friend'        => $friendIds->contains($user->id),
                        'request_sent'     => $pendingSentIds->contains($user->id),
                        'request_received' => $pendingReceivedIds->contains($user->id),
                    ];
                });

            // Se devuelve la respuesta
            return response()->json(['data' => $users]);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Search failed.'], 500);
        }
    }

    // Sirve para enviar una petición de amistad
    public function sendRequest(Request $request): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se valida la petición
            $validated = $request->validate([
                'receiver_id' => 'required|string|exists:users,id',
            ]);

            // Si el usuario es el mismo que el receptor, se devuelve un error
            if ($currentUser->id === $validated['receiver_id']) {
                return response()->json(['message' => 'You cannot send a friend request to yourself.'], 422);
            }

            // Se verifica si ya son amigos
            $alreadyFriends = Friend::where('user_id', $currentUser->id)
                ->where('friend_user_id', $validated['receiver_id'])
                ->exists();

            // Si ya son amigos, se devuelve un error
            if ($alreadyFriends) {
                return response()->json(['message' => 'You are already friends with this user.'], 422);
            }

            // Se verifica si ya existe una petición de amistad
            $existingRequest = FriendRequest::where('sender_id', $currentUser->id)
                ->where('receiver_id', $validated['receiver_id'])
                ->exists();

            // Si ya existe una petición de amistad, se devuelve un error
            if ($existingRequest) {
                return response()->json(['message' => 'Friend request already sent.'], 422);
            }

            // Si el otro usuario ya ha enviado una petición a nosotros, se acepta automáticamente
            $reverseRequest = FriendRequest::where('sender_id', $validated['receiver_id'])
                ->where('receiver_id', $currentUser->id)
                ->first();

            // Si se encontró una petición de amistad inversa, se acepta automáticamente
            if ($reverseRequest) {
                Friend::firstOrCreate(['user_id' => $currentUser->id, 'friend_user_id' => $validated['receiver_id']]);
                Friend::firstOrCreate(['user_id' => $validated['receiver_id'], 'friend_user_id' => $currentUser->id]);
                $reverseRequest->delete();

                return response()->json(['message' => 'Friend request accepted.', 'auto_accepted' => true]);
            }

            // Se crea la petición de amistad
            FriendRequest::create([
                'sender_id'   => $currentUser->id,
                'receiver_id' => $validated['receiver_id'],
            ]);

            // Se devuelve la respuesta
            return response()->json(['message' => 'Friend request sent.'], 201);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to send friend request.'], 500);
        }
    }

    // Sirve para obtener las peticiones de amistad pendientes
    public function getPendingRequests(): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se obtienen las peticiones de amistad pendientes
            $requests = FriendRequest::where('receiver_id', $currentUser->id)
                ->with('sender:id,name,level,icon_path')
                ->get()
                ->map(fn ($r) => [
                    'id'                => $r->id,
                    'sender_id'         => $r->sender_id,
                    'sender_name'       => $r->sender->name,
                    'sender_level'      => $r->sender->level,
                    'sender_icon_path'  => $r->sender->icon_path,
                    'created_at'        => $r->created_at,
                ]);

            // Se devuelve la respuesta
            return response()->json(['data' => $requests]);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to get pending requests.'], 500);
        }
    }

    // Sirve para aceptar una petición de amistad
    public function acceptRequest(int $id): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se obtiene la petición de amistad
            $friendRequest = FriendRequest::where('id', $id)
                ->where('receiver_id', $currentUser->id)
                ->firstOrFail();

            // Se crea el amigo
            Friend::firstOrCreate(['user_id' => $currentUser->id, 'friend_user_id' => $friendRequest->sender_id]);
            Friend::firstOrCreate(['user_id' => $friendRequest->sender_id, 'friend_user_id' => $currentUser->id]);
            // Se elimina la petición de amistad
            $friendRequest->delete();
            // Se devuelve la respuesta

            return response()->json(['message' => 'Friend request accepted.']);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to accept request.'], 500);
        }
    }

    // Sirve para cancelar una petición de amistad
    public function cancelRequest(string $receiverId): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se elimina la petición de amistad
            $deleted = FriendRequest::where('sender_id', $currentUser->id)
                ->where('receiver_id', $receiverId)
                ->delete();

            if (! $deleted) {
                // Se devuelve un error
                return response()->json(['message' => 'Request not found.'], 404);
            }

            // Se devuelve la respuesta
            return response()->json(['message' => 'Friend request cancelled.']);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to cancel request.'], 500);
        }
    }

    // Sirve para rechazar una petición de amistad
    public function rejectRequest(int $id): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se elimina la petición de amistad
            $deleted = FriendRequest::where('id', $id)
                ->where('receiver_id', $currentUser->id)
                ->delete();

            if (! $deleted) {
                // Se devuelve un error
                return response()->json(['message' => 'Request not found.'], 404);
            }

            // Se devuelve la respuesta
            return response()->json(['message' => 'Friend request rejected.']);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to reject request.'], 500);
        }
    }

    // Sirve para obtener los amigos
    public function getFriends(): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se obtienen los amigos
            $friends = Friend::where('user_id', $currentUser->id)
                ->with('friendUser:id,name,level,icon_path,last_seen_at')
                ->get()
                ->map(function ($f) {
                    // Se obtiene el usuario
                    $user = $f->friendUser;
                    // Se obtiene el tiempo de última vista
                    $lastSeen = $user->last_seen_at ? Carbon::parse($user->last_seen_at) : null;
                    // Se obtiene el estado
                    $status = ($lastSeen && $lastSeen->diffInMinutes(now()) <= 1) ? 'online' : 'offline';
                    // Se devuelve la respuesta

                    return [
                        'id'        => $user->id,
                        'name'      => $user->name,
                        'level'     => $user->level,
                        'icon_path' => $user->icon_path,
                        'status'    => $status,
                        'last_seen' => null,
                    ];
                });

            // Se devuelve la respuesta
            return response()->json(['data' => $friends]);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to get friends.'], 500);
        }
    }

    // Sirve para eliminar un amigo
    public function removeFriend(string $friendUserId): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            // Se elimina el amigo
            Friend::where('user_id', $currentUser->id)
                ->where('friend_user_id', $friendUserId)
                ->delete();

            // Se elimina el amigo
            Friend::where('user_id', $friendUserId)
                ->where('friend_user_id', $currentUser->id)
                ->delete();

            // Se devuelve la respuesta
            return response()->json(['message' => 'Friend removed.']);
        } catch (Throwable) {
            // Se devuelve la respuesta
            return response()->json(['message' => 'Failed to remove friend.'], 500);
        }
    }
}
