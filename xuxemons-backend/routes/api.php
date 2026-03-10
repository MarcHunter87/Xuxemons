<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\InventoryController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:api')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/personalinfo', [UserController::class, 'updatePersonalInfo']);
    Route::put('/profile/updatePassword', [UserController::class, 'updatePassword']);
    Route::put('/profile/deactivateAccount', [UserController::class, 'deactivateAccount']);
    Route::post('/profile/upload-banner', [UserController::class, 'uploadBanner']);
    Route::post('/profile/upload-icon', [UserController::class, 'uploadIcon']);
    Route::delete('/profile', [AuthController::class, 'deleteAccount']);

    // Rutas de Inventario
    Route::get('/inventory', [InventoryController::class, 'getInventory']);
    Route::get('/inventory/item/{itemId}', [InventoryController::class, 'getInventoryItem']);
    Route::delete('/inventory/item/{bagItemId}', [InventoryController::class, 'discardItem']);
});
