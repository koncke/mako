@echo off
REM Registra la cola de ENRIQUECIMIENTO como tarea programada de Windows. Se corre UNA vez.
REM
REM Por que una tarea programada y no una tarea de fondo de Claude: el harness mata el grupo
REM de procesos cuando la sesion termina, y el 27/08/2026 eso corto la cola a mitad de un
REM curso sin dejar un solo error en el log. Un trabajo de horas no puede colgar de la
REM sesion. La tarea corre bajo el servicio de Windows y sobrevive a que se cierre Claude.
REM
REM Que hace: transcribe y republica las clases que `curso-enriquecer-desde-drive.mjs` sumo
REM a cursos ya publicados. La lista vive en C:\cursos\_enriquecer-cola.txt, un slug (o
REM nombre de carpeta) por linea.
REM
REM Despues de instalarla:
REM   schtasks /run   /tn "cursos-enriquecer"     lanzarla ahora
REM   schtasks /query /tn "cursos-enriquecer"     ver si esta corriendo
REM   schtasks /end   /tn "cursos-enriquecer"     frenarla
REM
REM Mirar el avance:  tail -f C:/cursos/enriquecer.log

set BASH=C:\Program Files\Git\bin\bash.exe
set COLA=C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\scripts\cursos-enriquecer-cola.sh

REM /sc ONCE + una hora lejana: no queremos que arranque sola, solo poder lanzarla a mano.
REM /f pisa la tarea si ya existia.
schtasks /create /tn "cursos-enriquecer" /f /sc ONCE /st 23:59 ^
  /tr "\"%BASH%\" \"%COLA%\" --lista C:/cursos/_enriquecer-cola.txt"
