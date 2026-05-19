@echo off
chcp 65001 >nul
title DYE MASTER - 방화벽 포트 열기
color 0E

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🔓 DYE MASTER 방화벽 포트 8080 열기       ║
echo  ║   ⚠️  반드시 "관리자 권한으로 실행" 하세요   ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ 관리자 권한이 없습니다!
    echo  이 파일을 우클릭 → "관리자 권한으로 실행" 해주세요.
    echo.
    pause
    exit /b 1
)

echo  ✅ 관리자 권한 확인됨
echo.

:: 기존 규칙 삭제 후 재생성
netsh advfirewall firewall delete rule name="DYE_MASTER_8080" >nul 2>&1
netsh advfirewall firewall add rule name="DYE_MASTER_8080" dir=in action=allow protocol=TCP localport=8080

if %errorlevel% equ 0 (
    echo.
    echo  ✅ 방화벽 규칙 추가 완료!
    echo  이제 내부망에서 http://IP주소:8080 으로 접속 가능합니다.
) else (
    echo.
    echo  ❌ 방화벽 규칙 추가 실패. 관리자에게 문의하세요.
)

echo.
pause
