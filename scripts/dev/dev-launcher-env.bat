@echo off
REM TAgent Windows dev launcher - bootstrap Bun on PATH
REM Explorer double-click may not inherit shell PATH (npm global bun is common on Windows)

if not defined BUN_INSTALL set "BUN_INSTALL=%USERPROFILE%\.bun"
if exist "%BUN_INSTALL%\bin\bun.exe" (
  set "PATH=%BUN_INSTALL%\bin;%PATH%"
)

REM npm global bun (e.g. installed with kscc setup)
if exist "%APPDATA%\npm\bun.cmd" (
  set "PATH=%APPDATA%\npm;%PATH%"
)

REM Electron download mirror (China-friendly; install.js also reads this)
if not defined ELECTRON_MIRROR set "ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/"

where bun >nul 2>&1
if errorlevel 1 (
  echo [X] Bun not found.
  echo     Try: npm i -g bun
  echo     Or:  powershell -c "irm bun.sh/install.ps1 | iex"
  exit /b 1
)

set ELECTRON_RUN_AS_NODE=
exit /b 0
