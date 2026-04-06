param(
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$targets = @(
  'tparumahceria.my.id',
  'apps.tparumahceria.my.id',
  'parent.tparumahceria.my.id'
)

function Write-Info {
  param([string]$Message)
  if (-not $Quiet) {
    Write-Output $Message
  }
}

function Get-CloudflaredProcessIds {
  try {
    $ids = @(Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    return @($ids | Sort-Object -Unique)
  } catch {
    return @()
  }
}

function Get-CloudflaredMetricsPorts {
  param([int[]]$ProcessIds)

  if (-not $ProcessIds -or $ProcessIds.Count -eq 0) {
    return @()
  }

  $result = @()
  $pidSet = @{}
  foreach ($processId in $ProcessIds) {
    $pidSet["$processId"] = $true
  }

  $netstatLines = @(netstat -ano -p tcp)
  foreach ($line in $netstatLines) {
    if ($line -match '^\s*TCP\s+127\.0\.0\.1:(\d+)\s+0\.0\.0\.0:0\s+LISTENING\s+(\d+)\s*$') {
      $port = [int]$matches[1]
      $processIdFromNetstat = $matches[2]
      if ($pidSet.ContainsKey($processIdFromNetstat)) {
        $result += $port
      }
      continue
    }

    if ($line -match '^\s*TCP\s+\[::1\]:(\d+)\s+\[::\]:0\s+LISTENING\s+(\d+)\s*$') {
      $port = [int]$matches[1]
      $processIdFromNetstat = $matches[2]
      if ($pidSet.ContainsKey($processIdFromNetstat)) {
        $result += $port
      }
    }
  }

  return @($result | Sort-Object -Unique)
}

function Test-LocalConnectorHealthy {
  param([ref]$HaConnections)

  $HaConnections.Value = 0

  $processIds = Get-CloudflaredProcessIds
  if ($processIds.Count -eq 0) {
    return $false
  }

  $ports = Get-CloudflaredMetricsPorts -ProcessIds $processIds
  foreach ($port in $ports) {
    try {
      $metrics = Invoke-WebRequest -Uri "http://127.0.0.1:$port/metrics" -UseBasicParsing -TimeoutSec 3 -Proxy $null
      if ($metrics.Content -match 'cloudflared_tunnel_ha_connections\s+([0-9.]+)') {
        $haValue = [double]$matches[1]
        if ($haValue -gt $HaConnections.Value) {
          $HaConnections.Value = $haValue
        }
        if ($haValue -ge 1) {
          return $true
        }
      }
    } catch {
      continue
    }
  }

  return $false
}

function Test-PublicHost {
  param(
    [string]$TargetHost,
    [int]$TimeoutSec = 8
  )

  try {
    $response = Invoke-WebRequest -Uri "https://$TargetHost" -UseBasicParsing -TimeoutSec $TimeoutSec -Proxy $null
    return [PSCustomObject]@{
      Host = $TargetHost
      Ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
      StatusCode = [int]$response.StatusCode
      Error = ''
    }
  } catch {
    $statusCode = 0
    $errorMessage = $_.Exception.Message
    try {
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
      }
    } catch {
    }

    return [PSCustomObject]@{
      Host = $TargetHost
      Ok = $false
      StatusCode = $statusCode
      Error = $errorMessage
    }
  }
}

function Test-AllPublicHosts {
  $results = @()
  foreach ($targetHost in $targets) {
    $results += Test-PublicHost -TargetHost $targetHost
  }
  return $results
}

function Get-TunnelTokenFromService {
  try {
    $serviceConfig = sc.exe qc Cloudflared | Out-String
  } catch {
    return ''
  }

  $match = [regex]::Match(
    $serviceConfig,
    'BINARY_PATH_NAME\s*:\s*"?[^"]*cloudflared\.exe"?\s+tunnel\s+run\s+--token\s+([^\s\r\n]+)'
  )

  if (-not $match.Success) {
    return ''
  }

  return $match.Groups[1].Value.Trim()
}

function Get-UserTunnelProcess {
  try {
    return Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" |
      Where-Object {
        $cmd = [string]$_.CommandLine
        ($cmd -match 'tunnel run') -and (($cmd -match '--token') -or ($cmd -match '--token-file'))
      } |
      Select-Object -First 1
  } catch {
    return $null
  }
}

$initial = Test-AllPublicHosts
$isHealthy = ($initial | Where-Object { -not $_.Ok }).Count -eq 0

if ($isHealthy) {
  Write-Info 'Cloudflare tunnel publik sehat.'
  exit 0
}

$initialHaConnections = 0
if (Test-LocalConnectorHealthy -HaConnections ([ref]$initialHaConnections)) {
  Write-Info ("Cloudflare connector lokal sehat (HA connections: {0}). Cek HTTPS publik dari mesin ini kemungkinan false-negative." -f $initialHaConnections)
  exit 0
}

Write-Info 'Cloudflare tunnel terdeteksi bermasalah. Menjalankan recovery connector...'

$existingTokenConnector = Get-UserTunnelProcess
if (-not $existingTokenConnector) {
  $token = $env:CLOUDFLARED_TUNNEL_TOKEN
  if ([string]::IsNullOrWhiteSpace($token)) {
    $token = Get-TunnelTokenFromService
  }

  if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Info 'Token tunnel tidak ditemukan (env/service). Recovery tidak bisa dijalankan otomatis.'
    exit 1
  }

  $cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
  if (-not $cloudflaredCommand) {
    Write-Info 'Executable cloudflared tidak ditemukan. Pastikan cloudflared terpasang.'
    exit 1
  }

  $tokenDir = Join-Path $env:TEMP 'tpa-cloudflared'
  if (-not (Test-Path $tokenDir)) {
    New-Item -Path $tokenDir -ItemType Directory -Force | Out-Null
  }
  $tokenFile = Join-Path $tokenDir 'tunnel-token.txt'
  Set-Content -Path $tokenFile -Value $token -Encoding ASCII

  Start-Process `
    -FilePath $cloudflaredCommand.Source `
    -ArgumentList @('--no-autoupdate', '--loglevel', 'info', 'tunnel', 'run', '--token-file', $tokenFile) `
    -WindowStyle Hidden

  Start-Sleep -Seconds 8
  Write-Info 'Connector cloudflared cadangan dijalankan.'
} else {
  Write-Info 'Connector cloudflared token sudah berjalan, menunggu sinkronisasi...'
  Start-Sleep -Seconds 5
}

$afterRecovery = Test-AllPublicHosts
$isRecovered = ($afterRecovery | Where-Object { -not $_.Ok }).Count -eq 0

if ($isRecovered) {
  Write-Info 'Recovery tunnel berhasil. Host publik kembali normal.'
  exit 0
}

$afterHaConnections = 0
if (Test-LocalConnectorHealthy -HaConnections ([ref]$afterHaConnections)) {
  Write-Info ("Connector cloudflared aktif (HA connections: {0}), tetapi cek HTTPS publik dari mesin ini masih gagal." -f $afterHaConnections)
  exit 0
}

Write-Info 'Recovery tunnel belum berhasil. Periksa koneksi internet lokal dan status tunnel di Cloudflare Zero Trust.'
if (-not $Quiet) {
  $afterRecovery | ForEach-Object {
    $statusValue = if ($_.StatusCode -gt 0) { $_.StatusCode } else { 'DOWN' }
    $errorText = if ($_.Error) { $_.Error } else { '-' }
    Write-Output ("- {0}: {1} ({2})" -f $_.Host, $statusValue, $errorText)
  }
}

exit 1
