$ErrorActionPreference = 'Stop'

$backendPortNumber = 4000

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
  foreach (\$processId in \$ProcessIds) {
    \$pidSet["$processId"] = $true
  }

  $netstatLines = @(netstat -ano -p tcp)
  foreach ($line in $netstatLines) {
    if ($line -match '^\s*TCP\s+127\.0\.0\.1:(\d+)\s+0\.0\.0\.0:0\s+LISTENING\s+(\d+)\s*$') {
      $port = [int]$matches[1]
      $pid = $matches[2]
      if ($pidSet.ContainsKey($pid)) {
        $result += $port
      }
      continue
    }

    if ($line -match '^\s*TCP\s+\[::1\]:(\d+)\s+\[::\]:0\s+LISTENING\s+(\d+)\s*$') {
      $port = [int]$matches[1]
      $pid = $matches[2]
      if ($pidSet.ContainsKey($pid)) {
        $result += $port
      }
    }
  }

  return @($result | Sort-Object -Unique)
}

function Get-CloudflaredHaConnections {
  $processIds = Get-CloudflaredProcessIds
  if ($processIds.Count -eq 0) {
    return [PSCustomObject]@{ Ok = $false; HaConnections = 0; Port = 0 }
  }

  $ports = Get-CloudflaredMetricsPorts -ProcessIds $processIds
  foreach ($port in $ports) {
    try {
      $metrics = Invoke-WebRequest -Uri "http://127.0.0.1:$port/metrics" -UseBasicParsing -TimeoutSec 3 -Proxy $null
      if ($metrics.Content -match 'cloudflared_tunnel_ha_connections\s+([0-9.]+)') {
        $haValue = [double]$matches[1]
        return [PSCustomObject]@{
          Ok = ($haValue -ge 1)
          HaConnections = $haValue
          Port = $port
        }
      }
    } catch {
      continue
    }
  }

  return [PSCustomObject]@{ Ok = $false; HaConnections = 0; Port = 0 }
}

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

$backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
$adminFrontendReady = Test-FrontendReady -Port $backendPortNumber
$landingFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'tparumahceria.my.id'
$parentFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'parent.tparumahceria.my.id'

Write-Output "Frontend admin   ($backendPortNumber): $adminFrontendReady"
Write-Output "Frontend landing ($backendPortNumber): $landingFrontendReady"
Write-Output "Frontend parent  ($backendPortNumber): $parentFrontendReady"
Write-Output "Backend health   ($backendPortNumber): $backendReady"

$cloudflaredStatus = Get-CloudflaredHaConnections
if ($cloudflaredStatus.Port -gt 0) {
  Write-Output ("Cloudflared HA   : {0} (ha={1}, metrics=127.0.0.1:{2})" -f $cloudflaredStatus.Ok, $cloudflaredStatus.HaConnections, $cloudflaredStatus.Port)
} else {
  Write-Output 'Cloudflared HA   : UNKNOWN (metrics tidak terdeteksi)'
}

try {
  $localHealth = Invoke-WebRequest -Uri "http://127.0.0.1:$backendPortNumber/health" -UseBasicParsing -TimeoutSec 5
  Write-Output "Local backend health: $($localHealth.StatusCode)"
} catch {
  Write-Output 'Local backend health: DOWN'
}

try {
  $localFrontend = Invoke-WebRequest -Uri "http://127.0.0.1:$backendPortNumber" -UseBasicParsing -TimeoutSec 5
  Write-Output "Local frontend admin: $($localFrontend.StatusCode)"
} catch {
  Write-Output 'Local frontend admin: DOWN'
}

try {
  $localLanding = Invoke-WebRequest `
    -Uri "http://127.0.0.1:$backendPortNumber" `
    -Headers @{ Host = 'tparumahceria.my.id' } `
    -UseBasicParsing `
    -TimeoutSec 5
  Write-Output "Local frontend landing: $($localLanding.StatusCode)"
} catch {
  Write-Output 'Local frontend landing: DOWN'
}

try {
  $localParent = Invoke-WebRequest `
    -Uri "http://127.0.0.1:$backendPortNumber" `
    -Headers @{ Host = 'parent.tparumahceria.my.id' } `
    -UseBasicParsing `
    -TimeoutSec 5
  Write-Output "Local frontend parent: $($localParent.StatusCode)"
} catch {
  Write-Output 'Local frontend parent: DOWN'
}

try {
  $publicRootHttps = Invoke-WebRequest -Uri 'https://tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10 -Proxy $null
  Write-Output "Public root HTTPS: $($publicRootHttps.StatusCode)"
} catch {
  Write-Output "Public root HTTPS: DOWN ($($_.Exception.Message))"
}

try {
  $publicRootHttp = Invoke-WebRequest -Uri 'http://tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10 -Proxy $null
  Write-Output "Public root HTTP : $($publicRootHttp.StatusCode)"
} catch {
  Write-Output "Public root HTTP : DOWN ($($_.Exception.Message))"
}

try {
  $publicAppsHttps = Invoke-WebRequest -Uri 'https://apps.tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10 -Proxy $null
  Write-Output "Public apps HTTPS: $($publicAppsHttps.StatusCode)"
} catch {
  Write-Output "Public apps HTTPS: DOWN ($($_.Exception.Message))"
}

try {
  $publicParentHttps = Invoke-WebRequest -Uri 'https://parent.tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10 -Proxy $null
  Write-Output "Public parent HTTPS: $($publicParentHttps.StatusCode)"
} catch {
  Write-Output "Public parent HTTPS: DOWN ($($_.Exception.Message))"
}
