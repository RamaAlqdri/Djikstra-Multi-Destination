<?php

use App\Http\Controllers\DepotGalonController;
use App\Http\Controllers\PelangganController;
use App\Http\Controllers\TransaksiController;
use Illuminate\Support\Facades\Route;

Route::apiResource('depot-galon', DepotGalonController::class);
Route::apiResource('pelanggan', PelangganController::class);

Route::get('/pengantaran', [TransaksiController::class, 'index']);
Route::post('/pengantaran', [TransaksiController::class, 'store']);
Route::get('/pengantaran/{transaksi}', [TransaksiController::class, 'show']);
Route::patch('/pengantaran/{transaksi}/status', [TransaksiController::class, 'updateStatus']);
