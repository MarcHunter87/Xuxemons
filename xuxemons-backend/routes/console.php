<?php

use App\Models\DailyReward;
use Carbon\Carbon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function () {
    $dailyXuxemonTime = DailyReward::where('reward_type', 'daily_xuxemon')
        ->value('time');

    if (! $dailyXuxemonTime) {
        return;
    }

    $timeFormatted = Carbon::parse($dailyXuxemonTime)->format('H:i');

    if (Carbon::now()->format('H:i') === $timeFormatted) {
        Artisan::call('app:process-daily-xuxemons');
        echo Artisan::output();
    }
})->everyMinute();
