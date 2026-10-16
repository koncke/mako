# Relevo — Video Editor (y la unificación de las tabs de contenido)

*12/10/2026, chat «Video Editor», cuenta claude3 (semana al 88 %).*

## 15/10 noche (cuenta 3): pasos 2–4 de los subtítulos y el chat con todo lo que el editor sabe hacer

Orden aprobado por el coordinador «Estrategia 3 cuentas». Escrito y con tests, **NADA visto en Chrome**:
- **Edición por transcripción**: Biblioteca › Subtítulos › «Transcripción» (y el botón de la barra): elegir
  palabras y Supr las saca del video y del subtítulo. **«Eliminar las muletillas»** del video, ahí mismo.
- **Karaoke**: «Animaciones de subtítulos» en el panel de un subtítulo (palabra o frase pronunciada, opacidad de
  lo no dicho) y tres plantillas («Karaoke», «Palabra resaltada», «Atenuado»).
- **El chat «Editar con IA»**: de 11 a 32 operaciones (transiciones, animaciones, filtros, color, velocidad,
  recortar, estilo y posición del texto, audio, revertir, congelar, cortar por frase/tramo, muletillas,
  karaoke). Lo que no sabe hacer lo dice.
- Lo aprendido, en `docs/hallazgos-video-editor.md` (secciones del 15/10) y dos reglas nuevas al final de
  AGENTS.md. **Lo primero que sigue**: mirarlo en Chrome (transcripción, karaoke y cada operación del chat), y
  después el punto 3 del orden: las cinco plantillas de anuncio (relevamiento en
  `docs/editor-video/relevamiento-plantillas.md`, con lo investigado en la web el 15/10 al final). Regla de RAM del coordinador: nada de workflows de varios agentes ni tsc completo
  en la notebook (el completo y los tests corren en GitHub Actions, rama `integracion`).

## 15/10 (cuenta 1): PRIMERO TERMINAR LA COPIA DE CAPCUT (Martín: «tal vez que termine eso primero»)

- El inventario, en `docs/editor-video/inventario-copia-capcut.md`. De 158 funciones de CapCut: 74 hechas, 26 a
  medias, 42 faltan y se pueden copiar, y 16 quedan fuera con su motivo. «Hecho» es escrito, no visto andar.
- **Los subtítulos van primero.** La transcripción ya existe: Whisper en el navegador, gratis, sin cuota del
  cliente y con tiempos por palabra. **Hecho el 15/10 (`7ef765fcc`, sin pushear)**: los tiempos por palabra se
  guardan; Enter, Retroceso y Supr dividen y combinan como en CapCut; «Buscar y reemplazar»; el chat suma
  «subtitular todo» y «reemplazar en los subtítulos». SIGUE: resaltar palabras, eliminar las muletillas del
  video, edición por transcripción. Nada de esto se vio en Chrome: la pestaña de la extensión sigue oculta.
- Las plantillas de proyecto no tienen de dónde copiarse (es el catálogo de ByteDance): tenerlas es crear uno
  propio, y eso lo decide Martín.

## 15/10 (cuenta 1): chat al costado, API de MaKo y Lottie, ESPERAN DECISIÓN

Pedido de Martín (vía «Estrategia 3 cuentas»): chat para editar con prompt como el del Landing; todos los
botones a la API de MaKo; animaciones tipo Lottie.
- **El chat «Editar con IA» está EN PRODUCCIÓN** desde el 15/10 a las 01:00 AR (push `1ae6ee1ff`, deploy Ready). Lo ven todos los admins con el editor. El modelo
  lo decidió «Estrategia 3 cuentas»: Gemini del cliente, sin Claude. Tiene 21 tests y el typecheck
  acotado en verde; **no se vio en un navegador**. Es lo primero a mirar, junto con el congelamiento y el
  export.
- **La API espera a Martín** («video-proyecto-donde-vive» en la Ticketera), y **Lottie también**
  («video-lottie»).
- El inventario, el diseño del chat, lo que falta y lo de Lottie, en `docs/hallazgos-video-editor.md` →
  «La API de MaKo y el chat al costado» y «Lottie en un editor de VIDEO».
- **Rojo en main que NO es de acá:** `tests/cobranza.test.ts` («marcar el pago CORTA…») falla desde
  `ba199cb49` (CRM pagos, 14/10 01:35): `marcarPago` mide 6900 caracteres y el test acota a 3000. Es del
  chat del CRM.

## 14/10 noche (cuenta 1, chat «Video Editor»): el inventario, y la verificación sin hacer

- **La rama `video-editor` no tiene trabajo propio:** se adelantó a `origin/main` (fast-forward) y sólo
  lleva lo de este relevo. El editor está abierto a todo admin con la tab desde el 12/10
  (`app/video-editor/acceso.ts`), no sólo al super admin.
- **YA NO ESPERAN A MARTÍN** (figuran abajo como pendientes): la barra lateral (se queda), abrir el
  editor a clientes (hecho el 12/10) y Canva en Image (lo hizo el chat Image Editor).
- **Resuelto con criterio** (lo pidió «Estrategia 3 cuentas»; todavía no se implementó nada):
  - Avatar de IA filma todo seguido, sin pausa en la toma 1.
  - Quitar fondo sigue con el modelo selfie.
  - Las guías de OpenCut que nadie muestra se borran (`guides/registry.tsx`).
  - No se da de alta «Feature: Video Editor» en el Plan.
- **Siguen esperando a Martín:** qué son los B-rolls de IA; los formatos de video e imagen en
  Estrellas; si se monta el worker de montaje; Notion/Mila en Copywriting.
- **SIN HACER, y es lo primero:** reproducir el congelamiento de «Agregar texto predeterminado» y
  medir el export con ffprobe. No se pudo. Primero la extensión de Chrome no conectaba y el `next dev`
  local lo mató el vigía de RAM (ver `docs/hallazgos-video-editor.md` → «El entorno de esta máquina»).
  Después la extensión conectó, pero con la ventana de Chrome OCULTA: la importación se quedó en 0 %, y
  es el mismo síntoma que el «congelamiento» del 13/10 (ver «Lo que confunde al MEDIR»). Hace falta la
  ventana a la vista. Y la sesión de hola-mako en ese Chrome es la de Mauricio (ws1, sin `?ws=`): el
  proyecto de prueba «1014» quedó en el navegador, del lado del ws1, y hay que borrarlo. El clip
  de prueba se arma con
  `ffmpeg -f lavfi -i testsrc2=size=720x1280:rate=30:duration=6 -f lavfi -i sine=frequency=440:duration=6 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest prueba.mp4`.
  Los scripts del 11/10 (`ve-lib.mjs`, `e2e.mjs`, con Playwright de la caché de npx) siguen en el
  scratchpad de la sesión `eb5e2cd4`.

## 14/10 (cuenta 2, mismo chat): barra lateral, Borrar silencios y Avatar de IA

**Cierre (14/10 ~02:40, pedido de Martín: «que se pushee todo y que los chats cierren»):** todo commiteado en
la rama `video-editor`, árbol limpio, nada a medias. El push lo hace «Estrategia 3 CUENTAS» con todo junto;
estos commits no pasaron por tsc (si el pre-push marca algo en `app/video-editor/avatar/` o en
`_opencut/avatar/`, es de acá).
En la rama `video-editor` del worktree `C:/dev/wt-video-editor`, **sin pushear** (el typecheck sigue
bloqueado en la máquina; lo mira «Fallas en la PC»). Commits `e1523b2f`, `923120b4` y `98e8ea36`, encima
de `6c9e0162`. Para subirlo, desde el clon: `git merge --no-edit video-editor && git push`. Un merge y
no un rebase: la bitácora cita estos hashes, y un rebase los cambia (al 14/10 no hay archivos en común con `main`).
- **Barra lateral**: se queda mientras se edita (decidido por Martín, gana sobre el §9 del diseño).
- **Borrar silencios**: botón en la barra de la línea de tiempo, un solo Deshacer.
- **Avatar de IA**: la pestaña de CapCut. Los avatares son los escenarios confirmados del Video
  Generator y genera con sus acciones. Llega de punta a punta cuando el puente lea el video del Flow
  nuevo.
- **Regla nueva de Martín**: antes de construir, buscar en la fuente (relevamientos de CapCut y OpenCut);
  si no está, avisarle antes de crear.

**SIGUE** (de la lista del 13/10): verificar subtítulos en el navegador; preguntarle a Martín qué son
los «B-rolls que genera la IA» (no hay generación de B-roll en MaKo); Canva en Image y Notion/Mila en
Copywriting; formatos híbridos y colas (dependen del puente).

**ESPERA A MARTÍN — Estrellas (punto 10, 13/10):** «API de MaKo» armó la publicación de creaciones
(rama `api-acciones-1310`, mig 0273, `lib/creaciones-reglas.ts`). `formato_video` y `formato_imagen` quedan en
`POR_ENCHUFAR` a propósito: los formatos de video son las 8 puestas fijas del código (ningún negocio crea uno) y
el Image Generator no tiene backend. Si Martín elige «un anuncio como plantilla», el enchufe sale de
`PlanGuardado` sin el guion literal ni la foto. El contrato ya acepta ids de texto (UUID).

**PENDIENTE MÍO — variaciones de hook para el Autopilot del Ads Manager (punto 18, 13/10):** el contrato
acordado es `lib/video-variaciones.ts` con `pedirVariacionesHook(ws, { planId, toma, n })` y
`estadoVariaciones(ws, planId)`, sin reintento de lo que gasta créditos. Bloqueos, en orden: (1) el puente no
trae el video del Flow nuevo (`mediaDeFlow` null con el payload posicional); (2) el avance de tomas lo mueve la
pantalla: mudar el núcleo de `estadoTomaAction`/`generarTomaAction` a `lib/` con ws explícito y llamarlo desde
un cron; (3) no hay generador de N ganchos (`reescribirToma` es de a una) y el historial topea en 10: tabla
propia; (4) el worker de montaje no tiene contenedor: sólo hace falta para un anuncio completo, y es
decisión de Martín. «Mis creativos» ya lista las tomas filmadas del historial (`lib/creativo-mako-fuentes.ts`).

## 13/10 (cuenta 2, chat «Puente a Flow / Content Machine»): cerrado, medido y lo que espera

**CERRADO** en la rama `video-editor` (worktree `C:/dev/wt-video-editor`, `tsc-ve` en verde). **Sin
pushear**: el clon tiene el `tsc` bloqueado y lo mira «Fallas en la PC». Para subirlo, desde el clon:
`git merge --no-edit video-editor && git push`.
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
