<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BattleController;
use App\Http\Controllers\DailyRewardNotificationController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\XuxemonController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/battles/{battleId}/stream', [BattleController::class, 'streamBattle']);

Route::get('/xuxemons', [XuxemonController::class, 'index']);
Route::get('/items', [InventoryController::class, 'getAllItems']);

Route::middleware(['auth:api', 'update.last.seen'])->group(function () {
    // Rutas de Admin
    Route::middleware(['role:admin'])->group(function () {
        Route::get('/users', [AdminController::class, 'getAllUsers']);
        Route::get('/users/{userId}/bag-status', [AdminController::class, 'checkBagStatus']);
        Route::put('/users/{userId}/ban', [AdminController::class, 'banUser']);
        Route::post('/users/{userId}/give-item', [AdminController::class, 'giveItemToUser']);
        Route::post('/users/{userId}/award-random', [XuxemonController::class, 'awardRandomXuxemonToUser']);
        Route::delete('/admin/items/{id}', [AdminController::class, 'deleteItemCascade']);
        Route::delete('/admin/xuxemons/{id}', [AdminController::class, 'deleteXuxemonCascade']);
        Route::get('/admin/meta', [AdminController::class, 'getCreationMeta']); // Get types, attacks, status effects
        Route::get('/admin/items/{id}', [AdminController::class, 'getItem']);
        Route::get('/admin/xuxemons/{id}', [AdminController::class, 'getXuxemon']);
        Route::post('/admin/items', [AdminController::class, 'createItem']);
        Route::put('/admin/items/{id}', [AdminController::class, 'updateItem']);
        Route::post('/admin/xuxemons', [AdminController::class, 'createXuxemon']);
        Route::put('/admin/xuxemons/{id}', [AdminController::class, 'updateXuxemon']);
        Route::get('/admin/sizes', [AdminController::class, 'getAllSizes']);
        Route::get('/admin/sizes/{id}', [AdminController::class, 'getSize']);
        Route::put('/admin/sizes/{id}', [AdminController::class, 'updateSize']);
        Route::get('/admin/daily-rewards', [AdminController::class, 'getAllDailyRewards']);
        Route::get('/admin/daily-rewards/{id}', [AdminController::class, 'getDailyReward']);
        Route::put('/admin/daily-rewards/{id}', [AdminController::class, 'updateDailyReward']);
        Route::get('/admin/side-effects', [AdminController::class, 'getAllSideEffects']);
        Route::get('/admin/side-effects/{id}', [AdminController::class, 'getSideEffect']);
        Route::put('/admin/side-effects/{id}', [AdminController::class, 'updateSideEffect']);
        // Ejecutar las daily rewards
        Route::post('/admin/process-daily-items', [AdminController::class, 'processDailyItems']);
        Route::post('/admin/process-daily-xuxemons', [AdminController::class, 'processDailyXuxemons']);
        Route::post('/admin/process-daily-all', [AdminController::class, 'processDailyAll']);
    });
    
    // Rutas de Profile
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/personalinfo', [UserController::class, 'updatePersonalInfo']);
    Route::put('/profile/updatePassword', [UserController::class, 'updatePassword']);
    Route::put('/profile/deactivateAccount', [UserController::class, 'deactivateAccount']);
    Route::post('/profile/upload-banner', [UserController::class, 'uploadBanner']);
    Route::post('/profile/upload-icon', [UserController::class, 'uploadIcon']);
    Route::delete('/profile', [AuthController::class, 'deleteAccount']);

    // Rutas de Xuxemons
    Route::get('/xuxemons/collection-stats', [XuxemonController::class, 'collectionStats']);
    Route::get('/xuxemons/me', [XuxemonController::class, 'myXuxemons']);
    Route::post('/xuxemons/award-random', [XuxemonController::class, 'awardRandomXuxemon']);
    Route::post('/xuxemons/update-hp', [XuxemonController::class, 'updateCurrentHp']);
    Route::put('/xuxemons/{id}', [XuxemonController::class, 'update']);
    Route::delete('/xuxemons/{id}', [XuxemonController::class, 'delete']);

    // Rutas de Inventory
    Route::get('/inventory', [InventoryController::class, 'getInventory']);
    Route::get('/inventory/item/{itemId}', [InventoryController::class, 'getInventoryItem']);
    Route::post('/inventory/item', [InventoryController::class, 'addItem']);
    Route::put('/inventory/item/{bagItemId}', [InventoryController::class, 'updateItem']);
    Route::delete('/inventory/item/{bagItemId}', [InventoryController::class, 'discardItem']);
    Route::post('/inventory/use', [InventoryController::class, 'useItem']);
    Route::get('/inventory/gacha-tickets', [InventoryController::class, 'getGachaTicketCount']);

    // Daily rewards notifications
    Route::get('/daily-rewards/pending', [DailyRewardNotificationController::class, 'pending']);
    Route::post('/daily-rewards/{id}/ack', [DailyRewardNotificationController::class, 'acknowledge']);

    // Friends
    Route::get('/friends/search', [FriendController::class, 'searchUsers']);
    Route::get('/friends/requests', [FriendController::class, 'getPendingRequests']);
    Route::post('/friends/requests', [FriendController::class, 'sendRequest']);
    Route::delete('/friends/requests/cancel/{receiverId}', [FriendController::class, 'cancelRequest']);
    Route::put('/friends/requests/{id}/accept', [FriendController::class, 'acceptRequest']);
    Route::delete('/friends/requests/{id}', [FriendController::class, 'rejectRequest']);
    Route::get('/friends', [FriendController::class, 'getFriends']);
    Route::delete('/friends/{friendUserId}', [FriendController::class, 'removeFriend']);

    // Batallas
    Route::post('/battles/request/{friendId}', [BattleController::class, 'requestBattle']);
    Route::post('/battles/practice/use-item', [BattleController::class, 'usePracticeItem']);
    Route::post('/battles/{battleId}/accept', [BattleController::class, 'acceptBattle']);
    Route::post('/battles/{battleId}/reject', [BattleController::class, 'rejectBattle']);
    Route::get('/battles/pending', [BattleController::class, 'getPendingBattles']);
    Route::get('/battles/{battleId}', [BattleController::class, 'getBattle']);
    Route::post('/battles/{battleId}/action', [BattleController::class, 'submitAction']);
    Route::post('/battles/{battleId}/use-item', [BattleController::class, 'useBattleItem']);
    Route::post('/battles/{battleId}/finish', [BattleController::class, 'finishBattle']);

    // Equipos
    Route::get('/team', [TeamController::class, 'getTeam']);
    Route::post('/team/slot/{slotNumber}', [TeamController::class, 'updateSlot']);
});
