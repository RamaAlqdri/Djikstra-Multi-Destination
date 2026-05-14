<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransaksiDetail extends Model
{
    protected $table = 'transaksi_detail';

    protected $fillable = [
        'transaksi_id',
        'pelanggan_id',
        'urutan',
        'jarak_dari_titik_sebelumnya_km',
        'jumlah_galon',
        'status_pengantaran',
    ];

    public function transaksi()
    {
        return $this->belongsTo(Transaksi::class);
    }

    public function pelanggan()
    {
        return $this->belongsTo(Pelanggan::class);
    }
}
