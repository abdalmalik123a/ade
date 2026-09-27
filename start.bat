@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================================
echo             Diwan - منظومة ديوان
echo ====================================================
echo Starting Diwan...
call npm run dev
if errorlevel 1 pause
