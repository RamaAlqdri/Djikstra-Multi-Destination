<?php

namespace App\Http\Controllers;

use App\Models\DepotGalon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepotGalonController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => DepotGalon::query()->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateDepot($request);
        $depot = DepotGalon::create($validated);

        return response()->json([
            'message' => 'Depot galon berhasil disimpan.',
            'data' => $depot,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json([
            'data' => DepotGalon::findOrFail($id),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $this->validateDepot($request, sometimes: true);
        $depot = DepotGalon::findOrFail($id);
        $depot->update($validated);

        return response()->json([
            'message' => 'Depot galon berhasil diperbarui.',
            'data' => $depot,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $depot = DepotGalon::findOrFail($id);
        $depot->delete();

        return response()->json([
            'message' => 'Depot galon berhasil dihapus.',
        ]);
    }

    private function validateDepot(Request $request, bool $sometimes = false): array
    {
        $presence = $sometimes ? ['sometimes', 'required'] : ['required'];

        return $request->validate([
            'nama_depot' => [...$presence, 'string', 'max:255'],
            'alamat' => [...$presence, 'string'],
            'latitude' => [...$presence, 'numeric', 'between:-90,90'],
            'longitude' => [...$presence, 'numeric', 'between:-180,180'],
        ]);
    }
}
