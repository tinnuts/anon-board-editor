@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Stop Anon Board Editor

if not exist server.pid (
  echo 没有找到 server.pid，服务可能已经停止。
  echo 如果端口仍被占用，可手动结束 node.exe 进程。
  pause
  exit /b 0
)

set /p PID=<server.pid
echo 正在停止服务 PID=%PID% ...
taskkill /PID %PID% /F >nul 2>nul
del /q server.pid >nul 2>nul
echo 已停止。按任意键关闭。
pause >nul
