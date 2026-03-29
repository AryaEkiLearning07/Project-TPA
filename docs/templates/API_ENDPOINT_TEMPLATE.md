# Template Bedah API Endpoint

## Metadata
- Endpoint:
- Method:
- Route file:
- Middleware chain:
- Service function:

## 1. Definisi Endpoint
- Tujuan endpoint:
- Aktor yang boleh akses:
- Resource yang dimanipulasi:

## 2. Kontrak Request
- Header wajib:
- Query param:
- Path param:
- Body:
- Validasi:

Contoh request:
```json
{}
```

## 3. Kontrak Response
- Response sukses:
- Response gagal:
- Kode status yang mungkin:

Contoh response sukses:
```json
{}
```

Contoh response gagal:
```json
{}
```

## 4. Urutan Eksekusi
1. Route parse request.
2. Middleware verifikasi.
3. Service dipanggil.
4. DB read/write.
5. Response dibentuk.

## 5. Interaksi dengan Database
- Tabel dibaca:
- Tabel ditulis:
- Constraint/index yang terlibat:
- Transaction dipakai: ya/tidak

## 6. Kenapa Desainnya Begini
- Alasan pemilihan method/path:
- Alasan bentuk payload:
- Alasan kode status:

## 7. Risiko
- Broken auth/role risk:
- Input abuse risk:
- Data consistency risk:
- Performance risk:

## 8. Bukti Uji API
| Skenario | Request | Expected Status | Actual Status | Status |
|---|---|---|---|---|
|  |  |  |  |  |

## 9. Rekomendasi
1.
2.
3.
