$ids = @('KWPP.Application','WPP.Application','WPS.Application','Kwpp.Application','KWPP.UOFPresentation.9','WPP.PPTX.6')
foreach ($id in $ids) {
  try {
    $o = New-Object -ComObject $id
    Write-Output ("OK  " + $id)
    $o.Quit() 2>$null
    $null = [System.Runtime.Interopservices.Marshal]::ReleaseComObject($o)
  } catch {
    Write-Output ("FAIL " + $id + " :: " + $_.Exception.Message.Substring(0,40))
  }
}
