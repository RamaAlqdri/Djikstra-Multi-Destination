<?php

namespace Tests\Feature;

use App\Models\DepotGalon;
use App\Models\Pelanggan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PengantaranApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_pengantaran_and_store_three_algorithm_results(): void
    {
        $depot = DepotGalon::create([
            'nama_depot' => 'Depot Test',
            'alamat' => 'Jl. Depot',
            'latitude' => -7.9374811,
            'longitude' => 112.6144279,
        ]);

        $pelangganA = Pelanggan::create([
            'nama_pelanggan' => 'Pelanggan A',
            'alamat' => 'Jl. A',
            'latitude' => -7.9541234,
            'longitude' => 112.6149012,
        ]);

        $pelangganB = Pelanggan::create([
            'nama_pelanggan' => 'Pelanggan B',
            'alamat' => 'Jl. B',
            'latitude' => -7.9561000,
            'longitude' => 112.6105000,
        ]);

        Http::fake([
            'http://127.0.0.1:8000/api/solve' => Http::response([
                'ok' => true,
                'data' => $this->solverResponse(),
            ]),
        ]);

        $response = $this->postJson('/api/pengantaran', [
            'depot_id' => $depot->id,
            'tanggal_pengantaran' => '2026-05-20',
            'pelanggan_ids' => [$pelangganA->id, $pelangganB->id],
            'cost_metric' => 'duration',
            'profile' => 'driving',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.best_by_total_cost', 'EAMDSP')
            ->assertJsonCount(3, 'data.algorithm_results');

        $this->assertDatabaseCount('transaksi', 1);
        $this->assertDatabaseCount('transaksi_detail', 2);
        $this->assertDatabaseCount('transaksi_algoritma_results', 3);
    }

    private function solverResponse(): array
    {
        $source = ['id' => 'S0', 'lat' => -7.9374811, 'lng' => 112.6144279];
        $d1 = ['id' => 'D1', 'lat' => -7.9541234, 'lng' => 112.6149012];
        $d2 = ['id' => 'D2', 'lat' => -7.9561000, 'lng' => 112.6105000];

        return [
            'profile' => 'driving',
            'cost_metric' => 'duration',
            'cost_unit' => 'seconds',
            'source' => $source,
            'destinations' => [$d1, $d2],
            'algorithms' => ['CDSSSD', 'MDMSMD', 'EAMDSP'],
            'best_by_total_cost' => 'EAMDSP',
            'best_by_total_visited_nodes' => 'CDSSSD',
            'results' => [
                $this->algorithmResult('CDSSSD', [$d1, $d2], [$source, $source], [180, 220]),
                $this->algorithmResult('MDMSMD', [$d1, $d2], [$source, $d1], [180, 90]),
                $this->algorithmResult('EAMDSP', [$d2, $d1], [$source, $d2], [120, 80]),
            ],
        ];
    }

    private function algorithmResult(string $algorithm, array $targets, array $starts, array $costs): array
    {
        $segments = [];
        foreach ($targets as $index => $target) {
            $start = $starts[$index];
            $segments[] = [
                'from' => $start,
                'to' => $target,
                'path_ids' => [$start['id'], $target['id']],
                'path_coordinates' => [$start, $target],
                'cost' => $costs[$index],
                'visited_nodes' => 2,
                'geometry' => [
                    [$start['lat'], $start['lng']],
                    [$target['lat'], $target['lng']],
                ],
                'distance_m' => $costs[$index] * 10,
                'duration_s' => $costs[$index],
            ];
        }

        return [
            'algorithm' => $algorithm,
            'visit_order' => $targets,
            'total_cost' => array_sum($costs),
            'total_visited_nodes' => 4,
            'segments' => $segments,
            'full_path_ids' => [],
            'full_path_coordinates' => [],
            'raw_result' => [
                'algorithm' => $algorithm,
                'visit_order' => array_map(fn ($target) => $target['id'], $targets),
                'total_cost' => array_sum($costs),
                'total_visited_nodes' => 4,
            ],
        ];
    }
}
