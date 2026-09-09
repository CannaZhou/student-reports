@echo off
rem 一键启动：自动拉起 node(7000) + 确保公网隧道在线，最后弹窗给 https://lesson.aizqxx.top
title 课堂检测系统 - 一键启动(公网)
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\cursor20260624\_lessonquiz\tools\start_lesson.ps1"
echo.
pause
