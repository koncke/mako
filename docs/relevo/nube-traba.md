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
| **T6** el cron del Runner | La vuelta del cron deja `runner-cron.<cuenta>` al medir (`marcarCronDelRunner`, cartero.mjs); `runner-salud.mjs estado` trae `cron` y `cronVencido`; la guardia y el Cerebro lo avisan. Sin marca nunca, calla. | tests/runner-salud.test.ts (4 roturas) |
| **T5** el limbo sin pantalla | Borradas las seis funciones del cartel, la acción y `descartarDelLimbo`. El aviso al Cerebro y `tickets.ts mensaje` ya no mandan a Martín al cartel rojo (que no existe): dicen que lo reenvíe desde la conversación. | tests/centro-limbo.test.ts, tests/centro-estado-pc.test.ts, tests/limbo-al-cerebro.test.ts |
| **T11** `recurrente` por WhatsApp | `tareasDelDoer` (lib/plan-tareas-del-doer.ts) y el `case` del doer sin un segundo `map`. | tests/plan-tareas-del-doer.test.ts (3 roturas) |
| **T12** la relectura de Spy | `cierreDeLasQueNoVolvieron` (lo que no volvió se cierra siempre), `PUEDEN_SER_UNO_NUEVO` (se relee también testimonio, opinión, detrás de escena y entrevista) y `sinNadaQueLeer` (el texto vencido no se manda). | tests/spy-analisis.test.ts 8-10 (3 roturas) |

Tipos: `node scripts/tsc-acotado.mjs --heap=9000` sobre los 16 archivos tocados, código 0. Con el tope por defecto muere sin
memoria en la nube (ver docs/hallazgos-infra.md, «En la nube, el `tsc` acotado…»).

## Lo que falta y de quién es

- **T6 en la PC (el Cerebro):** copiar `scripts/operaciones/cartero.mjs` y `scripts/operaciones/runner-salud.mjs` a
  `~/.claude/operaciones/`, y en la tarea `runner-guardia-<cuenta>` de cada cuenta poner el bloque nuevo del prompt de
  `scripts/operaciones/guardia-runner.md` (la línea de `cronVencido`). Sin la copia del cartero no hay marca y todo queda callado
  (`sin_dato`), como antes. No subí la `VERSION` del cartero: la marca es un archivo local, no una capacidad que MaKo pida.
- **T5 en la PC:** la copia de `cartero.mjs` de arriba trae también el texto nuevo de `mensajeLimbo`. Hasta copiarla, el Runner le
  sigue diciendo al Cerebro «desde el cartel rojo».
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

- Nada de esto corrió contra producción ni en la PC: la marca del cron, el texto nuevo al Cerebro y la relectura de Spy se
  probaron con los tests, no con un Runner ni con un competidor reales.
- La relectura de Spy con `PUEDEN_SER_UNO_NUEVO` vuelve a mandar una vez las piezas viejas de esos cuatro formatos: cuánto le cuesta
  a cada negocio depende de cuántas tenga, y no lo medí.

## Autocrítica

- **Cambié:** en T12 empecé arreglando sólo lo que la refutación nombraba; al leer `podarVencido` vi que una pieza de texto vencido
  caía en el mismo agujero por otra puerta y además renovaba el reloj del texto (la retención de YouTube). Lo sumé con su test.
- **Cambié:** en T5 iba a dejar el aviso al Cerebro como estaba; al releerlo vi que mandaba a Martín a un cartel que no existe, y lo
  corregí en las tres copias (lib, cartero.mjs y tickets.ts).
- **Descarté:** en T5, poner el limbo en el Uso (camino b): es una pieza nueva de pantalla que Martín tiene que ver antes, y él ya
  había vetado el cartel. En T12, una pasada global de relectura: gasta la IA de cada negocio en competidores que nadie abre. En T17,
  construir la apertura de la marca: toca tres editores y tiene un candado de Pro en el medio; va con el chat del Image Editor.
