$ErrorActionPreference = 'Stop'

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

Write-Output "Frontend (5173): $frontendReady"
Write-Output "Backend  (4000): $backendReady"

try {
  $localHealth = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/health' -UseBasicParsing -TimeoutSec 5
  Write-Output "Local backend health: $($localHealth.StatusCode)"
} catch {
  Write-Output 'Local backend health: DOWN'
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

try {
  $publicParentHttps = Invoke-WebRequest -Uri 'https://parent.tparumahceria.my.id' -UseBasicParsing -TimeoutSec 10
  Write-Output "Public parent HTTPS: $($publicParentHttps.StatusCode)"
} catch {
  Write-Output "Public parent HTTPS: DOWN ($($_.Exception.Message))"
}
