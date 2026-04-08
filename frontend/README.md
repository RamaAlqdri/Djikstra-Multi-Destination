# Frontend Outdoor Routing (React + Leaflet)

Frontend ini digunakan untuk ilustrasi algoritma multi-destination pada peta outdoor.

## Fitur

- Klik peta untuk set `source` (klik pertama) dan `destinations` (klik berikutnya).
- Pilih algoritma: `CDSSSD`, `MDMSMD`, `EAMDSP`.
- Pilih `cost_metric`: `duration` atau `distance`.
- Menampilkan polyline rute hasil dari backend pada map Leaflet.
- Menampilkan ringkasan hasil: visit order, total cost, total visited nodes, dan detail segment.

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
