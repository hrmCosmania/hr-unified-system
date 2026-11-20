@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== ดึงงานล่าสุดจาก GitHub =====
node sync.js pull
echo.
pause
