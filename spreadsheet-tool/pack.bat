@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
:: ============================================================
::  离线打包脚本 (Windows)
::  将项目和所有依赖打包为 .zip，复制到离线电脑即可使用
::
::  用法: pack.bat
::  输出: spreadsheet-tool-offline.zip
:: ============================================================

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"
set OUTPUT=spreadsheet-tool-offline.zip
set PKG_NAME=spreadsheet-tool
set TEMP_DIR=%TEMP%\spreadsheet-pack

echo ==========================================
echo   表格工具 - 离线打包
echo ==========================================

:: ── 1. 下载依赖 ────────────────────────────
echo [1/4] 准备离线依赖...
if not exist "%SCRIPT_DIR%offline-deps" mkdir "%SCRIPT_DIR%offline-deps"

python -m pip download flask openpyxl pandas xlrd -d "%SCRIPT_DIR%offline-deps" --quiet 2>nul
if errorlevel 1 (
    echo   使用 python3 重试...
    python3 -m pip download flask openpyxl pandas xlrd -d "%SCRIPT_DIR%offline-deps" --quiet 2>nul
)
echo   依赖准备完成

:: ── 2. 生成图标 ─────────────────────────────
echo [2/4] 生成图标...
python gen_icon.py 2>nul && echo   图标已生成 || echo   跳过图标

:: ── 3. 清理临时文件 ─────────────────────────
echo [3/4] 清理临时文件...
if exist "%SCRIPT_DIR%__pycache__" rmdir /s /q "%SCRIPT_DIR%__pycache__" 2>nul
del /q "%SCRIPT_DIR%*.pyc" 2>nul
echo   清理完成

:: ── 4. 打包 ─────────────────────────────────
echo [4/4] 打包为 %OUTPUT% ...

if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%" 2>nul
mkdir "%TEMP_DIR%\%PKG_NAME%"

xcopy /e /y /q "%SCRIPT_DIR%*.py" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /y /q "%SCRIPT_DIR%*.sh" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /y /q "%SCRIPT_DIR%*.bat" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /y /q "%SCRIPT_DIR%*.desktop" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /y /q "%SCRIPT_DIR%*.txt" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /y /q "%SCRIPT_DIR%*.svg" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /y /q "%SCRIPT_DIR%*.png" "%TEMP_DIR%\%PKG_NAME%\" 2>nul
xcopy /e /i /y /q "%SCRIPT_DIR%offline-deps" "%TEMP_DIR%\%PKG_NAME%\offline-deps" 2>nul
xcopy /e /i /y /q "%SCRIPT_DIR%static" "%TEMP_DIR%\%PKG_NAME%\static" 2>nul
xcopy /e /i /y /q "%SCRIPT_DIR%templates" "%TEMP_DIR%\%PKG_NAME%\templates" 2>nul

:: 打包为 zip (使用 PowerShell)
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\%PKG_NAME%' -DestinationPath '%SCRIPT_DIR%%OUTPUT%' -Force" 2>nul

rmdir /s /q "%TEMP_DIR%" 2>nul

echo.
echo ==========================================
echo   打包完成!
echo   文件: %OUTPUT%
echo.
echo   离线安装步骤 (目标电脑上):
echo     1. 复制 %OUTPUT% 到目标电脑
echo     2. 解压到任意目录
echo     3. 双击 run.sh (Linux) 或 start.py (Windows)
echo ==========================================
pause
