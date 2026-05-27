import { prisma } from '@/lib/prisma';
import { json, handleError, readJson } from '@/lib/http';
import { serializeDepot } from '@/lib/serializers';
import { depotSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const depots = await prisma.depotGalon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return json({ data: depots.map(serializeDepot) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const data = depotSchema.parse(await readJson(request));
    const depot = await prisma.depotGalon.create({
      data: {
        namaDepot: data.nama_depot,
        alamat: data.alamat,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return json(
      {
        message: 'Depot galon berhasil disimpan.',
        data: serializeDepot(depot),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
