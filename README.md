# Shortest Path Algorithms Project (Indoor + Outdoor Multi-Destination)

Project ini mengimplementasikan 3 algoritma shortest path dari jurnal:
**“An Efficient Shortest Path Algorithm: Multi-Destinations in an Indoor Environment”**.

Algoritma yang tersedia:

1. **CDSSSD** (Conventional Dijkstra Single Source Single Destination)
2. **MDMSMD** (Modified Dijkstra Multi-Source Multi-Destination)
3. **EAMDSP** (Efficient Algorithm for Multi-Destination Shortest Path)

## Struktur Project

- `algorithms.py`: modul reusable helper + Dijkstra + 3 algoritma utama.
- `cdsssd.ipynb`: notebook fokus CDSSSD.
- `mdmsmd.ipynb`: notebook fokus MDMSMD.
- `eamdsp.ipynb`: notebook fokus EAMDSP.
- `comparison.ipynb`: perbandingan ketiga algoritma pada input yang sama.
- `tests.ipynb`: notebook test (`unittest`) untuk edge case utama.
- `outdoor_server.py`: backend API outdoor; fetch jarak/rute dari OSRM, lalu menjalankan algoritma multi-destination.
- `frontend/`: React + Leaflet untuk ilustrasi map outdoor interaktif.

## Bagian 1: Notebook Indoor

### Kebutuhan

- Python 3.10+
- Jupyter Notebook / JupyterLab

### Menjalankan

```bash
jupyter notebook
```

Lalu jalankan notebook dari atas ke bawah:

- `cdsssd.ipynb`
- `mdmsmd.ipynb`
- `eamdsp.ipynb`
- `comparison.ipynb`
- `tests.ipynb`

## Bagian 2: Outdoor Map (React + Leaflet + OSRM)

Arsitektur:

- Frontend Leaflet untuk pilih titik source/destination pada peta.
- Backend Python fetch **cost matrix** dan **route geometry** dari OSRM.
- Backend menjalankan `CDSSSD` / `MDMSMD` / `EAMDSP` di atas graph berbobot dari hasil OSRM.

### 2.1 Jalankan Backend API

```bash
python3 outdoor_server.py --host 127.0.0.1 --port 8000
```

Endpoint:

- `GET /health`
- `POST /api/solve`

Contoh payload `POST /api/solve`:

```json
{
  "algorithm": "EAMDSP",
  "cost_metric": "duration",
  "profile": "driving",
  "source": { "lat": -6.2000, "lng": 106.8166 },
  "destinations": [
    { "lat": -6.2012, "lng": 106.8221 },
    { "lat": -6.2140, "lng": 106.8450 }
  ]
}
```

Catatan:

- Default OSRM provider: `https://router.project-osrm.org`
- Bisa override dengan env `OSRM_BASE_URL` atau argumen `--osrm-base-url`
- Mode `driving` menghormati one-way road
- Jika environment lokal bermasalah dengan CA certificate HTTPS, jalankan:
  `python3 outdoor_server.py --insecure-skip-tls-verify`

### 2.2 Jalankan Frontend

Masuk folder frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default URL frontend: `http://127.0.0.1:5173`

## Catatan Implementasi Algoritma

- Graph memakai adjacency list.
- Edge weight wajib non-negatif.
- Jika destination tidak terjangkau, sistem melempar `PathNotFoundError`.
- Jika `source` muncul di destinations, segmen tersebut diproses aman (`cost = 0`, path satu node).
- Destination duplikat dipertahankan sebagai request terpisah.
- Penggabungan sub-path menghindari duplikasi node sambungan.

## Contoh Format Return (Core Algorithm)

```python
{
    "algorithm": "EAMDSP",
    "full_path": ["A", "C", "F", "E"],
    "segments": [
        {
            "from": "A",
            "to": "C",
            "path": ["A", "B", "C"],
            "cost": 5,
            "visited_nodes": 4
        }
    ],
    "visit_order": ["C", "F", "E"],
    "total_cost": 33,
    "total_visited_nodes": 25
}
```
