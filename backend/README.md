# Backend — Djikstra Multi-Destination (Laravel)

Backend API untuk proyek **Shortest Path Algorithms — Multi-Destination** yang dibangun menggunakan **Laravel 12** dengan database **PostgreSQL**.

## Tech Stack

| Komponen | Versi |
|----------|-------|
| PHP | ^8.2 |
| Laravel Framework | ^12.0 |
| Database | PostgreSQL 16 |
| Session Driver | database |
| Cache Driver | database |
| Queue Driver | database |

---

## Prasyarat

- PHP 8.2+
- Composer
- PostgreSQL 16 (atau via Docker)
- Node.js (untuk asset Vite)

---

## Persiapan Lingkungan

### 1. Jalankan PostgreSQL via Docker

Dari root project (folder `Djikstra-Multi-Destination/`):

```bash
docker compose up -d postgres
```

Ini akan menjalankan PostgreSQL di port `5432` dengan konfigurasi:

| Parameter | Nilai |
|-----------|-------|
| Database | `laravel` |
| User | `laravel` |
| Password | `secret` |
| Port | `5432` |

### 2. Konfigurasi Environment

Masuk folder `backend/`, lalu salin file environment:

```bash
cd backend
cp .env.example .env
```

Pastikan konfigurasi database di `.env` sesuai:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=laravel
DB_USERNAME=laravel
DB_PASSWORD=secret
```

### 3. Install Dependensi

```bash
composer install
```

### 4. Generate Application Key

```bash
php artisan key:generate
```

### 5. Jalankan Migrasi Database

```bash
php artisan migrate
```

Migrasi yang tersedia:

| File Migrasi | Tabel |
|---|---|
| `0001_01_01_000000_create_users_table.php` | `users`, `password_reset_tokens`, `sessions` |
| `0001_01_01_000001_create_cache_table.php` | `cache`, `cache_locks` |
| `0001_01_01_000002_create_jobs_table.php` | `jobs`, `job_batches`, `failed_jobs` |

---

## Menjalankan Server

```bash
php artisan serve
```

Server berjalan di `http://localhost:8000` secara default.

Atau gunakan script `dev` dari Composer (menjalankan server, queue, log watcher, dan Vite secara bersamaan):

```bash
composer run dev
```

---

## Setup Lengkap Satu Perintah

```bash
composer run setup
```

Script ini akan melakukan: `composer install` → salin `.env` → generate key → migrate → `npm install` → `npm run build`.

---

## Struktur Direktori

```
backend/
├── app/
│   ├── Http/
│   │   └── Controllers/     # Controller API
│   ├── Models/
│   │   └── User.php
│   └── Providers/
├── bootstrap/
├── config/                  # Konfigurasi (database, cache, session, dll.)
├── database/
│   ├── factories/
│   ├── migrations/          # Skema database
│   └── seeders/
├── routes/
│   └── web.php              # Definisi route
├── resources/
│   └── views/
├── .env.example             # Template konfigurasi environment
└── composer.json
```

---

## Testing

```bash
php artisan test
```

Atau via Composer:

```bash
composer run test
```

---

## Docker (Opsional — Full Stack)

Untuk menjalankan seluruh stack (backend Python, frontend React, dan PostgreSQL) sekaligus via Docker:

```bash
# Dari root project
docker compose up -d
```

> Catatan: Dockerfile backend di root project menjalankan server Python (`outdoor_server.py`), bukan server Laravel. Laravel dijalankan secara terpisah dengan `php artisan serve`.

---

## Lisensi

MIT
