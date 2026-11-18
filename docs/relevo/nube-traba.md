# Relevo — «Traba otra cosa» de los pendientes verificados (18/11/2026, sesión en la nube)

Lo escribió la sesión de la nube `cli_6ab6e94e-8cd3-5fa9-a736-713a1fc58542` (firma `Claude-Cuenta: claude2`). La fuente del estado
es [docs/pendientes-verificados-17-11.md](../pendientes-verificados-17-11.md) → «Traba otra cosa»: ahí está cada ítem con su
evidencia. Esto es lo que hace falta para seguir.

## Lo pedido

Martín, 18/11: «continúes con absolutamente todos los pendientes». El encargo de esta sesión: la sección «Traba otra cosa (13
abiertos)», en su orden; refutar cada uno contra `main` antes de tocarlo; lo que no esté hecho, arreglarlo con un test que lo
reproduzca; y tacharlo en el documento.

## Lo hecho (todo en `punta/traba-1811`)

| Ítem | Qué quedó | Test |
|---|---|---|
| **T6** el cron del Runner | El primer paso de la vuelta del cron es `runner-salud.mjs latido-del-cron`: deja `runner-cron.<cuenta>` sólo si lo corre el chat Runner, con la cuenta del entorno. `estado` trae `cron` y `cronVencido` (una hora sin marca; o ninguna marca con el LEEME que ya la pide). La guardia lo mira primero y el Cerebro lo recibe en cada turno. | tests/runner-salud.test.ts (5 roturas) |
| **T5** el limbo sin pantalla | Borradas las seis funciones del cartel, la acción y `descartarDelLimbo`. El aviso al Cerebro y `tickets.ts mensaje` ya no mandan a Martín al cartel rojo (que no existe): dicen que lo vuelva a escribir en un chat abierto. | tests/centro-limbo.test.ts, tests/centro-estado-pc.test.ts, tests/limbo-al-cerebro.test.ts |
| **T11** `recurrente` | `tareasDelDoer` (lib/plan-tareas-del-doer.ts), el `case` del doer sin un segundo `map`, y la def del registro declara el campo (si no, `validarInput` lo borraba para la app, `/api/v1` y los flujos). | tests/plan-tareas-del-doer.test.ts (4 roturas) |
| **T12** la relectura de Spy (a medias) | `cierreDeLasQueNoVolvieron` con un CAS contra la versión de hoy, `PUEDEN_SER_UNO_NUEVO` (se relee también testimonio, opinión, detrás de escena y entrevista) y `hayAlgoQueLeer` (lo de texto vencido no va a la IA por ningún camino). Falta una decisión de gasto de Martín. | tests/spy-analisis.test.ts 8-11 (5 roturas) |

**La revisión adversarial** (un agente que no escribió el código, con la consigna de refutar) tumbó la primera versión de los cuatro:
T6 colgaba la marca de `medir`, T11 no pasaba por el registro, T5 mandaba a «Reenviar» (que firma la columna `texto`) y T12 tenía
un CAS que se trababa al subir la versión, dejaba sin analizar los posts sanos sin descripción y no cubría el camino de la API. Todo
se corrigió antes de subir; el detalle está en cada hallazgo.

Tipos: `node scripts/tsc-acotado.mjs --heap=9000` sobre los archivos tocados, código 0. Con el tope por defecto muere sin memoria en
la nube (docs/hallazgos-infra.md, «En la nube, el `tsc` acotado…»). El veredicto de la nube corrió antes de la revisión (8.285
tests y el tsc entero, verde) y se volvió a sacar después.

## Lo que falta y de quién es

- **T6 en la PC (el Cerebro):** copiar `scripts/operaciones/runner-salud.mjs` a `~/.claude/operaciones/`; sumar
  `node ~/.claude/operaciones/runner-salud.mjs latido-del-cron` como PRIMER paso del prompt del cron en `LEEME-cartero.md` y rearmar
  el cron del Runner en ese mismo paso; poner el bloque nuevo de `scripts/operaciones/guardia-runner.md` en la tarea
  `runner-guardia-<cuenta>` de cada cuenta. Hasta que el LEEME nombre el comando, todo queda callado (`sin_dato`), como antes.
- **T5 en la PC (el Cerebro):** copiar `scripts/operaciones/cartero.mjs` (trae el texto nuevo de `mensajeLimbo`). Hasta entonces el
  Runner le sigue diciendo al Cerebro «desde el cartel rojo». No subí la `VERSION` del cartero: sólo cambió un texto.
- **T5, lo que quedó SIN HACER:** el «Reenviar» de un mensaje propio en el Ops Center firma la columna `texto`, no el `firmado`
  (docs/hallazgos-operaciones.md). Es de antes de esta tanda; va con el chat del Ops Center.
- **T12 (Martín, gasto de la IA de cada negocio):** releer más formatos viejos, releer todo lo del catálogo de once, o una pasada
  sobre todos los competidores.
- **T1 (el Cerebro, lectura de producción):** sólo falta la voz: `GET /webhook/find/<instancia de la voz>` y ver que lleve `firma=`.
- **T13 (el Cerebro + sí de Martín):** `node --import tsx scripts/carruseles-biblioteca.mts estado` en la PC; si la 0411 no está,
  aplicarla con su backfill pide el sí de Martín.
- **T14 (el Cerebro + sí de Martín):** `reclasificar` en seco para el número de hoy; la pasada con visión gasta IA y escribe.
- **T8 (el Cerebro, con el Chrome de Martín):** los inventarios de cursos.
- **T10 y T9 (Martín):** el scope de Drive en Google Cloud; el Hook generator sigue aparcado.
- **T2, T15 y T17 (los chats de su área):** son construcción, no trabas. T2 prende campañas (plata: revisión adversarial). T15 son
  ocho paquetes que copian Canva. T17: la apertura de la marca tiene que preguntar un HECHO, no «¿lo hacemos con tu turquesa?»
  (detalle en el documento).

## Lo que no se midió

- Nada de esto corrió contra producción ni en la PC: el latido del cron, el texto nuevo al Cerebro y la relectura de Spy se
  probaron con los tests, no con un Runner ni con un competidor reales. La escritura de `yaRevisadas` con el filtro `or` sobre una
  ruta de JSON (`analisis->>formatosV`) sigue el molde de otras del repo (`ctx->>cuotaId`, `pedido->>mediaId`), pero no se corrió
  contra PostgREST.
- Cuánto le cuesta a cada negocio releer una vez los cuatro formatos viejos de `PUEDEN_SER_UNO_NUEVO`: depende de cuántas piezas
  tenga, y no lo medí.

## Autocrítica

- **Cambié por la revisión adversarial:** los cuatro. La lección que generaliza está en cada hallazgo; la más útil para otros: un
  campo nuevo de una operación de la API va en su def (si no, `validarInput` lo borra), y un compare-and-set sobre una versión se
  compara contra la de hoy, no contra «no tiene».
- **Cambié antes de la revisión:** en T12 sumé el texto vencido, que la refutación no nombraba; en T5, el aviso que mandaba a un
  cartel que no existe.
- **Descarté:** en T5, poner el limbo en el Uso (camino b): es una pieza nueva de pantalla que Martín tiene que ver antes, y él ya
  había vetado el cartel. En T12, releer más o hacer una pasada global: gasta la IA de cada negocio, lo decide Martín. En T17,
  construir la apertura de la marca: toca tres editores y tiene un candado de Pro en el medio; va con el chat del Image Editor.
