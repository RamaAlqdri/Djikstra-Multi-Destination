# Sistem Informasi Depot Air + Multi-Destination Routing

Project ini menggabungkan sistem informasi depot air galon dengan perbandingan
algoritma shortest path multi-destination.

Fitur utama:

- Master data depot galon sebagai titik awal pengantaran.
- Master data pelanggan berisi nama, alamat, latitude, dan longitude.
- Pemilik depot memilih pelanggan yang akan diantar.
- Sistem menjalankan 3 algoritma sekaligus: `CDSSSD`, `MDMSMD`, dan `EAMDSP`.
- Hasil perbandingan ditampilkan di frontend dan disimpan ke riwayat pengantaran.
- Detail riwayat dapat dibuka ulang untuk melihat tabel perbandingan dan rute peta.

## Struktur Project

- `algorithms.py`: modul reusable Dijkstra + CDSSSD + MDMSMD + EAMDSP.
- `outdoor_server.py`: Python routing solver API. Mengambil matrix/rute dari OSRM.
- `backend/`: Laravel API untuk data depot, pelanggan, pengantaran, dan riwayat.
- `frontend/`: React + Leaflet dashboard sistem informasi depot air.
- `*.ipynb`: notebook pembelajaran dan pembanding algoritma.

## Arsitektur Runtime

Frontend tidak lagi memanggil Python solver secara langsung.

Alur pengantaran:

1. User memilih depot dan beberapa pelanggan di frontend.
2. Frontend mengirim request ke Laravel API.
3. Laravel mengambil data koordinat dari database.
4. Laravel memanggil Python solver `/api/solve`.
5. Python solver menjalankan `CDSSSD`, `MDMSMD`, dan `EAMDSP`.
6. Laravel menyimpan semua hasil algoritma ke riwayat.
7. Frontend menampilkan tabel perbandingan dan map rute.

## Menjalankan

### 1. Python Solver

```bash
python3 outdoor_server.py --host 127.0.0.1 --port 8000
```

Endpoint solver:

- `GET /health`
- `POST /api/solve`

### 2. Laravel API

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8001
```

Pastikan `.env` Laravel memuat:

```env
ROUTING_SOLVER_URL=http://127.0.0.1:8000
```

Endpoint utama Laravel:

- `GET|POST /api/depot-galon`
- `GET|POST|PUT|DELETE /api/pelanggan`
- `GET|POST /api/pengantaran`
- `GET /api/pengantaran/{id}`
- `PATCH /api/pengantaran/{id}/status`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default URL frontend: `http://127.0.0.1:5173`

Pastikan `.env` frontend:

```env
VITE_API_BASE_URL=http://127.0.0.1:8001/api
```

## Catatan Algoritma

- `CDSSSD`: shortest path dari depot ke setiap pelanggan secara independen.
- `MDMSMD`: mengikuti urutan pelanggan yang dipilih user.
- `EAMDSP`: greedy nearest-next dari posisi aktif.
- Untuk outdoor mode, graph solver dibentuk dari matrix antar titik depot/pelanggan
  hasil OSRM, bukan graph penuh seluruh simpul jalan.

## Validasi

Core algoritma dapat dites dari notebook `tests.ipynb` atau dengan menjalankan
test Python manual terhadap `algorithms.py`.
