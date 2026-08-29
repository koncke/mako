@echo off
REM Registra EL PERRO de la cola: mira cada 15 minutos que siga viva y la levanta si murio.
REM Se corre UNA sola vez.
REM
REM Existe porque la cola ya se murio TRES veces por motivos distintos, y las tres el costo
REM no fue la muerte sino el tiempo hasta que alguien miro: la ultima, SIETE HORAS Y MEDIA.
REM Arreglar causas de a una no cierra eso; lo cierra que algo mire solo.
REM
REM   tail -30 C:/cursos/perro.log          ver que hizo
REM   schtasks /end /tn "cursos-perro"      frenarlo
REM   schtasks /delete /tn "cursos-perro" /f   sacarlo

set BASH=C:\Program Files\Git\bin\bash.exe
set PERRO=C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\scripts\cursos-perro.sh

schtasks /create /tn "cursos-perro" /f /sc MINUTE /mo 15 /tr "\"%BASH%\" \"%PERRO%\""

if errorlevel 1 ( echo.& echo   No se pudo registrar el perro.& exit /b 1 )
echo.
echo   Perro registrado: mira cada 15 minutos. Log en C:\cursos\perro.log
