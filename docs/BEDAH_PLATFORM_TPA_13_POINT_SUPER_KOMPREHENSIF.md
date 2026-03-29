# Bedah Platform TPA Super Komprehensif (13 Poin)

Dokumen ini ditulis untuk tujuan belajar dari nol: memahami `apa`, `bagaimana`, dan `kenapa` sistem ini dibangun.
Fokus dokumen: alur dari login sampai ujung sistem (operasional petugas, admin, parent portal, billing, backup), berdasarkan implementasi kode yang ada saat ini.

Untuk mode penulisan skripsi sangat detail per-screen/per-interaksi, gunakan playbook ini:
- `docs/SKRIPSI_PLAYBOOK_BEDAH_TOTAL.md`

## Definisi Label Status File
- `GIT+ADA`: file ter-track di Git dan file fisik ada.
- `GIT-HILANG`: file ter-track di Git tetapi file fisik tidak ada di workspace.
- `LOKAL-BARU`: file ada di workspace tetapi belum ter-track di Git.

---

## 1. Orientasi Belajar (Kenapa Dokumen Ini Ada)
### Definisi
Platform ini dibangun cepat dengan bantuan AI. Tantangan utamanya bukan sekadar "berjalan", tapi apakah Anda paham arsitektur dan risikonya.

### Mekanisme Belajar yang Dipakai
Dokumen ini membedah sistem dengan pola tetap:
1. `Apa` masalah bisnisnya.
2. `Bagaimana` implementasi teknisnya (frontend, API, service, DB).
3. `Kenapa` keputusan desain itu dipilih.
4. Risiko nyata dan celah yang perlu diperbaiki.

### Kenapa Penting
Karena ketika ditanya orang teknis, Anda tidak cukup menjawab fitur; Anda harus bisa menjawab:
- data disimpan di mana,
- siapa boleh akses,
- bagaimana mencegah abuse,
- apa dampak kalau satu komponen gagal.

---

## 2. Peta Besar Arsitektur Sistem
### Definisi
Arsitektur sistem adalah pembagian tanggung jawab antarkomponen.

### Mekanisme
- Frontend internal (Admin + Petugas): `[GIT+ADA] src/App.tsx`, `[GIT+ADA] src/features/admin/AdminSection.tsx`, `[GIT+ADA] src/features/petugas/PetugasSection.tsx`
- Frontend parent portal: `[GIT+ADA] src/features/parent/ParentPortalSection.tsx`
- API client: `[GIT+ADA] src/services/api.ts`
- Backend app bootstrap: `[GIT+ADA] server/src/app.ts`, `[GIT+ADA] server/src/index.ts`
- Middleware auth/role/gate: `[GIT+ADA] server/src/middlewares/auth-middleware.ts`
- Business logic: `[GIT+ADA] server/src/services/*.ts`
- Route API: `[GIT+ADA] server/src/routes/*.ts`
- DB: MySQL lewat `[GIT+ADA] server/src/config/database.ts`

Alur request normal:
1. Browser kirim request ke `/api/v1/*`.
2. Middleware validasi token + role + policy tambahan.
3. Route parse payload.
4. Service eksekusi logika + query SQL (sering pakai transaction).
5. Response JSON dikembalikan ke frontend.

### Kenapa
Pemisahan `Route -> Service -> DB` membuat logika bisnis lebih mudah dilacak, dites, dan diaudit.

---

## 3. Startup, Host Routing, dan Deploy Runtime
### Definisi
Startup adalah proses server menyiapkan skema dan infrastruktur sebelum menerima trafik.

### Mekanisme
Di `[GIT+ADA] server/src/index.ts` saat start:
1. cek koneksi DB,
2. `ensureAuthSchemaReady()`,
3. `ensureServiceRateSchema()`,
4. `ensureStaffAttendanceSchema()`,
5. `ensureServiceBillingSchema()`,
6. `ensureChildRegistrationCodeSchema()`.

Di `[GIT+ADA] server/src/app.ts`:
- host-based serving:
  - landing host ke `dist-landing`,
  - apps/parent host ke `dist`.
- redirect HTTPS di production untuk host publik,
- CORS allowlist,
- global API limiter + login limiter,
- request-size guard,
- security headers (HSTS/CSP opsional),
- static `/uploads` dilindungi auth + role.

### Kenapa
Satu backend menangani API + static hosting, jadi deployment lebih sederhana dan kontrol keamanan terpusat.

---

## 4. Login End-to-End (Sangat Detail)
### Definisi
Login adalah proses autentikasi user (admin, petugas, orang tua) dan pembuatan sesi aman.

### Mekanisme Detail
#### 4.1 Dari UI
- Halaman login: `[GIT+ADA] src/features/auth/LoginPage.tsx`
- Jika mode parent portal, login mengirim `loginPreference: PARENT_FIRST`; portal staff mengirim `STAFF_FIRST`.
- Call API: `authApi.login()` di `[GIT+ADA] src/services/api.ts`.

#### 4.2 Di Route API
- Endpoint: `POST /api/v1/auth/login` di `[GIT+ADA] server/src/routes/auth-routes.ts`.
- Payload diparse (`email`, `password`, `loginPreference`).
- Memanggil `login()` service.

#### 4.3 Di Service Auth
File: `[GIT+ADA] server/src/services/auth-service.ts`

Langkah internal `login()`:
1. `ensureAuthSchemaReady()` memastikan tabel auth tersedia.
2. Validasi email/password kosong.
3. Cek lockout via tabel `auth_login_attempts`.
4. Pilih urutan percobaan login berdasarkan `loginPreference`:
   - parent dulu lalu staff, atau sebaliknya.
5. Parent path:
   - cari akun parent by email,
   - verifikasi password (`scrypt`, lihat `[GIT+ADA] server/src/utils/password.ts`),
   - cek `is_active`,
   - buat session role `ORANG_TUA`.
6. Staff/admin path:
   - cari user by email,
   - verifikasi password,
   - map role DB (`SUPER_ADMIN/ADMIN -> ADMIN`, `STAFF/PETUGAS -> PETUGAS`),
   - cek `is_active`,
   - buat session.
7. Jika gagal autentikasi (401): tambah counter gagal login.
8. Jika gagal mencapai threshold, lockout naik eksponensial.
9. Semua hasil login dicatat ke `activity_logs` (sukses/gagal).

Konstanta lockout:
- `LOGIN_MAX_FAILED_ATTEMPTS = 5`
- `LOGIN_LOCKOUT_BASE_SECONDS = 60`
- `LOGIN_LOCKOUT_MAX_SECONDS = 3600`

#### 4.4 Session Creation
- Token raw dibuat random 32 byte hex.
- Token di-hash SHA-256.
- Disimpan ke `auth_sessions` (kolom token/hash, role, subject id, email snapshot, display snapshot, expires_at).
- Session lama untuk subjek yang sama direvoke dulu.

#### 4.5 Pengembalian ke Client
- Route set HTTP-only cookie (`AUTH_COOKIE_NAME`, `sameSite`, `secure`, `domain`) dari env.
- Response hanya mengirim data user + expiresAt, bukan token raw.

#### 4.6 Bootstrap Setelah Login
- `[GIT+ADA] src/App.tsx` memanggil `authApi.me()` saat bootstrap.
- Jika valid, sesi disimpan ke local storage (cache UI).
- Host redirect dilakukan sesuai role:
  - `ADMIN/PETUGAS -> apps.tparumahceria.my.id`
  - `ORANG_TUA -> parent.tparumahceria.my.id` (jika enforced).

### Kenapa
- Hash token + server-side session memberi kontrol revoke yang kuat.
- Multi-path login (parent/staff) mengakomodasi kebutuhan domain tanpa endpoint terpisah.
- Lockout + rate limit menurunkan risiko brute force.

---

## 5. Otorisasi, Gate Absensi, dan Lifecycle Sesi
### Definisi
- Autentikasi: membuktikan identitas.
- Otorisasi: membatasi aksi sesuai role.
- Policy gate: aturan tambahan di luar role.

### Mekanisme
File: `[GIT+ADA] server/src/middlewares/auth-middleware.ts`
1. `requireAuth`
   - token dicari dari bearer dulu, lalu cookie,
   - `resolveAuthContext()` validasi expiry + konsistensi user dari DB,
   - jika user/role berubah, snapshot session disinkronkan.
2. `requireRoles(...roles)`
   - role dinormalisasi, lalu dicocokkan.
3. `requirePetugasCheckedIn`
   - hanya berlaku untuk role `PETUGAS`,
   - cek tabel `staff_daily_attendance` untuk hari aktif,
   - jika belum check-in: 403 + flag `attendanceRequired`.

Lifecycle sesi:
- `logout()` menghapus session token + log `LOGOUT`.
- cleanup periodik di startup loop menghapus session expired dan login attempts stale.
- frontend auto logout jika tidak ada aktivitas 10 menit (`src/App.tsx`).

### Kenapa
Role saja belum cukup. Untuk domain ini, petugas boleh kerja hanya jika hadir sah hari itu.

---

## 6. Absensi Petugas sebagai Gerbang Operasional
### Definisi
Absensi petugas menentukan boleh/tidaknya akses fitur operasional.

### Mekanisme
Service: `[GIT+ADA] server/src/services/staff-attendance-service.ts`
- Tabel `staff_daily_attendance` (unik per `staff_user_id + attendance_date`).
- Status memuat:
  - check-in/out,
  - jumlah aktivitas produktif,
  - status produktivitas (`aktif`/`perlu-konfirmasi`).
- Aktivitas produktif diambil dari `activity_logs` action:
  - `REPLACE_APP_DATA`, `IMPORT_APP_DATA`,
  - `CREATE_PARENT_ACCOUNT`, `UPDATE_PARENT_ACCOUNT`, `DELETE_PARENT_ACCOUNT`.
- Check-in/out by admin menggunakan transaction + `FOR UPDATE`.

Route petugas: `[GIT+ADA] server/src/routes/staff-attendance-routes.ts`
- `GET /staff-attendance/status` tersedia.
- `POST /check-in` dan `POST /check-out` dari petugas sengaja ditolak 403, lalu dicatat log `*_BLOCKED`.

Route admin: `[GIT+ADA] server/src/routes/admin-routes.ts`
- admin yang melakukan check-in/check-out petugas.

### Kenapa
Model "admin assisted attendance" dipilih untuk mencegah manipulasi absensi oleh petugas sendiri.

---

## 7. Domain Operasional Inti (Anak, Kehadiran, Insiden, Observasi, Komunikasi, Inventori)
### 7.1 Data Anak
- Route: `[GIT+ADA] server/src/routes/child-routes.ts`
- Service: `[GIT+ADA] server/src/services/child-service.ts`
- Mekanisme:
  - data anak join `parent_profiles`,
  - create/update resolve parent profile via `parent-relations-service`,
  - simpan foto base64 ke disk,
  - petugas melihat data parent yang dimasking (`[DISENSOR]`).
- Kenapa: privasi data parent dipisah dari operasional lapangan.

### 7.2 Kehadiran Anak
- Route: `[GIT+ADA] server/src/routes/attendance-routes.ts`
- Service: `[GIT+ADA] server/src/services/attendance-service.ts`
- Mekanisme:
  - CRUD attendance,
  - JSON notes menyimpan kondisi datang/pulang + pesan parent + carried items,
  - validasi pengantar/penjemput pakai authorized persons dari data anak,
  - tanda tangan/foto dipersist ke storage.
- Kenapa: satu record harian jadi sumber kebenaran komunikasi parent-petugas.

### 7.3 Berita Acara/Insiden
- Route: `[GIT+ADA] server/src/routes/incident-routes.ts`
- Service: `[GIT+ADA] server/src/services/incident-service.ts`
- Mekanisme:
  - dukung format lama dan format baru `items_json`,
  - kategori barang dibakukan (`DRINKING_BOTTLE`, `BAG`, dst),
  - foto grup + signature diproses ke disk.
- Kenapa: migrasi aman dari data legacy tanpa merusak UI baru.

### 7.4 Observasi
- Route: `[GIT+ADA] server/src/routes/observation-routes.ts`
- Service: `[GIT+ADA] server/src/services/observation-service.ts`
- Mekanisme:
  - header tabel `observation_records`, detail di `observation_items`,
  - update dilakukan dengan replace detail items (delete lalu insert ulang),
  - kategori observasi dinormalisasi.
- Kenapa: struktur header-detail memudahkan rekap per bulan/per anak.

### 7.5 Buku Komunikasi
- Route: `[GIT+ADA] server/src/routes/communication-routes.ts`
- Service: `[GIT+ADA] server/src/services/communication-service.ts`
- Mekanisme:
  - item inventaris komunikasi disimpan JSON string array,
  - CRUD sederhana per tanggal dan anak.
- Kenapa: menjaga catatan harian non-insiden tetap ringan.

### 7.6 Inventori
- Route: `[GIT+ADA] server/src/routes/supply-inventory-routes.ts`
- Service: `[GIT+ADA] server/src/services/supply-inventory-service.ts`
- Mekanisme:
  - CRUD item supply per anak,
  - quantity dinormalisasi integer >= 0,
  - foto item disimpan ke disk.
- Kenapa: memudahkan monitoring stok dan kebutuhan follow-up parent.

---

## 8. Parent Account dan Parent Portal
### Definisi
Parent account adalah kanal resmi orang tua memonitor anak.

### Mekanisme
#### 8.1 Parent Account CRUD (internal)
- Route: `[GIT+ADA] server/src/routes/parent-account-routes.ts`
- Service: `[GIT+ADA] server/src/services/parent-account-service.ts`
- Fitur:
  - create/update/delete akun orang tua,
  - sinkronisasi relasi child ke profile,
  - log audit `CREATE/UPDATE/DELETE_PARENT_ACCOUNT`.

#### 8.2 Registrasi Parent by Code
- Route: `[GIT+ADA] server/src/routes/auth-routes.ts` endpoint `/auth/register-parent-with-code`
- Service: `[GIT+ADA] server/src/services/parent-portal-service.ts`
- Aturan penting:
  - email wajib valid dan domain Gmail,
  - password minimal 8,
  - kode registrasi wajib.
- Transaksi:
  1. pastikan schema parent + code,
  2. pastikan email belum dipakai,
  3. buat parent profile + account,
  4. claim kode,
  5. build dashboard awal,
  6. commit,
  7. buat auth session parent.

#### 8.3 Child Registration Code
- Service: `[GIT+ADA] server/src/services/child-registration-code-service.ts`
- Status code: `ACTIVE`, `CLAIMED`, `REVOKED`, `EXPIRED`.
- Claim memakai lock `FOR UPDATE` untuk hindari race condition.

#### 8.4 Parent Dashboard
- Route: `[GIT+ADA] server/src/routes/parent-routes.ts`
- Service: `[GIT+ADA] server/src/services/parent-portal-service.ts`
- Data yang dikembalikan:
  - profil parent,
  - daftar anak terkait,
  - daily reports attendance,
  - billing snapshot per anak,
  - supply inventory per anak.
- Parent bisa update pesan ke attendance tertentu (maks 2000 char).

Frontend parent:
- `[GIT+ADA] src/features/parent/ParentPortalSection.tsx`
- background refresh 15 detik.
- child selector + link child by code.

### Kenapa
Model code-claim membuat proses linking anak lebih aman dibanding assign manual berbasis nama saja.

### 8.5 Alur Ujung-ke-Ujung (Dari Login Sampai Operasional Selesai)
1. User buka portal sesuai host (`apps` atau `parent`).
2. User login, backend buat session cookie.
3. `src/App.tsx` bootstrap `auth/me`, validasi sesi aktif.
4. Sistem redirect user ke host yang sesuai role.
5. Jika role `PETUGAS`, middleware cek absensi harian.
6. Jika lolos gate, petugas input data operasional: kehadiran, insiden, observasi, inventori.
7. Semua data tersimpan ke tabel domain masing-masing dan sebagian media ke folder upload/storage.
8. Admin memonitor rekap data, mengelola akun, memvalidasi absensi petugas, dan mengelola billing.
9. Orang tua memantau dashboard anak, melihat laporan harian, dan mengirim pesan balik.
10. Admin bisa membuat backup terenkripsi untuk mitigasi kehilangan data.

---

## 9. Service Billing (Perancangan Sampai Implementasi)
### Definisi
Billing menghitung tagihan dari paket layanan + kehadiran + transaksi pembayaran/refund.

### Mekanisme
Service: `[GIT+ADA] server/src/services/service-billing-service.ts`

Type utama:
- package: `harian | 2-mingguan | bulanan`
- bucket transaksi: `period | arrears`
- tipe transaksi: `period-start | payment | refund`
- status periode: `active | upgrade_pending | upgrade_confirmed | completed`

Aturan hitung kunci:
- harian: `attendanceCount * rate.harian`
- bulanan: flat `rate.bulanan`
- 2-mingguan:
  - base untuk 10 hari pertama,
  - extra daily max 5 hari (hari 11-15),
  - ambang migrasi otomatis saat attendance >= 16,
  - settlement migrasi pakai nominal `650000` (`BIWEEKLY_MIGRATION_SETTLEMENT_AMOUNT`).

Skema tabel:
- `service_billing_settings`
- `service_billing_periods`
- `service_billing_transactions` (termasuk bukti bayar data-url + nama file)

Fungsi mutasi utama:
- `createServiceBillingPeriod`
- `createServiceBillingPayment`
- `createServiceBillingRefund`
- `confirmServiceBillingUpgrade`

Semua mutasi menggunakan transaction + rollback.

Route admin billing:
- `[GIT+ADA] server/src/routes/admin-routes.ts`
- endpoint summary, history, create period, payment, refund, confirm upgrade.

### Kenapa
Billing dirancang sebagai event ledger (transactions), bukan overwrite saldo, supaya jejak audit jelas.

---

## 10. Sinkronisasi Data Aplikasi (App Data Full/Lite)
### Definisi
`app-data` adalah endpoint agregat untuk memuat atau mengganti data besar sekaligus.

### Mekanisme
Route: `[GIT+ADA] server/src/routes/app-data-routes.ts`
- `GET /app-data`
- `PUT /app-data` (admin)
- `POST /app-data/import` (admin)

Service: `[GIT+ADA] server/src/services/app-data-service.ts`
- `getAppData()` join multi tabel (children, attendance, incident, observation, supply),
- `maskSensitiveData()` menyensor data parent untuk petugas,
- `stripAppDataMediaPayload()` mode lite (hapus payload media besar),
- `replaceAppData()`:
  - preprocess base64 ke disk,
  - transaction,
  - delete massal (`attendance_records`, `incident_reports`, `children`),
  - insert ulang dari payload.

### Kenapa
Skenario migrasi/restore sinkronisasi cepat butuh endpoint bulk; mode lite menjaga performa bandwidth.

---

## 11. Keamanan, Validasi, dan Hardening
### Definisi
Hardening adalah pengamanan berlapis untuk menurunkan risiko kebocoran/abuse.

### Mekanisme yang Sudah Ada
- Password hashing: scrypt (`[GIT+ADA] server/src/utils/password.ts`).
- Session token server-side + hash token.
- Auth cookie HttpOnly + SameSite + Secure by env.
- CORS allowlist.
- Global rate limiter + login limiter.
- Login lockout berbasis tabel.
- Request size guard endpoint-spesifik.
- Security headers + optional CSP + HSTS.
- Upload static folder dilindungi role.
- Backup terenkripsi AES-256-GCM (`[GIT+ADA] server/src/services/database-backup-service.ts`).

### Kenapa
Satu kontrol tidak cukup; keamanan sistem harus mengandalkan defense-in-depth.

---

## 12. Risiko Aktual dan Area Kropos (Jujur Teknis)
### Risiko Utama
1. Konsistensi coding style antar service belum seragam (indikasi evolusi cepat AI-assisted).
2. Beberapa service punya komentar/debug panjang, menambah noise saat audit.
3. Endpoint bulk replace/import sangat powerful; salah pakai bisa wipe data operasional.
4. In-memory rate limiter tidak distributed (kalau multi-instance, state limiter tidak sinkron).
5. Test otomatis belum terlihat sebagai pipeline wajib.

### Kenapa Ini Penting untuk Skripsi
Ini justru bahan skripsi kuat: sistem nyata, berjalan, tetapi punya gap maintainability dan governance khas AI-first development.

---

## 13. Kerangka Bedah untuk Anda (Apa, Bagaimana, Kenapa)
### Tahap 1: Kuasai Login dan Session
- Baca berurutan:
  - `[GIT+ADA] src/features/auth/LoginPage.tsx`
  - `[GIT+ADA] src/App.tsx`
  - `[GIT+ADA] server/src/routes/auth-routes.ts`
  - `[GIT+ADA] server/src/middlewares/auth-middleware.ts`
  - `[GIT+ADA] server/src/services/auth-service.ts`

### Tahap 2: Kuasai 1 Domain Sampai Tuntas (contoh Attendance)
- UI form -> API client -> route -> service -> tabel.
- Ulang pola ini untuk incident, observation, inventory.

### Tahap 3: Kuasai Parent Portal + Billing
- Fokus ke link kode, dashboard parent, dan perhitungan billing.

### Tahap 4: Kuasai Operasional Produksi
- backup, restore drill, health endpoint, release checklist.

Template catatan belajar per modul:
1. Masalah bisnis apa?
2. Input-output apa?
3. Algoritma/transaksi apa?
4. Risiko data race/bug di mana?
5. Kenapa desainnya begini?

---

## Lampiran A - Inventaris File `GIT+ADA`
- [GIT+ADA] .claude/settings.json
- [GIT+ADA] .claude/settings.local.json
- [GIT+ADA] .env.example
- [GIT+ADA] .gitignore
- [GIT+ADA] apps/landing/index.html
- [GIT+ADA] apps/landing/README.md
- [GIT+ADA] apps/landing/src/App.jsx
- [GIT+ADA] apps/landing/src/main.jsx
- [GIT+ADA] apps/landing/src/styles.css
- [GIT+ADA] apps/landing/vite.config.js
- [GIT+ADA] dist-landing/index.html
- [GIT+ADA] dist-landing/logo_TPA.jpg
- [GIT+ADA] dist-landing/UBAYA-noBG.png
- [GIT+ADA] dist-landing/vite.svg
- [GIT+ADA] docs/DEPLOY-LAPTOP-CLOUDFLARE-TUNNEL.md
- [GIT+ADA] docs/PANDUAN_BEDAH_PLATFORM_TPA.md
- [GIT+ADA] docs/RANCANGAN-PLATFORM-TPA.md
- [GIT+ADA] eslint.config.js
- [GIT+ADA] index.html
- [GIT+ADA] ops/cloudflared/config.example.yml
- [GIT+ADA] ops/create-source-zip.ps1
- [GIT+ADA] ops/install-autostart.ps1
- [GIT+ADA] ops/install-startup-folder.ps1
- [GIT+ADA] ops/README.md
- [GIT+ADA] ops/restart-tpa.ps1
- [GIT+ADA] ops/restart-tpa-prod.ps1
- [GIT+ADA] ops/start-tpa.ps1
- [GIT+ADA] ops/start-tpa-prod.ps1
- [GIT+ADA] ops/status-tpa.ps1
- [GIT+ADA] ops/status-tpa-prod.ps1
- [GIT+ADA] ops/uninstall-autostart.ps1
- [GIT+ADA] ops/uninstall-startup-folder.ps1
- [GIT+ADA] package.json
- [GIT+ADA] package-lock.json
- [GIT+ADA] Productions fase
- [GIT+ADA] project-tpa-source-20260319-200009.zip
- [GIT+ADA] proposal.md
- [GIT+ADA] public/logo_TPA.jpg
- [GIT+ADA] public/UBAYA-noBG.png
- [GIT+ADA] public/vite.svg
- [GIT+ADA] README.md
- [GIT+ADA] server/.env.example
- [GIT+ADA] server/.env.production.example
- [GIT+ADA] server/check_data.js
- [GIT+ADA] server/migrate_data.mjs
- [GIT+ADA] server/package.json
- [GIT+ADA] server/package-lock.json
- [GIT+ADA] server/query
- [GIT+ADA] server/README.md
- [GIT+ADA] server/src/app.ts
- [GIT+ADA] server/src/config/database.ts
- [GIT+ADA] server/src/config/env.ts
- [GIT+ADA] server/src/index.ts
- [GIT+ADA] server/src/middlewares/auth-middleware.ts
- [GIT+ADA] server/src/middlewares/rate-limit-middleware.ts
- [GIT+ADA] server/src/middlewares/request-size-middleware.ts
- [GIT+ADA] server/src/middlewares/upload-middleware.ts
- [GIT+ADA] server/src/routes/admin-routes.ts
- [GIT+ADA] server/src/routes/app-data-routes.ts
- [GIT+ADA] server/src/routes/attendance-routes.ts
- [GIT+ADA] server/src/routes/auth-routes.ts
- [GIT+ADA] server/src/routes/child-routes.ts
- [GIT+ADA] server/src/routes/communication-routes.ts
- [GIT+ADA] server/src/routes/incident-routes.ts
- [GIT+ADA] server/src/routes/observation-routes.ts
- [GIT+ADA] server/src/routes/parent-account-routes.ts
- [GIT+ADA] server/src/routes/parent-routes.ts
- [GIT+ADA] server/src/routes/staff-attendance-routes.ts
- [GIT+ADA] server/src/routes/supply-inventory-routes.ts
- [GIT+ADA] server/src/scripts/check-db.ts
- [GIT+ADA] server/src/scripts/cleanup-data.ts
- [GIT+ADA] server/src/scripts/fix-admin-access.ts
- [GIT+ADA] server/src/scripts/migrate-photos.ts
- [GIT+ADA] server/src/scripts/seed-test-accounts.ts
- [GIT+ADA] server/src/services/app-data-service.ts
- [GIT+ADA] server/src/services/attendance-service.ts
- [GIT+ADA] server/src/services/auth-service.ts
- [GIT+ADA] server/src/services/child-registration-code-service.ts
- [GIT+ADA] server/src/services/child-service.ts
- [GIT+ADA] server/src/services/communication-service.ts
- [GIT+ADA] server/src/services/database-backup-service.ts
- [GIT+ADA] server/src/services/incident-service.ts
- [GIT+ADA] server/src/services/observation-service.ts
- [GIT+ADA] server/src/services/parent-account-service.ts
- [GIT+ADA] server/src/services/parent-portal-service.ts
- [GIT+ADA] server/src/services/parent-relations-service.ts
- [GIT+ADA] server/src/services/service-billing-service.ts
- [GIT+ADA] server/src/services/service-rate-service.ts
- [GIT+ADA] server/src/services/staff-attendance-service.ts
- [GIT+ADA] server/src/services/staff-user-service.ts
- [GIT+ADA] server/src/services/supply-inventory-service.ts
- [GIT+ADA] server/src/types/app-data.ts
- [GIT+ADA] server/src/types/auth.ts
- [GIT+ADA] server/src/types/express.d.ts
- [GIT+ADA] server/src/types/index.ts
- [GIT+ADA] server/src/types/parent-account.ts
- [GIT+ADA] server/src/utils/base64-storage.ts
- [GIT+ADA] server/src/utils/data-mappers.ts
- [GIT+ADA] server/src/utils/error-sanitizer.ts
- [GIT+ADA] server/src/utils/image-compress.ts
- [GIT+ADA] server/src/utils/input-parsers.ts
- [GIT+ADA] server/src/utils/password.ts
- [GIT+ADA] server/src/utils/service-error.ts
- [GIT+ADA] server/src/utils/string-utils.ts
- [GIT+ADA] server/test_db.mjs
- [GIT+ADA] server/tsconfig.json
- [GIT+ADA] src/App.css
- [GIT+ADA] src/App.tsx
- [GIT+ADA] src/assets/react.svg
- [GIT+ADA] src/components/common/AppErrorBoundary.tsx
- [GIT+ADA] src/components/common/AppLoader.tsx
- [GIT+ADA] src/components/common/DatePickerFields.tsx
- [GIT+ADA] src/components/common/SearchableSelect.tsx
- [GIT+ADA] src/components/common/SignaturePad.tsx
- [GIT+ADA] src/components/layout/Sidebar.tsx
- [GIT+ADA] src/constants/incident-categories.ts
- [GIT+ADA] src/constants/inventory.ts
- [GIT+ADA] src/constants/options.ts
- [GIT+ADA] src/features/admin/adminHelpers.ts
- [GIT+ADA] src/features/admin/AdminSection.tsx
- [GIT+ADA] src/features/admin/observationPdf.ts
- [GIT+ADA] src/features/admin/pengaturan/BackupPage.tsx
- [GIT+ADA] src/features/admin/pengaturan/LogAktivitasPage.tsx
- [GIT+ADA] src/features/admin/pengaturan/ManajemenAkunOrangTuaPage.tsx
- [GIT+ADA] src/features/admin/pengaturan/ManajemenPetugasPage.tsx
- [GIT+ADA] src/features/admin/rekap-bulanan/rekapPdf.ts
- [GIT+ADA] src/features/admin/rekap-monitoring/BeritaAcaraPage.tsx
- [GIT+ADA] src/features/admin/rekap-monitoring/BillingPage.tsx
- [GIT+ADA] src/features/admin/rekap-monitoring/KehadiranAnakPage.tsx
- [GIT+ADA] src/features/admin/rekap-monitoring/KehadiranPetugasPage.tsx
- [GIT+ADA] src/features/admin/rekap-monitoring/ObservasiAnakPage.tsx
- [GIT+ADA] src/features/admin/staffAttendancePdf.ts
- [GIT+ADA] src/features/auth/LoginPage.tsx
- [GIT+ADA] src/features/parent/parent-portal.css
- [GIT+ADA] src/features/parent/ParentPortalSection.tsx
- [GIT+ADA] src/features/petugas/berita-acara/BeritaAcaraPage.tsx
- [GIT+ADA] src/features/petugas/berita-acara/beritaAcaraPdf.ts
- [GIT+ADA] src/features/petugas/data-anak/DataAnakPage.tsx
- [GIT+ADA] src/features/petugas/inventori/InventoriPage.tsx
- [GIT+ADA] src/features/petugas/kehadiran/KehadiranPage.tsx
- [GIT+ADA] src/features/petugas/observasi/ObservasiPage.tsx
- [GIT+ADA] src/features/petugas/observasi/types/observation.ts
- [GIT+ADA] src/features/petugas/petugasHelpers.ts
- [GIT+ADA] src/features/petugas/PetugasSection.tsx
- [GIT+ADA] src/index.css
- [GIT+ADA] src/main.tsx
- [GIT+ADA] src/services/api.ts
- [GIT+ADA] src/types.ts
- [GIT+ADA] src/utils/auth-storage.ts
- [GIT+ADA] src/utils/browser-history.ts
- [GIT+ADA] src/utils/date.ts
- [GIT+ADA] src/utils/image.ts
- [GIT+ADA] src/utils/storage.ts
- [GIT+ADA] src/utils/useHideOnScroll.ts
- [GIT+ADA] src/utils/validators.ts
- [GIT+ADA] src/vite-env.d.ts
- [GIT+ADA] tsconfig.app.json
- [GIT+ADA] tsconfig.json
- [GIT+ADA] tsconfig.node.json
- [GIT+ADA] vite.config.ts

## Lampiran B - Inventaris File `GIT-HILANG`
- [GIT-HILANG] chrome-live-dom.txt
- [GIT-HILANG] chrome-live-err.txt
- [GIT-HILANG] chrome-local-dom.txt
- [GIT-HILANG] chrome-local-err.txt
- [GIT-HILANG] landing-live.png
- [GIT-HILANG] landing-local-fixed.png
- [GIT-HILANG] landing-local-preview.png
- [GIT-HILANG] landing-public-fixed.png
- [GIT-HILANG] landing-public-https-fixed.png
- [GIT-HILANG] server/src/scripts/check-bcrypt.ts
- [GIT-HILANG] server/src/scripts/debug-latest-log.ts
- [GIT-HILANG] server/src/scripts/debug-login.ts
- [GIT-HILANG] server/src/scripts/debug-server-integration.ts
- [GIT-HILANG] server/src/scripts/describe-children.ts
- [GIT-HILANG] server/src/scripts/drop-unused-tables.ts
- [GIT-HILANG] server/src/scripts/list-tables.ts
- [GIT-HILANG] server/src/scripts/test-connection-detailed.ts
- [GIT-HILANG] server/src/scripts/trigger-login-error.ts
- [GIT-HILANG] server/src/scripts/verify-privacy.ts
- [GIT-HILANG] src/features/parent/billing/BillingPage.tsx
- [GIT-HILANG] src/features/parent/daily-logs/DailyLogsPage.tsx
- [GIT-HILANG] src/features/parent/dashboard/DashboardPage.tsx
- [GIT-HILANG] src/features/parent/gallery/GalleryPage.tsx
- [GIT-HILANG] src/features/parent/ParentSection.tsx
- [GIT-HILANG] src/features/parent/profile/ProfilePage.tsx

## Lampiran C - Inventaris File `LOKAL-BARU`
- [LOKAL-BARU] docs/_append_inventory.ps1
- [LOKAL-BARU] docs/BEDAH_PLATFORM_TPA_13_POINT_SUPER_KOMPREHENSIF.md
- [LOKAL-BARU] docs/BELAJAR_DARI_NOL_TPA.md
- [LOKAL-BARU] informasi_tpa_rumah_ceria_ubaya.txt
- [LOKAL-BARU] public/favicon-tpa-rounded.svg
- [LOKAL-BARU] public/legal/cookie-policy.html
- [LOKAL-BARU] public/legal/data-consent-form.html
- [LOKAL-BARU] public/legal/privacy-policy.html
- [LOKAL-BARU] public/legal/terms-of-service.html
- [LOKAL-BARU] src/features/admin/AdminApp.tsx
- [LOKAL-BARU] src/features/petugas/PetugasApp.tsx
     