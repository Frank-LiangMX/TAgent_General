@echo off
chcp 65001 > nul
setlocal

REM ============================================
REM TAgent dev 清理脚本
REM 退出 dev.bat / 托盘 Quit 后残留的 vite / esbuild / electron / electronmon 进程
REM 跟 dev.bat 第 1 步用同样的杀进程逻辑
REM ============================================

echo.
echo === 清理 dev 残留进程 ===
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process electron,electronmon,vite,esbuild,bun -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Output ('  killed '+$_.ProcessName+' PID='+$_.Id) } catch {} }; $c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output ('  killed leftover vite PID='+$c.OwningProcess) }"
echo.
echo === 验证端口 5173 已释放 ===
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Output ('  [!!] 5173 still held by PID='+$c.OwningProcess) } else { Write-Output '  [OK] 5173 free' }"
