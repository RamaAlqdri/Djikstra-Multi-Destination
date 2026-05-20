<?php

namespace Database\Seeders;

use App\Models\DepotGalon;
use Illuminate\Database\Seeder;

class DepotGalonSeeder extends Seeder
{
    public function run(): void
    {
        DepotGalon::insert([
            [
                'nama_depot'  => 'Depot Galon Pusat',
                'alamat'      => 'Jl. Veteran No.1, Ketawanggede, Kec. Lowokwaru, Kota Malang, Jawa Timur 65145',
                'latitude'    => -7.9374811,
                'longitude'   => 112.6144279,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);
    }
}
