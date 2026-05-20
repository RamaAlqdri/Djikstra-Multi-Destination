<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaksi_detail', function (Blueprint $table) {
            $table->string('point_id')->nullable()->after('pelanggan_id');
        });
    }

    public function down(): void
    {
        Schema::table('transaksi_detail', function (Blueprint $table) {
            $table->dropColumn('point_id');
        });
    }
};
