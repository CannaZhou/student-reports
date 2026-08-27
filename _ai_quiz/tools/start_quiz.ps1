$ErrorActionPreference = 'Continue'
$CFD   = 'C:\Users\admin\bin\cloudflared.exe'
$LOGF  = 'F:\cursor20260624\_ai_quiz\tunnel.log'
$LOGE  = 'F:\cursor20260624\_ai_quiz\tunnel.log.err'
$APP   = 'F:\cursor20260624\_ai_quiz\app'
$PAT   = 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'

Add-Type -AssemblyName System.Windows.Forms

# 安全读取日志文本：空文件/被占用/不存在 一律返回空串，绝不返回 null
function Get-LogText($f) {
  $c = Get-Content $f -Raw -ErrorAction SilentlyContinue
  if ($null -eq $c) { return '' }
  return [string]$c
}

function Show-Popup($url) {
  Set-Clipboard $url
  [System.Windows.Forms.MessageBox]::Show(
    "公网地址(已复制到剪贴板)：`n`n$url`n`n请到 教师端-总览-公网访问 粘贴该地址，重新生成二维码",
    'AI答题系统 启动成功', 'OK', 'Information') | Out-Null
}

Write-Host '=========================================='
Write-Host '   AI知识竞赛答题系统  一键启动'
Write-Host '=========================================='
Write-Host ''

if (-not (Test-Path $CFD)) {
  Write-Host "错误：未找到 cloudflared.exe  ->  $CFD"
  Write-Host '请先下载 cloudflared 放到 C:\Users\admin\bin\ 目录'
  Read-Host '按回车键退出'
  exit 1
}

# ---- 若已有可用地址，直接给出 ----
if (Test-Path $LOGF) {
  $old = [regex]::Match((Get-LogText $LOGF) + (Get-LogText $LOGE), $PAT)
  if ($old.Success -and (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
    Show-Popup $old.Value
    Write-Host "已有公网地址：$($old.Value)（已复制到剪贴板）"
    exit 0
  }
}
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue

# ---- 启动答题服务 ----
if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host '答题服务已运行（端口8080），无需重复启动'
} else {
  Write-Host '正在启动答题服务（端口8080）...'
  Start-Process node -ArgumentList 'server.js' -WorkingDirectory $APP -WindowStyle Minimized
  Start-Sleep -Seconds 3
}

# ---- 隧道自动重试 ----
Write-Host ''
Write-Host '正在尝试获取公网地址，请稍候...'
Write-Host '若学校网络未恢复，脚本会每30秒自动重试，请保持此窗口开启'
Write-Host ''

$try = 0
while ($true) {
  $try++
  Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Remove-Item $LOGF, $LOGE -Force -ErrorAction SilentlyContinue

  Start-Process -FilePath $CFD -ArgumentList @('tunnel','--protocol','http2','--url','http://localhost:8080') `
    -RedirectStandardOutput $LOGF -RedirectStandardError $LOGE -WindowStyle Minimized -ErrorAction SilentlyContinue

  $url = $null
  for ($i = 0; $i -lt 14 -and -not $url; $i++) {
    Start-Sleep -Seconds 3
    $m = [regex]::Match((Get-LogText $LOGF) + (Get-LogText $LOGE), $PAT)
    if ($m.Success) { $url = $m.Value }
  }

  if ($url) {
    Write-Host ''
    Write-Host '=========================================='
    Write-Host "  公网地址：$url"
    Write-Host '  （已自动复制到剪贴板）'
    Write-Host '=========================================='
    Show-Popup $url
    exit 0
  }
  Write-Host "  第 $try 次尝试未连上，学校网络可能未恢复，30秒后自动重试..."
  Start-Sleep -Seconds 30
}
