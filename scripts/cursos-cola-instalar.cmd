@echo off
REM Registra la cola de cursos como TAREA PROGRAMADA de Windows. Se corre UNA sola vez.
REM
REM Por que una tarea programada y no una tarea de fondo: el harness de Claude mata el
REM grupo de procesos cuando la sesion termina, y el 27/08/2026 eso corto la cola a mitad
REM de monetizatube sin dejar un solo error en el log. La tarea programada corre bajo el
REM servicio de Windows y sobrevive a que se cierre Claude o la terminal.
REM
REM Despues de instalarla:
REM   schtasks /run   /tn "cursos-cola"     lanzarla ahora
REM   schtasks /query /tn "cursos-cola"     ver si esta corriendo
REM   schtasks /end   /tn "cursos-cola"     frenarla

set BASH=C:\Program Files\Git\bin\bash.exe
set COLA=C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\scripts\cursos-cola.sh

REM /sc ONCE + /st a una hora lejana: no queremos que arranque sola, solo poder lanzarla
REM a mano con `schtasks /run`. /f pisa la tarea si ya existia.
schtasks /create /tn "cursos-cola" /f /sc ONCE /st 23:59 ^
  /tr "\"%BASH%\" \"%COLA%\""

if errorlevel 1 (
  echo.
  echo   No se pudo registrar la tarea.
  exit /b 1
)

echo.
echo   Tarea "cursos-cola" registrada. Para lanzarla:  schtasks /run /tn "cursos-cola"
