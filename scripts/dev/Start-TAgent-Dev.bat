@echo off
setlocal

set "TAGENT_ROOT=%~dp0..\.."

REM ============================================
REM TAgent dev startup script
REM 1. Clean leftover port 5173 (does NOT kill bun, to avoid killing kscc / other CLI agents)
REM 2. Sync resources to dist
REM 3. Start bun run dev
REM ============================================

echo.
echo === [1/3] Cleaning leftover port 5173 ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output ('  killed leftover PID='+$c.OwningProcess) } catch {} } else { Write-Output '  [OK] 5173 free' }"

echo.
echo === [2/3] Sync resources to dist ===
cd /d "%TAGENT_ROOT%\apps\electron"
call bun run build:resources
if errorlevel 1 (
  echo [X] build:resources failed
  exit /b 1
)

echo.
echo === [3/3] Starting dev server ===
cd /d "%TAGENT_ROOT%"
bun run dev
