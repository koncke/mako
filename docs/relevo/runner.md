# Relevo del chat Runner (03/11/2026, 00:45 UTC; 98% semanal, cuenta claude1; reinicia el 04/11 a las 10:00 UTC)

Cómo se opera: `~/.claude/operaciones/LEEME-cartero.md`, con el prompt del cron. Eso manda sobre este archivo.

## Lo que corre ahora, adentro de este chat

- **Cron `4b1570c8`** cada 10 minutos: mide la cuota y corre el vigía. Vence el 07/11.
- **Monitor con `vigilar-continuo.sh`:** entrega en segundos y termina solo a los 28 minutos. Hay que volver a armarlo en cada aviso.
- **Recordatorios:** `8a9b80fb` (05/11, rearmar el cron) y `a3d9a0af` (06/11, revisar el limbo).
- Si este chat se cierra, no se entrega ni se mide. Al retomar: `CronList`, armar el Monitor y contar las copias (`continuo.pid`; memoria `monitor-no-mata-el-proceso`).
- **Si la cuenta corta (desde el 02/11, al 99%; el cierre con relevo es al 98%), se para todo esto:** nada más entrega los pedidos del Centro hasta que este chat siga en otra cuenta. Al retomar, `medir` frena una medición de otra cuenta si el marcador está mal, y `--renovada` sólo se usa si lo dice Martín.
- La app no informa la ventana de 5 horas: `medir` va con `"" ""` en su lugar.
- **Última vuelta antes de este relevo:** 03/11, 02:15 UTC, con la cuenta al 99%. Latido al día, sin alertas y 9 en el limbo.
- **03/11 de 02:43 a 03:05 UTC, la vigilancia estuvo parada:** frené por el corte del 99%. Desde las 02:30 UTC existía `~/.claude/guardia/sin-corte`, que lo apaga (según esa nota, por pedido de Martín). La volví a armar, pero la cuenta puede frenar de golpe al 100%. El Cerebro está avisado.
- **Del 02/11 02:00 al 03/11 02:15 UTC** se entregaron al Cerebro, con acuse: tickets #43, #44 y #45 (y el 03/11, entre las 03:25 y las 04:00 UTC, #46, #47 y #48, con la cuenta al 100%), y los pedidos de Martín `4dbf4767`, `3a1657a3` y `1088908c`. Entregar no dice que los leyó ni que están hechos: eso se mira en el Centro.

## Lo pedido y lo hecho

- **Cartel rojo de los mensajes sin entregar, y aviso «Sin noticias de la PC»** (Martín, 31/10, desde el teléfono: «Me dice que no responde... Y elimina el cartel rojo de "9 mensajes tuyos..."»): en main desde `9008c347c` (`a151e6cf9`); desplegado con `e22c68698`, según el Cerebro. Nadie lo miró en pantalla.
- **Estado de la PC en el Uso** (Martín, citado por el Cerebro: «Si, ponlo pero en USO»): rama `runner-servicio-3010`. Ya sin carteles.
- **Fuga de procesos del Monitor:** arreglada en `~/.claude/operaciones/vigilar-continuo.sh`, fuera del repo.

## A medias: `runner-servicio-3010`, sin subir

Carpeta `C:/dev/wt-runner-servicio`. Medido el 03/11 a las 00:45 UTC contra `59353f806`: 15 commits propios (el servicio y este relevo) y 156 atrás de main. Antes de subir hay que traer main con merge, sin rebasar. Va último en la cola del Cerebro. Falta:

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
- **El corte de vueltas del 01/11, de 02:25 a 08:54 hora Argentina:** sin causa medida; quizá la PC dormida.
