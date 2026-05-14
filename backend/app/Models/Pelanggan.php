<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pelanggan extends Model
{
    protected $table = 'pelanggan';

    protected $fillable = [
        'nama_pelanggan',
        'alamat',
        'latitude',
        'longitude',
    ];

    public function transaksiDetail()
    {
        return $this->hasMany(TransaksiDetail::class);
    }
}
