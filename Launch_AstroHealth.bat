@echo off
title AstroHealth - NASA Astronaut & Mission Control
color 0B
echo ======================================================================
echo           ASTROHEALTH - NASA ASTRONAUT & MISSION CONTROL
echo ======================================================================
echo.
echo Starting Flask Server and opening web browser...
echo Local URL: http://127.0.0.1:5000
echo.

:: Open the default browser to the web app
start "" http://127.0.0.1:5000

:: Run the Flask server
cd /d "D:\SUT\NASA\web"
"C:\Users\hamza\AstroHealth\venv\Scripts\python.exe" "D:\SUT\NASA\web\app.py"

pause
