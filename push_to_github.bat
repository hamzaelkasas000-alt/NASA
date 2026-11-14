@echo off
setlocal
title ASTRA - Push to GitHub
color 0A

echo ======================================================================
echo             ASTRA - ONE-CLICK GITHUB REPO UPLOADER
echo ======================================================================
echo.
echo Your local Git repository is already initialized and committed!
echo.
echo Step 1: Go to https://github.com/new in your browser.
echo Step 2: Set repository name to 'ASTRA' (Leave README/License unchecked).
echo Step 3: Click 'Create repository' and copy the HTTPS URL.
echo.
set /p REPO_URL="Paste your GitHub Repository URL (e.g. https://github.com/username/ASTRA.git): "

if "%REPO_URL%"=="" (
    echo [ERROR] No URL entered. Exiting.
    pause
    exit /b 1
)

echo.
echo [1/2] Linking remote origin to %REPO_URL% ...
"C:\Program Files\Git\cmd\git.exe" remote remove origin 2>nul
"C:\Program Files\Git\cmd\git.exe" remote add origin %REPO_URL%

echo.
echo [2/2] Pushing 'main' branch to GitHub...
"C:\Program Files\Git\cmd\git.exe" push -u origin main

echo.
echo ======================================================================
echo DONE! Check your GitHub repository link.
echo ======================================================================
pause
