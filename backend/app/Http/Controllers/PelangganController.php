<?php

namespace App\Http\Controllers;

use App\Models\Pelanggan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PelangganController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $pelanggan = Pelanggan::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('nama_pelanggan', 'like', "%{$search}%")
                        ->orWhere('alamat', 'like', "%{$search}%");
                });
            })
            ->orderBy('nama_pelanggan')
            ->get();

        return response()->json([
            'data' => $pelanggan,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $pelanggan = Pelanggan::create($this->validatePelanggan($request));

        return response()->json([
            'message' => 'Pelanggan berhasil disimpan.',
            'data' => $pelanggan,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json([
            'data' => Pelanggan::findOrFail($id),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $pelanggan = Pelanggan::findOrFail($id);
        $pelanggan->update($this->validatePelanggan($request, sometimes: true));

        return response()->json([
            'message' => 'Pelanggan berhasil diperbarui.',
            'data' => $pelanggan,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $pelanggan = Pelanggan::findOrFail($id);
        $pelanggan->delete();

        return response()->json([
            'message' => 'Pelanggan berhasil dihapus.',
        ]);
    }

    private function validatePelanggan(Request $request, bool $sometimes = false): array
    {
        $presence = $sometimes ? ['sometimes', 'required'] : ['required'];

        return $request->validate([
            'nama_pelanggan' => [...$presence, 'string', 'max:255'],
            'alamat' => [...$presence, 'string'],
            'latitude' => [...$presence, 'numeric', 'between:-90,90'],
            'longitude' => [...$presence, 'numeric', 'between:-180,180'],
        ]);
    }
}
