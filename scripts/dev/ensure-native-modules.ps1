# Ensure better-sqlite3 matches Electron ABI (bun install builds for Bun, not Electron)
$ErrorActionPreference = 'Stop'

# Bootstrap bun on PATH (Explorer double-click may miss npm global bin)
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  $bunInstall = Join-Path $env:USERPROFILE '.bun\bin'
  if (Test-Path (Join-Path $bunInstall 'bun.exe')) {
    $env:PATH = "$bunInstall;$env:PATH"
  }
  $npmBin = Join-Path $env:APPDATA 'npm'
  if (Test-Path (Join-Path $npmBin 'bun.cmd')) {
    $env:PATH = "$npmBin;$env:PATH"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$electronPkg = Join-Path $repoRoot 'node_modules\electron\package.json'
$sqlitePkg = Join-Path $repoRoot 'node_modules\better-sqlite3\package.json'
$stampDir = Join-Path $repoRoot 'node_modules\.cache'
$stampFile = Join-Path $stampDir 'tagent-native-modules.stamp'

if (-not (Test-Path $electronPkg) -or -not (Test-Path $sqlitePkg)) {
  Write-Host '[X] node_modules incomplete. Run: bun install'
  exit 1
}

$electronVer = (Get-Content $electronPkg | ConvertFrom-Json).version
$sqliteVer = (Get-Content $sqlitePkg | ConvertFrom-Json).version
$stampKey = "electron=$electronVer;better-sqlite3=$sqliteVer"

if (Test-Path $stampFile) {
  $existing = Get-Content $stampFile -Raw
  if ($existing.Trim() -eq $stampKey) {
    Write-Host '[OK] Native modules stamp valid'
    exit 0
  }
}

Write-Host '[..] Rebuilding better-sqlite3 for Electron...'
Push-Location (Join-Path $repoRoot 'apps\electron')
try {
  & bun run rebuild:native
  if ($LASTEXITCODE -ne 0) { throw "rebuild:native exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $stampDir | Out-Null
Set-Content -Path $stampFile -Value $stampKey -NoNewline
Write-Host '[OK] Native modules rebuilt'
exit 0
