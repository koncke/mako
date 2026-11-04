# Relevo del Runner (04/11/2026, 12:10 UTC; cuenta claude5, 58% semanal, reinicia el 10/11 a las 18:00 UTC)

Cómo se opera: `~/.claude/operaciones/LEEME-cartero.md`, con el prompt del cron. Eso manda sobre este archivo.
Qué es cada pieza y cómo se crea la guardia: `~/.claude/operaciones/guardia-runner.md` (copia en `scripts/operaciones/`).

## Lo que corre ahora

- **El Runner es `local_bb1661c6…`** (Haiku), levantado solo por la guardia el 04/11 a las 11:57 UTC. Cron `5016b4a7` (vence el 11/11) y Monitor con `vigilar-continuo.sh`, que hay que rearmar en cada vencimiento.
- **La guardia:** tarea programada `runner-guardia-claude5`, en modo Auto y con Haiku. Corre a los minutos 7, 27 y 47, y la app le suma ~10 minutos: en los hechos, a los 17, 37 y 57.
- **`bitacora-sesion.sh` instalado:** al arrancar un chat, `runner-salud.mjs al-abrir` corrige el marcador con el uuid de la app. Copia anterior: `~/.claude/bitacora-sesion.sh.antes-04-11`.
- **`local_184238c7…`** (el chat que armó todo esto) ya no da vueltas: borré su cron. Le quedan dos recordatorios de una sola vez: `b5faee6f` (06/11, revisar el limbo) y `402bbd89` (10/11, rearmar el cron). Si ese chat se cierra, se pierden.
- **`local_ac844b1a…`** (el Runner viejo) sigue abierto y fijado, sin cron ni Monitor. No lo archivé.

## Lo pedido y lo hecho

Martín, 4/11: «me gustaría que trabajemos bajo la misma metodología que el resto, instalando la app o que corras un scrip o algo así para que siempre se detecte en que cuenta estoy y el uso... Porque te lo tengo que pedir cada que entro en una cuenta y eso debería ser autompatico. Y supongo que si no está el runner tampoco recibe mensajes, eso no debe pasar...».

- **El servicio** (cartero 1.26.1, estado de la PC en el Uso): en main desde `60290ac80`. MaKo contesta `{"servicio":true}` a `?servicio-listo=1`: la migración 0355 (la aplicó el Cerebro) y el deploy están.
- **La cuenta sale sola:** `CLAUDE_CODE_ACCOUNT_UUID` + `config.json → carpetas`, sólo con `source: startup`.
- **El uso se mide solo:** el Runner cada 10 minutos, la guardia si pasaron 30, y cualquier chat con `cartero.mjs medir` cuando el hook se lo pide.
- **Un Runner muerto se levanta solo:** probado rompiéndolo el 04/11: apagué el Monitor a las 11:49 UTC, y la corrida de las 11:57 lo encontró caído y en 44 s tomó el puesto, se renombró, midió, armó cron y Monitor, y avisó al Cerebro.

## Lo que espera a Martín

- **Instalar el servicio de Windows:** `node "C:/dev/wt-runner-servicio/scripts/operaciones/cartero.mjs" instalar-servicio`, y `explorer.exe` con `~/.claude/operaciones/mako-cartero.vbs` para no esperar al reinicio. Un chat no lo puede correr (`soloMartin`). Medido: el panel Terminal de la app da `esUnChat=false`, así que el botón Run sirve. Hasta entonces, `~/.claude/operaciones/cartero.mjs` sigue siendo la 1.24.0.
- **Archivar las corridas de la guardia:** cada una deja un chat en la lista y un proceso de ~270 MB, unas 72 por día. Regla suya: no se archivan sin su sí. El Cerebro se lo plantea. `runner-salud.mjs corridas` las lista.

## Lo que no se midió

- **El cambio real de una cuenta a otra.** Nada de esto se vio con Martín cambiando de cuenta. Lo medido es que el uuid existe en el chat y en la corrida, y lo cubre el test con el hook de verdad.
- **Las otras cuatro cuentas no tienen guardia.** Se crea en el primer chat donde Martín escriba al entrar, por el encargo del hook. Sin probar que un chat lo obedezca. Se crea sólo en un turno escrito en la app de la PC: desde el teléfono, la tarea no guarda el modo y se frena en un permiso.
- **Una entrega real del Runner levantado por la guardia.** Sólo se vio armado. `exigirRunner` lo deja pasar por nombre.
- **Si la app cierra sola el proceso de cada corrida.** Una sola medición: el de la corrida de las 10:57 UTC no estaba a las 11:37.
- **Las pantallas del estado de la PC,** en el Uso, como super admin. Nadie las miró.
- **Las carpetas de terminal:** no toqué `.claude-cuenta3` ni `.claude-martin`, sin sesiones desde el 15/10. Ahí la cuenta sigue saliendo del marcador.

## Sin hacer

- **El cron del Runner levantado vence el 11/11.** La medición sigue por `medirYa` de la guardia, pero el vigía se apaga. Falta que la guardia lo mire.
- **`CARTERO_VIVO_MS` sigue siendo un número suelto:** derivarlo del intervalo real pide columna y cartero nuevo. Dueño: Runner (`docs/pendientes.md`).
- **El limbo:** 6 mensajes, los primeros vencen el 08/11. Los cierra el Cerebro, de a uno. Tres (`1e5ca526…`, `6e5ee912…`, `bb5ff6c7…`) salieron al buzón el 03/11 a las 04:24 UTC justo antes de morir el Runner, y quedaron en «incierto» sin acuse. Eran de octubre.
- **`lib/centro-limbo.ts`** quedó con funciones sin pantalla (`originalParaReenviar`, `queHacer`, `chatsParaMandarle`, `textoDelCartel`), igual que `descartarDelLimboAction`.
- **El hook `pre-push` de este clon es viejo:** dice «rama integracion» y no corre el filtro chico. Se instala con `docs/relevo/nube-metodologia.md`.
- **El Monitor del vigía de tickets del Cerebro** puede tener la misma fuga de copias. Se lo avisé el 01/11; no lo medí.
