# Shortest Path Algorithms Project (Indoor Multi-Destination)

Project ini mengimplementasikan 3 algoritma shortest path dari jurnal:
**“An Efficient Shortest Path Algorithm: Multi-Destinations in an Indoor Environment”**.

## Algoritma

1. **CDSSSD**: Conventional Dijkstra Single Source Single Destination
2. **MDMSMD**: Modified Dijkstra Multi-Source Multi-Destination
3. **EAMDSP**: Efficient Algorithm for Multi-Destination Shortest Path

## Struktur File

- `algorithms.py`: implementasi reusable semua helper + Dijkstra + 3 algoritma utama.
- `cdsssd.ipynb`: notebook fokus CDSSSD.
- `mdmsmd.ipynb`: notebook fokus MDMSMD.
- `eamdsp.ipynb`: notebook fokus EAMDSP.
- `comparison.ipynb`: perbandingan ketiga algoritma pada input sama.
- `tests.ipynb`: pengujian minimal 5 skenario (menggunakan `unittest`).

## Kebutuhan

- Python 3.10+ (direkomendasikan)
- Jupyter Notebook / JupyterLab
- Hanya standard library Python yang dipakai (`heapq`, `typing`, `dataclasses`, `unittest`, `json`)

## Cara Menjalankan

1. Buka folder project ini.
2. Jalankan Jupyter:

```bash
jupyter notebook
```

3. Jalankan notebook dari atas ke bawah:

- `cdsssd.ipynb`
- `mdmsmd.ipynb`
- `eamdsp.ipynb`
- `comparison.ipynb`
- `tests.ipynb`

## Catatan Perilaku Implementasi

- Graph menggunakan adjacency list.
- Semua edge weight harus non-negatif.
- Jika node tujuan tidak terjangkau, fungsi melempar `PathNotFoundError`.
- Jika `source` muncul di `destinations`, segment terkait diproses aman dengan `cost = 0` dan path satu node.
- Jika `destinations` berisi duplikat, implementasi **mempertahankan duplikat** sebagai permintaan terpisah agar konsisten dengan urutan input.
- Penggabungan sub-path menghindari duplikasi node pada titik sambung.

## Contoh Format Return

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
