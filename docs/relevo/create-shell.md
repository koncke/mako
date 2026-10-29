# Relevo — chat «Create: un solo diseño» (claude3, 29/10/2026)

Rama `create-shell-2910`, worktree `C:/dev/wt-create-shell`. Diseño e inventario: [docs/diseno-create.md](../diseno-create.md).
Nota para el Cerebro: side-session-notes/…/create-shell-2910.md. **No pusheo: el Cerebro verifica y sube.**

## Lo pedido
Martín, 29/10: Create sin pestañas, el chat de MaKo siempre a la izquierda con los proyectos detrás de la «←», «Nuevo …» con
plantillas bajo «¿Qué vas a crear hoy?», colores de MaKo en Video e Image, deprecar lo que sobra (Reels → plantilla del
Copywriter). Y después: Offer con el mismo sistema, la oferta armándose al costado y sin pestañas (ni para el super admin).

## Commits (todo en la rama)
- 592c1ec0b — el shell (`app/_crear/PantallaCrear.tsx`), `ConversacionCerebro`, nav sin secciones en Video/Image, retiros
  (Reels, Carousels, Image Generator, Thumbnails), teléfono, cosecha ui/api-mako/mobile.
- 2b62724ea — Video en el shell con colores de MaKo (agente), Offer en el shell con `DocumentoVivo`, arreglos del shell.
- e9971db4a — los 5 rojos que vio AI Avatar (tests que fijaban texto de MakoEnLaTab, /m/reels y /m/carousels borradas,
  cerebro-funciones) y la cosecha de Video y Offer.

## Lo que falta
- **Image** (agente en curso, archivos sin commitear en `app/image-editor/**`, `app/m/image-editor/**`, `lib/image-editor/**`,
  tests de image-editor y `tests/fuentes-sin-next-font.test.ts`). Al terminar: commitear por ruta y sacar Image de
  `PAGINAS_CREATE` en tests/crear-pantalla.test.ts.
- **tsc-acotado** de toda la rama: NO corrió todavía (guardia de RAM, pausa del Cerebro y las reglas de la noche). Va por
  `node C:/dev/con-turno.mjs node scripts/tsc-acotado.mjs <archivos>`; la lista de archivos está en el scratchpad
  (`tsc-archivos.txt`, salida en `tsc-mio.txt`).
- **tests-afectados --base origin/main --rapido**: tampoco (lo paré al llegar las reglas de la noche). Por con-turno.
- **Capturas** antes/después (computadora y teléfono): Claude in Chrome desconectado; el navegador integrado cae en el login.
- Copywriting y AI Avatar los cierran sus chats en sus ramas encima de las mías (nav.ts de su bloque incluido); están
  anotados en `FALTAN_SIN_SECCIONES` / `PAGINAS_CREATE`. `/reels` redirige a `/copywriter`: la rama del Copywriter sube
  con o después de ésta.
