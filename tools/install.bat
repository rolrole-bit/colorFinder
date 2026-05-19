@echo off
chcp 65001 >nul
title DYE MASTER v3.0 Installer
color 0A

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🎨 DYE MASTER v3.0 - Windows Installer    ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── 1. 프로젝트 루트 이동 ──
cd /d "%~dp0.."
set "PROJECT_DIR=%cd%"
echo  [1/6] 프로젝트 경로: %PROJECT_DIR%

:: ── 2. Node.js 확인 ──
echo.
echo  [2/6] Node.js 확인 중...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Node.js가 설치되어 있지 않습니다.
    echo  ─────────────────────────────────────────
    echo  아래 링크에서 Node.js LTS를 설치한 후 다시 실행하세요:
    echo  https://nodejs.org/ko/download
    echo  ─────────────────────────────────────────
    echo.
    start https://nodejs.org/ko/download
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  ✅ Node.js %NODE_VER% 감지됨

:: ── 3. npm install ──
echo.
echo  [3/6] 패키지 설치 중... (npm install --production)
call npm install --production 2>nul
if %errorlevel% neq 0 (
    echo  ⚠️  npm install 실패. 전체 설치를 시도합니다...
    call npm install 2>nul
)
echo  ✅ 패키지 설치 완료

:: ── 4. .env 생성 ──
echo.
echo  [4/6] 환경설정 (.env) 확인 중...
if not exist ".env" (
    echo  .env 파일이 없습니다. 기본 설정으로 생성합니다.
    
    :: 로컬 IP 감지
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr "10. 172. 192."') do (
        set "LOCAL_IP=%%a"
    )
    set "LOCAL_IP=%LOCAL_IP: =%"
    
    (
        echo PORT=8080
        echo NODE_ENV=production
        echo CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://%LOCAL_IP%:8080
        echo TRUST_PROXY=false
        echo RATE_LIMIT_SESSION=5
        echo RATE_LIMIT_ROUND=20
        echo RATE_LIMIT_RANKING=30
        echo MAX_SESSIONS=1000
        echo MAX_RANKINGS=1000
    ) > .env
    echo  ✅ .env 생성 완료 (IP: %LOCAL_IP%)
) else (
    echo  ✅ .env 이미 존재함
)

:: ── 5. 방화벽 규칙 ──
echo.
echo  [5/6] 방화벽 규칙 추가 중... (관리자 권한 필요)
netsh advfirewall firewall show rule name="DYE_MASTER_8080" >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process cmd -ArgumentList '/c netsh advfirewall firewall add rule name=DYE_MASTER_8080 dir=in action=allow protocol=TCP localport=8080 & exit' -Verb RunAs -Wait" 2>nul
    echo  ✅ 방화벽 포트 8080 허용 (UAC 팝업에서 '예' 선택)
) else (
    echo  ✅ 방화벽 규칙 이미 존재함
)

:: ── 6. data 디렉토리 확인 ──
if not exist "data" mkdir data
if not exist "data\rankings.json" echo [] > data\rankings.json

:: ── 완료 ──
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║          ✅ 설치 완료!                       ║
echo  ╠══════════════════════════════════════════════╣
echo  ║  로컬:   http://localhost:8080               ║
echo  ║  내부망: http://%LOCAL_IP%:8080              ║
echo  ╠══════════════════════════════════════════════╣
echo  ║  서버 시작: start.bat 더블클릭              ║
echo  ║  또는 이 창에서 바로 시작하려면 Enter       ║
echo  ╚══════════════════════════════════════════════╝
echo.
set /p "START_NOW=서버를 바로 시작할까요? (Y/n): "
if /i "%START_NOW%"=="n" (
    echo  서버를 시작하려면 start.bat을 실행하세요.
    pause
    exit /b 0
)

echo.
echo  🚀 서버 시작 중...
start "DYE MASTER Server" cmd /k "cd /d %PROJECT_DIR% && node server/index.js"
timeout /t 2 >nul
start http://localhost:8080
echo  ✅ 브라우저에서 게임이 열립니다!
timeout /t 3 >nul
