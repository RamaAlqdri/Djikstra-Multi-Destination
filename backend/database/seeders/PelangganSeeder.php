<?php

namespace Database\Seeders;

use App\Models\Pelanggan;
use Illuminate\Database\Seeder;

class PelangganSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'nama_pelanggan' => 'Pelanggan Veteran',
                'alamat' => 'Jl. Veteran, Ketawanggede, Lowokwaru, Kota Malang',
                'latitude' => -7.9541234,
                'longitude' => 112.6149012,
            ],
            [
                'nama_pelanggan' => 'Pelanggan Sumbersari',
                'alamat' => 'Jl. Sumbersari, Lowokwaru, Kota Malang',
                'latitude' => -7.9561000,
                'longitude' => 112.6105000,
            ],
            [
                'nama_pelanggan' => 'Pelanggan Dinoyo',
                'alamat' => 'Jl. MT Haryono, Dinoyo, Lowokwaru, Kota Malang',
                'latitude' => -7.9448000,
                'longitude' => 112.6087000,
            ],
        ];

        foreach ($items as $item) {
            Pelanggan::updateOrCreate(
                ['nama_pelanggan' => $item['nama_pelanggan']],
                $item
            );
        }
    }
}
