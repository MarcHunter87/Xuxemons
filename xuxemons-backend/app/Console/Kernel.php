<?php

namespace App\Console;

use App\Models\DailyReward;
use Carbon\Carbon;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        $dailyXuxemonTime = DailyReward::where('reward_type', 'daily_xuxemon')
            ->value('time');

        if ($dailyXuxemonTime) {
            $timeFormatted = Carbon::parse($dailyXuxemonTime)->format('H:i');
            $schedule->command('app:process-daily-xuxemons')
                ->dailyAt($timeFormatted);
        }
    }

    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');

        require base_path('routes/console.php');
    }
}
