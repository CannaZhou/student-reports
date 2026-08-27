$ids = @('KWPP.Application.9','WPP.Application.9','WPS.Application.9','KWPS.Application.9','Kwpp.Application.9','KWPP.Application','WPP.Application')
foreach ($id in $ids) {
  try {
    $o = New-Object -ComObject $id
    Write-Output ("OK  " + $id)
    try { $o.Quit() } catch {}
    $null = [System.Runtime.Interopservices.Marshal]::ReleaseComObject($o)
  } catch {
    Write-Output ("FAIL " + $id)
  }
}
