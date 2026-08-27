$ErrorActionPreference = 'Stop'
$ppt = New-Object -ComObject KWPP.Application
$ppt.Visible = $false
$src = 'f:\桌面\桌面所有图标\工作复盘\教师\工作\2025522学校家长会（改）.pptx'
$out = 'F:\cursor20260624\_ai_quiz\tools\render'
New-Item -ItemType Directory -Force -Path $out | Out-Null
try {
  $pres = $ppt.Presentations.Open($src, $true, $false, $false)
  Write-Output ("Slides: " + $pres.Slides.Count)
  for ($i=1; $i -le $pres.Slides.Count; $i++) {
    $p = Join-Path $out ("tpl_" + $i + ".png")
    $pres.Slides.Item($i).Export($p, "PNG", 1333, 750)
    Write-Output ("exported " + $p)
  }
  $pres.Close()
} catch {
  Write-Output ("ERR: " + $_.Exception.Message)
} finally {
  $ppt.Quit()
}
