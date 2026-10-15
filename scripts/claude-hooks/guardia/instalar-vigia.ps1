# =============================================================================
# instalar-vigia.ps1 — deja vigia.ps1 como tarea programada al iniciar sesión
# =============================================================================
# Uso (no pide admin):  powershell -ExecutionPolicy Bypass -File instalar-vigia.ps1
#
# ⚠️ La prioridad va en 3 (alta-normal), a propósito. Task Scheduler lanza por
# default con prioridad 7 (bajo normal, con memoria y E/S de baja prioridad) y
# medido el 11/10/2026: así el vigía quedó con 0,015 s de CPU y 3 MB, sin llegar
# a ejecutar una línea, justo cuando la máquina estaba cargada — que es el único
# momento en que tiene que actuar.
# =============================================================================

$script = Join-Path $PSScriptRoot 'vigia.ps1'
$yo = "$env:USERDOMAIN\$env:USERNAME"

$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
# Dos disparadores. Al iniciar sesión, y además CADA 5 MINUTOS para siempre: el
# vigía se muere (13/10 estuvo 6 horas caído sin que nadie se enterara, porque el
# único disparador era AtLogon). Si está vivo, el reintento no hace nada
# (`-MultipleInstances IgnoreNew` y el mutex del script); si murió, lo levanta.
# Por eso `Stop-ScheduledTask` ya no lo pausa: se pausa con ~/.claude/guardia/vigia-pausa.
$disparo = @(
  (New-ScheduledTaskTrigger -AtLogOn -User $yo),
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5))
)
$conf = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew -Priority 3
$quien = New-ScheduledTaskPrincipal -UserId $yo -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'mako-vigia-ram' -Action $accion -Trigger $disparo -Settings $conf `
  -Principal $quien -Force `
  -Description 'Mata tsc/tests/next dev si la RAM entra en zona roja, antes de que se cuelgue Claude. Ver ~/.claude/guardia/vigia.ps1' | Out-Null
Start-ScheduledTask -TaskName 'mako-vigia-ram'
Start-Sleep -Seconds 8
Get-Content (Join-Path $env:USERPROFILE '.claude\guardia\guardia.log') -Tail 1
