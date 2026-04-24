<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('battles', function (Blueprint $table) {
            $table->string('completion_reason')->nullable()->after('winner_id');
            $table->string('runner_id')->nullable()->after('completion_reason');
        });
    }

    public function down(): void
    {
        Schema::table('battles', function (Blueprint $table) {
            $table->dropColumn(['completion_reason', 'runner_id']);
        });
    }
};
