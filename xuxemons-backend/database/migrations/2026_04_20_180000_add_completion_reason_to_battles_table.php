<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('battles', 'completion_reason')) {
            Schema::table('battles', function (Blueprint $table) {
                $table->string('completion_reason')->nullable()->after('winner_id');
            });
        }

        if (! Schema::hasColumn('battles', 'runner_id')) {
            Schema::table('battles', function (Blueprint $table) {
                $table->string('runner_id')->nullable()->after('completion_reason');
            });
        }
    }

    public function down(): void
    {
        Schema::table('battles', function (Blueprint $table) {
            if (Schema::hasColumn('battles', 'completion_reason')) {
                $table->dropColumn('completion_reason');
            }
            if (Schema::hasColumn('battles', 'runner_id')) {
                $table->dropColumn('runner_id');
            }
        });
    }
};
