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
        Schema::create('xuxemons', function (Blueprint $table) {
            $table->id();
            $table->string('name', 128)->unique();
            $table->text('description')->nullable();
            $table->foreignId('type_id')->constrained('types');
            $table->foreignId('status_effect_id')->nullable()->constrained('status_effects')->nullOnDelete();
            $table->foreignId('attack_1_id')->constrained('attacks');
            $table->foreignId('attack_2_id')->constrained('attacks');
            $table->unsignedInteger('hp')->default(1);
            $table->unsignedInteger('attack')->default(1);
            $table->unsignedInteger('defense')->default(1);
            $table->string('icon_path');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('xuxemons');
    }
};
