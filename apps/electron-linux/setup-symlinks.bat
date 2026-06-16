@echo off
REM setup-symlinks.bat - Windows 上创建符号链接（用于预览和测试）

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set ELECTRON_DIR=%SCRIPT_DIR%..\electron

echo 创建符号链接...

REM 源代码目录
if not exist "%SCRIPT_DIR%src" (
    mklink /D "%SCRIPT_DIR%src" "%ELECTRON_DIR%src"
    echo √ 链接 src/ 目录
)

REM 资源目录
if not exist "%SCRIPT_DIR%resources" (
    mklink /D "%SCRIPT_DIR%resources" "%ELECTRON_DIR%resources"
    echo √ 链接 resources/ 目录
)

REM 默认 Skills
if not exist "%SCRIPT_DIR%default-skills" (
    mklink /D "%SCRIPT_DIR%default-skills" "%ELECTRON_DIR%default-skills"
    echo √ 链接 default-skills/ 目录
)

REM TA MCP wheels
if exist "%ELECTRON_DIR%ta-agent-mcp-wheels" (
    if not exist "%SCRIPT_DIR%ta-agent-mcp-wheels" (
        mklink /D "%SCRIPT_DIR%ta-agent-mcp-wheels" "%ELECTRON_DIR%ta-agent-mcp-wheels"
        echo √ 链接 ta-agent-mcp-wheels/ 目录
    )
)

REM scripts 目录
if not exist "%SCRIPT_DIR%scripts" (
    mklink /D "%SCRIPT_DIR%scripts" "%ELECTRON_DIR%scripts"
    echo √ 链接 scripts/ 目录
)

echo.
echo 符号链接创建完成！
echo.
echo 注意：此脚本仅用于 Windows 预览。
echo 实际 Linux 开发请在 Linux 系统上运行 setup-symlinks.sh
pause
