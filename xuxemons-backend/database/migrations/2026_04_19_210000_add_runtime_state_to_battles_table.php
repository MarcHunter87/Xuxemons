<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('battles', 'user_active_adquired_xuxemon_id')) {
            Schema::table('battles', function (Blueprint $table) {
                $table->foreignId('user_active_adquired_xuxemon_id')
                    ->nullable()
                    ->after('turn')
                    ->constrained('adquired_xuxemons')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('battles', 'opponent_active_adquired_xuxemon_id')) {
            Schema::table('battles', function (Blueprint $table) {
                $table->foreignId('opponent_active_adquired_xuxemon_id')
                    ->nullable()
                    ->after('user_active_adquired_xuxemon_id')
                    ->constrained('adquired_xuxemons')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('battles', 'battle_log')) {
            Schema::table('battles', function (Blueprint $table) {
                $table->json('battle_log')
                    ->nullable()
                    ->after('opponent_active_adquired_xuxemon_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('battles', function (Blueprint $table) {
            if (Schema::hasColumn('battles', 'user_active_adquired_xuxemon_id')) {
                $table->dropConstrainedForeignId('user_active_adquired_xuxemon_id');
            }
            if (Schema::hasColumn('battles', 'opponent_active_adquired_xuxemon_id')) {
                $table->dropConstrainedForeignId('opponent_active_adquired_xuxemon_id');
            }
            if (Schema::hasColumn('battles', 'battle_log')) {
                $table->dropColumn('battle_log');
            }
        });
    }
};
