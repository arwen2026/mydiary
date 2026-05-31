@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title TripDiary Server

echo.
echo  ============================================
echo    行程记录 TripDiary 本地服务器
echo  ============================================
echo.
echo  当前目录: %CD%
echo.

REM ---- 1. 找 Python ----
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "!PY!" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not exist "!PY!" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not exist "!PY!" (
    echo  [ERROR] 找不到 Python，请先安装到默认位置
    echo  期望路径: %LOCALAPPDATA%\Programs\Python\Python312\python.exe
    echo.
    pause
    exit /b 1
)

echo  Python: !PY!
"!PY!" --version
echo.

REM ---- 2. 尝试杀掉占用 5176 的旧进程（容错，失败不退出） ----
echo  检查 5176 端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5176 " ^| findstr "LISTENING" 2^>nul') do (
    echo  结束占用 5176 的旧进程 PID %%a
    taskkill /F /PID %%a >nul 2>nul
)
echo.

REM ---- 3. 显示访问地址 ----
echo  PC 浏览器：http://127.0.0.1:5176
echo.
echo  手机访问（同一 WiFi）找下面 IPv4 中 192/10/172 开头的：
ipconfig | findstr /C:"IPv4"
echo.
echo  → http://你的IP:5176
echo.
echo  按 Ctrl+C 可停止服务器
echo  --------------------------------------------
echo.

REM ---- 4. 启动服务器 ----
"!PY!" -m http.server 5176 --bind 0.0.0.0

REM ---- 5. 服务器停止后不立即关窗 ----
echo.
echo  服务器已停止（退出码 %ERRORLEVEL%）
echo.
pause
