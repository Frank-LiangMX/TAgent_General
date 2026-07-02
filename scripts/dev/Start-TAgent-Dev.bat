@echo off
setlocal EnableExtensions

set "TAGENT_ROOT=%~dp0..\.."
call "%~dp0dev-launcher-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo === [0/4] Ensure Electron binary ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-electron.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo === [1/4] Ensure native modules (better-sqlite3) ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-native-modules.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)

REM ============================================
REM TAgent dev startup script
REM 2. Clean leftover port 5173 (does NOT kill bun, to avoid killing kscc / other CLI agents)
REM 3. Sync resources to dist
REM 4. Start bun run dev
REM ============================================

echo.
echo === [2/4] Cleaning leftover port 5173 ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output ('  killed leftover PID='+$c.OwningProcess) } catch {} } else { Write-Output '  [OK] 5173 free' }"

echo.
echo === [3/4] Sync resources to dist ===
cd /d "%TAGENT_ROOT%\apps\electron"
call bun run build:resources
if errorlevel 1 (
  echo [X] build:resources failed
  pause
  exit /b 1
)

echo.
echo === [4/4] Starting dev server ===
cd /d "%TAGENT_ROOT%"
call bun run dev
if errorlevel 1 (
  echo.
  echo [X] dev failed - see errors above
  pause
  exit /b 1
)
