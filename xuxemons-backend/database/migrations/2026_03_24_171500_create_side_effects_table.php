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
        Schema::create('side_effects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique();
            $table->text('description')->nullable();
            $table->string('icon_path');
            $table->unsignedTinyInteger('apply_chance')->nullable()->comment('% probability of applying the side effect when consuming this item');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('side_effects');
    }
};
