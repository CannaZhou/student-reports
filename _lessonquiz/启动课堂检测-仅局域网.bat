@echo off
rem 仅局域网版：不动公网隧道，立即在本机窗口启动 node(7000)，打印访问地址
rem （当教室网络连不上 cloudflare/外网时用这个最省事；平时请用“启动课堂检测.bat”一键公网版）
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH. Please install Node.js 18+ first.
  pause
  exit /b 1
)
rem The server window stays open and shows the access URL.
start "lessonquiz-server" cmd /k "cd /d %~dp0app && node server.js"
timeout /t 1 >nul
echo.
echo  ==================================================
echo   Lesson-quiz system is starting on http://localhost:7000
echo   Students on the LAN use:  http://YOUR-PC-IP:7000
echo   (run: ipconfig  to find YOUR-PC-IP; allow port 7000 in firewall)
echo   Teacher page:            http://localhost:7000/teacher
echo  ==================================================
echo.
pause
