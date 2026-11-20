@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== ส่งงานขึ้น GitHub =====
node sync.js push
echo.
pause
