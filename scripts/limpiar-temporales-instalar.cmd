@echo off
REM Registra la LIMPIEZA SEMANAL de %TEMP% como TAREA PROGRAMADA de Windows. Se corre UNA sola vez, a mano (F69, 18/11/2026).
REM
REM Por que: la cache de transpilado de tsx (%TEMP%\tsx-<usuario>) crece hasta 1 GB por dia y nadie la poda. El 6/11/2026
REM tenia 216.852 entradas (docs/hallazgos-infra.md). scripts/limpiar-temporales.mjs la vacia POR DENTRO y nunca toca lo
REM de los ultimos 2 dias, que lo puede estar usando un test de cualquier chat.
REM
REM OJO: lo instala Martin. Ninguna sesion de Claude lo corre: borra cientos de miles de archivos en su maquina.
REM
REM La tarea corre como el usuario que la instala (el %TEMP% que se barre es el suyo), los lunes a las 13:17. Si la PC
REM estaba apagada a esa hora, corre apenas se prende. Lo que borra queda en %LOCALAPPDATA%\mako\limpiar-temporales.log.
REM
REM   node scripts\limpiar-temporales.mjs                     antes de instalarla: dice que borraria, sin borrar nada
REM   schtasks /run    /tn "mako-limpiar-temporales"          correrla ahora
REM   schtasks /query  /tn "mako-limpiar-temporales" /v       ver la ultima corrida y su resultado
REM   type "%LOCALAPPDATA%\mako\limpiar-temporales.log"       ver que borro
REM   schtasks /delete /tn "mako-limpiar-temporales" /f       sacarla

setlocal
set "TAREA=%~dp0limpiar-temporales-semanal.cmd"
if not exist "%TAREA%" (
  echo.
  echo   No encuentro %TAREA%.
  exit /b 1
)

REM El node de ESTA maquina, con su ruta entera: la tarea no siempre arranca con el mismo PATH que la terminal.
set "NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE (
  echo.
  echo   No encuentro node en el PATH. Abre una terminal donde "node --version" ande y vuelve a correr esto.
  exit /b 1
)

REM /f pisa la tarea si ya existia: correr esto dos veces deja una sola.
schtasks /create /tn "mako-limpiar-temporales" /f /sc WEEKLY /d MON /st 13:17 ^
  /tr "\"%TAREA%\" \"%NODE%\""

if errorlevel 1 (
  echo.
  echo   No se pudo registrar la tarea.
  exit /b 1
)

REM Que corra al prenderse si la hora la encontro apagada, tambien con bateria, y con un tope de dos horas.
powershell -NoProfile -Command "Set-ScheduledTask -TaskName 'mako-limpiar-temporales' -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2))" >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Tarea registrada, pero no pude pedirle que corra al prender la PC: si el lunes a las 13:17 esta apagada, se saltea esa semana.
)

echo.
echo   Tarea "mako-limpiar-temporales" registrada: los lunes a las 13:17. Para correrla ahora:  schtasks /run /tn "mako-limpiar-temporales"
