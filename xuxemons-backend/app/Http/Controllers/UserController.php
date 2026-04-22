<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Throwable;
use WebPConvert\WebPConvert;

class UserController extends Controller
{
    // Sirve para actualizar la información personal del usuario
    public function updatePersonalInfo(Request $request)
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $user */
            $user = Auth::guard('api')->user();

            // Se valida la información del usuario
            $validated = $request->validate([
                'name' => 'sometimes|string|max:30',
                'surname' => 'sometimes|string|max:30',
                'email' => 'sometimes|string|email|max:120|unique:users,email,'.$user->id,
                'view_animations' => 'sometimes|boolean',
                'theme' => 'sometimes|string|in:light,dark',
            ], [
                'email.unique' => 'This email is already being used by another account.',
                'email.email' => 'Please provide a valid email address.',
            ]);

            // Si no se proporciona información, se devuelve un error
            if (empty($validated)) {
                return response()->json([
                    'message' => 'No personal information provided to update',
                    'errors' => [
                        'payload' => ['At least one of name, surname or email is required.'],
                    ],
                ], 422);
            }

            // Se actualiza la información del usuario
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

    // Sirve para actualizar la contraseña del usuario
    public function updatePassword(Request $request)
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $user */
            $user = Auth::guard('api')->user();

            // Se valida la información del usuario
            $validated = $request->validate([
                'current_password' => 'required|string|min:6',
                'new_password' => 'required|string|min:6',
            ], [
                'current_password.required' => 'Current password is required.',
                'new_password.required' => 'New password is required.',
                'new_password.min' => 'New password must be at least 6 characters.',
            ]);

            // Si la contraseña actual no es correcta, se devuelve un error
            if (! Hash::check($validated['current_password'], $user->password)) {
                return response()->json([
                    'message' => 'Current password is not correct.',
                    'errors' => [
                        'current_password' => ['Current password is not correct.'],
                    ],
                ], 422);
            }

            // Se actualiza la contraseña del usuario
            $user->password = Hash::make($validated['new_password']);
            $user->save();

            // Se devuelve la respuesta
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

    // Sirve para desactivar la cuenta del usuario
    public function deactivateAccount(Request $request)
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $user */
            $user = Auth::guard('api')->user();

            // Se desactiva la cuenta del usuario
            $user->update(['is_active' => false, 'email' => '']);

            // Se cierra la sesión del usuario
            Auth::guard('api')->logout();

            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Account deleted successfully.',
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Couldn\'t delete account',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para subir el banner del usuario
    public function uploadBanner(Request $request)
    {
        return $this->uploadProfileImage($request, 'banner', 'banner_path', 'banners', 20480, 'Banner', 'Couldn\'t upload banner');
    }

    // Sirve para subir el icono del usuario
    public function uploadIcon(Request $request)
    {
        return $this->uploadProfileImage($request, 'icon', 'icon_path', 'icons', 20480, 'Icon', 'Couldn\'t upload icon');
    }

    // Sirve para subir la imagen de perfil del usuario
    private function uploadProfileImage(Request $request, string $field, string $pathKey, string $dir, int $maxKb, string $label, string $errorMessage): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $user */
            $user = Auth::guard('api')->user();

            // Se valida la imagen de perfil
            $request->validate([
                $field => 'required|image|max:'.$maxKb,
            ], [
                "{$field}.required" => "{$label} image is required.",
                "{$field}.image" => 'File must be an image.',
                "{$field}.max" => "{$label} must be less than ".round($maxKb / 1024).'MB.',
            ]);

            // Se obtiene el archivo
            $file = $request->file($field);
            $filename = $user->id.'.webp';
            // Se obtiene la ruta pública
            $publicPath = public_path("users/{$dir}");
            // Si la ruta pública no existe, se crea

            if (! file_exists($publicPath)) {
                mkdir($publicPath, 0755, true);
            }

            // Se obtiene la ruta antigua
            $oldPath = $user->{$pathKey} ? public_path($user->{$pathKey}) : null;
            if ($oldPath && file_exists($oldPath)) {
                unlink($oldPath);
            }

            // Se convierte la imagen subida a webp
            $this->saveImageAsWebp($file->getRealPath(), "{$publicPath}/{$filename}");
            $user->{$pathKey} = "/users/{$dir}/{$filename}";
            $user->updated_at = now();
            $user->save();

            // Se devuelve la respuesta
            return response()->json([
                'message' => "{$label} uploaded successfully.",
                'user' => $user->fresh(),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (Throwable $e) {
            return response()->json(['message' => $errorMessage, 'errors' => ['server' => [$e->getMessage()]]], 500);
        }
    }

    // Sirve para convertir una imagen a webp y guardarla con ImageMagick
    private function saveImageAsWebp(string $sourcePath, string $targetPath): void
    {
        $detectedMime = mime_content_type($sourcePath) ?: 'unknown';

        if ($detectedMime === 'image/webp') {
            if (! @copy($sourcePath, $targetPath)) {
                throw new \RuntimeException('Could not persist uploaded webp file.');
            }
            return;
        }

        WebPConvert::convert($sourcePath, $targetPath, [
            'quality' => 90,
            'fail' => 'throw',
        ]);
    }
}
