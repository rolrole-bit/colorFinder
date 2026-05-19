@echo off
chcp 949 >nul
title DYE MASTER - Firewall Port 8080
color 0E

echo.
echo  ========================================
echo    DYE MASTER - Firewall Port 8080 Open
echo    Right-click, Run as Administrator!
echo  ========================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] No admin rights!
    echo  Right-click this file, Run as Administrator.
    echo.
    pause
    exit /b 1
)

echo  [OK] Administrator confirmed
echo.

netsh advfirewall firewall delete rule name="DYE_MASTER_8080" >nul 2>&1
netsh advfirewall firewall add rule name="DYE_MASTER_8080" dir=in action=allow protocol=TCP localport=8080

if %errorlevel% equ 0 (
    echo.
    echo  [OK] Firewall rule added!
    echo  Now accessible: http://YOUR_IP:8080
) else (
    echo.
    echo  [FAIL] Could not add rule.
)

echo.
pause
