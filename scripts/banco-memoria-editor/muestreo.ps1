param([int]$raiz)
# Suma la memoria privada del Chrome del banco (el principal y sus hijos) cada ~200 ms.
while ($true) {
  $ps = Get-CimInstance Win32_Process -Filter "ProcessId=$raiz or ParentProcessId=$raiz" -Property ProcessId,CommandLine,PrivatePageCount,PeakPageFileUsage
  if (-not $ps) { break }
  $tot = 0; $ren = 0; $gpu = 0; $pren = 0; $pgpu = 0
  foreach ($p in $ps) {
    $m = [double]$p.PrivatePageCount
    $tot += $m
    $pk = [double]$p.PeakPageFileUsage * 1KB
    if ($p.CommandLine -like "*--type=renderer*") { if ($m -gt $ren) { $ren = $m }; if ($pk -gt $pren) { $pren = $pk } } elseif ($p.CommandLine -like '*--type=gpu-process*') { $gpu += $m; $pgpu = $pk }
  }
  $libre = (Get-CimInstance Win32_OperatingSystem -Property FreePhysicalMemory).FreePhysicalMemory
  "{0} {1} {2} {3} {4} {5}" -f [int]($tot / 1MB), [int]($ren / 1MB), [int]($gpu / 1MB), [int]($libre / 1KB), [int]($pren / 1MB), [int]($pgpu / 1MB)
  Start-Sleep -Milliseconds 200
}
