@echo off
REM Registra EL BARRIDO de disco: cada 6 horas libera el video local de los cursos que ya
REM estan en Drive. Se corre UNA sola vez.
REM
REM Existe porque el 29/08/2026 el disco llego a 815 MB de 455 GB. Liberar corria SOLO al
REM terminar cada curso, dentro de la cola: los que se cortaban a mitad nunca llegaban a
REM ese paso y se quedaban con su copia local para siempre. No fue un curso gigante,
REM fueron 74 cursos dejando cada uno su resto: 120 GB.
REM
REM Un paso de limpieza que depende del camino feliz es un paso que no se ejecuta.
REM
REM   tail -40 C:/cursos/liberar.log            ver que hizo
REM   sh scripts/cursos-liberar.sh              correrlo a mano
REM   node scripts/curso-liberables.mjs --ver   ver que hay para liberar, sin tocar nada
REM   schtasks /end /tn "cursos-liberar"        frenarlo
REM   schtasks /delete /tn "cursos-liberar" /f  sacarlo

set BASH=C:\Program Files\Git\bin\bash.exe
set BARRIDO=C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\scripts\cursos-liberar.sh

schtasks /create /tn "cursos-liberar" /f /sc HOURLY /mo 6 /tr "\"%BASH%\" \"%BARRIDO%\""

if errorlevel 1 ( echo.& echo   No se pudo registrar el barrido.& exit /b 1 )
echo.
echo   Barrido registrado: cada 6 horas. Log en C:\cursos\liberar.log
echo   Con mas de 60 GB libres no hace nada: solo barre cuando hace falta.
