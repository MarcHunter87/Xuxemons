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
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('slot_1_adquired_xuxemon_id')->nullable()->constrained('adquired_xuxemons')->nullOnDelete();
            $table->foreignId('slot_2_adquired_xuxemon_id')->nullable()->constrained('adquired_xuxemons')->nullOnDelete();
            $table->foreignId('slot_3_adquired_xuxemon_id')->nullable()->constrained('adquired_xuxemons')->nullOnDelete();
            $table->foreignId('slot_4_adquired_xuxemon_id')->nullable()->constrained('adquired_xuxemons')->nullOnDelete();
            $table->foreignId('slot_5_adquired_xuxemon_id')->nullable()->constrained('adquired_xuxemons')->nullOnDelete();
            $table->foreignId('slot_6_adquired_xuxemon_id')->nullable()->constrained('adquired_xuxemons')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};
