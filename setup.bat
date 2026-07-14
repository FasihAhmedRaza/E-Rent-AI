@echo off
REM ============================================================
REM  Intelligent Valuation AI — ONE-TIME setup for the scrape PC
REM  Run this once on a new computer. Needs: Python 3.11+, Chrome,
REM  Git — and the .env file placed in this folder.
REM ============================================================
cd /d "%~dp0"

echo [1/3] Installing Python packages...
pip install -r requirements.txt
if errorlevel 1 goto :fail

echo.
echo [2/3] Installing the browser driver...
patchright install chrome

echo.
echo [3/3] Checking configuration...
if not exist ".env" (
  echo   WARNING: .env file is MISSING. Scraping will not work.
  echo   Place the .env file ^(with SUPABASE_URL and SUPABASE_KEY^) in this folder.
) else (
  echo   .env found - OK.
)

echo.
echo Setup complete. To refresh data, double-click scrape_and_publish.bat
pause
exit /b 0

:fail
echo.
echo Setup FAILED - is Python installed and on PATH? (python.org, tick "Add to PATH")
pause
exit /b 1
