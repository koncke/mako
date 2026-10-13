# Relevo — Video Editor (y la unificación de las tabs de contenido)

*12/10/2026, chat «Video Editor», cuenta claude3 (semana al 88 %).*

## 13/10 (cuenta 2, chat «Puente a Flow / Content Machine»): cerrado, medido y lo que espera

**CERRADO** en la rama `video-editor` (worktree `C:/dev/wt-video-editor`, `tsc-ve` en verde). **Sin
pushear**: el clon tiene el `tsc` bloqueado y lo mira «Fallas en la PC». Para subirlo, desde el clon:
`git merge --ff-only video-editor && git push` (la rama es main + estos commits).
- «No se pudo exportar» ya no muestra el `error.message` del motor en inglés: `export/mensaje-error.ts`
  traduce lo que el motor tira hoy (grep de `throw new Error`) y lo desconocido cae a una frase que dice
  qué probar; el crudo sigue en consola. Test `tests/video-editor-export-mensaje.test.ts`.
- Botón dentro de botón en `timeline-element.tsx` (`EffectsButton` vivía adentro del botón que cubre
  el clip; React lo marcaba como error con cualquier clip con efectos): `<span role="button">` con
  Enter/Espacio.
- El último `hsl(var(--primary))` (`selection/selectable-item.tsx`): `var(--primary)`. Lo vigila
  `tests/video-editor-tema.test.ts`, que barre `app/video-editor/**`.
- El borde doble del panel del reproductor: el mismo `rounded-[7px]` que los otros tres paneles.

**MEDIDO en producción** (hola-mako.com, Chrome de Martín, 13/10, máquina con 1-2 GB de RAM libre):
- El inicio (`/video-editor`) tarda ~20 s en pintar el contenido; la barra de secciones sale al toque.
- Crear proyecto → importar un MP4 9:16 de 6 s → agregar a la línea → dividir en 2:02 funcionan, y la
  consola queda limpia: el único error es «Receiving end does not exist», del content script del
  puente a Flow, ajeno al editor.
- ⚠️ **Al agregar un «Texto predeterminado» el renderizador se congeló más de 90 s** (CDP no pudo ni
  capturar pantalla) con 1 GB libre y un proceso de Chrome en 5 GB. NO se pudo separar bug de falta
  de memoria: es lo primero a reproducir con RAM libre (`text/`, `font-picker`). El export quedó sin
  probar por eso; la cadena «→ texto → exportar y medir con ffprobe» sigue pendiente. Los clips de
  prueba están hechos con ffmpeg (`testsrc2` 720x1280 6 s con tono; uno con `rotate=90`).

**ESPERA A MARTÍN** (una línea cada una):
- ¿Canva en Image y Notion/Mila en Copywriting arrancan ahora, o siguen en «luego»?
- ¿El editor sigue a pantalla completa (decisión §9 del diseño) o la barra lateral se queda, como pide
  la tarea del 12/10?

**NO TOCADO a propósito**: todo lo de `mako-feedback-y-tareas.md` (provisional), incluidas las 4 tareas
del editor de las reuniones. Dato para esa decisión: los subtítulos automáticos YA existen (Whisper en
el navegador); borrar silencios, B-rolls y sidebar visible no.

## Dónde está
- El editor (copia de CapCut 9.3 sobre OpenCut portado) vive en `app/video-editor/`, en `main`,
  **abierto a todos** desde el 12/10 (antes sólo super admin). El plano: `docs/diseno-editor-video.md`;
  lo aprendido y lo que quedó sin hacer, archivo por archivo: `docs/hallazgos-video-editor.md`.
- Worktree de trabajo: `C:/dev/wt-video-editor` (rama `video-editor`, fuera de OneDrive, con su
  `node_modules`). Typecheck acotado del editor: `node C:/dev/tsc-ve.mjs` (~40 s, se turna por el lock).

## Lo último que pasó
- **Producción caía con «Failed to execute 'compile' on 'WebAssembly'»**: el cargador de wasm de
  Turbopack codifica el `?dpl=` de Vercel adentro del nombre del archivo → 404. Arreglado: el motor se
  carga a mano desde `public/ve/wasm/` (`_opencut/wasm/opencut.ts`), cuidado por
  `tests/video-editor-wasm.test.ts`. Reproducido en local con `NEXT_DEPLOYMENT_ID=… npm run build`.
- **Acceso**: `app/video-editor/acceso.ts` pregunta lo mismo que toda tab (rol + capa).

## HECHO (12/10): las tabs de contenido unificadas en Video, Image y Copywriting
- `nav.ts`, familia `content`: tres tabs con `secciones` (cada sección es el ítem de siempre, misma
  key, misma ruta, mismo `adminOnly`: ningún guard cambió). `itemsDe` las abre en sus secciones, así
  que títulos, capas, /admin/dev y los tests siguen viendo los mismos ítems.
- La regla de quién ve qué se mudó a `lib/nav-visibilidad.ts` (`puedeVerItem`, `resolverTab`): la usan
  el Sidebar y la barra de secciones (`app/_components/SeccionesTab.tsx`, una vez en el layout, deja su
  alto en `--alto-secciones`). Una tab se ve si se ve alguna sección y lleva a la primera visible que no
  sea «Próximamente»; con una sola sección visible no hay barra.
- Medido en el navegador mirando el ws 1 (como cliente): Video muestra «Editor · Crear con IA»;
  Copywriting sólo Ads Writer (sin barra); Image, hoy todo `adminOnly`, sólo el super admin.
- SIGUE (pedido de Martín, «luego»): el lienzo tipo Canva en Image y el tipo Notion/Mila en Copywriting.

## El pedido original de la unificación (12/10)
> «Que no exista "video generator" y luego "Editor"... que todo sea lo mismo, para varias taps...
> 1. Video Generator + Editor + Reels = "Video" (el lienzo de edición tipo CapCut y un botón o sección
> para crear con IA) 2. Image Generator + Thumbnail + Carousels = "Image" (… tipo Canva …)
> 3. Ideas + Ads Writer + YouTube Writer + Stories = "Copywriting" (… tipo Notion o "Mila" …)
> Que sean 3 tabs funcionales que todo mundo reconoce y MaKo le agrega generación con IA.»
> **«Por ahora solo lo de unificar tabs... Luego implementamos Canva y Notion/Mila.»**

Lo relevado para hacerlo (nada escrito todavía):
- `app/_components/nav.ts`, familia `content`: hoy grupos Ads (Ads Writer, Image Generator, Video
  Generator, Video Editor), Instagram (Reels, Carousels, Stories) y YouTube (YouTube Writer,
  Thumbnails), con `planaParaCliente` y `adminOnly` en casi todo: el 12/10 Martín pidió que el CLIENTE
  vea sólo Ads Writer y Video Generator, y el super admin todo. La unificación tiene que respetarlo.
- Las keys del nav son contrato con la base (`tabEnCapa`, onboarding): los guards de cada page usan
  la key vieja (`requireRolWs([], { nav: 'video-generator' })`, etc.). `tabEnCapa` sólo mira la key
  contra `navKeys` de la capa, NO necesita que el ítem esté en el nav: se pueden sacar de la barra sin
  romper los guards. Ojo: `pm` y `superadmin` tienen `navKeys` explícitas → una key nueva (`video`,
  `image`, `copywriting`) tiene que entrar ahí o el Sidebar la esconde.
- Consumidores del nav a revisar al tocarlo: `Sidebar.tsx`, `lib/titulo-tab.ts`,
  `lib/plan-proyectos-catalogo.ts`, `lib/movil-rutas.ts`, `lib/api-mako/areas/mako.run.ts`,
  `app/admin/dev/areas.ts` y los tests que leen `FAMILIAS` (`tests/tabs-retiradas.test.ts`,
  `tests/sin-instagram.test.ts`, `tests/plan-proyectos-catalogo.test.ts`, `tests/dev-areas.test.ts`…).
- Plan propuesto: tres entradas («Video», «Image», «Copywriting») cuyo `match` cubre las rutas de sus
  partes, y una barra de secciones arriba de cada parte (p. ej. Video: Editor · Crear con IA · Reels),
  sin mover rutas (retirar una ruta es enumerar sus links, AGENTS.md). Visibilidad de cada sección =
  la de su parte hoy.
