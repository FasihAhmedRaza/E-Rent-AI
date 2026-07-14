@echo off
REM ============================================================
REM  Intelligent Valuation AI — ONE-CLICK data refresh
REM  Double-click this file. It will:
REM    1. Scrape Bayut + Dubizzle + Property Finder (Chrome opens;
REM       if a CAPTCHA appears, solve it in the window — then it
REM       continues by itself)
REM    2. Rebuild the website data file
REM    3. Publish — the live site updates itself in ~1 minute
REM  Scheduled runs call this with --auto (no pauses; output goes
REM  to data\refresh.log).
REM ============================================================
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist "data" mkdir "data"

if /i "%~1"=="--auto" goto :auto

call :main
set RC=%errorlevel%
echo.
pause
exit /b %RC%

:auto
call :main >> "%~dp0data\refresh.log" 2>&1
exit /b %errorlevel%

:main
echo ============================================================
echo  Data refresh started  %date% %time%
echo ============================================================

echo [1/3] Scraping the 3 portals (this takes 20-45 minutes)...
python run_scrape.py
if errorlevel 1 echo   WARNING: a portal reported an error - continuing with whatever was saved.

echo [2/3] Rebuilding the website data file...
python make_snapshot.py
if errorlevel 1 goto :fail

echo [3/3] Publishing to the live site...
git add webapp/public/landData.json
git diff --cached --quiet
if not errorlevel 1 (
  echo   No data changes to publish - site already up to date.
  goto :done
)
git commit -m "data: scheduled refresh"
git push origin main
if errorlevel 1 goto :fail

:done
echo.
echo DONE  %date% %time% - the live site updates itself in about a minute.
exit /b 0

:fail
echo.
echo FAILED  %date% %time% - see messages above. The live site was NOT updated.
exit /b 1
