<?php

use App\Http\Controllers\DepotGalonController;
use Illuminate\Support\Facades\Route;

Route::put('/depot-galon/{id}', [DepotGalonController::class, 'update']);
