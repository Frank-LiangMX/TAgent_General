@echo off
chcp 65001 > nul
setlocal

REM ============================================
REM TAgent dev 启动脚本
REM 1. 清理旧 dev 残留进程
REM 2. 启动 bun run dev
REM ============================================

echo.
echo === [1/3] 清理旧 dev 残留进程 ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process electron,electronmon,vite,esbuild,bun -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Output ('  killed '+$_.ProcessName+' PID='+$_.Id) } catch {} }; $c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output ('  killed leftover vite PID='+$c.OwningProcess) }"

echo.
echo === [2/3] 同步 resources 到 dist ===
cd /d "%~dp0\apps\electron"
call bun run build:resources
if errorlevel 1 (
  echo [X] build:resources 失败
  exit /b 1
)

echo.
echo === [3/3] 启动 dev server ===
cd /d "%~dp0"
bun run dev
