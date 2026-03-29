# Belajar Platform TPA Dari Nol (Untuk yang Belum Paham Coding)

Dokumen ini dibuat untuk kamu yang merasa:
- belum paham coding,
- bingung baca file teknis,
- ingin paham **apa, bagaimana, kenapa** secara bertahap.

Kalau dokumen 13 poin terasa berat, **mulai dari dokumen ini dulu**.

---

## Cara Pakai Dokumen Ini
Aturan penting:
1. Jangan baca semua sekaligus.
2. Kerjakan 1 sesi per hari (30-60 menit).
3. Tiap sesi harus menghasilkan catatan 1 halaman.
4. Fokus ke 3 pertanyaan:
   - **Apa** fungsi bagian ini?
   - **Bagaimana** alurnya berjalan?
   - **Kenapa** dibuat seperti itu?

---

## Peta Super Sederhana Sistem (Versi Manusia)
Bayangkan platform ini seperti restoran:
- **Frontend** = ruang kasir/tempat pelanggan lihat menu.
- **Backend** = dapur yang memproses pesanan.
- **Database** = gudang/lemari catatan.

Alur umum:
1. User klik/isi form di frontend.
2. Frontend kirim request ke backend (`/api/v1/...`).
3. Backend cek aturan (login? role? validasi?).
4. Kalau valid, backend baca/tulis ke database.
5. Backend kirim hasil ke frontend.
6. Frontend menampilkan hasil ke user.

---

## Kamus Istilah Wajib (Sangat Dasar)
- `Frontend`: tampilan yang dilihat user.
- `Backend`: logika server.
- `API`: jalur kromunikasi frontend <-> backend.
- `Route`: alamat endpoint API.
- `Service`: tempat logika bisnis utama.
- `Middleware`: “satpam” sebelum masuk route.
- `Session`: tanda user masih login.
- `Role`: hak akses (`ADMIN`, `PETUGAS`, `ORANG_TUA`).
- `CRUD`: create, read, update, delete data.

---

## Flowchart Platform TPA (Menyeluruh dan Sangat Komprehensif)
Tujuan section ini: memberi peta algoritma lengkap dari startup, login, akses role, alur request, sampai billing.

### 1) Master Flow End-to-End Platform
```mermaid
flowchart TD
  A[User buka aplikasi] --> B{Session lokal ada?}
  B -- Tidak --> C[Halaman login]
  B -- Ya --> D[GET /api/v1/auth/me]
  D --> E{Session valid?}
  E -- Tidak --> C
  E -- Ya --> F[Masuk dashboard sesuai role]

  C --> G[POST /api/v1/auth/login]
  G --> H[Auth route]
  H --> I[Auth service]
  I --> J{Login sukses?}
  J -- Tidak --> K[401 atau 429]
  K --> C
  J -- Ya --> L[Buat session + activity log]
  L --> M[Set cookie dan kirim user profile]
  M --> F

  F --> N{Role user}
  N -- ADMIN --> O[AdminSection]
  N -- PETUGAS --> P[PetugasSection]
  N -- ORANG_TUA --> Q[ParentPortalSection]

  O --> R[Aksi fitur]
  P --> R
  Q --> R

  R --> S[Call API /api/v1]
  S --> T[Middleware auth role policy]
  T --> U{Lolos validasi?}
  U -- Tidak --> V[Response error ke UI]
  U -- Ya --> W[Route -> Service -> DB]
  W --> X[Response sukses]
  X --> Y[UI update state dan tampilan]
```

### 2) Flowchart Algoritma Login + Session + Routing Role
```mermaid
flowchart TD
  A[Input email password loginPreference] --> B[Validasi format dasar]
  B --> C{Input valid?}
  C -- Tidak --> D[422 validation error]
  C -- Ya --> E[Cek login attempts dan lockout]
  E --> F{Sedang lockout?}
  F -- Ya --> G[429 tunggu lockout habis]
  F -- Tidak --> H[Tentukan urutan auth by loginPreference]

  H --> I[Coba path parent]
  I --> J{Parent match dan password benar?}
  J -- Ya --> K[Role ORANG_TUA]
  J -- Tidak --> L[Coba path staff admin]
  L --> M{Staff match dan password benar?}
  M -- Tidak --> N[Tambah failed attempts + catat LOGIN FAILED]
  N --> O[401 unauthorized]
  M -- Ya --> P[Map role ke ADMIN atau PETUGAS]
  K --> Q[Revoke session lama user]
  P --> Q

  Q --> R[Generate raw token acak]
  R --> S[Hash token dan simpan ke auth_sessions]
  S --> T[Catat LOGIN SUCCESS di activity log]
  T --> U[Set httpOnly cookie]
  U --> V[Frontend panggil auth/me]
  V --> W{Role hasil auth/me}
  W -- ADMIN --> X[Redirect ke dashboard admin]
  W -- PETUGAS --> Y[Redirect ke dashboard petugas]
  W -- ORANG_TUA --> Z[Redirect ke portal orang tua]
```

### 3) Flowchart Algoritma Request Fitur (Semua Modul)
```mermaid
flowchart TD
  A[User klik submit filter simpan hapus] --> B[Frontend validate form]
  B --> C{Validasi frontend lolos?}
  C -- Tidak --> D[Tampilkan error field]
  C -- Ya --> E[Bentuk payload request]
  E --> F[HTTP request ke endpoint]
  F --> G[Global rate limit dan size guard]
  G --> H[Route menerima request]
  H --> I[requireAuth]
  I --> J{Token valid?}
  J -- Tidak --> K[401]
  J -- Ya --> L[requireRoles]
  L --> M{Role diizinkan?}
  M -- Tidak --> N[403]
  M -- Ya --> O{Butuh gate check in petugas?}
  O -- Ya --> P[requirePetugasCheckedIn]
  P --> Q{Sudah check in?}
  Q -- Tidak --> R[403 attendanceRequired]
  Q -- Ya --> S[Lanjut]
  O -- Tidak --> S[Lanjut]

  S --> T[Validasi payload backend]
  T --> U{Payload valid?}
  U -- Tidak --> V[422]
  U -- Ya --> W[Panggil service bisnis]
  W --> X{Perlu transaction?}
  X -- Ya --> Y[BEGIN -> query -> COMMIT atau ROLLBACK]
  X -- Tidak --> Z[Query normal]
  Y --> AA[Audit log bila aksi sensitif]
  Z --> AA
  AA --> AB[Format response JSON]
  AB --> AC[Frontend mapping ke state]
  AC --> AD[UI render sukses atau notifikasi]

  K --> AE[Frontend tangani error]
  N --> AE
  R --> AE
  V --> AE
```

### 4) Flowchart Algoritma Operasional Petugas
```mermaid
flowchart TD
  A[Petugas buka dashboard] --> B[GET staff-attendance status]
  B --> C{Sudah check in hari ini?}
  C -- Tidak --> D[Tampilkan gate absensi]
  D --> E[Petugas minta admin check in]
  C -- Ya --> F[Menu operasional terbuka]

  F --> G{Pilih modul}
  G -- Kehadiran --> H[CRUD attendance]
  G -- Berita Acara --> I[CRUD incidents barang bawaan]
  G -- Observasi --> J[CRUD observation header detail]
  G -- Data Anak --> K[CRUD child profile]
  G -- Inventori --> L[CRUD supply inventory]

  H --> M[Simpan ke DB + response]
  I --> M
  J --> M
  K --> M
  L --> M
  M --> N[Refresh list dan status UI]
```

### 5) Flowchart Algoritma Parent Portal
```mermaid
flowchart TD
  A[Orang tua buka parent portal] --> B{Sudah punya akun?}
  B -- Belum --> C[Isi register + registration code]
  C --> D[POST register parent]
  D --> E{Code valid dan belum dipakai?}
  E -- Tidak --> F[Error code invalid expired used]
  E -- Ya --> G[Buat user parent + link ke child]
  G --> H[Login parent]

  B -- Sudah --> H[Login parent]
  H --> I[Verifikasi session parent]
  I --> J{Valid?}
  J -- Tidak --> H
  J -- Ya --> K[Load dashboard daily logs billing profile inventory]
  K --> L[Parent hanya lihat child yang ter-link]
  L --> M[Optional kirim pesan parent di attendance notes]
```

### 6) Flowchart Algoritma Billing Admin (Paling Kompleks)
```mermaid
flowchart TD
  A[Admin buka menu layanan billing] --> B[Ambil rates periods attendance payments refunds]
  B --> C[Loop setiap child aktif]
  C --> D[Hitung attendance dalam period]
  D --> E{Tipe paket}

  E -- Harian --> F[due = hadir x tarif harian]
  E -- Dua Mingguan --> G[due = base 10 hari + extra harian sampai batas]
  G --> H{Kriteria upgrade bulanan terpenuhi?}
  H -- Ya --> I[Flag upgrade auto atau tunggu confirm]
  H -- Tidak --> J[Tetap dua mingguan]
  E -- Bulanan --> K[due = tarif bulanan period]

  F --> L[Hitung paid dan refund]
  I --> L
  J --> L
  K --> L
  L --> M[outstanding = due - paid + refund adjustment]
  M --> N{Outstanding > 0?}
  N -- Ya --> O[Status menunggak]
  N -- Tidak --> P{Overpayment > 0?}
  P -- Ya --> Q[Status kelebihan bayar]
  P -- Tidak --> R[Status lancar]

  O --> S[Simpan summary child]
  Q --> S
  R --> S
  S --> T[Agregasi total semua child]
  T --> U[Tampilkan billing summary dan history]
```

### Cara Baca Flowchart Ini
1. Mulai dari diagram 1 dulu agar paham gambaran besar.
2. Lanjut diagram 2 untuk paham autentikasi dan session.
3. Lanjut diagram 3 untuk paham pola semua endpoint.
4. Dalami diagram 4 sampai 6 sesuai modul yang sedang dipelajari harian.
5. Saat membaca kode, cocokkan node flowchart dengan file route/service terkait.

---

## Sesi 1 (Hari 1): Pahami Login Dulu
Tujuan: paham satu alur lengkap dari UI sampai DB.

File yang dibaca:
1. `src/App.tsx`
2. `src/features/auth/LoginPage.tsx`
3. `src/services/api.ts` (bagian `authApi`)
4. `server/src/routes/auth-routes.ts`
5. `server/src/services/auth-service.ts`

### Yang Harus Kamu Catat
#### A. Apa
- Login itu untuk apa di sistem ini?

#### B. Bagaimana (langkah urut)
Contoh format:
1. User isi email/password di halaman login.
2. Frontend panggil `authApi.login`.
3. Request masuk ke route `/auth/login`.
4. Backend validasi email/password.
5. Backend buat session.
6. Frontend simpan session dan tampilkan dashboard sesuai role.

#### C. Kenapa
- Kenapa butuh session?
- Kenapa ada role?
- Kenapa route dan service dipisah?

---

## Sesi 2 (Hari 2): Pahami Role dan Hak Akses
File:
1. `server/src/middlewares/auth-middleware.ts`
2. `server/src/app.ts` (bagian mount route)

Fokus:
- Bedakan `requireAuth`, `requireRoles`, `requirePetugasCheckedIn`.
- Jawab: kenapa petugas harus check-in dulu?

Output catatan:
- Tabel kecil:
  - Middleware
  - Fungsinya
  - Kapan dipakai

---

## Sesi 3 (Hari 3): Pahami 1 Fitur Operasional (Kehadiran)
File:
1. `src/features/petugas/kehadiran/KehadiranPage.tsx`
2. `src/services/api.ts` (bagian `attendanceApi`)
3. `server/src/routes/attendance-routes.ts`
4. `server/src/services/attendance-service.ts`

Tugas:
- Cari data input apa saja.
- Cari validasi apa saja.
- Cari data disimpan ke tabel apa.

Output:
- Diagram sederhana:
  - Form -> API -> Route -> Service -> DB -> Response

---

## Sesi 4 (Hari 4): Pahami Data Anak
File:
1. `src/features/petugas/data-anak/DataAnakPage.tsx`
2. `server/src/routes/child-routes.ts`
3. `server/src/services/child-service.ts`

Fokus:
- Siapa boleh lihat data penuh?
- Siapa data-nya dimasking?
- Kenapa dimasking?

---

## Sesi 5 (Hari 5): Pahami Parent Portal
File:
1. `src/features/parent/ParentPortalSection.tsx`
2. `server/src/routes/parent-routes.ts`
3. `server/src/services/parent-portal-service.ts`

Fokus:
- Orang tua bisa lihat data apa?
- Orang tua tidak bisa akses apa?
- Mekanisme link anak via registration code.

---

## Sesi 6 (Hari 6): Pahami Billing (Bagian Paling Kompleks)
File:
1. `src/features/admin/rekap-monitoring/BillingPage.tsx`
2. `server/src/routes/admin-routes.ts` (endpoint billing)
3. `server/src/services/service-billing-service.ts`

Fokus:
- Input billing period/payment/refund.
- Bagaimana status tagihan dibentuk.
- Kenapa ada `period` dan `arrears`.

Catatan:
- Ini bagian sulit. Tidak apa-apa kalau perlu 2-3 hari.

---

## Template Catatan Harian (Wajib Diisi)
Copy template ini tiap sesi:

```md
## Modul: <nama modul>

### Apa
- ...

### Bagaimana (langkah urut)
1. ...
2. ...
3. ...

### Kenapa
- ...

### Risiko yang saya temukan
- ...

### Yang belum saya paham
- ...
```

---

## Cara Baca Kode Tanpa Panik
Saat buka file:
1. Cari `export default function` / `const ... =`.
2. Cari fungsi yang dipanggil saat klik submit (`handleSubmit`, `onSave`, dst).
3. Lacak panggilan API (`...Api...`).
4. Cari route backend yang cocok.
5. Cari service backend yang dipanggil route.

Kalau mentok:
- Jangan lanjut ke file lain.
- Tulis “yang saya belum paham” secara spesifik 1 kalimat.

---

## Target Realistis 14 Hari
Hari 1-3: login, role, kehadiran.  
Hari 4-6: data anak, berita acara, observasi.  
Hari 7-9: parent portal dan registration code.  
Hari 10-12: billing dan backup.  
Hari 13-14: rangkum semua jadi 1 dokumen presentasi.

---

## Kalimat Presentasi Siap Pakai
Pakai pola ini saat ditanya:
1. “Fitur ini tujuannya adalah ...” (**Apa**)
2. “Alurnya dimulai dari ... lalu ... hingga ...” (**Bagaimana**)
3. “Pendekatan ini dipilih karena ... dengan tradeoff ...” (**Kenapa**)

---

## Penutup
Kamu tidak gagal karena belum paham.  
Yang penting sekarang: ubah dari “AI membangun” menjadi “kamu menguasai”.

Mulai dari 1 alur kecil, ulangi tiap hari, dan catat dengan format yang konsisten.
