<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:api')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/personalinfo', [UserController::class, 'updatePersonalInfo']);
    Route::put('/profile/updatePassword', [UserController::class, 'updatePassword']);
    Route::put('/profile/deactivateAccount', [UserController::class, 'deactivateAccount']);
    Route::delete('/profile', [AuthController::class, 'deleteAccount']);
});
