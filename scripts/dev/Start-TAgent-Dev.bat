@echo off
setlocal EnableExtensions
set "TAGENT_ROOT=%~dp0..\.."
cd /d "%TAGENT_ROOT%"

set "BUN_INSTALL=%USERPROFILE%\.bun"
set "PATH=%BUN_INSTALL%\bin;%PATH%"

where bun >nul 2>&1
if errorlevel 1 (
  echo 未找到 Bun。请先安装 Bun 并执行 bun install
  echo 仓库: %CD%
  pause
  exit /b 1
)

set ELECTRON_RUN_AS_NODE=

echo ========================================
echo   TAgent 开发模式
echo   目录: %CD%
echo   停止: 双击 scripts\dev\Stop-TAgent-Dev.bat
echo ========================================
echo.

bun run dev-start
if errorlevel 1 (
  echo.
  echo 启动失败，请查看上方错误信息。
  pause
)
