<?php

namespace App\Http\Controllers;

use App\Models\DepotGalon;
use App\Models\Pelanggan;
use App\Models\Transaksi;
use App\Models\TransaksiAlgoritmaResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

class TransaksiController extends Controller
{
    public function index(): JsonResponse
    {
        $transaksi = Transaksi::query()
            ->with(['depot', 'detail.pelanggan', 'algorithmResults'])
            ->latest()
            ->get()
            ->map(fn (Transaksi $item) => $this->serializeTransaksi($item));

        return response()->json([
            'data' => $transaksi,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'depot_id' => ['required', 'integer', 'exists:depot_galon,id'],
            'tanggal_pengantaran' => ['nullable', 'date'],
            'pelanggan_ids' => ['required', 'array', 'min:1'],
            'pelanggan_ids.*' => ['required', 'integer', 'distinct', 'exists:pelanggan,id'],
            'cost_metric' => ['nullable', 'string', 'in:duration,distance,ongkir'],
            'profile' => ['nullable', 'string', 'max:50'],
            'catatan' => ['nullable', 'string'],
        ]);

        $depot = DepotGalon::findOrFail($validated['depot_id']);
        $pelangganIds = collect($validated['pelanggan_ids'])->map(fn ($id) => (int) $id)->values();
        $pelangganById = Pelanggan::query()
            ->whereIn('id', $pelangganIds)
            ->get()
            ->keyBy('id');

        $orderedPelanggan = $pelangganIds->map(fn (int $id) => $pelangganById->get($id));
        $costMetric = $validated['cost_metric'] ?? 'duration';
        $profile = $validated['profile'] ?? 'driving';

        $pointCustomerMap = $this->buildPointCustomerMap($orderedPelanggan);
        $solverPayload = [
            'cost_metric' => $costMetric,
            'profile' => $profile,
            'source' => [
                'lat' => (float) $depot->latitude,
                'lng' => (float) $depot->longitude,
            ],
            'destinations' => $orderedPelanggan
                ->map(fn (Pelanggan $pelanggan) => [
                    'lat' => (float) $pelanggan->latitude,
                    'lng' => (float) $pelanggan->longitude,
                ])
                ->all(),
        ];

        try {
            $routingData = $this->callRoutingSolver($solverPayload);
        } catch (Throwable $exception) {
            return response()->json([
                'message' => 'Solver rute gagal dipanggil.',
                'error' => $exception->getMessage(),
            ], 502);
        }

        $routingData['point_customer_map'] = $pointCustomerMap;

        $created = DB::transaction(function () use (
            $validated,
            $depot,
            $costMetric,
            $profile,
            $routingData,
            $pointCustomerMap
        ) {
            $bestResult = $this->bestResultByCost($routingData);
            $bestSegments = collect($bestResult['segments'] ?? []);
            $bestVisitPointIds = $this->visitPointIds($bestResult);
            $routeCustomerIds = $bestVisitPointIds
                ->map(fn (string $pointId) => $pointCustomerMap[$pointId]['id'] ?? null)
                ->filter()
                ->values()
                ->all();

            $totalDistanceM = $this->sumSegmentNumeric($bestSegments, 'distance_m');
            $totalDurationS = $this->sumSegmentNumeric($bestSegments, 'duration_s');

            $transaksi = Transaksi::create([
                'depot_id' => $depot->id,
                'tanggal_pengantaran' => $validated['tanggal_pengantaran'] ?? now()->toDateString(),
                'cost_metric' => $costMetric,
                'profile' => $profile,
                'total_jarak_km' => $totalDistanceM / 1000,
                'total_durasi_detik' => $totalDurationS,
                'total_ongkir' => $costMetric === 'ongkir'
                    ? $this->numericOrNull($bestResult['total_cost'] ?? null)
                    : null,
                'rute' => $routeCustomerIds,
                'best_by_total_cost' => $routingData['best_by_total_cost'] ?? null,
                'best_by_total_visited_nodes' => $routingData['best_by_total_visited_nodes'] ?? null,
                'status' => 'pending',
                'catatan' => $validated['catatan'] ?? null,
            ]);

            $distanceByTargetPoint = $this->distanceByTargetPoint($bestSegments);
            foreach ($bestVisitPointIds as $index => $pointId) {
                $customerId = $pointCustomerMap[$pointId]['id'] ?? null;
                if ($customerId === null) {
                    continue;
                }

                $transaksi->detail()->create([
                    'pelanggan_id' => $customerId,
                    'point_id' => $pointId,
                    'urutan' => $index + 1,
                    'jarak_dari_titik_sebelumnya_km' => ($distanceByTargetPoint[$pointId] ?? 0) / 1000,
                    'jumlah_galon' => 1,
                    'status_pengantaran' => 'belum',
                ]);
            }

            foreach (($routingData['results'] ?? []) as $result) {
                if (! is_array($result)) {
                    continue;
                }

                $segments = collect($result['segments'] ?? []);
                TransaksiAlgoritmaResult::create([
                    'transaksi_id' => $transaksi->id,
                    'algorithm' => (string) ($result['algorithm'] ?? '-'),
                    'total_cost' => $this->numericOrNull($result['total_cost'] ?? null),
                    'total_distance_m' => $this->sumSegmentNumeric($segments, 'distance_m'),
                    'total_duration_s' => $this->sumSegmentNumeric($segments, 'duration_s'),
                    'total_visited_nodes' => is_numeric($result['total_visited_nodes'] ?? null)
                        ? (int) $result['total_visited_nodes']
                        : null,
                    'visit_order' => $result['visit_order'] ?? [],
                    'segments' => $result['segments'] ?? [],
                    'raw_result' => $result['raw_result'] ?? $result,
                ]);
            }

            return $transaksi->fresh(['depot', 'detail.pelanggan', 'algorithmResults']);
        });

        return response()->json([
            'message' => 'Pengantaran berhasil dibuat dan hasil 3 algoritma tersimpan.',
            'data' => $this->serializeTransaksi($created),
            'routing' => $routingData,
        ], 201);
    }

    public function show(Transaksi $transaksi): JsonResponse
    {
        $transaksi->load(['depot', 'detail.pelanggan', 'algorithmResults']);

        return response()->json([
            'data' => $this->serializeTransaksi($transaksi),
        ]);
    }

    public function updateStatus(Request $request, Transaksi $transaksi): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:pending,dalam_pengantaran,selesai,dibatalkan'],
        ]);

        $transaksi->update(['status' => $validated['status']]);
        $transaksi->load(['depot', 'detail.pelanggan', 'algorithmResults']);

        return response()->json([
            'message' => 'Status pengantaran berhasil diperbarui.',
            'data' => $this->serializeTransaksi($transaksi),
        ]);
    }

    private function callRoutingSolver(array $payload): array
    {
        $solverUrl = rtrim((string) config('services.routing_solver.url'), '/');
        $response = Http::timeout(90)->post("{$solverUrl}/api/solve", $payload);
        $body = $response->json();

        if (! $response->successful()) {
            $message = is_array($body) && isset($body['error'])
                ? (string) $body['error']
                : "HTTP {$response->status()}";
            throw new \RuntimeException($message);
        }

        if (! is_array($body) || ($body['ok'] ?? false) !== true || ! is_array($body['data'] ?? null)) {
            throw new \RuntimeException('Response solver tidak valid.');
        }

        return $body['data'];
    }

    private function buildPointCustomerMap(Collection $pelanggan): array
    {
        $map = [];
        foreach ($pelanggan->values() as $index => $item) {
            $map['D'.($index + 1)] = $this->serializePelanggan($item);
        }

        return $map;
    }

    private function bestResultByCost(array $routingData): array
    {
        $results = collect($routingData['results'] ?? []);
        $bestAlgorithm = $routingData['best_by_total_cost'] ?? null;
        $best = $results->first(fn ($item) => is_array($item) && ($item['algorithm'] ?? null) === $bestAlgorithm);

        if (is_array($best)) {
            return $best;
        }

        $fallback = $results->first();

        return is_array($fallback) ? $fallback : [];
    }

    private function visitPointIds(array $algorithmResult): Collection
    {
        return collect($algorithmResult['visit_order'] ?? [])
            ->map(function ($item) {
                if (is_array($item)) {
                    return $item['id'] ?? null;
                }

                return is_string($item) ? $item : null;
            })
            ->filter(fn ($pointId) => is_string($pointId) && str_starts_with($pointId, 'D'))
            ->values();
    }

    private function distanceByTargetPoint(Collection $segments): array
    {
        $distanceByTarget = [];
        foreach ($segments as $segment) {
            if (! is_array($segment)) {
                continue;
            }

            $target = $segment['to']['id'] ?? null;
            if (! is_string($target)) {
                continue;
            }

            $distanceByTarget[$target] = $this->numericOrNull($segment['distance_m'] ?? null) ?? 0;
        }

        return $distanceByTarget;
    }

    private function sumSegmentNumeric(Collection $segments, string $field): float
    {
        return (float) $segments->sum(function ($segment) use ($field) {
            if (! is_array($segment)) {
                return 0;
            }

            return $this->numericOrNull($segment[$field] ?? null) ?? 0;
        });
    }

    private function numericOrNull(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function serializeTransaksi(Transaksi $transaksi): array
    {
        $transaksi->loadMissing(['depot', 'detail.pelanggan', 'algorithmResults']);
        $details = $transaksi->detail->sortBy('urutan')->values();

        return [
            'id' => $transaksi->id,
            'depot' => $transaksi->depot ? $this->serializeDepot($transaksi->depot) : null,
            'tanggal_pengantaran' => optional($transaksi->tanggal_pengantaran)->toDateString(),
            'cost_metric' => $transaksi->cost_metric,
            'profile' => $transaksi->profile,
            'total_jarak_km' => $transaksi->total_jarak_km,
            'total_durasi_detik' => $transaksi->total_durasi_detik,
            'total_ongkir' => $transaksi->total_ongkir,
            'rute' => $transaksi->rute ?? [],
            'best_by_total_cost' => $transaksi->best_by_total_cost,
            'best_by_total_visited_nodes' => $transaksi->best_by_total_visited_nodes,
            'status' => $transaksi->status,
            'catatan' => $transaksi->catatan,
            'pelanggan' => $details->map(fn ($detail) => [
                'id' => $detail->id,
                'point_id' => $detail->point_id ?: 'D'.$detail->urutan,
                'urutan' => $detail->urutan,
                'jarak_dari_titik_sebelumnya_km' => (float) $detail->jarak_dari_titik_sebelumnya_km,
                'jumlah_galon' => $detail->jumlah_galon,
                'status_pengantaran' => $detail->status_pengantaran,
                'pelanggan' => $detail->pelanggan ? $this->serializePelanggan($detail->pelanggan) : null,
            ])->all(),
            'point_customer_map' => $details
                ->filter(fn ($detail) => $detail->pelanggan !== null)
                ->mapWithKeys(fn ($detail) => [
                    ($detail->point_id ?: 'D'.$detail->urutan) => $this->serializePelanggan($detail->pelanggan),
                ])
                ->all(),
            'algorithm_results' => $transaksi->algorithmResults
                ->sortBy('algorithm')
                ->values()
                ->map(fn (TransaksiAlgoritmaResult $result) => [
                    'id' => $result->id,
                    'algorithm' => $result->algorithm,
                    'total_cost' => $result->total_cost,
                    'total_distance_m' => $result->total_distance_m,
                    'total_duration_s' => $result->total_duration_s,
                    'total_visited_nodes' => $result->total_visited_nodes,
                    'visit_order' => $result->visit_order ?? [],
                    'segments' => $result->segments ?? [],
                    'raw_result' => $result->raw_result ?? [],
                ])
                ->all(),
            'created_at' => optional($transaksi->created_at)->toISOString(),
            'updated_at' => optional($transaksi->updated_at)->toISOString(),
        ];
    }

    private function serializeDepot(DepotGalon $depot): array
    {
        return [
            'id' => $depot->id,
            'nama_depot' => $depot->nama_depot,
            'alamat' => $depot->alamat,
            'latitude' => (float) $depot->latitude,
            'longitude' => (float) $depot->longitude,
        ];
    }

    private function serializePelanggan(Pelanggan $pelanggan): array
    {
        return [
            'id' => $pelanggan->id,
            'nama_pelanggan' => $pelanggan->nama_pelanggan,
            'alamat' => $pelanggan->alamat,
            'latitude' => (float) $pelanggan->latitude,
            'longitude' => (float) $pelanggan->longitude,
        ];
    }
}
