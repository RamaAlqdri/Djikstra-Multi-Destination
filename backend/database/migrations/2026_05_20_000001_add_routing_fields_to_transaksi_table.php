<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->string('cost_metric')->default('duration')->after('tanggal_pengantaran');
            $table->string('profile')->default('driving')->after('cost_metric');
            $table->decimal('total_durasi_detik', 12, 3)->nullable()->after('total_jarak_km');
            $table->decimal('total_ongkir', 14, 2)->nullable()->after('total_durasi_detik');
            $table->string('best_by_total_cost')->nullable()->after('rute');
            $table->string('best_by_total_visited_nodes')->nullable()->after('best_by_total_cost');
        });
    }

    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropColumn([
                'cost_metric',
                'profile',
                'total_durasi_detik',
                'total_ongkir',
                'best_by_total_cost',
                'best_by_total_visited_nodes',
            ]);
        });
    }
};
