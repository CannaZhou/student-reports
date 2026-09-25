# Start the cloudflared tunnel detached, then wait until the public URL answers.
# NOTE: keep this file pure ASCII. PowerShell 5.1 decodes BOM-less .ps1 as the
# system ANSI codepage (GBK here), so any non-ASCII byte in a comment turns into
# mojibake and can corrupt the surrounding string literal.
$CFD = 'C:\Users\admin\bin\cloudflared.exe'
$LOG = 'F:\cursor20260624\_lessonquiz\cloudflared.log'
$URL = 'https://lesson.aizqxx.top'

# Warm the DNS records the tunnel needs into the system resolver cache.
# The school DNS is slow and cloudflared's internal timeout is short.
foreach ($n in @('_v2-origintunneld._tcp.argotunnel.com', '_origintunneld._tcp.argotunnel.com')) {
  try { Resolve-DnsName -Name $n -Type SRV -DnsOnly -ErrorAction Stop | Out-Null } catch {}
}
foreach ($n in @('region1.v2.argotunnel.com', 'region2.v2.argotunnel.com')) {
  try { Resolve-DnsName -Name $n -DnsOnly -ErrorAction Stop | Out-Null } catch {}
}

# Clear any leftover cloudflared so two processes do not fight over the tunnel.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Use WMI to create the process. Start-Process would make it a child of this
# script, and the child gets torn down when the script exits (which is exactly
# what killed the tunnel when this ran as a background task). A WMI-created
# process is owned by WMI and outlives the script. Logging goes through
# cloudflared's own --logfile, so no shell redirection is needed.
# --edge-ip-version 4 --protocol http2: school egress drops UDP 7844 and this box
# has no working IPv6, so the defaults die on QUIC/IPv6 timeouts.
$cmd = '"' + $CFD + '" --logfile "' + $LOG + '" tunnel --edge-ip-version 4 --protocol http2 run aizqxx'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
if ($r.ReturnValue -ne 0) { Write-Host ('CreateProcess failed, ReturnValue=' + $r.ReturnValue); exit 1 }
Write-Host ('cloudflared started, PID=' + $r.ProcessId)

for ($i = 0; $i -lt 18; $i++) {
  Start-Sleep -Seconds 5
  $code = curl.exe -s -o NUL -w '%{http_code}' --max-time 10 $URL
  if ($code -match '^[23]') { Write-Host ('tunnel up, HTTP ' + $code); exit 0 }
  Write-Host -NoNewline '.'
}
Write-Host ''
Write-Host 'not reachable within 90s - check cloudflared.log'
exit 1
