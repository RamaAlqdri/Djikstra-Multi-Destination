import { prisma } from '@/lib/prisma';
import { json, handleError, readJson } from '@/lib/http';
import { serializeTransaksi, transaksiInclude } from '@/lib/serializers';
import { statusSchema } from '@/lib/validation';

export const runtime = 'nodejs';

async function idFromContext(context) {
  const params = await context.params;
  return BigInt(params.id);
}

export async function PATCH(request, context) {
  try {
    const data = statusSchema.parse(await readJson(request));
    const transaksi = await prisma.transaksi.update({
      where: { id: await idFromContext(context) },
      data: { status: data.status },
      include: transaksiInclude,
    });

    return json({
      message: 'Status pengantaran berhasil diperbarui.',
      data: serializeTransaksi(transaksi),
    });
  } catch (error) {
    return handleError(error);
  }
}
