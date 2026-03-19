param(
    [string]$OutputPath = ""
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $projectRoot ("project-tpa-source-{0}.zip" -f $timestamp)
} elseif (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $projectRoot $OutputPath
}

$excludedDirNames = @(
    "node_modules",
    "dist",
    ".git",
    ".vite"
)

$excludedFilePatterns = @(
    "*.log",
    "*_errors.txt"
)

$files = Get-ChildItem $projectRoot -Recurse -File -Force | Where-Object {
    $relativePath = $_.FullName.Substring($projectRoot.Length + 1)
    $segments = $relativePath -split "[\\/]"
    $containsExcludedDir = $segments | Where-Object { $excludedDirNames -contains $_ }
    if ($containsExcludedDir) {
        return $false
    }

    foreach ($pattern in $excludedFilePatterns) {
        if ($_.Name -like $pattern) {
            return $false
        }
    }

    return $true
}

if ($files.Count -eq 0) {
    throw "Tidak ada file yang bisa dimasukkan ke ZIP."
}

$relativeFiles = $files | ForEach-Object {
    $_.FullName.Substring($projectRoot.Length + 1)
}

if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

Push-Location $projectRoot
try {
    Compress-Archive -Path $relativeFiles -DestinationPath $OutputPath -Force
} finally {
    Pop-Location
}

Write-Host ("ZIP selesai dibuat: {0}" -f $OutputPath)
Write-Host ("Total file dalam ZIP: {0}" -f $relativeFiles.Count)
