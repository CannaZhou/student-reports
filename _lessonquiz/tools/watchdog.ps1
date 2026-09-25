# 分课课堂检测系统 看门狗
# 由计划任务每分钟调用一次：7 0 0 端口没服务就重新拉起 node；隧道进程不在就重新拉起隧道。
# 只做「补起来」，不碰正在正常运行的服务，因此可以随便重复跑。
$ErrorActionPreference = 'Continue'

$DIR     = 'F:\cursor20260624\_lessonquiz'
$APP     = $DIR + '\app'
$PORT    = 7000
$LOG     = $DIR + '\watchdog.log'
$NODEOUT = $DIR + '\server_out.log'
$NODEERR = $DIR + '\server_err.log'
$CFDERR  = $DIR + '\tunnel_recent.err'
$STATE   = $DIR + '\.watchdog_laststart'
$CFD     = 'C:\Users\admin\bin\cloudflared.exe'

function Write-Log($msg) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $msg
  Add-Content -Path $LOG -Value $line -Encoding UTF8
}

# 单个日志文件超过 512KB 就只留最后 200 行，防止无限增长
function Trim-Log($path) {
  $f = Get-Item $path -ErrorAction SilentlyContinue
  if ($f -and $f.Length -gt 512KB) {
    $keep = Get-Content $path -Tail 200 -ErrorAction SilentlyContinue
    Set-Content -Path $path -Value $keep -Encoding UTF8
  }
}

function Now-Seconds {
  return [int][double]::Parse((Get-Date -UFormat %s), [Globalization.CultureInfo]::InvariantCulture)
}

# ---------- 1) node（端口 7000）----------
$listening = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  # 防抖：45 秒内刚启动过就不再启动，避免 node 一启动就崩时疯狂拉进程
  $last = 0
  if (Test-Path $STATE) { [int]::TryParse((Get-Content $STATE -Raw -ErrorAction SilentlyContinue).Trim(), [ref]$last) | Out-Null }
  if ((Now-Seconds) - $last -ge 45) {
    Set-Content -Path $STATE -Value (Now-Seconds) -Encoding ASCII
    Trim-Log $NODEOUT
    Trim-Log $NODEERR
    # 用 cmd 包一层是为了让 node 的输出以追加方式落盘，保留上一次崩溃的最后现场
    Start-Process cmd -ArgumentList ('/c node server.js >> ' + $NODEOUT + ' 2>&1') `
      -WorkingDirectory $APP -WindowStyle Hidden
    Write-Log ('node 未监听 ' + $PORT + '，已重新启动（日志见 server_out.log / server_err.log）')
  }
}

# ---------- 2) cloudflared 隧道进程 ----------
# 只判断「进程在不在」，不根据网址通不通来决定重启：
# 学校 DNS 抖动时网址会短暂不通，那时重启隧道只会把好端端的隧道搅乱。
if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
  if (Test-Path $CFD) {
    Trim-Log $CFDERR
    # 必须跟 start_lesson.ps1 用同一套参数：学校出口丢 UDP 7844、本机 IPv6 不通，
    # 默认参数会让 cloudflared 在 QUIC/IPv6 上反复超时后自己退出。
    Start-Process -FilePath $CFD -ArgumentList @('tunnel', '--edge-ip-version', '4', '--protocol', 'http2', 'run', 'aizqxx') -WorkingDirectory 'C:\Users\admin' `
      -WindowStyle Hidden -RedirectStandardError $CFDERR
    Write-Log 'cloudflared 进程不存在，已重新启动隧道'
  } else {
    Write-Log ('cloudflared 不存在：' + $CFD)
  }
}
