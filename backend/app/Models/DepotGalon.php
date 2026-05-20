<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DepotGalon extends Model
{
    protected $table = 'depot_galon';

    protected $fillable = [
        'nama_depot',
        'alamat',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    public function transaksi()
    {
        return $this->hasMany(Transaksi::class, 'depot_id');
    }
}
