Write-Host '正在停止 AI答题系统...'
Write-Host ''

# 停止隧道
$cf = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($cf) {
  $cf | Stop-Process -Force
  Write-Host '[OK] 已停止 隧道进程(cloudflared)'
} else {
  Write-Host '[--] 未检测到 cloudflared 进程'
}

# 停止答题服务（占用8080的进程）
$conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] 已停止 答题服务(端口8080, PID $pid)"
  }
} else {
  Write-Host '[--] 未检测到运行中的答题服务(8080)'
}

Write-Host ''
Write-Host '完成。如需再次使用，双击【启动答题系统.bat】即可。'
