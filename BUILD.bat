@echo off
title TCG Card Shop Mod Manager - Build Script
color 0A
echo ============================================
echo   TCG Card Shop Mod Manager - Build Script
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed. Download from https://nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js: & node --version & echo.

echo ============================================
echo   Step 1: Installing dependencies...
echo ============================================
echo.
call npm install
if %errorlevel% neq 0 ( color 0C & echo. & echo [ERROR] npm install failed. & pause & exit /b 1 )
echo. & echo [OK] Dependencies installed. & echo.

echo ============================================
echo   Step 2: Building the UI...
echo ============================================
echo.
call npm run build:renderer
if %errorlevel% neq 0 ( color 0C & echo. & echo [ERROR] UI build failed. & pause & exit /b 1 )
echo. & echo [OK] UI built. & echo.

echo ============================================
echo   Step 3: Packaging portable .exe...
echo ============================================
echo.
echo Using electron-builder 24.13.3 (the version that built the
echo clean 1.0.4 release). Newer builder versions ship a different
echo portable stub that some antivirus engines false-flag.
echo.
call npx electron-builder@24.13.3 --win
if %errorlevel% neq 0 (
    color 0C & echo.
    echo [ERROR] Build failed. The .exe may still be in build/ if it was a signing warning.
    pause & exit /b 1
)

echo.
echo ============================================
color 0A
echo   BUILD COMPLETE!
echo ============================================
echo.
echo Your portable .exe is in the build/ folder:
echo   build\TCG-Mod-Manager.exe
echo.
echo Just put the .exe wherever you want and run it.
echo A "staging" folder will be created next to it.
echo.
explorer build
pause
