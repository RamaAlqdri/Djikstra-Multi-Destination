# Frontend Sistem Informasi Depot Air

React + Leaflet dashboard untuk:

- mengelola data depot,
- mengelola data pelanggan,
- memilih pelanggan tujuan pengantaran,
- menampilkan perbandingan `CDSSSD`, `MDMSMD`, dan `EAMDSP`,
- membuka ulang riwayat pengantaran.

## Menjalankan

```bash
npm install
cp .env.example .env
npm run dev
```

Default URL: `http://127.0.0.1:5173`

Konfigurasi API Laravel:

```env
VITE_API_BASE_URL=http://127.0.0.1:8001/api
```
