@echo off
title AstroHealth NASA Mission Web Dashboard
color 0B
echo =====================================================================
echo           ASTROHEALTH - NASA ASTRONAUT & MISSION CONTROL
echo =====================================================================
echo.

cd /d "%~dp0"

IF EXIST "C:\Users\hamza\AstroHealth\venv\Scripts\python.exe" (
    SET "PY_CMD=C:\Users\hamza\AstroHealth\venv\Scripts\python.exe"
) ELSE (
    SET "PY_CMD=py"
)

echo Starting AstroHealth Flask Server...
echo URL: http://127.0.0.1:5000
echo.
start "" http://127.0.0.1:5000
"%PY_CMD%" app.py

pause
