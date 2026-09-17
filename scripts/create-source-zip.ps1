$ErrorActionPreference = 'Stop'

# This script lives in <project>/scripts, so its parent is the project root.
$projectRoot = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path (Split-Path -Parent $projectRoot) 'scm-tower-source.zip'

$excludedDirectories = @(
  'node_modules',
  '.next',
  '.git',
  '.kilo',
  '.kiro',
  '.agents',
  '.codex'
)

# ZipArchiveMode belongs to System.IO.Compression; ZipFile and its extension
# methods belong to FileSystem. Windows PowerShell 5.1 does not always load
# the former transitively.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$archive = [System.IO.Compression.ZipFile]::Open(
  $zipPath,
  [System.IO.Compression.ZipArchiveMode]::Create
)

try {
  Get-ChildItem -LiteralPath $projectRoot -Recurse -File -Force | ForEach-Object {
    $file = $_
    $relativePath = $file.FullName.Substring($projectRoot.Length + 1)
    $pathParts = $relativePath -split '[\\/]'
    $isExcludedDirectory = $pathParts | Where-Object { $excludedDirectories -contains $_ }
    $isExcludedFile = $file.Name -like '.env*' -or $file.Name -like '*.log' -or $file.Name -like 'output_*.csv'

    if (-not $isExcludedDirectory -and -not $isExcludedFile) {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $file.FullName,
        $relativePath.Replace('\', '/'),
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
}
finally {
  $archive.Dispose()
}

Get-Item -LiteralPath $zipPath |
  Select-Object FullName, @{ Name = 'SizeMB'; Expression = { [math]::Round($_.Length / 1MB, 2) } }
