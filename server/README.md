# Project TPA Server

Backend minimal untuk koneksi ke database MySQL yang sudah ada.

## Menjalankan

### Menyalakan MySQL (disarankan via Docker)

Jalankan dari root project:

```bash
npm run db:start
```

Lihat log MySQL:

```bash
npm run db:logs
```

Matikan container MySQL:

```bash
npm run db:stop
```

1. Install dependency:

```bash
npm install
```

2. Copy file environment:

```bash
cp .env.example .env
```

3. Sesuaikan nilai `DB_*` di `.env` dengan database Anda.
4. Sesuaikan akun awal admin di variabel:
   - `ADMIN_NAME`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
5. Atur durasi sesi login via `SESSION_HOURS` (default 12 jam).
6. Jika frontend jalan di port berbeda, isi `CORS_ORIGIN` dengan daftar origin dipisah koma.

7. Cek koneksi database:

```bash
npm run check:db
```

8. Jalankan server:

```bash
npm run dev
```

Endpoint health:

- `GET /health`
- `GET /health/db`

Endpoint sinkronisasi data:

- `GET /api/v1/app-data` ambil seluruh data aplikasi dari database.
- `PUT /api/v1/app-data` replace seluruh data aplikasi (sinkronisasi utama).
- `POST /api/v1/app-data/import` import data lama (misalnya dari localStorage).

Endpoint manajemen akun orang tua:

- `GET /api/v1/parent-accounts` ambil daftar akun orang tua.
- `POST /api/v1/parent-accounts` buat akun orang tua baru.
- `PUT /api/v1/parent-accounts/:id` update akun orang tua.
- `DELETE /api/v1/parent-accounts/:id` hapus akun orang tua.

Endpoint autentikasi:

- `POST /api/v1/auth/login` login pakai `email + password` (role otomatis sesuai akun).
- `POST /api/v1/auth/logout` logout sesi aktif.
- `GET /api/v1/auth/me` ambil profil sesi login saat ini.

Catatan akun awal:
- Jika belum ada data admin, server otomatis membuat akun admin dari variabel `ADMIN_*`
  (fallback ke `SUPER_ADMIN_*` jika variabel baru belum diset).

Endpoint admin:

- `GET /api/v1/admin/staff-users` daftar akun petugas.
- `POST /api/v1/admin/staff-users` tambah akun petugas.
- `PUT /api/v1/admin/staff-users/:id` update akun petugas.
- `DELETE /api/v1/admin/staff-users/:id` hapus akun petugas.
- `GET /api/v1/admin/activity-logs` baca log aktivitas (login/input/hapus/backup).
- `GET /api/v1/admin/service-rates` ambil tarif paket layanan.
- `PUT /api/v1/admin/service-rates` update tarif paket layanan.
- `GET /api/v1/admin/service-billing/summary` ringkasan billing layanan per anak.
- `GET /api/v1/admin/service-billing/history/:childId` detail periode dan transaksi billing anak.
- `POST /api/v1/admin/service-billing/periods` mulai periode billing baru (30 hari).
- `POST /api/v1/admin/service-billing/payments` catat pembayaran billing.
- `POST /api/v1/admin/service-billing/refunds` catat refund manual billing.
- `POST /api/v1/admin/service-billing/confirm-upgrade` konfirmasi upgrade 2 mingguan ke bulanan.
- `GET /api/v1/admin/backup` unduh backup database dalam format JSON.

## Seed akun testing

Jalankan:

```bash
npm run seed:test-accounts
```

Default akun testing yang dibuat:
- `ADMIN`: `testing.admin@gmail.com` / `Testing123!`
- `PETUGAS`: `testing.staff@gmail.com` / `Testing123!`
- `PARENT_ACCOUNT`: `testing.orangtua@gmail.com` / `Testing123!`
