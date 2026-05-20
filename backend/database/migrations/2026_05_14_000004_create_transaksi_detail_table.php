<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaksi_detail', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaksi_id')->constrained('transaksi')->onDelete('cascade');
            $table->foreignId('pelanggan_id')->constrained('pelanggan')->onDelete('cascade');
            $table->unsignedInteger('urutan')->comment('Urutan kunjungan dalam rute');
            $table->decimal('jarak_dari_titik_sebelumnya_km', 10, 3)->default(0);
            $table->unsignedInteger('jumlah_galon')->default(1);
            $table->enum('status_pengantaran', ['belum', 'terkirim', 'gagal'])->default('belum');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaksi_detail');
    }
};
