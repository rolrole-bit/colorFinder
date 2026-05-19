@echo off
chcp 65001 >nul
title DYE MASTER Server
cd /d "%~dp0.."
echo.
echo  🎨 DYE MASTER 서버를 시작합니다...
echo  종료하려면 Ctrl+C를 누르세요.
echo.
node server/index.js
pause
