import { prisma } from '@/lib/prisma';
import { json, handleError } from '@/lib/http';
import { serializeTransaksi, transaksiInclude } from '@/lib/serializers';

export const runtime = 'nodejs';

async function idFromContext(context) {
  const params = await context.params;
  return BigInt(params.id);
}

export async function GET(_request, context) {
  try {
    const transaksi = await prisma.transaksi.findUniqueOrThrow({
      where: { id: await idFromContext(context) },
      include: transaksiInclude,
    });

    return json({ data: serializeTransaksi(transaksi) });
  } catch (error) {
    return handleError(error);
  }
}
