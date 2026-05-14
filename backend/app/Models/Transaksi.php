<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaksi extends Model
{
    protected $table = 'transaksi';

    protected $fillable = [
        'depot_id',
        'tanggal_pengantaran',
        'total_jarak_km',
        'rute',
        'status',
        'catatan',
    ];

    protected $casts = [
        'rute' => 'array',
        'tanggal_pengantaran' => 'date',
    ];

    public function depot()
    {
        return $this->belongsTo(DepotGalon::class, 'depot_id');
    }

    public function detail()
    {
        return $this->hasMany(TransaksiDetail::class);
    }
}
