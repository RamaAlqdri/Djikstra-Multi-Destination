<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaksi extends Model
{
    protected $table = 'transaksi';

    protected $fillable = [
        'depot_id',
        'tanggal_pengantaran',
        'cost_metric',
        'profile',
        'total_jarak_km',
        'total_durasi_detik',
        'total_ongkir',
        'rute',
        'best_by_total_cost',
        'best_by_total_visited_nodes',
        'status',
        'catatan',
    ];

    protected $casts = [
        'rute' => 'array',
        'tanggal_pengantaran' => 'date',
        'total_jarak_km' => 'float',
        'total_durasi_detik' => 'float',
        'total_ongkir' => 'float',
    ];

    public function depot()
    {
        return $this->belongsTo(DepotGalon::class, 'depot_id');
    }

    public function detail()
    {
        return $this->hasMany(TransaksiDetail::class);
    }

    public function algorithmResults()
    {
        return $this->hasMany(TransaksiAlgoritmaResult::class);
    }
}
