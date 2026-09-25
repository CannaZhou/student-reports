# Temporary helper: run install_watchdog.ps1 elevated and capture its output to a log.
& 'F:\cursor20260624\_lessonquiz\tools\install_watchdog.ps1' *>&1 |
  Out-File -FilePath 'F:\cursor20260624\_lessonquiz\tools\_install_out.txt' -Encoding UTF8
