# Playbook Skripsi Bedah Total Platform TPA

Dokumen ini adalah panduan kerja untuk menulis skripsi sangat detail (ratusan sampai ribuan halaman) dengan fokus:
- apa yang dibangun,
- bagaimana mekanisme interaksi sistem,
- kenapa keputusan teknisnya diambil,
- risiko teknis dan validasi.

Dokumen referensi arsitektur tinggi:
- `docs/BEDAH_PLATFORM_TPA_13_POINT_SUPER_KOMPREHENSIF.md`

## 1. Prinsip Kerja Skripsi
1. Jangan tulis fitur sebagai daftar saja; tulis sebagai alur sebab-akibat.
2. Setiap klaim wajib punya bukti:
   - file kode,
   - endpoint,
   - query/tabel,
   - hasil uji.
3. Satu unit pembahasan minimum = 1 interaksi user lengkap:
   - aksi user,
   - validasi,
   - request,
   - proses service,
   - perubahan data,
   - umpan balik UI.
4. Semua halaman harus dibedah dalam 3 sumbu:
   - `Definisi`,
   - `Mekanisme`,
   - `Alasan (Kenapa)`.

## 2. Unit Analisis yang Wajib Dibedah
Gunakan struktur ini sebagai daftar kerja utama.

### 2.1 Unit UI (Screen)
Untuk setiap screen/tab/form:
1. Tujuan bisnis layar.
2. Komponen UI yang tampil.
3. State lokal.
4. Event handler.
5. Kondisi loading/error/empty/success.
6. Validasi input di frontend.
7. Panggilan API yang dipicu.
8. Dampak ke state global/refresh data.

### 2.2 Unit Interaksi
Untuk setiap tombol/aksi:
1. Trigger (click/submit/change).
2. Guard condition (disabled, role, checked-in gate).
3. Payload yang dibentuk.
4. Endpoint yang dipanggil.
5. Mapping response ke UI.
6. Pesan sukses/gagal ke user.

### 2.3 Unit API Endpoint
Untuk setiap endpoint:
1. Method + path.
2. Middleware chain.
3. Kontrak request (field wajib/opsional).
4. Kontrak response sukses/gagal.
5. Error branch (401/403/404/409/422/500).
6. Service function yang dipanggil.
7. Tabel yang dibaca/ditulis.

### 2.4 Unit Service/Algoritma
Untuk setiap service function:
1. Input dan precondition.
2. Urutan proses.
3. Percabangan logika.
4. Transaction boundary (`BEGIN/COMMIT/ROLLBACK`).
5. Data race risk dan lock strategy (`FOR UPDATE` bila ada).
6. Kompleksitas dan tradeoff.

### 2.5 Unit Data/Database
Untuk tiap tabel:
1. Tujuan tabel.
2. Relasi (FK/index/unique).
3. Sumber data (endpoint mana yang menulis).
4. Konsumen data (endpoint/UI mana yang membaca).
5. Risiko inkonsistensi dan mitigasi.

## 3. Pemetaan Prioritas Penulisan
Urutan ini dipilih agar Anda cepat paham sistem dari akar.

### Fase A - Fondasi Identitas dan Akses
1. Login, logout, auth/me.
2. Cookie/session lifecycle.
3. Role-based access.
4. Gate absensi petugas.

### Fase B - Operasional Harian
1. Data Anak.
2. Kehadiran Anak.
3. Berita Acara.
4. Observasi.
5. Inventori.
6. Buku Komunikasi.

### Fase C - Kanal Orang Tua
1. Register parent by code.
2. Link child by code.
3. Parent dashboard, daily logs, billing view.
4. Parent message ke attendance.

### Fase D - Kontrol Admin
1. Manajemen petugas.
2. Manajemen akun orang tua.
3. Rekap kehadiran/observasi/insiden.
4. Log aktivitas.
5. Backup.

### Fase E - Keuangan
1. Tarif layanan.
2. Billing summary/history.
3. Create period/payment/refund.
4. Confirm upgrade 2-mingguan ke bulanan.
5. Arrears dan overpayment.

## 4. Inventaris Tampilan yang Harus Ditulis
Daftar ini dari kode saat ini.

### 4.1 Petugas
Sumber: `src/features/petugas/petugasHelpers.ts`
- `kehadiran`
- `berita-acara`
- `observasi`
- `data-anak`
- `inventori`

### 4.2 Admin
Sumber: `src/features/admin/adminHelpers.ts`
- Sidebar:
  - `monitoring`
  - `data-anak`
  - `settings`
- Monitoring tab:
  - `kehadiran-anak`
  - `observasi-anak`
  - `berita-acara`
  - `kehadiran-petugas`
  - `layanan`
- Settings tab:
  - `petugas`
  - `orang-tua`
  - `logs`
  - `backup`

### 4.3 Orang Tua
Sumber: `src/features/parent/ParentPortalSection.tsx`
- `dashboard`
- `daily-logs`
- `billing`
- `profile`
- `inventory`

## 5. Metode Menulis Satu Bab Interaksi (Format Tetap)
Gunakan urutan ini untuk setiap sub-bab agar konsisten:
1. Latar masalah.
2. Definisi fitur.
3. Aktor dan hak akses.
4. Alur utama (main success flow).
5. Alur alternatif (error/edge case).
6. Diagram interaksi (opsional: sequence).
7. Analisis kode frontend.
8. Analisis route + middleware.
9. Analisis service + query.
10. Dampak ke data.
11. Risiko dan celah.
12. Rekomendasi perbaikan.
13. Bukti uji (manual test case).

## 6. Strategi Membuat Skripsi Sangat Panjang Tanpa Kehilangan Kualitas
1. Terapkan aturan: 1 interaksi = 3 sampai 10 halaman.
2. Untuk tiap screen, minimal bedah:
   - open page,
   - load data,
   - create,
   - update,
   - delete,
   - filter/search/download (kalau ada).
3. Tulis satu tabel traceability per bab:
   - `UI action -> endpoint -> service -> tabel -> output`.
4. Simpan semua bukti uji di lampiran:
   - skenario,
   - input,
   - output aktual,
   - hasil valid/tidak valid.
5. Pisahkan narasi utama dan lampiran bukti agar bacaan tetap terstruktur.

## 7. Daftar Artefak Dokumen yang Harus Dibuat
Gunakan folder `docs/thesis/` untuk hasil detail.

Struktur disarankan:
1. `docs/thesis/00_MASTER_INDEX.md`
2. `docs/thesis/01_AUTH/`
3. `docs/thesis/02_PETUGAS/`
4. `docs/thesis/03_ADMIN/`
5. `docs/thesis/04_PARENT/`
6. `docs/thesis/05_BILLING/`
7. `docs/thesis/06_SECURITY/`
8. `docs/thesis/07_TESTING/`
9. `docs/thesis/08_TRACEABILITY/`
10. `docs/thesis/99_APPENDIX/`

## 8. Template yang Harus Dipakai
Gunakan template berikut agar semua bab seragam:
- `docs/templates/SCREEN_INTERACTION_TEMPLATE.md`
- `docs/templates/API_ENDPOINT_TEMPLATE.md`
- `docs/templates/SERVICE_ALGORITHM_TEMPLATE.md`
- `docs/templates/TRACEABILITY_MATRIX_TEMPLATE.md`

## 9. Checklist Kualitas Sebelum Bab Dianggap Selesai
1. Semua interaksi utama di screen sudah dibahas.
2. Semua endpoint yang disentuh screen sudah dipetakan.
3. Semua field input penting sudah dianalisis validasinya.
4. Error state UI dan error response API sudah ditulis.
5. Ada analisis kenapa desain sekarang dipilih.
6. Ada saran teknis perbaikan.
7. Ada bukti pengujian.

## 10. Cara Pakai Playbook Ini Secara Harian
1. Pilih 1 screen.
2. Isi `SCREEN_INTERACTION_TEMPLATE`.
3. Untuk setiap API yang dipanggil screen itu, isi `API_ENDPOINT_TEMPLATE`.
4. Untuk setiap service yang dipanggil endpoint, isi `SERVICE_ALGORITHM_TEMPLATE`.
5. Rekap ke `TRACEABILITY_MATRIX_TEMPLATE`.
6. Ulang sampai semua screen selesai.

Dengan pola ini, Anda tidak akan kehabisan bahan tulisan dan kualitas analisis tetap konsisten.
