$ErrorActionPreference = 'Continue'
$CFD   = 'C:\Users\admin\bin\cloudflared.exe'
$APP   = 'F:\cursor20260624\_ai_quiz\app'
$URL   = 'https://ai.aizqxx.top'
$LOGE  = 'F:\cursor20260624\_ai_quiz\tunnel_recent.err'

Add-Type -AssemblyName System.Windows.Forms

# 判断公网地址是否可用（只要 2xx/3xx，排除 000/502/530 等）
function Test-Live($u, $timeoutSec = 10) {
  $code = curl.exe -s -o NUL -w '%{http_code}' --max-time $timeoutSec $u
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
    $p = Start-Process -FilePath $CFD -ArgumentList @('tunnel','run','aizqxx') `
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
Write-Host '  AI知识学习系统  一键启动 (node + 公网隧道)'
Write-Host '=========================================='

# ---------- 1) node（端口 8080） ----------
$nodeOk = $false
if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
  $nodeOk = $true
  Write-Host '[1/3] node 已在运行（端口 8080）'
} else {
  Write-Host '[1/3] 正在启动 node ...'
  Start-Process node -ArgumentList 'server.js' -WorkingDirectory $APP -WindowStyle Minimized
  for ($i = 0; $i -lt 15; $i++) {            # 最长约 30 秒
    Start-Sleep -Seconds 2
    if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { $nodeOk = $true; break }
  }
  if ($nodeOk) { Write-Host '      node 已起来' }
  else { Write-Host '      [警告] 30 秒内 node 未监听 8080，请查看日志或重试' }
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
    Read-Host '按回车退出'
    exit 1
  }
}

# ---------- 3) 结果确认 ----------
if (Test-Live $URL) {
  Write-Host ''
  Write-Host '=========================================='
  Write-Host ('  访问地址:  ' + $URL)
  Write-Host '  已复制到剪贴板，发给学生即可开始'
  Write-Host '=========================================='
  Set-Clipboard $URL
  [System.Windows.Forms.MessageBox]::Show("访问地址已复制到剪贴板：`n`n$URL`n`n 发给学生即可使用", 'AI知识学习系统 - 启动成功', 'OK', 'Information') | Out-Null
} else {
  Write-Host '[警告] 公网检查仍未通过，请按上方提示排查后重试。'
  Read-Host '按回车退出'
}
