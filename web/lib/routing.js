import { prisma } from './prisma';
import { serializePelanggan, serializeTransaksi, transaksiInclude } from './serializers';

function numericOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function sumSegmentNumeric(segments, field) {
  return (segments || []).reduce((total, segment) => total + (numericOrNull(segment?.[field]) || 0), 0);
}

function buildPointCustomerMap(pelanggan) {
  return Object.fromEntries(
    pelanggan.map((item, index) => [`D${index + 1}`, serializePelanggan(item)])
  );
}

function visitPointIds(result) {
  return (result?.visit_order || [])
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter((pointId) => typeof pointId === 'string' && pointId.startsWith('D'));
}

function bestResultByCost(routingData) {
  const results = routingData?.results || [];
  return (
    results.find((item) => item?.algorithm === routingData?.best_by_total_cost) ||
    results[0] ||
    {}
  );
}

function distanceByTargetPoint(segments) {
  return Object.fromEntries(
    (segments || [])
      .filter((segment) => typeof segment?.to?.id === 'string')
      .map((segment) => [segment.to.id, numericOrNull(segment.distance_m) || 0])
  );
}

async function callRoutingSolver(payload) {
  const solverUrl = (process.env.ROUTING_SOLVER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const response = await fetch(`${solverUrl}/api/solve`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body?.error || `Solver mengembalikan HTTP ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  if (body?.ok !== true || !body?.data) {
    const error = new Error('Response solver tidak valid.');
    error.statusCode = 502;
    throw error;
  }

  return body.data;
}

export async function createPengantaran(validated) {
  const pelangganIds = [...new Set(validated.pelanggan_ids.map((id) => BigInt(id)))];
  const [depot, pelangganList] = await Promise.all([
    prisma.depotGalon.findUniqueOrThrow({
      where: { id: BigInt(validated.depot_id) },
    }),
    prisma.pelanggan.findMany({
      where: { id: { in: pelangganIds } },
    }),
  ]);

  if (pelangganList.length !== pelangganIds.length) {
    const error = new Error('Satu atau lebih pelanggan tidak ditemukan.');
    error.statusCode = 422;
    throw error;
  }

  const pelangganById = new Map(pelangganList.map((item) => [String(item.id), item]));
  const orderedPelanggan = pelangganIds.map((id) => pelangganById.get(String(id)));
  const pointCustomerMap = buildPointCustomerMap(orderedPelanggan);

  const solverPayload = {
    cost_metric: validated.cost_metric,
    profile: validated.profile,
    source: {
      lat: Number(depot.latitude),
      lng: Number(depot.longitude),
    },
    destinations: orderedPelanggan.map((pelanggan) => ({
      lat: Number(pelanggan.latitude),
      lng: Number(pelanggan.longitude),
    })),
  };

  const routingData = await callRoutingSolver(solverPayload);
  routingData.point_customer_map = pointCustomerMap;

  const created = await prisma.$transaction(async (tx) => {
    const bestResult = bestResultByCost(routingData);
    const bestSegments = bestResult?.segments || [];
    const bestVisitPointIds = visitPointIds(bestResult);
    const routeCustomerIds = bestVisitPointIds
      .map((pointId) => pointCustomerMap[pointId]?.id)
      .filter(Boolean);
    const totalDistanceM = sumSegmentNumeric(bestSegments, 'distance_m');
    const totalDurationS = sumSegmentNumeric(bestSegments, 'duration_s');
    const distanceByTarget = distanceByTargetPoint(bestSegments);

    const detailRows = bestVisitPointIds
      .map((pointId, index) => {
        const customerId = pointCustomerMap[pointId]?.id;
        if (!customerId) return null;

        return {
          pelangganId: BigInt(customerId),
          pointId,
          urutan: index + 1,
          jarakDariTitikSebelumnyaKm: (distanceByTarget[pointId] || 0) / 1000,
          jumlahGalon: 1,
          statusPengantaran: 'belum',
        };
      })
      .filter(Boolean);

    const algorithmRows = (routingData.results || [])
      .filter((result) => result && typeof result === 'object')
      .map((result) => {
        const segments = result.segments || [];

        return {
          algorithm: String(result.algorithm || '-'),
          totalCost: numericOrNull(result.total_cost),
          totalDistanceM: sumSegmentNumeric(segments, 'distance_m'),
          totalDurationS: sumSegmentNumeric(segments, 'duration_s'),
          totalVisitedNodes: Number.isFinite(Number(result.total_visited_nodes))
            ? Number(result.total_visited_nodes)
            : null,
          visitOrder: result.visit_order || [],
          segments,
          rawResult: result.raw_result || result,
        };
      });

    return tx.transaksi.create({
      data: {
        depotId: depot.id,
        tanggalPengantaran: new Date(`${validated.tanggal_pengantaran || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
        costMetric: validated.cost_metric,
        profile: validated.profile,
        totalJarakKm: totalDistanceM / 1000,
        totalDurasiDetik: totalDurationS,
        totalOngkir: validated.cost_metric === 'ongkir' ? numericOrNull(bestResult.total_cost) : null,
        rute: routeCustomerIds,
        bestByTotalCost: routingData.best_by_total_cost || null,
        bestByTotalVisitedNodes: routingData.best_by_total_visited_nodes || null,
        status: 'pending',
        catatan: validated.catatan || null,
        detail: {
          create: detailRows,
        },
        algorithmResults: {
          create: algorithmRows,
        },
      },
      include: transaksiInclude,
    });
  });

  return {
    data: serializeTransaksi(created),
    routing: routingData,
  };
}
