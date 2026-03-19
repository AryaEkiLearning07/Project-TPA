$ErrorActionPreference = 'Stop'

$taskName = 'TPA Runtime AutoStart'

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Output "Scheduled task '$taskName' tidak ditemukan."
  exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Output "Scheduled task '$taskName' berhasil dihapus."
