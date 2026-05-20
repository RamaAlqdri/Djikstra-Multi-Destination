<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PelangganApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_pelanggan(): void
    {
        $response = $this->postJson('/api/pelanggan', [
            'nama_pelanggan' => 'Budi',
            'alamat' => 'Jl. Veteran, Malang',
            'latitude' => -7.9541234,
            'longitude' => 112.6149012,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.nama_pelanggan', 'Budi');

        $this->assertDatabaseHas('pelanggan', [
            'nama_pelanggan' => 'Budi',
        ]);
    }

    public function test_rejects_invalid_coordinates(): void
    {
        $response = $this->postJson('/api/pelanggan', [
            'nama_pelanggan' => 'Invalid',
            'alamat' => 'Koordinat salah',
            'latitude' => -120,
            'longitude' => 112.6149012,
        ]);

        $response->assertUnprocessable();
    }
}
