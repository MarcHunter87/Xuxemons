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
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description');
            $table->enum('effect_type', ['Heal', 'DMG Up', 'Defense Up', 'Gacha Ticket', 'Remove Status Effects', 'Apply Status Effects', 'Evolve']);
            $table->unsignedInteger('effect_value')->nullable();
            $table->boolean('is_stackable')->default(true);
            $table->unsignedInteger('max_quantity')->default(5);
            $table->foreignId('status_effect_id')->nullable()->constrained('status_effects')->nullOnDelete();
            $table->string('icon_path')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
