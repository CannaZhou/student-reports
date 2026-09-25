# 注册/更新看门狗计划任务（重复运行安全，会覆盖旧任务）
# 用得着的话右键「以管理员身份运行 PowerShell」后执行一次即可。
$ErrorActionPreference = 'Stop'

$TaskName = 'LessonQuizWatchdog'
$Script   = 'F:\cursor20260624\_lessonquiz\tools\watchdog.ps1'
# 用 wscript 包一层启动 powershell：直接调 powershell.exe 时 Windows 会先建出
# 控制台窗口再执行 -WindowStyle Hidden，结果就是每分钟闪一个黑框。
$Vbs      = 'F:\cursor20260624\_lessonquiz\tools\run_hidden.vbs'

if (-not (Test-Path $Script)) { throw ('找不到看门狗脚本：' + $Script) }
if (-not (Test-Path $Vbs))    { throw ('找不到隐藏启动脚本：' + $Vbs) }

$Action = New-ScheduledTaskAction -Execute 'wscript.exe' `
  -Argument ('//B //Nologo "' + $Vbs + '"')

# 登录时跑一次 + 之后每分钟跑一次（持续 3650 天）
$Trigger1 = New-ScheduledTaskTrigger -AtLogOn
$Trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)

$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# 以当前登录用户身份运行，权限和老师手动双击 start_lesson.ps1 时一致
$Principal = New-ScheduledTaskPrincipal -UserId ($env:USERDOMAIN + '\' + $env:USERNAME) `
  -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger1, $Trigger2 `
  -Settings $Settings -Principal $Principal -Force | Out-Null

Write-Host ('已注册计划任务：' + $TaskName)
Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo |
  Select-Object TaskName, LastRunTime, NextRunTime | Format-List
