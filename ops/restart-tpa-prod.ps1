$ErrorActionPreference = 'Stop'

$portsToStop = @(4000)
$stoppedProcessIds = New-Object 'System.Collections.Generic.HashSet[int]'

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

foreach ($port in $portsToStop) {
  $listeners = Get-ListeningProcessIds -Port $port
  foreach ($pidValue in $listeners) {
    if ($pidValue -le 0 -or $stoppedProcessIds.Contains($pidValue)) {
      continue
    }
    try {
      Stop-Process -Id $pidValue -Force -ErrorAction Stop
      [void]$stoppedProcessIds.Add($pidValue)
    } catch {
    }
  }
}

Start-Sleep -Seconds 2

& (Join-Path $PSScriptRoot 'start-tpa-prod.ps1')
