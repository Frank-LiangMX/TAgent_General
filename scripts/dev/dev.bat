@echo off
setlocal

set "TAGENT_ROOT=%~dp0..\.."

REM ============================================
REM TAgent dev startup script
REM 1. Clean old dev processes
REM 2. Start bun run dev
REM ============================================

echo.
echo === [1/3] Cleaning old dev processes ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process electron,electronmon,vite,esbuild,bun -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Output ('  killed '+$_.ProcessName+' PID='+$_.Id) } catch {} }; $c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output ('  killed leftover vite PID='+$c.OwningProcess) }"

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
