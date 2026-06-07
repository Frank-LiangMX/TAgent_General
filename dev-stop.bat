@echo off
setlocal

REM ============================================
REM TAgent dev cleanup script
REM Kills residual vite/esbuild/electron/electronmon processes
REM ============================================

echo.
echo === Cleaning dev processes ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process electron,electronmon,vite,esbuild,bun -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Output ('  killed '+$_.ProcessName+' PID='+$_.Id) } catch {} }; $c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output ('  killed leftover vite PID='+$c.OwningProcess) }"
echo.
echo === Verify port 5173 is free ===
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Output ('  [!!] 5173 still held by PID='+$c.OwningProcess) } else { Write-Output '  [OK] 5173 free' }"
