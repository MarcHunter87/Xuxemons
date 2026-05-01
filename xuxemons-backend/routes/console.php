<?php

use App\Models\DailyReward;
use Carbon\Carbon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Sirve para mostrar una cita inspiradora
Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sirve para procesar las daily rewards
Schedule::call(function () {
    // Se obtiene el tiempo de la daily reward de xuxemons
    $dailyXuxemonTime = DailyReward::where('reward_type', 'daily_xuxemon')
        ->value('time');
    // Se obtiene el tiempo de la daily reward de items
    $dailyItemsTime = DailyReward::where('reward_type', 'daily_items')
        ->value('time');

    // Se formatea el tiempo de la daily reward de xuxemons
    $timeFormattedXuxemons = Carbon::parse($dailyXuxemonTime)->format('H:i');
    // Se formatea el tiempo de la daily reward de items
    $timeFormattedItems = Carbon::parse($dailyItemsTime)->format('H:i');

    // Si el tiempo actual es igual al tiempo de la daily reward de xuxemons, se procesan las daily rewards de xuxemons
    if (Carbon::now()->format('H:i') === $timeFormattedXuxemons) {
        Artisan::call('app:process-daily-xuxemons');
        echo Artisan::output(); // Se muestra la salida de la llamada a la consola
    }

    // Si el tiempo actual es igual al tiempo de la daily reward de items, se procesan las daily rewards de items
    if (Carbon::now()->format('H:i') === $timeFormattedItems) {
        Artisan::call('app:process-daily-items');
        echo Artisan::output(); // Se muestra la salida de la llamada a la consola
    }
})->everyMinute(); // Se ejecuta cada minuto
