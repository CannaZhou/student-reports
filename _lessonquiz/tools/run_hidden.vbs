' Hidden launcher for watchdog.ps1, called once a minute by the LessonQuizWatchdog
' scheduled task.
'
' Why wscript instead of calling powershell.exe directly from the task: when the
' task launches powershell.exe, Windows creates the console window first and only
' then applies -WindowStyle Hidden, so a black box flashes on screen every minute.
' Going through wscript with Run(..., 0, False) starts it with no window at all
' and without waiting for it to finish.
'
' Keep this file pure ASCII - wscript reads BOM-less scripts as the system ANSI
' codepage, so non-ASCII bytes can corrupt the command string.
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""F:\cursor20260624\_lessonquiz\tools\watchdog.ps1""", 0, False
