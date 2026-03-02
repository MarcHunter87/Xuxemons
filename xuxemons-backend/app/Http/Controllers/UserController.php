<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Throwable;

class UserController extends Controller
{
	public function updatePersonalInfo(Request $request)
	{
		try {
			/** @var User $user */
			$user = Auth::guard('api')->user();

			$validated = $request->validate([
				'name' => 'sometimes|string|max:30',
				'surname' => 'sometimes|string|max:30',
				'email' => 'sometimes|string|email|max:120|unique:users,email,' . $user->id,
			], [
				'email.unique' => 'This email is already being used by another account.',
				'email.email' => 'Please provide a valid email address.',
			]);

			if (empty($validated)) {
				return response()->json([
					'message' => 'No personal information provided to update',
					'errors' => [
						'payload' => ['At least one of name, surname or email is required.'],
					],
				], 422);
			}

			$user->update($validated);

			return response()->json([
				'message' => 'Personal information updated successfully',
				'user' => $user->fresh(),
			]);
		} catch (ValidationException $e) {
			return response()->json([
				'message' => 'Validation failed',
				'errors' => $e->errors(),
			], 422);
		} catch (Throwable $e) {
			return response()->json([
				'message' => 'Could not update personal information',
				'errors' => [
					'server' => [$e->getMessage()],
				],
			], 500);
		}
	}

	public function updatePassword(Request $request)
	{
		try {
			/** @var User $user */
			$user = Auth::guard('api')->user();

			$validated = $request->validate([
				'current_password' => 'required|string|min:6',
				'new_password' => 'required|string|min:6',
			], [
				'current_password.required' => 'Current password is required.',
				'new_password.required' => 'New password is required.',
				'new_password.min' => 'New password must be at least 6 characters.',
			]);

			if (!Hash::check($validated['current_password'], $user->password)) {
				return response()->json([
					'message' => 'Current password is not correct.',
					'errors' => [
						'current_password' => ['Current password is not correct.'],
					],
				], 422);
			}

			$user->password = Hash::make($validated['new_password']);
			$user->save();

			return response()->json([
				'message' => 'Password updated successfully.',
			]);
		} catch (ValidationException $e) {
			return response()->json([
				'message' => 'Validation failed',
				'errors' => $e->errors(),
			], 422);
		} catch (Throwable $e) {
			return response()->json([
				'message' => 'Could not update password',
				'errors' => [
					'server' => [$e->getMessage()],
				],
			], 500);
		}
	}

    public function deactivateAccount(Request $request)
    {
        try {
            /** @var User $user */
            $user = Auth::guard('api')->user();

            $user->is_active = false;
            $user->save();

            Auth::guard('api')->logout();

            return response()->json([
                'message' => 'Account deactivated successfully.',
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not deactivate account',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }
}
