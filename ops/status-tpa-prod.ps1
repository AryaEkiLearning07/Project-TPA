$ErrorActionPreference = 'Stop'

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

$backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
$adminFrontendReady = Test-FrontendReady -Port $backendPortNumber
$landingFrontendReady = Test-FrontendHostReady -Port $backendPortNumber -HostHeader 'tparumahceria.my.id'

Write-Output "Frontend admin   ($backendPortNumber): $adminFrontendReady"
Write-Output "Frontend landing ($backendPortNumber): $landingFrontendReady"
Write-Output "Backend health   ($backendPortNumber): $backendReady"

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
  $publicRootHttps = Invoke-WebRequest -Uri 'https://tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10
  Write-Output "Public root HTTPS: $($publicRootHttps.StatusCode)"
} catch {
  Write-Output "Public root HTTPS: DOWN ($($_.Exception.Message))"
}

try {
  $publicRootHttp = Invoke-WebRequest -Uri 'http://tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10
  Write-Output "Public root HTTP : $($publicRootHttp.StatusCode)"
} catch {
  Write-Output "Public root HTTP : DOWN ($($_.Exception.Message))"
}

try {
  $publicAppsHttps = Invoke-WebRequest -Uri 'https://apps.tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10
  Write-Output "Public apps HTTPS: $($publicAppsHttps.StatusCode)"
} catch {
  Write-Output "Public apps HTTPS: DOWN ($($_.Exception.Message))"
}
