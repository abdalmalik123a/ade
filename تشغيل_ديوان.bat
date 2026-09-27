@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================================
echo             منظومة ديوان — Diwan Bureau
echo ====================================================
echo جاري تشغيل التطبيق على سطح المكتب...
npx electron .
if errorlevel 1 (
    echo جاري التشغيل بنمط التطوير...
    call npm run dev
)
pause
