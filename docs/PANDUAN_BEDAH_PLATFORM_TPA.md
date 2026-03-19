# Panduan Bedah Platform TPA (Untuk Belajar + Presentasi Algoritma Pemrograman)

Dokumen ini dibuat khusus agar Anda bisa:
1. Membongkar isi program secara runtut.
2. Memahami alur logika dari UI sampai database.
3. Menjelaskan pertanggungjawaban teknis saat presentasi.

---

## 1) Gambaran Sistem dalam 1 Menit

Platform ini adalah aplikasi manajemen TPA berbasis:
1. Frontend: React + TypeScript + Vite (`src/`).
2. Backend: Express + TypeScript + MySQL (`server/src/`).
3. Data: kombinasi tabel relasional + beberapa data JSON di `app_meta`.

Flow umum:
1. User login.
2. Sistem validasi sesi + role (`ADMIN` / `PETUGAS`).
3. Role menentukan dashboard yang dibuka.
4. Dashboard memanggil API sesuai fitur.
5. API memproses bisnis logic di `services/*` lalu simpan/ambil dari MySQL.

---

## 2) Peta Folder yang Wajib Dipahami Dulu

## Frontend (`src`)
1. `App.tsx`: gerbang login, validasi sesi, routing berdasarkan role.
2. `services/api.ts`: semua HTTP client endpoint frontend.
3. `features/petugas/PetugasSection.tsx`: orkestrasi fitur petugas.
4. `features/admin/AdminSection.tsx`: orkestrasi fitur admin.
5. `features/*Page.tsx`: halaman form/tabel per domain (kehadiran, berita acara, observasi, data anak, inventori, rekap).
6. `utils/auth-storage.ts`: simpan/muat token sesi di localStorage.
7. `utils/validators.ts`: validasi input form.

## Backend (`server/src`)
1. `index.ts`: startup server + cek DB + ensure schema penting.
2. `app.ts`: konfigurasi Express, CORS, mount routes.
3. `routes/*.ts`: endpoint HTTP.
4. `middlewares/auth-middleware.ts`: autentikasi, role check, dan gate absensi petugas.
5. `services/*.ts`: business logic + query database.
6. `config/database.ts`: koneksi pool MySQL.
7. `config/env.ts`: variabel environment.

## Operasional
1. `ops/*.ps1`: script start/restart/status/autostart runtime di Windows.

---

## 3) Alur Eksekusi Program (Startup)

1. Jalankan `npm run dev` di root.
2. Script root menjalankan 2 proses paralel:
   - Vite frontend (port 5173).
   - Backend (`npm run dev --prefix server`, default port 4000).
3. `vite.config.ts` mem-proxy:
   - `/api/v1` ke `http://localhost:4000`.
   - `/uploads` ke `http://localhost:4000`.
4. Saat backend start:
   - Cek koneksi DB.
   - Ensure schema auth.
   - Ensure schema tarif layanan.
   - Ensure schema absensi petugas.

---

## 4) Alur Login dan Session (Poin Presentasi Penting)

## Frontend (`App.tsx`)
1. Coba baca session dari localStorage (`tpa_auth_session`).
2. Jika tidak ada atau expired, tampilkan `LoginPage`.
3. Jika ada, call `GET /api/v1/auth/me` untuk verifikasi token.
4. Jika valid:
   - role `PETUGAS` -> `PetugasSection`.
   - role `ADMIN` -> `AdminSection`.
5. Logout menghapus session lokal walaupun request logout gagal (fail-safe di client).

## Backend (`auth-service.ts`)
1. Login pakai email + password hash verification.
2. Rate-limit login:
   - maksimum 3 gagal.
   - lock 30 detik.
3. Jika sukses:
   - buat session token di tabel `auth_sessions`.
   - tulis log aktivitas `LOGIN SUCCESS`.
4. Jika gagal:
   - update `auth_login_attempts`.
   - tulis log aktivitas `LOGIN FAILED`.

## Pseudocode ringkas
```text
if token_local tidak ada:
  tampilkan login
else:
  validasi token ke /auth/me
  jika valid -> masuk dashboard sesuai role
  jika tidak valid -> hapus token + kembali login
```

---

## 5) Alur Role dan Otorisasi

## Role utama
1. `ADMIN`
2. `PETUGAS`

## Middleware utama backend
1. `requireAuth`: wajib token valid.
2. `requireRoles(...)`: filter role.
3. `requirePetugasCheckedIn`: untuk role petugas, wajib sudah check-in hari ini sebelum akses fitur operasional.

## Catatan implementasi saat ini
Endpoint `children`, `supply-inventory`, `parent-accounts`, `app-data` sudah diproteksi auth/role/check-in petugas.

Endpoint CRUD `attendance`, `incidents`, `observations`, `communications` saat ini belum dipasang middleware auth di route file. Ini bisa Anda sebut sebagai area hardening keamanan berikutnya.

---

## 6) Fitur Petugas: Cara Menjelaskan Secara Algoritmik

`PetugasSection.tsx` adalah orchestrator.

## Konsep utama
1. Petugas harus check-in dulu.
2. Setelah check-in, menu operasional terbuka.
3. Data dimuat per segmen sesuai menu (lazy loading), bukan semuanya sekaligus.
4. CRUD disimpan ke backend via API per domain.

## Menu operasional
1. Kehadiran.
2. Berita Acara.
3. Observasi.
4. Inventori.
5. Data Anak (dipakai sebagai data master, bisa diakses dari fitur lain).

## Algoritma load data per menu
```text
tentukan segmen data yg dibutuhkan menu
jika segmen belum pernah dimuat:
  fetch paralel API yang relevan
  normalize data
  merge ke state appData
```

## Domain petugas yang wajib dipahami
1. Data Anak: CRUD profil anak.
2. Kehadiran: form datang/pulang + tanda tangan + kondisi fisik/emosi.
3. Berita Acara: barang bawaan + kondisi + pesan orang tua.
4. Observasi: item observasi per kategori.
5. Inventori: stok per anak + update jumlah.

---

## 7) Fitur Admin: Cara Menjelaskan Secara Algoritmik

`AdminSection.tsx` punya 2 sidebar:
1. Rekap & Monitoring.
2. Pengaturan.

## Subtab Rekap & Monitoring
1. Kehadiran Anak (rekap bulanan).
2. Observasi Tiap Anak (dengan export PDF).
3. Berita Acara (dengan export PDF).
4. Kehadiran Petugas (rekap + export PDF).
5. Rekap Layanan (tarif + billing + tunggakan + pembayaran + refund + CSV recap).

## Subtab Pengaturan
1. Kelola akun petugas.
2. Log aktivitas (search + cursor pagination).
3. Backup database (download JSON).

## Algoritma billing (inti yang bagus untuk presentasi)
1. Ambil snapshot anak, attendance, period billing, transaction, rates.
2. Hitung attendance dalam periode.
3. Hitung due amount berdasarkan paket:
   - harian: `hari_hadir * tarif_harian`.
   - 2-mingguan: base 10 hari + charge harian tambahan max 5 hari.
   - jika attendance capai 16 hari dan base 2-mingguan belum lunas, bisa auto/confirm upgrade ke bulanan.
4. Hitung paid, outstanding, overpayment.
5. Bentuk status (`aktif-lancar`, `aktif-menunggak`, dll).

---

## 8) Peta Endpoint API (Ringkas untuk Slide)

## Auth
1. `POST /api/v1/auth/login`
2. `POST /api/v1/auth/logout`
3. `GET /api/v1/auth/me`

## Staff attendance petugas
1. `GET /api/v1/staff-attendance/status`
2. `POST /api/v1/staff-attendance/check-in`
3. `POST /api/v1/staff-attendance/check-out`

## App data
1. `GET /api/v1/app-data`
2. `PUT /api/v1/app-data`
3. `POST /api/v1/app-data/import`

## Admin
1. `GET/POST/PUT/DELETE /api/v1/admin/staff-users`
2. `GET /api/v1/admin/activity-logs`
3. `GET/PUT /api/v1/admin/service-rates`
4. `GET /api/v1/admin/staff-attendance/recap`
5. `GET /api/v1/admin/service-billing/summary`
6. `GET /api/v1/admin/service-billing/history/:childId`
7. `POST /api/v1/admin/service-billing/periods`
8. `POST /api/v1/admin/service-billing/payments`
9. `POST /api/v1/admin/service-billing/refunds`
10. `POST /api/v1/admin/service-billing/confirm-upgrade`
11. `GET /api/v1/admin/backup`

## Domain data harian
1. `/api/v1/children`
2. `/api/v1/attendance`
3. `/api/v1/incidents`
4. `/api/v1/observations`
5. `/api/v1/communications`
6. `/api/v1/supply-inventory`
7. `/api/v1/parent-accounts`

---

## 9) Model Data dan Penyimpanan

## Tabel relasional utama
1. `children`
2. `attendance_records`
3. `incident_reports`
4. `communication_books`
5. `users`
6. `auth_sessions`
7. `activity_logs`
8. `parent_profiles`
9. `parent_accounts`
10. `staff_daily_attendance`
11. `service_package_rates`
12. `service_billing_settings`
13. `service_billing_periods`
14. `service_billing_transactions`

## Data JSON di `app_meta`
1. `supply_inventory_json` (inventori).
2. `observation_records_json` (observasi).

Konsekuensi desain ini:
1. Operasi inventori/observasi memakai read-modify-write JSON blob.
2. Perlu transaction lock (`FOR UPDATE`) untuk konsistensi.
3. Ini area kandidat refactor ke tabel terpisah jika skala data membesar.

---

## 10) Cara Membongkar Kode Secara Runtut (Checklist Belajar)

Ikuti urutan ini agar tidak lompat-lompat:

1. Baca `src/App.tsx`.
   - Fokus: lifecycle login + role routing.
2. Baca `src/services/api.ts`.
   - Fokus: daftar endpoint dan kontrak data.
3. Baca `src/types.ts`.
   - Fokus: bentuk data antar layer.
4. Baca `server/src/app.ts`.
   - Fokus: route mana dipasang, middleware mana aktif.
5. Baca route file domain (`server/src/routes/*`).
   - Fokus: endpoint, validasi awal, service yang dipanggil.
6. Baca service domain (`server/src/services/*`).
   - Fokus: query DB, aturan bisnis, transaction.
7. Baca fitur frontend per domain (`src/features/*`).
   - Fokus: form input -> validator -> save API -> update state.
8. Uji satu alur end-to-end.
   - Contoh: login petugas -> check-in -> isi kehadiran -> cek DB.
9. Ulang untuk alur admin.
   - Contoh: login admin -> lihat rekap -> catat payment billing -> cek histori.

---

## 11) Algoritma Berpikir yang Benar untuk Presentasi

Gunakan kerangka 8 langkah ini saat menjelaskan fitur apa pun.

1. Definisikan masalah.
   - Contoh: "Bagaimana sistem memastikan petugas hanya bisa input data setelah absensi datang?"
2. Definisikan input.
   - token user, role, tanggal absensi, payload form.
3. Definisikan output.
   - status akses, data tersimpan, pesan sukses/gagal.
4. Definisikan aturan bisnis.
   - role check, check-in wajib, validasi field wajib.
5. Susun langkah proses (flow algorithm).
   - validasi -> proses -> simpan -> respon.
6. Bahas edge case.
   - token expired, childId invalid, duplicate period billing, login brute force.
7. Bahas kompleksitas/efisiensi singkat.
   - lazy load per menu, pagination log, summary precompute billing.
8. Bahas reliability.
   - transaction DB, rollback saat error, audit log.

## Template jawaban (siap pakai)
1. "Input fitur ini adalah ..."
2. "Validasi pertama dilakukan di ... "
3. "Kalau valid, service ... akan ..."
4. "Data disimpan ke tabel ... / meta ..."
5. "Jika gagal, sistem mengembalikan ... dan rollback ..."
6. "Edge case yang kami tangani: ..."

---

## 12) Contoh Script Presentasi Singkat (5-7 Menit)

1. "Aplikasi ini memakai arsitektur client-server. Frontend React memanggil backend Express, lalu backend mengakses MySQL."
2. "Gerbang utama ada di `App.tsx`: sesi dibaca dari localStorage, diverifikasi ke `/auth/me`, lalu user diarahkan ke panel admin atau petugas."
3. "Untuk petugas, ada gate absensi. Secara algoritma: jika belum check-in, fitur operasional dikunci."
4. "Untuk admin, modul utama adalah monitoring dan pengaturan, termasuk billing layanan yang menghitung tagihan berdasarkan kehadiran dan paket."
5. "Bagian keamanan login menerapkan rate-limit 3 kali gagal lalu lock 30 detik, plus audit log di `activity_logs`."
6. "Semua operasi penting memakai service layer dan sebagian memakai transaksi DB untuk menjaga konsistensi."
7. "Area pengembangan berikutnya adalah hardening endpoint domain tertentu dan normalisasi data observasi/inventori dari JSON blob ke tabel."

---

## 13) Pertanyaan Dosen yang Mungkin Muncul + Arah Jawaban

1. "Kenapa pakai service layer?"
   - supaya logic bisnis terpisah dari routing HTTP dan mudah diuji.
2. "Bagaimana mencegah login brute force?"
   - tabel `auth_login_attempts`, lock sementara setelah beberapa gagal.
3. "Bagaimana menjaga konsistensi data saat update banyak tabel?"
   - gunakan transaction + rollback.
4. "Kenapa sebagian data di `app_meta`?"
   - alasan historis/kompatibilitas, saat ini masih dipertahankan; roadmap ke normalisasi tabel.
5. "Bagaimana audit aktivitas user?"
   - `writeActivityLog` mencatat aksi penting (login, backup, billing, dll).

---

## 14) Checklist Final Sebelum Presentasi

1. Jalankan aplikasi lokal dan demontrasikan 1 alur petugas + 1 alur admin.
2. Hafal peta file inti:
   - `src/App.tsx`
   - `src/services/api.ts`
   - `server/src/app.ts`
   - `server/src/routes/admin-routes.ts`
   - `server/src/services/auth-service.ts`
   - `server/src/services/service-billing-service.ts`
3. Siapkan contoh edge case:
   - password salah berulang.
   - petugas belum check-in tapi coba akses fitur.
   - period billing overlap.
4. Siapkan 1 slide "temuan teknis + saran perbaikan".

---

## 15) Alasan Pemilihan Teknologi Saat Ini

Alasan pemilihan teknologi di platform ini bersifat pragmatis: fokus ke kebutuhan operasional TPA, kecepatan pengembangan, dan kemudahan maintenance.

## Frontend stack
1. React dipilih karena pola komponen cocok untuk banyak form dan tabel operasional (kehadiran, observasi, inventori, data anak) yang perlu reusable UI.
2. TypeScript dipilih untuk menurunkan bug dari mismatch data antar komponen dan antar layer API.
3. Vite dipilih karena startup dev cepat, hot reload ringan, dan konfigurasi sederhana untuk project React modern.
4. Tailwind + CSS custom dipilih agar pembuatan UI form-heavy lebih cepat tetapi tetap bisa di-custom sesuai kebutuhan tampilan internal.

## Backend stack
1. Express dipilih karena ringan, fleksibel, dan mudah dipetakan ke pola `route -> service -> database`.
2. TypeScript di backend dipilih agar kontrak data dan validasi lebih konsisten dengan frontend.
3. `mysql2` (promise-based) dipilih karena cocok untuk query SQL langsung dan dukungan transaksi yang diperlukan untuk proses kritikal (billing, update data terkait).

## Database dan model data
1. MySQL dipilih karena kuat untuk relasi data utama (anak, absensi, akun, log aktivitas, billing) dan familiar untuk implementasi sistem informasi operasional.
2. Sebagian data masih disimpan di `app_meta` (JSON blob) untuk kompatibilitas desain lama dan percepatan pengembangan fitur tertentu.
3. Trade-off dari JSON blob: fleksibel saat awal, tetapi kurang ideal untuk query granular skala besar; karena itu sudah ditandai sebagai area refactor berikutnya.

## Media, dokumen, dan operasional
1. Multer + Sharp dipilih untuk menerima upload dan mengompres gambar agar storage dan bandwidth lebih hemat.
2. jsPDF dipilih untuk kebutuhan dokumen cetak internal (rekap, observasi, berita acara) tanpa bergantung ke service eksternal.
3. Script PowerShell di folder `ops/` dipilih karena target runtime saat ini berbasis Windows, sehingga proses start/restart/autostart lebih mudah untuk operator lokal.

## Kenapa tidak pakai arsitektur yang lebih kompleks?
1. Untuk konteks aplikasi ini, arsitektur monolith full-stack lebih cepat dibangun, lebih mudah ditelusuri, dan lebih realistis dikelola tim kecil.
2. Kompleksitas tambahan seperti microservices atau event-driven belum diperlukan karena beban sistem masih cocok ditangani satu backend terpusat.
3. Fokus utama saat ini adalah stabilitas operasional, konsistensi data, dan kemudahan pertanggungjawaban teknis saat maintenance maupun presentasi akademik.

---

## 16) Ringkasan Inti untuk Diingat

1. Ini sistem berbasis role dengan gate absensi petugas.
2. Data flow jelas: UI -> API -> route -> service -> DB -> response.
3. Modul billing adalah algoritma bisnis paling kompleks.
4. Kekuatan sistem: pemisahan layer, audit log, transaction.
5. Area peningkatan: proteksi penuh endpoint domain tertentu dan normalisasi data JSON blob.
