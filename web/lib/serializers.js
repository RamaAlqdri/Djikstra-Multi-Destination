export function toNumber(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export function toId(value) {
  return Number(value);
}

export function serializeDepot(depot) {
  if (!depot) return null;

  return {
    id: toId(depot.id),
    nama_depot: depot.namaDepot,
    alamat: depot.alamat,
    latitude: toNumber(depot.latitude),
    longitude: toNumber(depot.longitude),
  };
}

export function serializePelanggan(pelanggan) {
  if (!pelanggan) return null;

  return {
    id: toId(pelanggan.id),
    nama_pelanggan: pelanggan.namaPelanggan,
    alamat: pelanggan.alamat,
    latitude: toNumber(pelanggan.latitude),
    longitude: toNumber(pelanggan.longitude),
  };
}

export function serializeTransaksi(transaksi) {
  const details = [...(transaksi.detail || [])].sort((a, b) => a.urutan - b.urutan);

  return {
    id: toId(transaksi.id),
    depot: serializeDepot(transaksi.depot),
    tanggal_pengantaran: transaksi.tanggalPengantaran?.toISOString?.().slice(0, 10) || null,
    cost_metric: transaksi.costMetric,
    profile: transaksi.profile,
    total_jarak_km: toNumber(transaksi.totalJarakKm),
    total_durasi_detik: toNumber(transaksi.totalDurasiDetik),
    total_ongkir: toNumber(transaksi.totalOngkir),
    rute: transaksi.rute || [],
    best_by_total_cost: transaksi.bestByTotalCost,
    best_by_total_visited_nodes: transaksi.bestByTotalVisitedNodes,
    status: transaksi.status,
    catatan: transaksi.catatan,
    pelanggan: details.map((detail) => ({
      id: toId(detail.id),
      point_id: detail.pointId || `D${detail.urutan}`,
      urutan: detail.urutan,
      jarak_dari_titik_sebelumnya_km: toNumber(detail.jarakDariTitikSebelumnyaKm),
      jumlah_galon: detail.jumlahGalon,
      status_pengantaran: detail.statusPengantaran,
      pelanggan: serializePelanggan(detail.pelanggan),
    })),
    point_customer_map: Object.fromEntries(
      details
        .filter((detail) => detail.pelanggan)
        .map((detail) => [detail.pointId || `D${detail.urutan}`, serializePelanggan(detail.pelanggan)])
    ),
    algorithm_results: [...(transaksi.algorithmResults || [])]
      .sort((a, b) => a.algorithm.localeCompare(b.algorithm))
      .map((result) => ({
        id: toId(result.id),
        algorithm: result.algorithm,
        total_cost: toNumber(result.totalCost),
        total_distance_m: toNumber(result.totalDistanceM),
        total_duration_s: toNumber(result.totalDurationS),
        total_visited_nodes: result.totalVisitedNodes,
        visit_order: result.visitOrder || [],
        segments: result.segments || [],
        raw_result: result.rawResult || {},
      })),
    created_at: transaksi.createdAt?.toISOString?.() || null,
    updated_at: transaksi.updatedAt?.toISOString?.() || null,
  };
}

export const transaksiInclude = {
  depot: true,
  detail: {
    include: {
      pelanggan: true,
    },
  },
  algorithmResults: true,
};
