import { prisma } from '@/lib/prisma';
import { json, handleError, readJson } from '@/lib/http';
import { createPengantaran } from '@/lib/routing';
import { serializeTransaksi, transaksiInclude } from '@/lib/serializers';
import { pengantaranSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const transaksi = await prisma.transaksi.findMany({
      include: transaksiInclude,
      orderBy: { createdAt: 'desc' },
    });

    return json({ data: transaksi.map(serializeTransaksi) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    const validated = pengantaranSchema.parse(await readJson(request));
    const result = await createPengantaran(validated);

    return json(
      {
        message: 'Pengantaran berhasil dibuat dan hasil 3 algoritma tersimpan.',
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
