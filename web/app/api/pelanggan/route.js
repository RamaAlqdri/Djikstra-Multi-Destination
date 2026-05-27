import { prisma } from '@/lib/prisma';
import { json, handleError, readJson } from '@/lib/http';
import { serializePelanggan } from '@/lib/serializers';
import { pelangganSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const search = request.nextUrl.searchParams.get('search')?.trim();
    const pelanggan = await prisma.pelanggan.findMany({
      where: search
        ? {
            OR: [
              { namaPelanggan: { contains: search, mode: 'insensitive' } },
              { alamat: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { namaPelanggan: 'asc' },
    });

    return json({ data: pelanggan.map(serializePelanggan) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const data = pelangganSchema.parse(await readJson(request));
    const pelanggan = await prisma.pelanggan.create({
      data: {
        namaPelanggan: data.nama_pelanggan,
        alamat: data.alamat,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return json(
      {
        message: 'Pelanggan berhasil disimpan.',
        data: serializePelanggan(pelanggan),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
