@echo off
REM Lo corre la tarea programada "mako-limpiar-temporales" (la registra scripts\limpiar-temporales-instalar.cmd, F69).
REM No se corre a mano: para ver que borraria, sin borrar nada, va  node scripts\limpiar-temporales.mjs
REM
REM %1 es el node que el instalador encontro en esta maquina. Sin el, el del PATH.
REM Cada corrida suma su fecha y lo que borro a %LOCALAPPDATA%\mako\limpiar-temporales.log.

setlocal
set "NODE=%~1"
if "%NODE%"=="" set "NODE=node"
set "LOGDIR=%LOCALAPPDATA%\mako"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "LOG=%LOGDIR%\limpiar-temporales.log"

echo ==== %DATE% %TIME% >> "%LOG%"
"%NODE%" "%~dp0limpiar-temporales.mjs" --aplicar >> "%LOG%" 2>&1
exit /b %errorlevel%
