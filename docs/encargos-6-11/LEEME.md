# Los encargos del 6/11/2026 — una foto, no un tablero vivo

Martín, 6/11: «Comienza con todo lo que puedas hacer tú, con absolutamente todo… abre chats en la
nube para no consumir RAM, hazlo todo, verifica los que haya que verificar».

Acá está el reparto de los **634 pendientes** del barrido de ese día, en JSON, para que cada chat de
la nube lea el suyo sin que haya que pegárselo en el mensaje.

| Archivo | Qué trae |
|---|---|
| `equipo-<área>.json` | los **342** que puede hacer el equipo sin molestar a Martín, uno por área |
| `verificar-<n>.json` | los **103** que vienen de documentos de octubre y hay que comprobar contra el código antes de tocarlos |
| `martin.json` | los **189** que sólo destraba Martín (firmar, pagar, una clave, una decisión). **No se tocan.** |

Cada item trae: `titulo` y `porque` en castellano, `tecnico` con el archivo y el comando, y
`original` con el texto crudo del que salió, por si el resumen perdió algo.

⚠️ **Es una FOTO del 6/11 y envejece.** Algunos ya estaban hechos cuando se escribió (la biblioteca
de Thumbnails, por ejemplo, se cargó ese mismo día). Antes de trabajar un item, comprobalo.

La versión para leer, en castellano y filtrable: `docs/pendientes-todo-6-11.md`.
