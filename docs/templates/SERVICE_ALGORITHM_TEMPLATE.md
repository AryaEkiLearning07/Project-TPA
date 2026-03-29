# Template Bedah Service dan Algoritma

## Metadata
- Service file:
- Function:
- Dipanggil oleh endpoint:
- Input:
- Output:

## 1. Definisi Algoritma
- Tujuan fungsi:
- Data yang diolah:
- Aturan bisnis utama:

## 2. Pseudocode
```text
1.
2.
3.
```

## 3. Bedah Implementasi Detail
### 3.1 Validasi Awal
- Apa yang divalidasi:
- Error yang dikembalikan:

### 3.2 Pengolahan Data
- Normalisasi data:
- Percabangan:
- Mapping:

### 3.3 Akses Database
- Query SELECT:
- Query INSERT/UPDATE/DELETE:
- Locking (`FOR UPDATE`) jika ada:
- Transaction boundary:

### 3.4 Return Value
- Struktur output:
- Dampak ke layer atas:

## 4. Kenapa Desainnya Begini
- Kenapa query dibentuk seperti itu:
- Kenapa pakai transaction/tidak:
- Kenapa mapping/normalisasi ini dipilih:

## 5. Analisis Kompleksitas dan Kinerja
- Kompleksitas waktu:
- Kompleksitas data:
- Potensi bottleneck:

## 6. Risiko dan Celah
- Data race:
- Dirty write:
- Inconsistent state:
- Logic branch yang rawan bug:

## 7. Bukti Uji Service
| Skenario | Input | Expected | Actual | Status |
|---|---|---|---|---|
|  |  |  |  |  |

## 8. Rekomendasi Refactor
1.
2.
3.
