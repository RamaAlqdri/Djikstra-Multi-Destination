<?php

namespace App\Http\Controllers;

use App\Models\DepotGalon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DepotGalonController extends Controller
{
    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'nama_depot' => 'sometimes|required|string|max:255',
            'alamat'     => 'sometimes|required|string',
            'latitude'   => 'sometimes|required|numeric|between:-90,90',
            'longitude'  => 'sometimes|required|numeric|between:-180,180',
        ]);

        $depot = DepotGalon::findOrFail($id);
        $depot->update($validated);

        return response()->json([
            'message' => 'Depot galon berhasil diperbarui.',
            'data'    => $depot,
        ]);
    }
}
