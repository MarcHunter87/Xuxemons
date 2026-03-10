<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\XuxemonController;
use App\Http\Controllers\UserController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/xuxemons', [XuxemonController::class, 'index']);

Route::middleware('auth:api')->group(function () {
    Route::get('/xuxemons/me', [XuxemonController::class, 'myXuxemons']);
    Route::post('/xuxemons/award-random', [XuxemonController::class, 'awardRandom']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/personalinfo', [UserController::class, 'updatePersonalInfo']);
    Route::put('/profile/updatePassword', [UserController::class, 'updatePassword']);
    Route::put('/profile/deactivateAccount', [UserController::class, 'deactivateAccount']);
    Route::post('/profile/upload-banner', [UserController::class, 'uploadBanner']);
    Route::post('/profile/upload-icon', [UserController::class, 'uploadIcon']);
    Route::delete('/profile', [AuthController::class, 'deleteAccount']);
});
