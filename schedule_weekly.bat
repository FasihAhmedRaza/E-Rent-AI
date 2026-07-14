@echo off
REM ============================================================
REM  Intelligent Valuation AI — turn ON the weekly auto-refresh
REM  Creates a Windows scheduled task: every SUNDAY at 07:00 the
REM  PC runs scrape_and_publish.bat by itself (PC must be ON and
REM  the user logged in; log written to data\refresh.log).
REM
REM  To change day/time: edit /D and /ST below and run again.
REM  To turn OFF:  schtasks /Delete /TN "ValuationAI data refresh" /F
REM ============================================================
schtasks /Create /F /TN "ValuationAI data refresh" ^
  /TR "\"%~dp0scrape_and_publish.bat\" --auto" ^
  /SC WEEKLY /D SUN /ST 07:00
if errorlevel 1 (
  echo FAILED to create the scheduled task.
) else (
  echo.
  echo Scheduled: every Sunday 07:00. The PC must be ON and logged in.
  echo Log file: data\refresh.log
  echo To turn off: schtasks /Delete /TN "ValuationAI data refresh" /F
)
pause
