$ErrorActionPreference = 'Stop'

$taskName = 'TPA Runtime AutoStart'
$scriptPath = Join-Path $PSScriptRoot 'start-tpa-prod.ps1'

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Description 'Auto start runtime production Project TPA saat user login Windows.' `
  -Force | Out-Null

Write-Output "Scheduled task '$taskName' berhasil dibuat."
