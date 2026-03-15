<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('adquired_xuxemons', function (Blueprint $table) {
            $table->integer('bonus_hp')->default(0);
            $table->integer('bonus_attack')->default(0);
            $table->integer('bonus_defense')->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('adquired_xuxemons', function (Blueprint $table) {
            $table->dropColumn(['bonus_hp', 'bonus_attack', 'bonus_defense']);
        });
    }
};
