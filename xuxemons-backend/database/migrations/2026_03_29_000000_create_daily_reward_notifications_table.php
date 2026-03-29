<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_reward_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('user_id');
            $table->date('reward_date');
            $table->unsignedInteger('gacha_ticket_quantity')->default(0);
            $table->json('items')->nullable();
            $table->timestamp('shown_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['user_id', 'reward_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reward_notifications');
    }
};