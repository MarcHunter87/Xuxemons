<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attacks', function (Blueprint $table) {
            $table->id();
            $table->string('name', 128)->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('dmg')->default(0);
            $table->foreignId('status_effect_id')->nullable()->constrained('status_effects')->nullOnDelete();
            $table->unsignedInteger('status_chance')->nullable()->default(50);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attacks');
    }
};
