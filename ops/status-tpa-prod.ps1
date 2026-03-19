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

$backendReady = Test-HttpReady -Uri "http://127.0.0.1:$backendPortNumber/health"
$frontendReady = Test-FrontendReady -Port $backendPortNumber

Write-Output "Frontend app     ($backendPortNumber): $frontendReady"
Write-Output "Backend health   ($backendPortNumber): $backendReady"

try {
  $localHealth = Invoke-WebRequest -Uri "http://127.0.0.1:$backendPortNumber/health" -UseBasicParsing -TimeoutSec 5
  Write-Output "Local backend health: $($localHealth.StatusCode)"
} catch {
  Write-Output 'Local backend health: DOWN'
}

try {
  $localFrontend = Invoke-WebRequest -Uri "http://127.0.0.1:$backendPortNumber" -UseBasicParsing -TimeoutSec 5
  Write-Output "Local frontend app: $($localFrontend.StatusCode)"
} catch {
  Write-Output 'Local frontend app: DOWN'
}

try {
  $publicRoot = Invoke-WebRequest -Uri 'https://tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10
  Write-Output "Public root: $($publicRoot.StatusCode)"
} catch {
  Write-Output 'Public root: DOWN'
}
