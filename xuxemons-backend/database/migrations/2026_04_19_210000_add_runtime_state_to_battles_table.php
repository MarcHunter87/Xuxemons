<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('battles', function (Blueprint $table) {
            $table->foreignId('user_active_adquired_xuxemon_id')
                ->nullable()
                ->after('turn')
                ->constrained('adquired_xuxemons')
                ->nullOnDelete();

            $table->foreignId('opponent_active_adquired_xuxemon_id')
                ->nullable()
                ->after('user_active_adquired_xuxemon_id')
                ->constrained('adquired_xuxemons')
                ->nullOnDelete();

            $table->json('battle_log')
                ->nullable()
                ->after('opponent_active_adquired_xuxemon_id');
        });
    }

    public function down(): void
    {
        Schema::table('battles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_active_adquired_xuxemon_id');
            $table->dropConstrainedForeignId('opponent_active_adquired_xuxemon_id');
            $table->dropColumn('battle_log');
        });
    }
};
