# Sistem Informasi Depot Air + Multi-Destination Routing

Project ini sekarang punya implementasi full stack Next.js untuk sistem informasi
depot air galon dengan perbandingan algoritma shortest path multi-destination.

Fitur utama:

- Master data depot galon sebagai titik awal pengantaran.
- Master data pelanggan berisi nama, alamat, latitude, dan longitude.
- Input lokasi depot dan pelanggan lewat peta.
- Pemilik depot memilih pelanggan yang akan diantar.
- Sistem menjalankan 3 algoritma sekaligus: `CDSSSD`, `MDMSMD`, dan `EAMDSP`.
- Hasil perbandingan ditampilkan dan disimpan ke riwayat pengantaran.
- Detail riwayat dapat dibuka ulang untuk melihat tabel perbandingan dan rute peta.

## Struktur Project

- `web/`: aplikasi full stack Next.js. Ini stack utama untuk UI dan API.
- `algorithms.py`: modul reusable Dijkstra + CDSSSD + MDMSMD + EAMDSP.
- `outdoor_server.py`: Python routing solver API. Mengambil matrix/rute dari OSRM.
- `*.ipynb`: notebook pembelajaran dan pembanding algoritma.

## Arsitektur Runtime Utama

Alur Next.js full stack:

1. User membuka dashboard Next.js di `web/`.
2. UI memanggil API internal Next.js (`/api/...`).
3. API Next.js membaca/menulis data ke PostgreSQL lewat Prisma.
4. Saat membuat pengantaran, API Next.js memanggil Python solver `/api/solve`.
5. Python solver menjalankan `CDSSSD`, `MDMSMD`, dan `EAMDSP`.
6. API Next.js menyimpan semua hasil algoritma ke riwayat.
7. UI menampilkan tabel perbandingan dan peta rute.

## Env Next.js

`web/.env` hanya membutuhkan:

```env
DATABASE_URL="postgresql://ramadhanial-qadri@127.0.0.1:5432/djikstra_db?schema=public"
ROUTING_SOLVER_URL="http://127.0.0.1:8000"
```

## Menjalankan Stack Utama

### 1. Python Solver

```bash
python3 outdoor_server.py --host 127.0.0.1 --port 8000
```

Endpoint solver:

- `GET /health`
- `POST /api/solve`

Default provider OSRM memakai `http://router.project-osrm.org` untuk menghindari
masalah TLS pada Python bawaan macOS/Xcode. Jika memakai Python modern dengan
OpenSSL baru, provider bisa diganti ke HTTPS:

```bash
python3 outdoor_server.py --host 127.0.0.1 --port 8000 --osrm-base-url https://router.project-osrm.org
```

### 2. Next.js Full Stack

```bash
cd web
npm install
npm run prisma:generate
npm run prisma:seed
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Dashboard: `http://127.0.0.1:3000`

Jika memakai database baru yang belum punya tabel:

```bash
cd web
npm run prisma:push
npm run prisma:seed
```

Catatan: jangan paksa `prisma:push` ke database existing jika Prisma memberi
warning akan menghapus tabel yang tidak dikelola oleh schema Next.js.

## Endpoint Next.js

- `GET|POST /api/depot-galon`
- `GET|PUT|DELETE /api/depot-galon/{id}`
- `GET|POST /api/pelanggan`
- `GET|PUT|DELETE /api/pelanggan/{id}`
- `GET|POST /api/pengantaran`
- `GET /api/pengantaran/{id}`
- `PATCH /api/pengantaran/{id}/status`

## Catatan Algoritma

- `CDSSSD`: shortest path dari depot ke setiap pelanggan secara independen.
- `MDMSMD`: mengikuti urutan pelanggan yang dipilih user.
- `EAMDSP`: greedy nearest-next dari posisi aktif.
- Untuk outdoor mode, graph solver dibentuk dari matrix antar titik depot/pelanggan
  hasil OSRM, bukan graph penuh seluruh simpul jalan.

## Docker

```bash
docker compose up --build
```

Service yang berjalan:

- `solver`: Python routing solver di port `8000`.
- `web`: Next.js full stack di port `3000`.
- `postgres`: database PostgreSQL di port `5432`.
