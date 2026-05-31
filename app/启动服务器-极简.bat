@echo off
cd /d "%~dp0"
title TripDiary Server 5176

echo ============================================
echo   TripDiary Server - Port 5176
echo ============================================
echo.
echo Working dir: %CD%
echo.

set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" (
    echo ERROR: Python not found at %PY%
    echo Please reinstall Python 3.12.
    pause
    exit /b 1
)

echo Python: %PY%
echo.
echo PC:     http://127.0.0.1:5176
echo Phone:  http://192.168.0.187:5176  (same WiFi)
echo.
echo Press Ctrl+C to stop.
echo --------------------------------------------
echo.

"%PY%" -m http.server 5176 --bind 0.0.0.0

echo.
echo Server stopped (exit %ERRORLEVEL%).
pause
