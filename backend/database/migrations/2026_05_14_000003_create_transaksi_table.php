<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaksi', function (Blueprint $table) {
            $table->id();
            $table->foreignId('depot_id')->constrained('depot_galon')->onDelete('cascade');
            $table->date('tanggal_pengantaran');
            $table->decimal('total_jarak_km', 10, 3)->comment('Total jarak rute dalam kilometer');
            $table->json('rute')->comment('Urutan ID pelanggan dalam rute optimal');
            $table->enum('status', ['pending', 'dalam_pengantaran', 'selesai', 'dibatalkan'])->default('pending');
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaksi');
    }
};
