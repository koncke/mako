@echo off
REM Registra EL PUBLICADOR: cada 2 horas commitea y pushea los cursos que la cola dejo en
REM disco. Se corre UNA sola vez.
REM
REM Existe porque el ciclo se cortaba justo antes del final: la cola baja, transcribe, sube
REM a Drive, escribe la ficha y la importa al catalogo — y ahi se detiene. El curso queda
REM perfecto EN EL DISCO y el portal sigue mostrando lo de antes.
REM
REM Martin lo reporto el 29/08/2026: «en MaKo siguen siendo 73, no entiendo por que no
REM haces el ciclo completo». Medido: 81 fichas en disco, 77 en git. Cuatro cursos enteros
REM —videos en Drive, transcripciones hechas— que no existian para nadie.
REM
REM Cada 2 horas y no despues de cada curso: un push cuesta lo mismo dure lo que dure el
REM build, asi que agrupar sale mas barato que publicar de a uno.
REM
REM   tail -30 C:/cursos/publicar.log         ver que hizo
REM   sh scripts/cursos-publicar.sh           correrlo a mano
REM   schtasks /end /tn "cursos-publicar"     frenarlo
REM   schtasks /delete /tn "cursos-publicar" /f   sacarlo

set BASH=C:\Program Files\Git\bin\bash.exe
set PUB=C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\scripts\cursos-publicar.sh

schtasks /create /tn "cursos-publicar" /f /sc HOURLY /mo 2 /tr "\"%BASH%\" \"%PUB%\""

if errorlevel 1 ( echo.& echo   No se pudo registrar el publicador.& exit /b 1 )
echo.
echo   Publicador registrado: cada 2 horas. Log en C:\cursos\publicar.log
echo   Commitea SOLO las salidas del pipeline, por ruta explicita. Nunca git add -A.
