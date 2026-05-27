import { prisma } from '@/lib/prisma';
import { json, handleError, readJson } from '@/lib/http';
import { serializeDepot } from '@/lib/serializers';
import { depotSchema } from '@/lib/validation';

export const runtime = 'nodejs';

async function idFromContext(context) {
  const params = await context.params;
  return BigInt(params.id);
}

export async function GET(_request, context) {
  try {
    const depot = await prisma.depotGalon.findUniqueOrThrow({
      where: { id: await idFromContext(context) },
    });

    return json({ data: serializeDepot(depot) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request, context) {
  try {
    const data = depotSchema.parse(await readJson(request));
    const depot = await prisma.depotGalon.update({
      where: { id: await idFromContext(context) },
      data: {
        namaDepot: data.nama_depot,
        alamat: data.alamat,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return json({
      message: 'Depot galon berhasil diperbarui.',
      data: serializeDepot(depot),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request, context) {
  try {
    await prisma.depotGalon.delete({
      where: { id: await idFromContext(context) },
    });

    return json({ message: 'Depot galon berhasil dihapus.' });
  } catch (error) {
    return handleError(error);
  }
}
