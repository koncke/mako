@echo off
REM Registra el VIGILANTE de la cola de enriquecimiento. Se corre UNA sola vez.
REM
REM Por que hace falta uno aparte: `cursos-perro` mira la cola normal (cursos-cola /
REM cola.log). El perro ahora toma la tarea, el log y el lock por argumento, con los valores
REM viejos como default — asi que es EL MISMO script, no una copia. Una copia garantiza que
REM el proximo arreglo entre en una sola de las dos.
REM
REM Que hace: cada 15 minutos mira si la cola escribio. A los 20 min sin escribir y sin
REM procesos esta muerta; a los 45 esta colgada aunque tenga procesos vivos. En los dos
REM casos mata el ARBOL, libera el lock si quedo huerfano, y la vuelve a lanzar.
REM
REM Cuando la cola esta sana no escribe NADA, a proposito: asi su log se lee de un vistazo.
REM
REM   schtasks /query /tn "cursos-enriquecer-perro"    ver si esta activo
REM   schtasks /end   /tn "cursos-enriquecer-perro"    frenarlo
REM   schtasks /delete /tn "cursos-enriquecer-perro" /f   sacarlo cuando la cola termine
REM
REM Su log: C:\cursos\perro-cursos-enriquecer.log

set BASH=C:\Program Files\Git\bin\bash.exe
set PERRO=C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\scripts\cursos-perro.sh

schtasks /create /tn "cursos-enriquecer-perro" /f /sc MINUTE /mo 15 ^
  /tr "\"%BASH%\" \"%PERRO%\" cursos-enriquecer C:/cursos/enriquecer.log C:/cursos/_enriquecer.lock"
