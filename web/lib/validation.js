import { z } from 'zod';

const coordinate = z.coerce.number().finite();

export const depotSchema = z.object({
  nama_depot: z.string().trim().min(1).max(255),
  alamat: z.string().trim().min(1),
  latitude: coordinate.min(-90).max(90),
  longitude: coordinate.min(-180).max(180),
});

export const pelangganSchema = z.object({
  nama_pelanggan: z.string().trim().min(1).max(255),
  alamat: z.string().trim().min(1),
  latitude: coordinate.min(-90).max(90),
  longitude: coordinate.min(-180).max(180),
});

export const pengantaranSchema = z.object({
  depot_id: z.coerce.bigint(),
  tanggal_pengantaran: z.string().trim().optional(),
  pelanggan_ids: z.array(z.coerce.bigint()).min(1),
  cost_metric: z.enum(['duration', 'distance', 'ongkir']).default('duration'),
  profile: z.string().trim().min(1).max(50).default('driving'),
  catatan: z.string().trim().optional().nullable(),
});

export const statusSchema = z.object({
  status: z.enum(['pending', 'dalam_pengantaran', 'selesai', 'dibatalkan']),
});
