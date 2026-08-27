$keys = Get-ChildItem 'HKLM:\SOFTWARE\Classes' -ErrorAction SilentlyContinue
foreach ($k in $keys) {
  if ($k.PSChildName -match '^(kw|wpp|wps)') { Write-Output $k.PSChildName }
}
$keys2 = Get-ChildItem 'HKCU:\Software\Classes' -ErrorAction SilentlyContinue
foreach ($k in $keys2) {
  if ($k.PSChildName -match '^(kw|wpp|wps)') { Write-Output $k.PSChildName }
}
