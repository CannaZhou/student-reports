# Temporary: confirm run_hidden.vbs really spawns the watchdog (hidden).
Start-Process 'wscript.exe' -ArgumentList '//B','//Nologo','F:\cursor20260624\_lessonquiz\tools\run_hidden.vbs'
$found = $false
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Milliseconds 200
  $p = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
       Where-Object { $_.CommandLine -like '*watchdog.ps1*' }
  if ($p) { $found = $true; break }
}
if ($found) { 'SPAWNED-OK' } else { 'NOT-SPAWNED' }
