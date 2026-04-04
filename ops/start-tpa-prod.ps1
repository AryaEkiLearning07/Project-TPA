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

function Test-FrontendHostReady {
  param(
    [int]$Port,
    [string]$HostHeader
  )
  try {
    $response = Invoke-WebRequest `
      -Uri "http://127.0.0.1:$Port/" `
      -Headers @{ Host = $HostHeader } `
      -UseBasicParsing `
      -TimeoutSec 5
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
$adminFrontendReady = Test-FrontendReady -Port $backendPortNumber
$landingFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'tparumahceria.my.id'
$parentFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'parent.tparumahceria.my.id'

if ($backendReady -and (-not $adminFrontendReady -or -not $landingFrontendReady -or -not $parentFrontendReady)) {
  Write-Output 'Backend aktif, tetapi salah satu frontend belum terlayani. Menyalakan ulang backend production...'
  foreach ($pidValue in (Get-ListeningProcessIds -Port $backendPortNumber)) {
    try {
      Stop-Process -Id $pidValue -Force -ErrorAction Stop
    } catch {
    }
  }
  Start-Sleep -Seconds 2
  $backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
  $adminFrontendReady = Test-FrontendReady -Port $backendPortNumber
  $landingFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'tparumahceria.my.id'
  $parentFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'parent.tparumahceria.my.id'
}

if ($adminFrontendReady -and $landingFrontendReady -and $parentFrontendReady -and $backendReady) {
  try {
    & (Join-Path $PSScriptRoot 'ensure-cloudflare-tunnel.ps1') -Quiet | Out-Null
  } catch {
    Write-Warning "Gagal menjalankan auto-recovery Cloudflare Tunnel: $($_.Exception.Message)"
  }
  Write-Output "TPA runtime production sudah berjalan (port $backendPortNumber aktif)."
  exit 0
}

if (-not $SkipBuild) {
  Write-Output 'Menjalankan build frontend admin/petugas...'
  Push-Location $projectRoot
  try {
    npm run build
  } finally {
    Pop-Location
  }

  Write-Output 'Menjalankan build landing page...'
  Push-Location $projectRoot
  try {
    npm run build:landing
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
$adminFrontendReady = Test-FrontendReady -Port $backendPortNumber
$landingFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'tparumahceria.my.id'
$parentFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'parent.tparumahceria.my.id'

if (-not ($adminFrontendReady -and $landingFrontendReady -and $parentFrontendReady -and $backendReady)) {
  Write-Error "Gagal menyalakan runtime production TPA. Cek $logFile."
}

try {
  & (Join-Path $PSScriptRoot 'ensure-cloudflare-tunnel.ps1') -Quiet | Out-Null
} catch {
  Write-Warning "Gagal menjalankan auto-recovery Cloudflare Tunnel: $($_.Exception.Message)"
}

Write-Output "TPA runtime production berhasil dinyalakan (landing + app + api:$backendPortNumber)."
