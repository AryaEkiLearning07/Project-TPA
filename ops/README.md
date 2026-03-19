# Operasional Runtime TPA

Semua command dijalankan dari folder project:

```powershell
cd "e:\Project TPA"
```

## Start manual

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-tpa.ps1
```

## Cek status

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\status-tpa.ps1
```

## Restart runtime

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\restart-tpa.ps1
```

## Start runtime production (build + start)

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-tpa-prod.ps1
```

Catatan:
- Runtime production sekarang melayani frontend + API lewat port `4000` (single service backend).

## Cek status runtime production

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\status-tpa-prod.ps1
```

## Restart runtime production

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\restart-tpa-prod.ps1
```

## Aktifkan auto-start via folder Startup (tanpa admin)

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\install-startup-folder.ps1
```

## Nonaktifkan auto-start via folder Startup

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\uninstall-startup-folder.ps1
```

## Aktifkan auto-start via Scheduled Task (butuh admin)

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\install-autostart.ps1
```

## Nonaktifkan Scheduled Task

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\uninstall-autostart.ps1
```

## Buat ZIP source ringan (tanpa node_modules/dist/cache)

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\create-source-zip.ps1
```

Atau via npm script:

```powershell
npm run zip:source
```
