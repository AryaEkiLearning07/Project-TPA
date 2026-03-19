$ErrorActionPreference = 'Stop'

$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$launcherPath = Join-Path $startupDir 'TPA Runtime AutoStart.cmd'

if (-not (Test-Path $launcherPath)) {
  Write-Output "Startup launcher tidak ditemukan: $launcherPath"
  exit 0
}

Remove-Item -Path $launcherPath -Force
Write-Output "Startup launcher berhasil dihapus: $launcherPath"
