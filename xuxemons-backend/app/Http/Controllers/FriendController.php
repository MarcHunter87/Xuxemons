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
    public function searchUsers(Request $request): JsonResponse
    {
        try {
            $query = trim($request->input('q', ''));
            if (strlen($query) < 3) {
                return response()->json(['data' => []]);
            }

            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            $friendIds = Friend::where('user_id', $currentUser->id)
                ->pluck('friend_user_id');

            $pendingSentIds = FriendRequest::where('sender_id', $currentUser->id)
                ->pluck('receiver_id');

            $pendingReceivedIds = FriendRequest::where('receiver_id', $currentUser->id)
                ->pluck('sender_id');

            $users = User::where('id', 'like', '%' . $query . '%')
                ->where('id', '!=', $currentUser->id)
                ->where('is_active', true)
                ->select(['id', 'name', 'level', 'icon_path'])
                ->limit(20)
                ->get()
                ->map(function (User $user) use ($friendIds, $pendingSentIds, $pendingReceivedIds) {
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

            return response()->json(['data' => $users]);
        } catch (Throwable) {
            return response()->json(['message' => 'Search failed.'], 500);
        }
    }

    public function sendRequest(Request $request): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            $validated = $request->validate([
                'receiver_id' => 'required|string|exists:users,id',
            ]);

            if ($currentUser->id === $validated['receiver_id']) {
                return response()->json(['message' => 'You cannot send a friend request to yourself.'], 422);
            }

            $alreadyFriends = Friend::where('user_id', $currentUser->id)
                ->where('friend_user_id', $validated['receiver_id'])
                ->exists();

            if ($alreadyFriends) {
                return response()->json(['message' => 'You are already friends with this user.'], 422);
            }

            $existingRequest = FriendRequest::where('sender_id', $currentUser->id)
                ->where('receiver_id', $validated['receiver_id'])
                ->exists();

            if ($existingRequest) {
                return response()->json(['message' => 'Friend request already sent.'], 422);
            }

            // If the other user already sent a request to us, auto-accept
            $reverseRequest = FriendRequest::where('sender_id', $validated['receiver_id'])
                ->where('receiver_id', $currentUser->id)
                ->first();

            if ($reverseRequest) {
                Friend::firstOrCreate(['user_id' => $currentUser->id, 'friend_user_id' => $validated['receiver_id']]);
                Friend::firstOrCreate(['user_id' => $validated['receiver_id'], 'friend_user_id' => $currentUser->id]);
                $reverseRequest->delete();

                return response()->json(['message' => 'Friend request accepted.', 'auto_accepted' => true]);
            }

            FriendRequest::create([
                'sender_id'   => $currentUser->id,
                'receiver_id' => $validated['receiver_id'],
            ]);

            return response()->json(['message' => 'Friend request sent.'], 201);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to send friend request.'], 500);
        }
    }

    public function getPendingRequests(): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

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

            return response()->json(['data' => $requests]);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to get pending requests.'], 500);
        }
    }

    public function acceptRequest(int $id): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            $friendRequest = FriendRequest::where('id', $id)
                ->where('receiver_id', $currentUser->id)
                ->firstOrFail();

            Friend::firstOrCreate(['user_id' => $currentUser->id, 'friend_user_id' => $friendRequest->sender_id]);
            Friend::firstOrCreate(['user_id' => $friendRequest->sender_id, 'friend_user_id' => $currentUser->id]);
            $friendRequest->delete();

            return response()->json(['message' => 'Friend request accepted.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to accept request.'], 500);
        }
    }

    public function cancelRequest(string $receiverId): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            $deleted = FriendRequest::where('sender_id', $currentUser->id)
                ->where('receiver_id', $receiverId)
                ->delete();

            if (! $deleted) {
                return response()->json(['message' => 'Request not found.'], 404);
            }

            return response()->json(['message' => 'Friend request cancelled.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to cancel request.'], 500);
        }
    }

    public function rejectRequest(int $id): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            $deleted = FriendRequest::where('id', $id)
                ->where('receiver_id', $currentUser->id)
                ->delete();

            if (! $deleted) {
                return response()->json(['message' => 'Request not found.'], 404);
            }

            return response()->json(['message' => 'Friend request rejected.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to reject request.'], 500);
        }
    }

    public function getFriends(): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            $friends = Friend::where('user_id', $currentUser->id)
                ->with('friendUser:id,name,level,icon_path,last_seen_at')
                ->get()
                ->map(function ($f) {
                    $user = $f->friendUser;
                    $lastSeen = $user->last_seen_at ? Carbon::parse($user->last_seen_at) : null;
                    $status = ($lastSeen && $lastSeen->diffInMinutes(now()) <= 1) ? 'online' : 'offline';

                    return [
                        'id'        => $user->id,
                        'name'      => $user->name,
                        'level'     => $user->level,
                        'icon_path' => $user->icon_path,
                        'status'    => $status,
                        'last_seen' => null,
                    ];
                });

            return response()->json(['data' => $friends]);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to get friends.'], 500);
        }
    }

    public function removeFriend(string $friendUserId): JsonResponse
    {
        try {
            /** @var User $currentUser */
            $currentUser = Auth::guard('api')->user();

            Friend::where('user_id', $currentUser->id)
                ->where('friend_user_id', $friendUserId)
                ->delete();

            Friend::where('user_id', $friendUserId)
                ->where('friend_user_id', $currentUser->id)
                ->delete();

            return response()->json(['message' => 'Friend removed.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to remove friend.'], 500);
        }
    }
}
