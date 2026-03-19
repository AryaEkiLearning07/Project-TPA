$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $projectRoot 'dev-runtime.log'

function Test-HttpReady {
  param(
    [string]$Uri,
    [int]$TimeoutSec = 5
  )
  try {
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec $TimeoutSec
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    return $false
  }
}

$frontendReady = Test-HttpReady -Uri 'http://127.0.0.1:5173'
$backendReady = Test-HttpReady -Uri 'http://127.0.0.1:4000/health'

if ($frontendReady -and $backendReady) {
  Write-Output 'TPA runtime sudah berjalan (5173 & 4000 aktif).'
  exit 0
}

if (-not ($frontendReady -and $backendReady)) {
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c cd /d `"$projectRoot`" && npm run dev >> `"$logFile`" 2>&1" `
    -WindowStyle Hidden
}

Start-Sleep -Seconds 8

$frontendReady = Test-HttpReady -Uri 'http://127.0.0.1:5173'
$backendReady = Test-HttpReady -Uri 'http://127.0.0.1:4000/health'

if (-not ($frontendReady -and $backendReady)) {
  Write-Error 'Gagal menyalakan runtime TPA. Cek dev-runtime.log.'
}

Write-Output 'TPA runtime berhasil dinyalakan.'
