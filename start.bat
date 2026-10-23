@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Anon Board Editor - running (close this window to stop)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] Node.js not found / 未找到 Node.js
  echo      Please install Node.js first: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo Starting... 浏览器会自动打开；关闭本窗口即停止服务。
echo.
node server.js --open

echo.
echo Server stopped. Press any key to close.
pause >nul
