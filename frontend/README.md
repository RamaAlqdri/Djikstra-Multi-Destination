# Frontend Outdoor Routing (React + Leaflet)

Frontend ini digunakan untuk ilustrasi algoritma multi-destination pada peta outdoor.

## Fitur

- Klik peta untuk set `source` (klik pertama) dan `destinations` (klik berikutnya).
- Pilih `cost_metric`: `duration`, `distance`, atau `ongkir`.
- Menjalankan otomatis 3 algoritma (`CDSSSD`, `MDMSMD`, `EAMDSP`) lalu menampilkan perbandingan.
- Menampilkan polyline rute hasil pada map Leaflet untuk algoritma yang dipilih di tabel perbandingan.
- Menampilkan ringkasan pembanding: best total cost, best visited nodes, dan detail segment per algoritma.

## Menjalankan

1. Install dependency:

```bash
npm install
```

2. Atur base URL API (opsional):

```bash
cp .env.example .env
```

3. Jalankan development server:

```bash
npm run dev
```

Default URL frontend biasanya: `http://127.0.0.1:5173`.

## Catatan

- Frontend memanggil backend di endpoint `POST /api/solve`.
- Data peta memakai tile OpenStreetMap.
