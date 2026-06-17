@echo off
setlocal EnableExtensions
set "TAGENT_ROOT=%~dp0..\.."
cd /d "%TAGENT_ROOT%"

set "BUN_INSTALL=%USERPROFILE%\.bun"
set "PATH=%BUN_INSTALL%\bin;%PATH%"

where bun >nul 2>&1
if errorlevel 1 (
  echo 未找到 Bun。
  pause
  exit /b 1
)

echo 正在停止 TAgent 开发进程...
bun run dev-stop
echo.
echo 已停止。
pause
