@echo off
rem Stop the lesson-quiz server listening on TCP port 7000
setlocal
set PORT=7000
set FOUND=0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  echo Killing PID %%P listening on port %PORT% ...
  taskkill /f /pid %%P >nul 2>nul
  set FOUND=1
)
if "%FOUND%"=="0" echo No lesson-quiz process found on port %PORT% (already stopped).
pause
