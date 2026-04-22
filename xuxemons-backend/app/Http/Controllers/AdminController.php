<?php

namespace App\Http\Controllers;

use App\Models\AdquiredXuxemon;
use App\Models\Attack;
use App\Models\Bag;
use App\Models\BagItem;
use App\Models\DailyReward;
use App\Models\Item;
use App\Models\SideEffect;
use App\Models\Size;
use App\Models\StatusEffect;
use App\Models\Type;
use App\Models\User;
use App\Models\Xuxemon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;
use WebPConvert\WebPConvert;

class AdminController extends Controller
{
    // Sirve para obtener todas las recompensas diarias
    public function getAllDailyRewards(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtienen las recompensas diarias
            $rewards = DailyReward::query()
                ->with('item:id,name')
                ->orderBy('id')
                ->get(['id', 'time', 'quantity', 'item_id'])
                ->map(fn (DailyReward $reward) => [
                    'id' => $reward->id,
                    'time' => $reward->time,
                    'quantity' => (int) $reward->quantity,
                    'item_id' => $reward->item_id,
                    'item_name' => $reward->item?->name,
                ]);

            // Se devuelve la respuesta
            return response()->json(['data' => $rewards]);
        } catch (Throwable $e) {
            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Could not retrieve daily rewards',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para obtener una recompensa diaria
    public function getDailyReward(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene la recompensa diaria
            $reward = DailyReward::query()
                ->with('item:id,name')
                ->find($id);
            if (! $reward) {
                return response()->json(['message' => 'Daily reward not found'], 404);
            }

            // Se devuelve la respuesta
            return response()->json([
                'data' => [
                    'id' => $reward->id,
                    'time' => $reward->time,
                    'quantity' => (int) $reward->quantity,
                    'item_id' => $reward->item_id,
                    'item_name' => $reward->item?->name,
                ],
            ]);
        } catch (Throwable $e) {
            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Could not retrieve daily reward',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para actualizar una recompensa diaria
    public function updateDailyReward(Request $request, int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene la recompensa diaria
            $reward = DailyReward::query()->find($id);
            if (! $reward) {
                return response()->json(['message' => 'Daily reward not found'], 404);
            }

            // Se valida la petición
            $validated = $request->validate([
                'time' => 'required|date_format:H:i',
                'quantity' => 'required|integer|min:1',
            ]);

            // Se actualiza la recompensa diaria
            $reward->update([
                'time' => $validated['time'].':00',
                'quantity' => (int) $validated['quantity'],
            ]);
            // Se carga el item
            $reward->loadMissing('item:id,name');

            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Daily reward updated successfully',
                'data' => [
                    'id' => $reward->id,
                    'time' => $reward->time,
                    'quantity' => (int) $reward->quantity,
                    'item_id' => $reward->item_id,
                    'item_name' => $reward->item?->name,
                ],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Could not update daily reward',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para procesar los items diariamente
    public function processDailyItems(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se procesan los items diariamente
            Artisan::call('app:process-daily-items');

            // Se devuelve la respuesta
            return response()->json(['message' => 'Daily items processing started']);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not process daily items',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para procesar los Xuxemons diariamente
    public function processDailyXuxemons(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se procesan los Xuxemons diariamente
            Artisan::call('app:process-daily-xuxemons');

            // Se devuelve la respuesta
            return response()->json(['message' => 'Daily xuxemons processing started']);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not process daily xuxemons',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    public function processDailyAll(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se procesan los Xuxemons y los items diariamente
            Artisan::call('app:process-daily-xuxemons');
            Artisan::call('app:process-daily-items');

            // Se devuelve la respuesta
            return response()->json(['message' => 'All daily processing started']);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not process daily rewards',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para obtener todos los efectos secundarios
    public function getAllSideEffects(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtienen todos los efectos secundarios
            $sideEffects = SideEffect::query()
                ->orderBy('id')
                ->get(['id', 'name', 'description', 'icon_path', 'apply_chance'])
                ->map(fn (SideEffect $sideEffect) => [
                    'id' => $sideEffect->id,
                    'name' => $sideEffect->name,
                    'description' => $sideEffect->description,
                    'icon_path' => $sideEffect->icon_path,
                    'apply_chance' => $sideEffect->apply_chance !== null ? (int) $sideEffect->apply_chance : null,
                ]);

            // Se devuelve la respuesta
            return response()->json(['data' => $sideEffects]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve side effects',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para obtener un efecto secundario
    public function getSideEffect(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el efecto secundario
            $sideEffect = SideEffect::query()->find($id);
            if (! $sideEffect) {
                return response()->json(['message' => 'Side effect not found'], 404);
            }

            // Se devuelve la respuesta
            return response()->json([
                'data' => [
                    'id' => $sideEffect->id,
                    'name' => $sideEffect->name,
                    'description' => $sideEffect->description,
                    'icon_path' => $sideEffect->icon_path,
                    'apply_chance' => $sideEffect->apply_chance !== null ? (int) $sideEffect->apply_chance : null,
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve side effect',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para actualizar un efecto secundario
    public function updateSideEffect(Request $request, int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el efecto secundario
            $sideEffect = SideEffect::query()->find($id);
            if (! $sideEffect) {
                return response()->json(['message' => 'Side effect not found'], 404);
            }

            // Se valida la petición
            $validated = $request->validate([
                'apply_chance' => 'nullable|integer|min:0|max:100',
            ]);

            // Se actualiza el efecto secundario
            $sideEffect->update([
                'apply_chance' => array_key_exists('apply_chance', $validated) ? $validated['apply_chance'] : $sideEffect->apply_chance,
            ]);

            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Side effect updated successfully',
                'data' => [
                    'id' => $sideEffect->id,
                    'name' => $sideEffect->name,
                    'description' => $sideEffect->description,
                    'icon_path' => $sideEffect->icon_path,
                    'apply_chance' => $sideEffect->apply_chance !== null ? (int) $sideEffect->apply_chance : null,
                ],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not update side effect',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para obtener todos los usuarios
    public function getAllUsers(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $user */
            $user = Auth::guard('api')->user();

            if (! $user->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json([
                    'message' => 'Unauthorized',
                ], 403);
            }

            // Se obtienen todos los usuarios
            $users = User::where('is_active', true)
                ->where('role', 'player')
                ->select('id', 'name', 'surname', 'email', 'role')
                ->get();

            // Se devuelve la respuesta
            return response()->json([
                'data' => $users,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve users',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para verificar el estado de la mochila de un usuario
    public function checkBagStatus(string $userId): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $user */
            $user = Auth::guard('api')->user();

            if (! $user->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json([
                    'message' => 'Unauthorized',
                ], 403);
            }

            // Se obtiene el usuario objetivo
            $targetUser = User::find($userId);
            if (! $targetUser) {
                // Si el usuario objetivo no existe, se devuelve un error
                return response()->json([
                    'message' => 'User not found',
                ], 404);
            }

            // Se obtiene la mochila del usuario objetivo
            $bag = $targetUser->bag;
            // Si la mochila no existe, se devuelve un error
            if (! $bag) {
                return response()->json([
                    'message' => 'User has no bag',
                ], 404);
            }

            // Se obtienen los items de la mochila
            $bagItems = $bag->bagItems()->with('item')->get();
            $usedSlots = $this->calculateUsedSlots($bagItems);

            // Se devuelve la respuesta
            return response()->json([
                'data' => [
                    'max_slots' => $bag->max_slots,
                    'used_slots' => $usedSlots,
                    'available_slots' => $bag->max_slots - $usedSlots,
                ],
            ]);
        } catch (Throwable $e) {
            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not check bag status',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para banear a un usuario
    public function banUser(string $userId): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el usuario objetivo
            $targetUser = User::where('id', $userId)
                ->where('is_active', true)
                ->first();

            if (! $targetUser) {
                // Si el usuario objetivo no existe, se devuelve un error
                return response()->json(['message' => 'User not found'], 404);
            }

            // Se actualiza el usuario objetivo
            $targetUser->update([
                'is_active' => false,
                'email' => '',
            ]);

            // Se devuelve la respuesta
            return response()->json([
                'message' => 'User banned successfully.',
            ]);
        } catch (Throwable $e) {
            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => "Couldn't ban user.",
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para dar un item a un usuario
    public function giveItemToUser(Request $request, string $userId): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el usuario objetivo
            $targetUser = User::find($userId);
            if (! $targetUser) {
                // Si el usuario objetivo no existe, se devuelve un error
                return response()->json(['message' => 'User not found'], 404);
            }

            // Se obtiene el item
            $itemId = (int) $request->input('item_id');
            $quantity = (int) $request->input('quantity', 1);
            if ($quantity < 1) {
                // Si la cantidad es menor a 1, se devuelve un error
                return response()->json(['message' => 'Quantity must be at least 1'], 422);
            }

            // Se obtiene el item
            $item = Item::find($itemId);
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            // Se obtiene la mochila del usuario objetivo
            $bag = Bag::firstOrCreate(
                ['user_id' => $targetUser->id],
                ['max_slots' => Bag::MAX_SLOTS]
            );

            // Se obtienen los items de la mochila
            $bagItems = BagItem::where('bag_id', $bag->id)->with('item')->get();
            $usedSlots = $this->calculateUsedSlots($bagItems);

            // Se obtiene el item existente
            $existing = BagItem::where('bag_id', $bag->id)->where('item_id', $itemId)->first();
            $existingQty = $existing ? (int) $existing->quantity : 0;
            $requestedQty = $quantity;
            // Se calcula la cantidad permitida
            $allowedAddQty = 0;

            if ($item->is_stackable) {
                // Si el item es stackeable, se calcula la cantidad permitida
                $maxQty = max(1, (int) ($item->max_quantity ?? 1));
                $oldStacks = $existingQty > 0 ? (int) ceil($existingQty / $maxQty) : 0;
                $freeStacksForItem = $bag->max_slots - ($usedSlots - $oldStacks);
                // Se calcula la cantidad de stacks libres para el item
                $freeStacksForItem = max(0, $freeStacksForItem);
                $maxTotalQty = $freeStacksForItem * $maxQty;
                $allowedAddQty = max(0, $maxTotalQty - $existingQty);
            } else {
                // Si el item no es stackeable, se calcula la cantidad de slots libres para el item
                $freeSlotsForItem = $bag->max_slots - ($usedSlots - $existingQty);
                $freeSlotsForItem = max(0, $freeSlotsForItem);
                $allowedAddQty = max(0, $freeSlotsForItem - $existingQty);
            }

            // Se calcula la cantidad de items a añadir
            $addedQty = min($requestedQty, $allowedAddQty);
            // Se calcula la cantidad de items a descartar
            $discardedQty = $requestedQty - $addedQty;

            // Si la cantidad de items a añadir es 0, se devuelve un error
            if ($addedQty === 0) {
                return response()->json([
                    'message' => 'No slots available for this item',
                    'data' => [
                        'bag_item_id' => $existing ? $existing->id : null,
                        'item_id' => $itemId,
                        'quantity' => $existingQty,
                        'requested_quantity' => $requestedQty,
                        'added_quantity' => 0,
                        'discarded_quantity' => $discardedQty,
                    ],
                ], 200);
            }

            // Se calcula la nueva cantidad de items
            $newQty = $existingQty + $addedQty;
            if ($existing) {
                $existing->load('item');
            }

            // Si el item existe, se actualiza la cantidad
            if ($existing) {
                $existing->quantity = $newQty;
                $existing->save();

                // Se devuelve la respuesta
                return response()->json([
                    'message' => 'Item quantity updated',
                    'data' => [
                        'bag_item_id' => $existing->id,
                        'item_id' => $existing->item_id,
                        'quantity' => $existing->quantity,
                        'requested_quantity' => $requestedQty,
                        'added_quantity' => $addedQty,
                        'discarded_quantity' => $discardedQty,
                    ],
                ], 200);
            }

            // Se crea el item en la mochila
            $bagItem = BagItem::create([
                'bag_id' => $bag->id,
                'item_id' => $itemId,
                'quantity' => $addedQty,
            ]);

            // Se devuelve la respuesta
            return response()->json([
                'message' => 'Item added to inventory',
                'data' => [
                    'bag_item_id' => $bagItem->id,
                    'item_id' => $bagItem->item_id,
                    'quantity' => $bagItem->quantity,
                    'requested_quantity' => $requestedQty,
                    'added_quantity' => $addedQty,
                    'discarded_quantity' => $discardedQty,
                ],
            ], 201);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Error giving item',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // Sirve para obtener los metadatos de creación
    public function getCreationMeta(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtienen los tipos
            $types = Type::query()->select('id', 'name', 'icon_path')->orderBy('name')->get();
            // Se obtienen los ataques
            $attacks = Attack::query()
                ->with('statusEffect:id,name,icon_path')
                ->get()
                ->sortBy(fn (Attack $a) => ($a->statusEffect?->name ?? "\u{FFFF}").' '.$a->name)
                ->values()
                ->map(fn (Attack $a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'icon_path' => $a->statusEffect?->icon_path,
                ]);
            // Se obtienen los efectos de estado
            $statusEffects = StatusEffect::query()->select('id', 'name', 'icon_path')->orderBy('name')->get();
            // Se devuelve la respuesta

            return response()->json([
                // Se devuelve la respuesta
                'data' => [
                    'types' => $types,
                    'attacks' => $attacks,
                    'status_effects' => $statusEffects,
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve creation metadata',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para crear un item
    public function createItem(Request $request): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se valida la petición
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:items,name',
                'description' => 'required|string',
                'effect_type' => 'required|in:Heal,DMG Up,Defense Up,Gacha Ticket,Remove Status Effects,Apply Status Effects,Evolve',
                'effect_value' => 'nullable|integer|min:0',
                'is_stackable' => 'required|boolean',
                'max_quantity' => 'required|integer|min:1|max:99',
                'status_effect_id' => 'nullable|exists:status_effects,id',
                'icon' => 'required|image|max:20480',
            ]);

            // Se obtiene el nombre
            $name = trim((string) $validated['name']);
            $isStackable = (bool) $validated['is_stackable'];
            $maxLimit = $validated['effect_type'] === 'Gacha Ticket' ? 99 : 5;
            $maxQuantity = $isStackable ? min($maxLimit, max(1, (int) $validated['max_quantity'])) : 1;

            // Se obtiene el archivo de la imagen
            $iconFile = $request->file('icon');
            $filename = Str::slug($name, '_').'.webp';
            // Se obtiene la ruta pública
            $publicPath = public_path('items');
            // Si la ruta pública no existe, se crea
            if (! file_exists($publicPath)) {
                mkdir($publicPath, 0755, true);
            }
            $this->saveImageAsWebp($iconFile->getRealPath(), "{$publicPath}/{$filename}");

            // Se crea el item
            $item = Item::create([
                'name' => $name,
                'description' => trim((string) $validated['description']),
                'effect_type' => $validated['effect_type'],
                'effect_value' => $validated['effect_value'] ?? null,
                'is_stackable' => $isStackable,
                'max_quantity' => $maxQuantity,
                'status_effect_id' => $validated['status_effect_id'] ?? null,
                'icon_path' => 'items/'.$filename,
            ]);

            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Item created successfully',
                'data' => $item->load('statusEffect'),
            ], 201);
        } catch (ValidationException $e) {
            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not create item',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para crear un xuxemon
    public function createXuxemon(Request $request): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se valida la petición
            $validated = $request->validate([
                'name' => 'required|string|max:128|unique:xuxemons,name',
                'description' => 'nullable|string',
                'type_id' => 'required|exists:types,id',
                'attack_1_id' => 'required|exists:attacks,id|different:attack_2_id',
                'attack_2_id' => 'required|exists:attacks,id|different:attack_1_id',
                'hp' => 'required|integer|min:1',
                'attack' => 'required|integer|min:1',
                'defense' => 'required|integer|min:1',
                'icon' => 'required|image|max:20480',
            ]);

            // Se obtiene el nombre
            $name = trim((string) $validated['name']);
            $iconFile = $request->file('icon');
            $filename = Str::slug($name, '_').'.webp';
            // Se obtiene la ruta pública
            $publicPath = public_path('xuxemons');
            // Si la ruta pública no existe, se crea
            if (! file_exists($publicPath)) {
                mkdir($publicPath, 0755, true);
            }
            $this->saveImageAsWebp($iconFile->getRealPath(), "{$publicPath}/{$filename}");

            // Se crea el xuxemon
            $xuxemon = Xuxemon::create([
                'name' => $name,
                'description' => $validated['description'] ? trim((string) $validated['description']) : null,
                'type_id' => (int) $validated['type_id'],
                'attack_1_id' => (int) $validated['attack_1_id'],
                'attack_2_id' => (int) $validated['attack_2_id'],
                'hp' => (int) $validated['hp'],
                'attack' => (int) $validated['attack'],
                'defense' => (int) $validated['defense'],
                'icon_path' => 'xuxemons/'.$filename,
            ]);

            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Xuxemon created successfully',
                'data' => $xuxemon->load(['type', 'attack1', 'attack2']),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not create Xuxemon',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para obtener un item
    public function getItem(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el item
            $item = Item::with('statusEffect')->find($id);
            if (! $item) {
                // Si el item no existe, se devuelve un error
                return response()->json(['message' => 'Item not found'], 404);
            }

            // Se devuelve la respuesta
            return response()->json(['data' => $item]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve item',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para obtener un xuxemon
    public function getXuxemon(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el xuxemon
            $xuxemon = Xuxemon::with(['type', 'attack1', 'attack2'])->find($id);
            // Si el xuxemon no existe, se devuelve un error
            if (! $xuxemon) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            // Se devuelve la respuesta
            return response()->json(['data' => $xuxemon]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve Xuxemon',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para actualizar un item
    public function updateItem(Request $request, int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el item
            $item = Item::find($id);
            // Si el item no existe, se devuelve un error
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            // Se valida la petición
            $rules = [
                'name' => 'required|string|max:255|unique:items,name,'.$id,
                'description' => 'required|string',
                'effect_type' => 'required|in:Heal,DMG Up,Defense Up,Gacha Ticket,Remove Status Effects,Apply Status Effects,Evolve',
                'effect_value' => 'nullable|integer|min:0',
                'is_stackable' => 'required|boolean',
                'max_quantity' => 'required|integer|min:1|max:99',
                'status_effect_id' => 'nullable|exists:status_effects,id',
                'icon' => 'nullable|image|max:20480',
            ];
            // Se valida la petición
            $validated = $request->validate($rules);

            // Se obtiene el nombre
            $name = trim((string) $validated['name']);
            // Se obtiene el tipo de stackable
            $isStackable = (bool) $validated['is_stackable'];
            $maxLimit = $validated['effect_type'] === 'Gacha Ticket' ? 99 : 5;
            $maxQuantity = $isStackable ? min($maxLimit, max(1, (int) $validated['max_quantity'])) : 1;

            // Se obtiene el update
            $update = [
                'name' => $name,
                'description' => trim((string) $validated['description']),
                'effect_type' => $validated['effect_type'],
                'effect_value' => $validated['effect_value'] ?? null,
                'is_stackable' => $isStackable,
                'max_quantity' => $maxQuantity,
                'status_effect_id' => $validated['status_effect_id'] ?? null,
            ];

            // Se obtiene el archivo de la imagen
            $iconFile = $request->file('icon');
            // Si el archivo de la imagen existe, se procesa
            if ($iconFile) {
                // Se obtiene la ruta pública
                $publicPath = public_path('items');
                // Si la ruta pública no existe, se crea
                if (! file_exists($publicPath)) {
                    mkdir($publicPath, 0755, true);
                }

                $currentPath = (string) ($item->icon_path ?? '');
                $targetPath = $currentPath !== ''
                    ? preg_replace('/\.[a-z0-9]+$/i', '.webp', $currentPath)
                    : 'items/'.Str::slug($name, '_').'.webp';
                $targetPath = (string) $targetPath;

                if ($currentPath !== '' && $currentPath !== $targetPath) {
                    $oldAbsolutePath = public_path($currentPath);
                    if (file_exists($oldAbsolutePath)) {
                        unlink($oldAbsolutePath);
                    }
                }

                $this->saveImageAsWebp($iconFile->getRealPath(), public_path($targetPath));
                $update['icon_path'] = $targetPath;
                $update['updated_at'] = now();
            }

            // Se actualiza el item
            $item->update($update);
            // Se devuelve la respuesta

            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Item updated successfully',
                'data' => $item->fresh()->load('statusEffect'),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not update item',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para actualizar un xuxemon
    public function updateXuxemon(Request $request, int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el xuxemon
            $xuxemon = Xuxemon::find($id);
            // Si el xuxemon no existe, se devuelve un error
            if (! $xuxemon) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            // Se valida la petición
            $rules = [
                'name' => 'required|string|max:128|unique:xuxemons,name,'.$id,
                'description' => 'nullable|string',
                'type_id' => 'required|exists:types,id',
                'attack_1_id' => 'required|exists:attacks,id|different:attack_2_id',
                'attack_2_id' => 'required|exists:attacks,id|different:attack_1_id',
                'hp' => 'required|integer|min:1',
                'attack' => 'required|integer|min:1',
                'defense' => 'required|integer|min:1',
                'icon' => 'nullable|image|max:20480',
            ];
            // Se valida la petición
            $validated = $request->validate($rules);

            // Se obtiene el nombre
            $name = trim((string) $validated['name']);
            // Se obtiene el update
            $update = [
                'name' => $name,
                'description' => $validated['description'] ? trim((string) $validated['description']) : null,
                'type_id' => (int) $validated['type_id'],
                'attack_1_id' => (int) $validated['attack_1_id'],
                'attack_2_id' => (int) $validated['attack_2_id'],
                'hp' => (int) $validated['hp'],
                'attack' => (int) $validated['attack'],
                'defense' => (int) $validated['defense'],
            ];

            // Se obtiene el archivo de la imagen
            $iconFile = $request->file('icon');
            // Si el archivo de la imagen existe, se procesa
            if ($iconFile) {
                // Se obtiene la ruta pública
                $publicPath = public_path('xuxemons');
                // Si la ruta pública no existe, se crea
                if (! file_exists($publicPath)) {
                    mkdir($publicPath, 0755, true);
                }

                $currentPath = (string) ($xuxemon->icon_path ?? '');
                $targetPath = $currentPath !== ''
                    ? preg_replace('/\.[a-z0-9]+$/i', '.webp', $currentPath)
                    : 'xuxemons/'.Str::slug($name, '_').'.webp';
                $targetPath = (string) $targetPath;

                if ($currentPath !== '' && $currentPath !== $targetPath) {
                    $oldAbsolutePath = public_path($currentPath);
                    if (file_exists($oldAbsolutePath)) {
                        unlink($oldAbsolutePath);
                    }
                }

                $this->saveImageAsWebp($iconFile->getRealPath(), public_path($targetPath));
                $update['icon_path'] = $targetPath;
                $update['updated_at'] = now();
            }

            // Se actualiza el xuxemon
            $xuxemon->update($update);
            // Se devuelve la respuesta

            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Xuxemon updated successfully',
                'data' => $xuxemon->fresh()->load(['type', 'attack1', 'attack2']),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not update Xuxemon',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para calcular los slots usados
    private function calculateUsedSlots($bagItems): int
    {
        // Se inicializa el número de slots usados
        $usedSlots = 0;
        // Se recorren los items de la mochila
        foreach ($bagItems as $bagItem) {
            if (! $bagItem->item || $bagItem->item->excludedFromPlayerInventory()) {
                continue;
            }
            if ($bagItem->item->is_stackable) {
                // Se obtiene el máximo de cantidad
                $maxQty = $bagItem->item->max_quantity ?? 1;
                // Se calcula el número de slots
                $slots = ceil($bagItem->quantity / $maxQty);
                $usedSlots += $slots;
            } else {
                // Se agrega la cantidad de items no stackeables
                $usedSlots += $bagItem->quantity;
            }
        }

        return $usedSlots;
    }

    // Sirve para convertir una imagen a webp y guardarla
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

    // Sirve para eliminar un item
    public function deleteItemCascade(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el item
            $item = Item::find($id);
            // Si el item no existe, se devuelve un error
            if (! $item) {
                return response()->json(['message' => 'Item not found'], 404);
            }

            // Se eliminan los items de la mochila
            DB::transaction(function () use ($id, $item) {
                BagItem::where('item_id', $id)->delete();
                // Se elimina el item
                $item->delete();
            });

            // Se devuelve la respuesta
            return response()->json(['message' => 'Item deleted']);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not delete item',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para eliminar un xuxemon
    public function deleteXuxemonCascade(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el xuxemon
            $xuxemon = Xuxemon::find($id);
            // Si el xuxemon no existe, se devuelve un error
            if (! $xuxemon) {
                return response()->json(['message' => 'Xuxemon not found'], 404);
            }

            // Se eliminan los xuxemons adqueridos
            DB::transaction(function () use ($id, $xuxemon) {
                // Se eliminan los xuxemons adqueridos
                AdquiredXuxemon::where('xuxemon_id', $id)->delete();
                // Se elimina el xuxemon
                $xuxemon->delete();
            });

            // Se devuelve la respuesta
            return response()->json(['message' => 'Xuxemon deleted']);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not delete Xuxemon',
                'errors' => [
                    'server' => [$e->getMessage()],
                ],
            ], 500);
        }
    }

    // Sirve para obtener todos los tamaños
    public function getAllSizes(): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtienen los tamaños
            $sizes = Size::orderBy('id')->get();
            // Se devuelve la respuesta

            return response()->json(['data' => $sizes]);
        } catch (Throwable $e) {
            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve sizes',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para obtener un tamaño
    public function getSize(int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el tamaño
            $size = Size::find($id);
            // Si el tamaño no existe, se devuelve un error
            if (! $size) {
                return response()->json(['message' => 'Size not found'], 404);
            }

            // Se devuelve la respuesta
            return response()->json(['data' => $size]);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not retrieve size',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }

    // Sirve para actualizar un tamaño
    public function updateSize(Request $request, int $id): JsonResponse
    {
        try {
            // Se obtiene el usuario autenticado
            /** @var User $admin */
            $admin = Auth::guard('api')->user();
            if (! $admin || ! $admin->is_admin) {
                // Si el usuario no está autenticado o no es un administrador, se devuelve un error
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Se obtiene el tamaño
            $size = Size::find($id);
            // Si el tamaño no existe, se devuelve un error
            if (! $size) {
                return response()->json(['message' => 'Size not found'], 404);
            }

            // Si el tamaño es Small, se devuelve un error
            if ($size->size === 'Small') {
                return response()->json(['message' => 'The Small size cannot be edited.'], 403);
            }

            // Se valida la petición
            $validated = $request->validate([
                'requirement_progress' => 'required|integer|min:0',
            ]);

            // Se actualiza el tamaño
            DB::transaction(function () use ($size, $validated) {
                // Se actualiza el tamaño
                $size->update([
                    'requirement_progress' => (int) $validated['requirement_progress'],
                ]);
                // Se reconciliallos tamaños de los xuxemons adqueridos
                Size::reconcileAllAdquiredXuxemonSizes();
            });

            $size->refresh();

            // Se devuelve la respuesta
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Size updated successfully',
                'data' => $size,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                // Se devuelve la respuesta
                'message' => 'Could not update size',
                'errors' => ['server' => [$e->getMessage()]],
            ], 500);
        }
    }
}
