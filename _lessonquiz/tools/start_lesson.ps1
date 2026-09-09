$ErrorActionPreference = 'Continue'
$CFD   = 'C:\Users\admin\bin\cloudflared.exe'
$APP   = 'F:\cursor20260624\_lessonquiz\app'
$PORT  = 7000
$URL   = 'https://lesson.aizqxx.top'

Add-Type -AssemblyName System.Windows.Forms

# 判断公网地址是否可用：接受 2xx/3xx，排除 000/502/530 等
function Test-Live($u, $timeoutSec = 10) {
  $code = curl.exe -s -o NUL -w '%{http_code}' --max-time $timeoutSec $u
  return ($code -match '^[23]')
}

Write-Host '=========================================='
Write-Host '  信息科技 分课课堂检测系统  一键启动'
Write-Host '  (node 端口 7000 + 公网隧道 lesson.aizqxx.top)'
Write-Host '=========================================='

# ---------- 1) node 服务（7000） ----------
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
  if ($nodeOk) { Write-Host '      node 已就绪' }
  else { Write-Host '      [警告] 30 秒内 node 未监听 7000，请双击原局域网脚本或查看 app 报错' }
}

# ---------- 2) cloudflared 公网隧道 ----------
if (Test-Live $URL) {
  Write-Host '[2/3] 公网隧道已在服务'
} else {
  Write-Host '[2/3] 公网暂不可达，启动/等待隧道（最长约 90 秒）...'
  $cf = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $cf) {
    Write-Host '      未检测到 cloudflared 进程，正在启动新隧道...'
    Start-Process -FilePath $CFD -ArgumentList @('tunnel','run','aizqxx') -WorkingDirectory 'C:\Users\admin' -WindowStyle Minimized
  } else {
    Write-Host '      已检测到 cloudflared 进程，等待其注册完成...'
  }
  $tunnelOk = $false
  for ($i = 0; $i -lt 18; $i++) {            # 18 x 5 = 90 秒
    Start-Sleep -Seconds 5
    if (Test-Live $URL) { $tunnelOk = $true; Write-Host ('      隧道已就绪（第 ' + ($i + 1) + ' 次检查通过）'); break }
    Write-Host -NoNewline '.'
  }
  if (-not $tunnelOk) {
    Write-Host ''
    Write-Host '[失败] 90 秒内公网未恢复，请检查：'
    Write-Host '  1. 本机能否上外网 / DNS 是否正常（学校 DNS 60.191.244.5）'
    Write-Host '  2. cloudflared 是否被杀毒软件或防火墙拦截'
    Write-Host '  3. 手动诊断：cloudflared tunnel run aizqxx'
    Write-Host ''
    Write-Host '  局域网不受影响，本机可先用 http://localhost:7000 （教师 /teacher）'
    Read-Host '回车退出'
    exit 1
  }
}

# ---------- 3) 最终确认 ----------
if (Test-Live $URL) {
  Write-Host ''
  Write-Host '=========================================='
  Write-Host ('  学生访问:  ' + $URL)
  Write-Host ('  教师管理:  ' + $URL + '/teacher')
  Write-Host '  地址已复制到剪贴板'
  Write-Host '=========================================='
  Set-Clipboard $URL
  [System.Windows.Forms.MessageBox]::Show("课堂检测系统已就绪。`n`n学生访问：$URL`n教师管理：$URL/teacher`n`n地址已复制到剪贴板，发给学生即可。", '分课课堂检测系统 - 启动成功', 'OK', 'Information') | Out-Null
} else {
  Write-Host '[警告] 最终检查未通过，按上方提示排查；局域网可先用 http://localhost:7000。'
  Read-Host '回车退出'
}
