# 📋 PROPOSAL PLATFORM MANAJEMEN TAMAN PENITIPAN ANAK (TPA)

---

## 1. PENDAHULUAN

Selamat datang. Dokumen ini menyajikan gambaran lengkap mengenai **Platform Manajemen Taman Penitipan Anak (TPA)** — sebuah sistem berbasis web yang dirancang khusus untuk membantu pengelola dan petugas TPA dalam menjalankan operasional harian secara **lebih terorganisir, akurat, dan efisien**.

Platform ini menggantikan proses manual (buku catatan, lembaran kertas, perhitungan manual) menjadi satu sistem terpadu yang bisa diakses kapan saja melalui perangkat apa pun — cukup menggunakan browser di laptop, tablet, atau ponsel.

---

## 2. MASALAH YANG DISELESAIKAN

| Masalah Operasional | Solusi Platform |
|---|---|
| Catatan kehadiran anak masih di kertas, rawan hilang atau tercecer | Pencatatan kehadiran digital otomatis dengan jam dan tanggal |
| Barang bawaan anak tidak terdokumentasi dengan baik | Berita acara harian lengkap dengan foto dan daftar barang |
| Tagihan pembayaran sulit dilacak | Sistem billing otomatis dengan status LUNAS/BELUM LUNAS |
| Perkembangan anak tidak terekam secara rutin | Modul observasi harian per anak |
| Stok kebutuhan anak (kaos, baju, perlengkapan) tidak terpantau | Inventori per anak yang tercatat rapi |
| Tidak ada rekap bulanan untuk pelaporan | Rekap otomatis per bulan, bisa dicetak PDF |
| Absensi petugas tidak terkontrol | Sistem absensi datang & pulang petugas |

---

## 3. SIAPA YANG MENGGUNAKAN

Platform ini memiliki **2 jenis pengguna** dengan hak akses yang berbeda:

### 👨‍💼 Admin (Pengelola TPA)
Memiliki akses penuh untuk mengelola seluruh aspek operasional dan keuangan TPA.

### 👩‍🏫 Petugas (Pendamping Anak)
Fokus pada pencatatan aktivitas harian anak — kehadiran, berita acara, observasi, dan inventori.

---

## 4. FITUR LENGKAP

### 4.1 Fitur Petugas

#### 🕐 Absensi Petugas
- Petugas **wajib absen datang** sebelum bisa mengakses fitur operasional lainnya.
- Tercatat otomatis: jam datang, jam pulang, dan jumlah aktivitas yang dilakukan.
- Absensi pulang bisa dilakukan kapan saja sebelum akhir shift.

#### ✅ Kehadiran Anak
- Pencatatan **kedatangan dan kepulangan** anak setiap hari.
- Tersedia kolom: **Nama Pengantar, Tanda Tangan Pengantar, Nama Penjemput, Tanda Tangan Penjemput.**
- Jam datang dan jam pulang tercatat otomatis.
- Daftar anak yang sudah hadir dan belum dijemput ditampilkan terpisah.
- **Riwayat kehadiran** bisa difilter berdasarkan bulan dan jumlah data (20, 50, atau 100 per halaman), dilengkapi navigasi halaman.

#### 📝 Berita Acara Harian
- Setiap anak mendapat berita acara harian yang mencakup:
  - **Kondisi fisik** (sehat/sakit) dan **kondisi emosi** (senang/sedih) saat datang dan pulang.
  - **Foto gabungan barang bawaan** yang bisa diambil langsung dari kamera atau galeri.
  - **Daftar barang bawaan** per kategori (botol minum, tempat makan, alat mandi, tas, obat, dll.) lengkap dengan keterangan.
  - **Pesan dari orangtua** dan **pesan untuk orangtua**.
  - **Catatan tambahan** dari petugas.
- Riwayat berita acara menampilkan **thumbnail foto** yang bisa diklik untuk melihat **preview data lengkap** tanpa perlu membuka halaman baru.

#### 👁️ Observasi Harian
- Pencatatan perkembangan dan pengamatan anak setiap hari.
- Digunakan untuk mendokumentasikan aktivitas, perkembangan, dan catatan penting tentang anak.

#### 📦 Inventori / Buku Penghubung
- Mencatat **stok perlengkapan setiap anak**: kaos dalam, baju tidur, baju sore, dan lainnya.
- Saat petugas melakukan absen pulang anak, sistem **otomatis menyisipkan informasi stok** ke dalam pesan untuk orangtua, sehingga orangtua tahu perlengkapan apa yang perlu dibawa kembali.

#### 👶 Data Anak (Lihat Saja)
- Petugas dapat melihat profil anak (nama, orangtua, kontak darurat, daftar pengantar/penjemput) tetapi **tidak bisa mengubah data**.

---

### 4.2 Fitur Admin

#### 💰 Rekap Layanan & Pembayaran
Fitur utama untuk mengelola keuangan TPA:

- **Konfigurasi Tarif**: Admin bisa mengatur tarif untuk 3 jenis paket:
  - **Harian** — dihitung per hari kehadiran.
  - **2 Mingguan** — paket 10 hari, hari ke-11 s.d. 15 dihitung harian, hari ke-16 otomatis naik ke paket bulanan.
  - **Bulanan** — tarif tetap per bulan.

- **Daftar Anak Belum Lunas**: Menampilkan anak-anak yang masih memiliki tagihan, dikelompokkan berdasarkan paket. Informasi meliputi:
  - Nama anak beserta jumlah hari tunggakan (ditandai badge berwarna merah).
  - Total nominal tagihan.
  - Bisa dibuka tutup seperti akordion agar layar tetap rapi.

- **Input Pembayaran**:
  - Pilih anak → pilih nominal → pilih metode pembayaran (Cash, BCA, BRI, MANDIRI, BNI, QRIS, atau Lainnya) → lampirkan **foto bukti transfer** → simpan.
  - Sistem otomatis menghitung sisa tagihan. Jika pembayaran pas, status langsung menjadi LUNAS.

- **Daftar Anak Lunas**: Menampilkan semua anak yang sudah melunasi pembayaran, dengan:
  - Status **LUNAS** ditandai badge hijau.
  - Filter berdasarkan **bulan, kategori paket**, dan **jumlah data** yang ditampilkan.

#### 📊 Rekap Bulanan
- Ringkasan operasional per bulan dalam satu tampilan.
- Data bisa diekspor atau dicetak untuk kebutuhan pelaporan.

#### 📄 Cetak PDF
Platform mendukung **cetak dokumen PDF** untuk:
- Berita acara harian per anak.
- Rekap observasi per batch.
- Rekap absensi petugas.

#### 👥 Manajemen Petugas
- Tambah, edit, dan kelola akun petugas (nama, email, password, status aktif/nonaktif).
- Melihat daftar seluruh petugas yang terdaftar.

#### 📋 Rekap Absensi Petugas
- Melihat catatan kehadiran petugas per bulan.
- Termasuk: jam datang, jam pulang, dan jumlah aktivitas.

#### 👶 Data Anak (Kelola Penuh)
- Admin dapat **menambah, mengedit, dan menghapus** data anak.
- Data meliputi: nama lengkap, orangtua, kontak darurat, paket layanan, dan daftar pengantar/penjemput yang diizinkan.

#### 📝 Log Aktivitas
- Mencatat seluruh aktivitas yang terjadi di platform (siapa melakukan apa, kapan).
- Berguna untuk audit dan transparansi.

---

## 5. KEUNGGULAN PLATFORM

| Keunggulan | Keterangan |
|---|---|
| **Bisa diakses dari mana saja** | Cukup buka browser — tidak perlu instal aplikasi khusus |
| **Desain responsif** | Tampil baik di layar komputer, tablet, maupun ponsel |
| **Data tersimpan aman** | Seluruh data tersimpan di server, bukan di perangkat pribadi |
| **Otomatis & akurat** | Perhitungan tagihan, jam kehadiran, dan rekap dilakukan otomatis oleh sistem |
| **Tanda tangan digital** | Pengantar dan penjemput menandatangani langsung di layar |
| **Dokumentasi foto** | Barang bawaan anak difoto dan tersimpan rapi |
| **Ramah pengguna** | Dirancang sederhana agar mudah digunakan tanpa pelatihan khusus |
| **Multi-peran** | Hak akses berbeda antara Admin dan Petugas menjaga keamanan data |

---

## 6. ALUR OPERASIONAL HARIAN

```
PAGI
 ├─ Petugas login → Absen datang
 ├─ Anak datang → Petugas catat kehadiran (nama pengantar + tanda tangan)
 ├─ Petugas isi berita acara (kondisi anak, foto barang bawaan, pesan orangtua)
 └─ Petugas catat observasi harian anak

SORE
 ├─ Anak pulang → Petugas catat kepulangan (nama penjemput + tanda tangan)
 ├─ Sistem otomatis sertakan info stok perlengkapan di pesan untuk orangtua
 └─ Petugas absen pulang

ADMIN (KAPAN SAJA)
 ├─ Lihat dan kelola data pembayaran
 ├─ Cetak rekap bulanan atau berita acara
 └─ Kelola data anak dan petugas
```

---

## 7. SPESIFIKASI TEKNIS (Ringkas)

| Aspek | Detail |
|---|---|
| Jenis | Aplikasi Web (Progressive Web App) |
| Akses | Melalui browser (Chrome, Safari, Firefox, Edge) |
| Perangkat | Komputer, Tablet, Ponsel |
| Penyimpanan Data | Server terpusat (database) |
| Keamanan | Login dengan email & password per akun |
| Cetak Dokumen | Format PDF langsung dari browser |

---

## 8. PENUTUP

Platform Manajemen TPA ini hadir sebagai **solusi menyeluruh** untuk mengoperasikan Taman Penitipan Anak secara profesional dan terorganisir. Dengan mengganti proses manual menjadi digital, pengelola TPA dapat:

- ✅ **Menghemat waktu** dalam pencatatan dan pelaporan.
- ✅ **Meningkatkan akurasi** data kehadiran dan pembayaran.
- ✅ **Memberikan transparansi** kepada orangtua melalui pesan dan dokumentasi harian.
- ✅ **Mempermudah pengambilan keputusan** dengan data yang tersedia secara real-time.

Kami siap berdiskusi lebih lanjut mengenai kebutuhan spesifik dan penyesuaian yang diperlukan agar platform ini dapat sepenuhnya sesuai dengan kebutuhan operasional Bapak/Ibu.

---

> 📌 **Dokumen ini bersifat rahasia dan ditujukan hanya untuk pihak yang berkepentingan.**

---
