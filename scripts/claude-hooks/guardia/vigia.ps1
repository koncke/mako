# =============================================================================
# vigia.ps1 — último recurso: si la RAM entra en zona roja, matar lo pesado
# y re-ejecutable ANTES de que Windows pagine hasta colgar la app de Claude.
# =============================================================================
# POR QUE EXISTE: la guardia (memoria.mjs) sólo decide si algo ARRANCA. Lo que
# ya arrancó puede seguir creciendo: el 11/10/2026 un `next dev` huérfano llegó a
# 8,1 GB de memoria privada (empezó a las 04:59; la app murió a las 05:07 con 7
# chats; matarlo devolvió 4,6 GB en 3 segundos). Un `tsc` de este repo pide 3 GB.
#
# QUE MATA (sólo esto, y de a uno): procesos node que son trabajo re-ejecutable:
#   - tsc / vitest / jest / eslint / playwright / next build  (se vuelven a correr)
#   - next dev  (se relanza en segundos; el nuevo arranca en 1-2 GB)
# NUNCA: Claude, Chrome, npm ci/install (dejaría node_modules a medias), nada más.
#
# CUANDO:
#   - Zona roja: < 0,9 GB disponibles durante 3 lecturas seguidas (~12 s) ->
#     el más grande de la lista.
#   - Fuga: un `next dev` con más de 5 GB privados, con cualquier RAM. Un dev
#     server de ese tamaño en una máquina de 16 GB no es trabajo: es una fuga.
#
# Corre como tarea programada al iniciar sesión ("mako-vigia-ram"). Instancia
# única por mutex. Escribe en ~/.claude/guardia/guardia.log y vigia.csv.
# =============================================================================

$ErrorActionPreference = 'SilentlyContinue'
$dir = Join-Path $env:USERPROFILE '.claude\guardia'
$log = Join-Path $dir 'guardia.log'
$csv = Join-Path $dir 'vigia.csv'
New-Item -ItemType Directory -Force $dir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, 'Global\mako-vigia-ram')
if (-not $mutex.WaitOne(0)) { exit 0 }

$ROJA_MB = 900
$LECTURAS_ROJAS = 3
$FUGA_DEV_MB = 5120
$SONDEO_S = 4
$ENFRIAMIENTO_S = 15

$PESADOS = 'typescript[\\/]bin[\\/]tsc|[\\/]\.bin[\\/]tsc|vitest|[\\/]jest|eslint|playwright|next(\.js)?["'' ]+build|next[\\/]dist[\\/]bin[\\/]next["'' ]+build'
$DEV = 'next[\\/]dist[\\/]server[\\/]lib[\\/]start-server|next[\\/]dist[\\/]bin[\\/]next["'' ]+dev|next-server'

function Log($m) { Add-Content -Path $log -Value ("{0} [vigia] {1}" -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'), $m) -Encoding utf8 }
function LibreMB { [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB) }

function Candidatos {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
    $cmd = [string]$_.CommandLine
    $tipo = if ($cmd -match $PESADOS) { 'pesado' } elseif ($cmd -match $DEV) { 'dev' } else { $null }
    if ($tipo) {
      $p = Get-Process -Id $_.ProcessId
      if ($p) {
        [pscustomobject]@{ Id = $_.ProcessId; Tipo = $tipo; PrivMB = [math]::Round($p.PrivateMemorySize64 / 1MB); Cmd = ($cmd -replace '\s+', ' ') }
      }
    }
  }
}

function Matar($c, $motivo, $libre) {
  # /T: el árbol entero (un next dev deja hijos postcss/turbopack).
  & taskkill.exe /PID $c.Id /T /F | Out-Null
  $corto = $c.Cmd.Substring(0, [Math]::Min(160, $c.Cmd.Length))
  Log ("MATO pid {0} ({1}, {2} MB privados) por {3}; libre antes {4} MB :: {5}" -f $c.Id, $c.Tipo, $c.PrivMB, $motivo, $libre, $corto)
  if (-not (Test-Path $csv)) { 'fecha,motivo,libre_mb,pid,tipo,priv_mb,comando' | Set-Content $csv -Encoding utf8 }
  ('{0},{1},{2},{3},{4},{5},"{6}"' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'), $motivo, $libre, $c.Id, $c.Tipo, $c.PrivMB, ($corto -replace '"', "'")) | Add-Content $csv -Encoding utf8
}

Log "arranca (zona roja < $ROJA_MB MB x$LECTURAS_ROJAS; fuga next dev > $FUGA_DEV_MB MB)"
$rojas = 0
$ultimoKill = [datetime]::MinValue

while ($true) {
  $libre = LibreMB
  $rojas = if ($libre -lt $ROJA_MB) { $rojas + 1 } else { 0 }
  $enfriando = ((Get-Date) - $ultimoKill).TotalSeconds -lt $ENFRIAMIENTO_S

  if (-not $enfriando) {
    $cands = @(Candidatos)
    $fuga = $cands | Where-Object { $_.Tipo -eq 'dev' -and $_.PrivMB -gt $FUGA_DEV_MB } | Sort-Object PrivMB -Descending | Select-Object -First 1
    if ($fuga) {
      Matar $fuga 'fuga-next-dev' $libre; $ultimoKill = Get-Date; $rojas = 0
    } elseif ($rojas -ge $LECTURAS_ROJAS) {
      $c = $cands | Where-Object { $_.PrivMB -gt 300 } | Sort-Object PrivMB -Descending | Select-Object -First 1
      if ($c) { Matar $c 'zona-roja' $libre; $ultimoKill = Get-Date }
      else { Log "zona roja ($libre MB) sin nada que pueda matar" }
      $rojas = 0
    }
  }
  Start-Sleep -Seconds $SONDEO_S
}
