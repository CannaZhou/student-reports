$ErrorActionPreference = 'Continue'
$CFD   = 'C:\Users\admin\bin\cloudflared.exe'
$APP   = 'F:\cursor20260624\_lessonquiz\app'
$PORT  = 7000
$URL   = 'https://lesson.aizqxx.top'
$LOGE  = 'F:\cursor20260624\_lessonquiz\tunnel_recent.err'

# 隧道参数（2026-09-21 踩坑）：学校出口把 UDP 7844 丢包、而且本机 IPv6 出不去，
# 云端 DNS 又把 AAAA 记录排在 A 前面，于是 cloudflared 挨个试 QUIC/IPv6 全超时，
# 最后报 "Could not lookup srv records ... timeout" 自己退出。
# 实测固定走 IPv4 + http2 就能稳定连上（注册 3 条连接）。
$CFDARGS = @('tunnel', '--edge-ip-version', '4', '--protocol', 'http2', 'run', 'aizqxx')

Add-Type -AssemblyName System.Windows.Forms

# 学校 DNS 会时不时整体超时、或者只把 AAAA(IPv6) 记录排在前面，而本机 IPv6 出不去。
# 这时 curl 直接回 000，脚本就会误判成"公网不可达"→ 把好端端的隧道杀掉重来 → 死循环。
# 所以：本机解析失败时，改用公共 DNS 查 IPv4，再用 curl --resolve 绕开本机解析重试一次。
$script:IpCache = @{}
function Resolve-Ipv4($hst) {
  if ($script:IpCache.ContainsKey($hst)) { return $script:IpCache[$hst] }
  foreach ($srv in @('223.5.5.5', '119.29.29.29')) {
    try {
      $r = Resolve-DnsName $hst -Type A -Server $srv -DnsOnly -QuickTimeout -ErrorAction Stop
      $ip = ($r | Where-Object { $_.IPAddress -and $_.IPAddress -notmatch ':' } | Select-Object -First 1).IPAddress
      if ($ip) { $script:IpCache[$hst] = $ip; return $ip }
    } catch {}
  }
  return ''
}

# 判断公网地址是否可用（只要 2xx/3xx，排除 000/502/530 等）
function Test-Live($u, $timeoutSec = 10) {
  $code = curl.exe -s -o NUL -w '%{http_code}' --max-time $timeoutSec $u
  if ($code -match '^[23]') { return $true }
  $hst = ([Uri]$u).Host
  $ip = Resolve-Ipv4 $hst
  if (-not $ip) { return $false }
  Write-Host ('      （本机解析失败，改用 ' + $ip + ' 重试）')
  $code = curl.exe -s -o NUL -w '%{http_code}' --max-time $timeoutSec --resolve ($hst + ':443:' + $ip) $u
  return ($code -match '^[23]')
}

# 学校 DNS（60.191.244.5）慢且不稳定，cloudflared 内部 DNS 超时又很短，
# 经常 SRV 记录还没查回来就自己退出。先把隧道要用的记录查进系统 DNS 缓存，
# 再启动 cloudflared，成功率明显提高。
function Warm-Dns {
  foreach ($n in @('_v2-origintunneld._tcp.argotunnel.com', '_origintunneld._tcp.argotunnel.com')) {
    try { Resolve-DnsName -Name $n -Type SRV -DnsOnly -ErrorAction Stop | Out-Null } catch {}
  }
  foreach ($n in @('region1.v2.argotunnel.com', 'region2.v2.argotunnel.com')) {
    try { Resolve-DnsName -Name $n -DnsOnly -ErrorAction Stop | Out-Null } catch {}
  }
}

# 启动隧道并等它生效；一轮没起来就杀掉重来（DNS 抖动时重试比死等有效）
function Start-Tunnel {
  param([int]$Attempts = 3, [int]$WaitPerTry = 8)   # 每轮 8 x 5 = 40 秒
  for ($a = 1; $a -le $Attempts; $a++) {
    Write-Host ('      第 ' + $a + '/' + $Attempts + ' 次尝试连接隧道...')
    Warm-Dns
    $p = Start-Process -FilePath $CFD -ArgumentList $CFDARGS `
         -WorkingDirectory 'C:\Users\admin' -WindowStyle Minimized -PassThru `
         -RedirectStandardError $LOGE -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt $WaitPerTry; $i++) {
      Start-Sleep -Seconds 5
      if (Test-Live $URL) { return $true }
      Write-Host -NoNewline '.'
    }
    Write-Host ''
    Write-Host '      本轮没连上，关掉重来一次。'
    if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
  }
  return $false
}

Write-Host '=========================================='
Write-Host '  信息科技 分课课堂检测系统  一键启动'
Write-Host ('  (node 端口 ' + $PORT + ' + 公网隧道 lesson.aizqxx.top)')
Write-Host '=========================================='

# ---------- 1) node（端口 7000） ----------
$nodeOk = $false
if (Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue) {
  $nodeOk = $true
  Write-Host ('[1/3] node 已在运行（端口 ' + $PORT + '）')
} else {
  Write-Host ('[1/3] 正在启动 node（端口 ' + $PORT + '）...')
  Start-Process node -ArgumentList 'server.js' -WorkingDirectory $APP -WindowStyle Minimized
  for ($i = 0; $i -lt 15; $i++) {            # 最长约 30 秒
    Start-Sleep -Seconds 2
    if (Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue) { $nodeOk = $true; break }
  }
  if ($nodeOk) { Write-Host '      node 已起来' }
  else { Write-Host '      [警告] 30 秒内 node 未监听 7000，请查看 app 目录下的日志' }
}

# ---------- 2) cloudflared 公网隧道 ----------
if (Test-Live $URL) {
  Write-Host '[2/3] 公网隧道正在服务'
} else {
  Write-Host '[2/3] 公网暂不可达，正在启动隧道（最长约 2 分钟）...'
  $cf = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
  $tunnelOk = $false
  if ($null -ne $cf) {
    Write-Host '      已检测到 cloudflared 进程，先等它注册（最多 30 秒）...'
    for ($i = 0; $i -lt 6; $i++) {
      Start-Sleep -Seconds 5
      if (Test-Live $URL) { $tunnelOk = $true; break }
      Write-Host -NoNewline '.'
    }
    Write-Host ''
    if (-not $tunnelOk) {
      Write-Host '      这个进程连不上，关掉重新启动。'
      Stop-Process -Id $cf.Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 2
    }
  }
  if (-not $tunnelOk) { $tunnelOk = Start-Tunnel }

  if (-not $tunnelOk) {
    Write-Host ''
    Write-Host '[失败] 2 分钟内公网仍未恢复，请检查：'
    Write-Host '  1. 本机能否上网 / DNS 是否正常（学校 DNS 60.191.244.5）'
    Write-Host '  2. cloudflared 是否被杀软或防火墙拦截'
    Write-Host '  3. 手动排查：cloudflared tunnel run aizqxx'
    Write-Host ('     日志：' + $LOGE)
    Write-Host ''
    Write-Host '  （学生端受影响，但教室局域网 http://localhost:7000 教师 /teacher 仍可用）'
    Read-Host '按回车退出'
    exit 1
  }
}

# ---------- 3) 结果确认 ----------
if (Test-Live $URL) {
  Write-Host ''
  Write-Host '=========================================='
  Write-Host ('  学生入口:  ' + $URL)
  Write-Host ('  教师入口:  ' + $URL + '/teacher')
  Write-Host '  地址已复制到剪贴板'
  Write-Host '=========================================='
  Set-Clipboard $URL
  [System.Windows.Forms.MessageBox]::Show("课堂检测系统已经就绪`n`n学生访问：$URL`n教师入口：$URL/teacher`n`n地址已复制到剪贴板，发给学生即可。", '分课课堂检测系统 - 启动成功', 'OK', 'Information') | Out-Null
} else {
  Write-Host '[警告] 公网检查仍未通过，请按上方提示排查；局域网仍可用 http://localhost:7000。'
  Read-Host '按回车退出'
}
