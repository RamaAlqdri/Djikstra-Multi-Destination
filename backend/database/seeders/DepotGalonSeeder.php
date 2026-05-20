<?php

namespace Database\Seeders;

use App\Models\DepotGalon;
use Illuminate\Database\Seeder;

class DepotGalonSeeder extends Seeder
{
    public function run(): void
    {
        DepotGalon::updateOrCreate(
            ['nama_depot' => 'Depot Galon Pusat'],
            [
                'alamat' => 'Titik pusat toko depot air',
                'latitude' => -7.94244696762181,
                'longitude' => 112.61640127197477,
            ]
        );
    }
}
