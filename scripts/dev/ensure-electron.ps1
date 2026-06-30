# Ensure Electron binary is installed (Windows dev bootstrap)
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$electronDir = Join-Path $repoRoot 'node_modules\electron'
$electronExe = Join-Path $electronDir 'dist\electron.exe'

if (Test-Path $electronExe) {
  Write-Host '[OK] Electron binary present'
  exit 0
}

Write-Host '[..] Electron binary missing, downloading (~130MB)...'

$version = (Get-Content (Join-Path $electronDir 'package.json') | ConvertFrom-Json).version
$zipName = "electron-v$version-win32-x64.zip"
$mirrors = @(
  "https://cdn.npmmirror.com/binaries/electron/v$version/$zipName",
  "https://npmmirror.com/mirrors/electron/v$version/$zipName",
  "https://github.com/electron/electron/releases/download/v$version/$zipName"
)

$zipPath = Join-Path $env:TEMP $zipName
$downloaded = $false
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue

foreach ($url in $mirrors) {
  try {
    Write-Host "  try: $url"
    if ($curl) {
      & curl.exe -L --ssl-no-revoke --connect-timeout 30 --max-time 900 -o $zipPath $url
      if ($LASTEXITCODE -ne 0) { throw "curl exit $LASTEXITCODE" }
    } else {
      Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 900
    }
    if ((Get-Item $zipPath).Length -gt 50MB) {
      $downloaded = $true
      break
    }
    throw 'downloaded file too small'
  } catch {
    Write-Host "  skip: $($_.Exception.Message)"
    Remove-Item $zipPath -ErrorAction SilentlyContinue
  }
}

if (-not $downloaded) {
  Write-Host '[X] Failed to download Electron (~130MB).'
  Write-Host '    Manual fix (repo root):'
  Write-Host '      set ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/'
  Write-Host '      bun install'
  exit 1
}

$distDir = Join-Path $electronDir 'dist'
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $distDir -Force
Remove-Item $zipPath -Force

Set-Content -Path (Join-Path $electronDir 'path.txt') -Value 'electron.exe' -NoNewline
Set-Content -Path (Join-Path $distDir 'version') -Value $version -NoNewline

Write-Host '[OK] Electron installed'
exit 0
