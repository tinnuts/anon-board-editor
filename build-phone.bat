@echo off
chcp 65001 >nul
cd /d "%~dp0"
node build-single.js
echo.
echo 生成的 匿名版编辑器-手机版.html 可以发到手机上（微信/QQ/网盘/数据线都行），
echo 用手机浏览器打开即可，不需要电脑、不需要联网。
echo.
pause >nul
