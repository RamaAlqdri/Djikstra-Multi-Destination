import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DEPOT = {
  namaDepot: 'Depot Galon Pusat',
  alamat: 'Titik pusat toko depot air',
  latitude: -7.94244696762181,
  longitude: 112.61640127197477,
};

const DEFAULT_CUSTOMERS = [
  {
    namaPelanggan: 'Pelanggan Veteran',
    alamat: 'Jl. Veteran, Ketawanggede, Lowokwaru, Kota Malang',
    latitude: -7.9541234,
    longitude: 112.6149012,
  },
  {
    namaPelanggan: 'Pelanggan Sumbersari',
    alamat: 'Jl. Sumbersari, Lowokwaru, Kota Malang',
    latitude: -7.9561,
    longitude: 112.6105,
  },
  {
    namaPelanggan: 'Pelanggan Dinoyo',
    alamat: 'Jl. MT Haryono, Dinoyo, Lowokwaru, Kota Malang',
    latitude: -7.9448,
    longitude: 112.6087,
  },
];

async function upsertByName(model, nameField, data) {
  const existing = await model.findFirst({
    where: {
      [nameField]: data[nameField],
    },
  });

  if (existing) {
    return model.update({
      where: { id: existing.id },
      data,
    });
  }

  return model.create({ data });
}

async function main() {
  await upsertByName(prisma.depotGalon, 'namaDepot', DEFAULT_DEPOT);

  for (const customer of DEFAULT_CUSTOMERS) {
    await upsertByName(prisma.pelanggan, 'namaPelanggan', customer);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
