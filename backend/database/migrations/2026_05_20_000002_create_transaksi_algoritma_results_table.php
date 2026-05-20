<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaksi_algoritma_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaksi_id')->constrained('transaksi')->onDelete('cascade');
            $table->string('algorithm');
            $table->decimal('total_cost', 14, 3)->nullable();
            $table->decimal('total_distance_m', 14, 3)->nullable();
            $table->decimal('total_duration_s', 14, 3)->nullable();
            $table->unsignedInteger('total_visited_nodes')->nullable();
            $table->json('visit_order')->nullable();
            $table->json('segments')->nullable();
            $table->json('raw_result')->nullable();
            $table->timestamps();

            $table->unique(['transaksi_id', 'algorithm']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaksi_algoritma_results');
    }
};
