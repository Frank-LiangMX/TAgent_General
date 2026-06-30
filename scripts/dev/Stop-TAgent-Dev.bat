@echo off
setlocal EnableExtensions

set "TAGENT_ROOT=%~dp0..\.."
call "%~dp0dev-launcher-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

cd /d "%TAGENT_ROOT%"

echo.
echo === Stopping TAgent dev ===
call bun run dev-stop
echo.
echo Done.
pause
