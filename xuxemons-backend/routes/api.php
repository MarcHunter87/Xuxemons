<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\XuxemonController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/xuxemons', [XuxemonController::class, 'index']);
Route::get('/items', [InventoryController::class, 'getAllItems']);

Route::middleware('auth:api')->group(function () {
    Route::get('/xuxemons/me', [XuxemonController::class, 'myXuxemons']);
    Route::post('/xuxemons/award-random', [XuxemonController::class, 'awardRandom']);
    Route::put('/xuxemons/{id}', [XuxemonController::class, 'update']);
    Route::delete('/xuxemons/{id}', [XuxemonController::class, 'delete']);
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
    Route::post('/inventory/item', [InventoryController::class, 'addItem']);
    Route::put('/inventory/item/{bagItemId}', [InventoryController::class, 'updateItem']);
    Route::delete('/inventory/item/{bagItemId}', [InventoryController::class, 'discardItem']);

    // Rutas de Admin
    Route::get('/users', [AdminController::class, 'getAllUsers']);
    Route::get('/users/{userId}/bag-status', [AdminController::class, 'checkBagStatus']);
});
