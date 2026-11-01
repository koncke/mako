# Relevo del chat Runner (01/11/2026, 22:55 UTC; 85% semanal, cuenta claude1)

Cómo se opera: `~/.claude/operaciones/LEEME-cartero.md`, con el prompt del cron. Eso manda sobre este archivo.

## Lo que corre ahora, adentro de este chat

- **Cron `4b1570c8`** cada 10 minutos: mide la cuota y corre el vigía. Vence el 07/11.
- **Monitor con `vigilar-continuo.sh`:** entrega en segundos y termina solo a los 28 minutos. Hay que volver a armarlo en cada aviso.
- **Recordatorios:** `8a9b80fb` (05/11, rearmar el cron) y `a3d9a0af` (06/11, revisar el limbo).
- Si este chat se cierra, no se entrega ni se mide. Al retomar: `CronList`, armar el Monitor y contar las copias (`continuo.pid`; memoria `monitor-no-mata-el-proceso`).

## Lo pedido y lo hecho

- **Cartel rojo de los mensajes sin entregar, y aviso «Sin noticias de la PC»:** en main desde `9008c347c` (`a151e6cf9`); desplegado con `e22c68698`, según el Cerebro. Nadie lo miró en pantalla.
- **Estado de la PC en el Uso** (Martín, citado por el Cerebro: «Si, ponlo pero en USO»): rama `runner-servicio-3010`. Ya sin carteles.
- **Fuga de procesos del Monitor:** arreglada en `~/.claude/operaciones/vigilar-continuo.sh`, fuera del repo.

## A medias: `runner-servicio-3010`, sin subir

Carpeta `C:/dev/wt-runner-servicio`. Quedó atrás de main (medido contra `e63050081`): antes de subir hay que traer main con merge, sin rebasar. Va último en la cola del Cerebro. Falta:

- Tipos de `useCentro.ts` y de los `.tsx` grandes (el acotado dio 99; los juzga Actions).
- Verla en la pantalla real como super admin. El arnés sólo probó la pieza y su CSS.
- La migración 0355: la aplica el Cerebro antes de subir. El número se confirma al subir.

`node_modules` de esa carpeta es un enlace a `C:/dev/wt-runner-sin-cartel`: no borrar esa carpeta primero.

## Lo que espera a Martín

- La instalación del servicio del Runner en su PC (clave Run, `instalar-servicio`, hook `SessionStart`). Un mensaje de otro chat no la autoriza. Es un paso aparte del push.

## Sin hacer

- **`CARTERO_VIVO_MS` sigue siendo un número suelto:** derivarlo del intervalo real pide columna y cartero nuevo. Dueño: Runner (`docs/pendientes.md`).
- **El limbo:** 9 mensajes, los primeros vencen el 08/11. Los cierra el Cerebro, de a uno; no se cancelan por script.
- **`lib/centro-limbo.ts`** quedó con funciones sin pantalla (`originalParaReenviar`, `queHacer`, `chatsParaMandarle`, `textoDelCartel`), igual que `descartarDelLimboAction`.
- **El Monitor del vigía de tickets del Cerebro** puede tener la misma fuga. Se lo avisé el 01/11; no lo medí.
