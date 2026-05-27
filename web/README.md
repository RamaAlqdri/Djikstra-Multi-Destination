# Sistem Informasi Depot Air - Next.js Full Stack

Folder ini adalah implementasi full stack Next.js untuk sistem informasi depot air.
Next.js menangani UI dan API, PostgreSQL menyimpan data, dan `outdoor_server.py`
tetap dipakai sebagai solver tiga algoritma routing.

## Fitur

- CRUD depot galon.
- CRUD pelanggan dengan input koordinat dari peta.
- Pemilihan pelanggan tujuan pengantaran.
- Pemanggilan solver `CDSSSD`, `MDMSMD`, dan `EAMDSP`.
- Penyimpanan hasil perbandingan algoritma ke riwayat.
- Tampilan riwayat dengan tabel perbandingan dan peta rute memakai nama pelanggan.

## Env

Hanya dua variabel yang dibutuhkan:

```env
DATABASE_URL="postgresql://ramadhanial-qadri@127.0.0.1:5432/djikstra_db?schema=public"
ROUTING_SOLVER_URL="http://127.0.0.1:8000"
```

## Menjalankan

```bash
npm install
npm run prisma:generate
npm run prisma:seed
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Jika memakai database baru yang belum punya tabel:

```bash
npm run prisma:push
npm run prisma:seed
```

Jangan jalankan `prisma:push` ke database existing jika Prisma memberi warning
akan menghapus tabel yang tidak dikelola oleh schema Next.js.

Dashboard: `http://127.0.0.1:3000`
