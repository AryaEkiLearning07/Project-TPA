# Deploy Laptop + Cloudflare Tunnel

Panduan ini untuk kondisi saat server masih berjalan di laptop pribadi.

## Arsitektur

- `tparumahceria.my.id` dilayani backend pada host root sebagai landing page.
- `apps.tparumahceria.my.id` dilayani backend pada host `apps` sebagai app admin/petugas.
- Cloudflare Tunnel meneruskan kedua hostname ke `http://localhost:4000`.
- Port publik tidak perlu dibuka dari laptop.

## 1. Persiapan Laptop

1. Colokkan laptop ke charger.
2. Ubah Windows `Sleep` menjadi `Never` saat plugged in.
3. Ubah aksi tutup lid menjadi `Do nothing`.
4. Gunakan koneksi internet yang stabil, lebih baik LAN.

## 2. Isi File `.env`

Copy:

```powershell
Copy-Item .env.example .env
```

Lalu isi minimal:

- `NODE_ENV=production`
- `TRUST_PROXY=1`
- `CORS_ORIGIN=https://tparumahceria.my.id,https://apps.tparumahceria.my.id`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_DOMAIN=` dibiarkan kosong
- `DB_*`
- `BACKUP_ENCRYPTION_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## 3. Build dan Jalankan Runtime

```powershell
cd "e:\Project TPA"
npm run runtime:prod:start
```

Script ini akan membangun:

- admin/petugas (`dist`)
- landing (`dist-landing`)
- backend (`server/dist`)

## 4. Cek Lokal

```powershell
npm run runtime:prod:status
```

Status yang diharapkan:

- `Frontend admin (4000): True`
- `Frontend landing (4000): True`
- `Backend health (4000): True`

## 5. Setup Cloudflare

1. Tambahkan domain ke Cloudflare.
2. Ganti nameserver domain di registrar ke nameserver Cloudflare.
3. Tunggu sampai status domain `Active`.
4. Hapus record `A` / `AAAA` lama untuk root atau `apps` jika nanti bentrok dengan tunnel.

## 6. Install `cloudflared`

Jalankan PowerShell sebagai Administrator:

```powershell
winget install --id Cloudflare.cloudflared
```

## 7. Buat Tunnel

Di Cloudflare Zero Trust:

1. `Networks` -> `Tunnels`
2. `Create a tunnel`
3. Pilih `Cloudflared`
4. Nama tunnel misalnya `tpa-laptop`
5. Pilih `Windows`
6. Jalankan command install service yang diberikan Cloudflare

Biasanya bentuknya seperti:

```powershell
cloudflared service install <TOKEN_DARI_CLOUDFLARE>
```

## 8. Tambah Public Hostname

Tambahkan tiga hostname:

1. `tparumahceria.my.id` -> `http://localhost:4000`
2. `www.tparumahceria.my.id` -> `http://localhost:4000`
3. `apps.tparumahceria.my.id` -> `http://localhost:4000`

Root domain dan `apps` sama-sama menuju backend, tetapi backend akan memilih frontend berdasarkan `Host`.

## 9. Tambah Proteksi untuk Subdomain Admin

Sangat disarankan mengunci `apps.tparumahceria.my.id` memakai Cloudflare Access:

1. `Zero Trust` -> `Access` -> `Applications`
2. `Add an application`
3. Pilih `Self-hosted`
4. Domain: `apps.tparumahceria.my.id`
5. Policy:
   - `Allow`
   - email admin dan petugas yang diizinkan

Dengan ini, subdomain admin akan memiliki gerbang tambahan sebelum login aplikasi.

## 10. Operasional Harian

Setelah ada perubahan code:

```powershell
cd "e:\Project TPA"
npm run runtime:prod:restart
```

## 11. Keterbatasan Setup Laptop

- Jika laptop mati, website ikut mati.
- Jika laptop sleep, tunnel terputus.
- Jika internet rumah bermasalah, domain ikut down.

Setup ini cocok untuk:

- demo
- uji coba internal
- beta publik terbatas

Belum ideal untuk production final jangka panjang.
