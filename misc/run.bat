@echo off
setlocal enabledelayedexpansion
title Safr [Goa Guide Buddy] - Local Server

echo ==========================================================
echo    Safr [Goa Guide Buddy] - Development Launcher
echo ==========================================================
echo.

:: 1. Locate frontend directory dynamically regardless of invoke location
set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR="

if exist "%SCRIPT_DIR%frontend\package.json" (
    set "FRONTEND_DIR=%SCRIPT_DIR%frontend"
) else if exist "%SCRIPT_DIR%..\frontend\package.json" (
    set "FRONTEND_DIR=%SCRIPT_DIR%..\frontend"
) else if exist "%CD%\frontend\package.json" (
    set "FRONTEND_DIR=%CD%\frontend"
)

if not defined FRONTEND_DIR (
    echo [ERROR] Could not find the frontend directory containing package.json!
    echo Expected: "%SCRIPT_DIR%frontend" or "%SCRIPT_DIR%..\frontend"
    echo.
    pause
    exit /b 1
)

:: 2. Verify Node.js and npm
echo [1/4] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js v20 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your system PATH!
    echo Please ensure npm is installed and added to your system PATH.
    echo.
    pause
    exit /b 1
)
echo       Node.js and npm detected successfully.
echo.

:: 3. Change directory to frontend and verify dependencies
echo [2/4] Verifying dependencies in frontend...
cd /d "%FRONTEND_DIR%"
if "%~1"=="--install" (
    echo       Force install requested. Running npm install...
    call npm install
) else if not exist "node_modules\" (
    echo       node_modules folder not found. Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install encountered an error!
        echo.
        pause
        exit /b 1
    )
    echo       Dependencies installed successfully.
) else (
    echo       Dependencies are already installed. Skipping npm install.
)
echo.

:: 4. Configure browser launch (Prioritize Firefox per workspace rules)
echo [3/4] Preparing browser launch...
set "FIREFOX_DIR="
if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    set "FIREFOX_DIR=C:\Program Files\Mozilla Firefox"
) else if exist "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" (
    set "FIREFOX_DIR=C:\Program Files (x86)\Mozilla Firefox"
)

if "%~1"=="--no-browser" (
    echo       --no-browser flag specified. Skipping automatic browser launch.
) else if defined FIREFOX_DIR (
    set "PATH=!FIREFOX_DIR!;!PATH!"
    set "BROWSER=firefox"
    echo       Target browser: Mozilla Firefox
    echo       Opening http://localhost:5173 once dev server is ready...
    start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start firefox http://localhost:5173"
) else (
    echo       Mozilla Firefox not found at standard path. Falling back to default browser...
    start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:5173"
)
echo.

:: 5. Launch Vite development server
echo [4/4] Starting Vite development server...
echo       Local URL: http://localhost:5173
echo       Press Ctrl+C in this window at any time to stop the server.
echo ==========================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Development server exited with code %errorlevel%.
    echo.
    pause
)
