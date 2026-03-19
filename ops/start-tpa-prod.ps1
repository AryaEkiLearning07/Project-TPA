param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $projectRoot 'runtime-prod.log'
$backendPortNumber = 4000

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

function Test-FrontendReady {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
      return $false
    }
    return $response.Content -match '<!doctype html>'
  } catch {
    return $false
  }
}

function Get-ListeningProcessIds {
  param([int]$Port)

  $regex = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $lines = netstat -ano -p TCP 2>$null
  $processIds = @()

  foreach ($line in $lines) {
    $match = [regex]::Match($line, $regex)
    if ($match.Success) {
      $processIds += [int]$match.Groups[1].Value
    }
  }

  return $processIds | Sort-Object -Unique
}

$backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
$frontendReady = Test-FrontendReady -Port $backendPortNumber

if ($backendReady -and -not $frontendReady) {
  Write-Output 'Backend aktif, tetapi frontend belum terlayani. Menyalakan ulang backend production...'
  foreach ($pidValue in (Get-ListeningProcessIds -Port $backendPortNumber)) {
    try {
      Stop-Process -Id $pidValue -Force -ErrorAction Stop
    } catch {
    }
  }
  Start-Sleep -Seconds 2
  $backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
  $frontendReady = Test-FrontendReady -Port $backendPortNumber
}

if ($frontendReady -and $backendReady) {
  Write-Output "TPA runtime production sudah berjalan (port $backendPortNumber aktif)."
  exit 0
}

if (-not $SkipBuild) {
  Write-Output 'Menjalankan build frontend...'
  Push-Location $projectRoot
  try {
    npm run build
  } finally {
    Pop-Location
  }

  Write-Output 'Menjalankan build backend...'
  Push-Location (Join-Path $projectRoot 'server')
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

if (-not $backendReady) {
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c cd /d `"$projectRoot\server`" && set SERVE_FRONTEND_FROM_BACKEND=true && npm run start >> `"$logFile`" 2>&1" `
    -WindowStyle Hidden
}

Start-Sleep -Seconds 8

$backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
$frontendReady = Test-FrontendReady -Port $backendPortNumber

if (-not ($frontendReady -and $backendReady)) {
  Write-Error "Gagal menyalakan runtime production TPA. Cek $logFile."
}

Write-Output "TPA runtime production berhasil dinyalakan (app+api:$backendPortNumber)."
