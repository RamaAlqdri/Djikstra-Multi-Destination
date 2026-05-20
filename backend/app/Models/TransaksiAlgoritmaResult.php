<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransaksiAlgoritmaResult extends Model
{
    protected $table = 'transaksi_algoritma_results';

    protected $fillable = [
        'transaksi_id',
        'algorithm',
        'total_cost',
        'total_distance_m',
        'total_duration_s',
        'total_visited_nodes',
        'visit_order',
        'segments',
        'raw_result',
    ];

    protected $casts = [
        'total_cost' => 'float',
        'total_distance_m' => 'float',
        'total_duration_s' => 'float',
        'total_visited_nodes' => 'integer',
        'visit_order' => 'array',
        'segments' => 'array',
        'raw_result' => 'array',
    ];

    public function transaksi()
    {
        return $this->belongsTo(Transaksi::class);
    }
}
