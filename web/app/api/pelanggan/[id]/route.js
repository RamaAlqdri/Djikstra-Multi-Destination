import { prisma } from '@/lib/prisma';
import { json, handleError, readJson } from '@/lib/http';
import { serializePelanggan } from '@/lib/serializers';
import { pelangganSchema } from '@/lib/validation';

export const runtime = 'nodejs';

async function idFromContext(context) {
  const params = await context.params;
  return BigInt(params.id);
}

export async function GET(_request, context) {
  try {
    const pelanggan = await prisma.pelanggan.findUniqueOrThrow({
      where: { id: await idFromContext(context) },
    });

    return json({ data: serializePelanggan(pelanggan) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request, context) {
  try {
    const data = pelangganSchema.parse(await readJson(request));
    const pelanggan = await prisma.pelanggan.update({
      where: { id: await idFromContext(context) },
      data: {
        namaPelanggan: data.nama_pelanggan,
        alamat: data.alamat,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return json({
      message: 'Pelanggan berhasil diperbarui.',
      data: serializePelanggan(pelanggan),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request, context) {
  try {
    await prisma.pelanggan.delete({
      where: { id: await idFromContext(context) },
    });

    return json({ message: 'Pelanggan berhasil dihapus.' });
  } catch (error) {
    return handleError(error);
  }
}
