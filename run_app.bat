@echo off
setlocal enabledelayedexpansion
title ASTRA - Autonomous Spaceflight Telemetry & Risk Assessment
color 0B

echo ======================================================================
echo    ASTRA - NASA Space Apps Challenge (Team SPARC)
echo    Autonomous Spaceflight Telemetry ^& Risk Assessment Platform
echo ======================================================================
echo.

cd /d "%~dp0\web"

:: Determine Python executable
set "PY_CMD="
if exist "..\..\..\..\..\..\Users\%USERNAME%\AstroHealth\venv\Scripts\python.exe" (
    set "PY_CMD=..\..\..\..\..\..\Users\%USERNAME%\AstroHealth\venv\Scripts\python.exe"
) else if exist "venv\Scripts\python.exe" (
    set "PY_CMD=venv\Scripts\python.exe"
) else (
    where py >nul 2>nul && set "PY_CMD=py"
    if not defined PY_CMD (
        where python >nul 2>nul && set "PY_CMD=python"
    )
)

if not defined PY_CMD (
    echo [ERROR] Python not found in system PATH.
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

echo [1/3] Using Python: !PY_CMD!
echo [2/3] Launching Mission Platform on http://127.0.0.1:5000 ...
start "" http://127.0.0.1:5000

echo [3/3] Starting Flask Application Server...
!PY_CMD! app.py

pause
