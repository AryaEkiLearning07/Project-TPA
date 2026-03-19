$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$launcherPath = Join-Path $startupDir 'TPA Runtime AutoStart.cmd'

if (-not (Test-Path $startupDir)) {
  New-Item -Path $startupDir -ItemType Directory -Force | Out-Null
}

$launcher = @"
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "$projectRoot\ops\start-tpa-prod.ps1"
"@

Set-Content -Path $launcherPath -Value $launcher -Encoding Ascii

Write-Output "Startup launcher berhasil dibuat: $launcherPath"
