import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function json(data, init) {
  return NextResponse.json(data, init);
}

export function handleError(error) {
  if (error instanceof ZodError) {
    return json(
      {
        message: 'Data request tidak valid.',
        errors: error.flatten(),
      },
      { status: 422 }
    );
  }

  if (error?.code === 'P2025') {
    return json({ message: 'Data tidak ditemukan.' }, { status: 404 });
  }

  return json(
    {
      message: error?.message || 'Terjadi kesalahan server.',
    },
    { status: error?.statusCode || 500 }
  );
}

export async function readJson(request) {
  return request.json().catch(() => ({}));
}
