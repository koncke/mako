# OpenCut classic: inventario de interfaz y funcionalidades

Relevamiento de solo lectura del clon en
`scratchpad/ext/classic` (último commit `cf5e79e9`, 17/05/2026, «docs: readme»).
Todas las rutas que siguen son relativas a `apps/web/src/` salvo que se diga otra cosa.

> **Lo primero que hay que saber:** el README dice textualmente *«This is the original OpenCut
> codebase. It's archived and no longer maintained. The rewrite is happening at
> opencut-app/opencut»*. Lo que se porte de acá no recibe más arreglos de arriba: lo que
> se porte pasa a ser nuestro.

---

## 0. Resumen en cifras

| Qué | Número |
|---|---|
| TS/TSX en `apps/web/src` | 685 archivos, 91.028 líneas (533 `.ts` = 64.719; 152 `.tsx` = 26.309) |
| Lógica del editor (TS sin tests, sin migraciones, sin sitio) | ~52.100 líneas |
| UI del editor (TSX sin `components/ui`, sin landing/blog) | ~18.450 líneas |
| `components/ui` (shadcn) | 48 archivos, 4.996 líneas |
| Migraciones de almacenamiento | 31 (`services/storage/migrations/v0-to-v1` … `v30-to-v31`), 5.863 líneas + ~3.250 de tests |
| Tests | ~5.230 líneas (`bun test`) |
| Rust (motor GPU compilado a WASM, paquete npm `opencut-wasm@^0.2.10`) | 4.337 líneas en `rust/crates/{gpu,compositor,effects,masks,time,bridge}` + `rust/wasm` |
| Subsistemas más grandes | timeline 16.117 · masks 6.548 · preview 5.463 · core 4.009 · commands 4.006 · stickers 3.435 · animation 3.129 · renderer 2.601 |
| Imports con alias `@/` | 1.721 (OpenCut: `@/*` → `src/*`; MaKo: `@/*` → raíz del repo: chocan) |

---

## 1. Layout del editor

### 1.1 Página `app/editor/[project_id]/page.tsx` (209 líneas)

Árbol:

```
<MobileGate>                       components/editor/mobile-gate.tsx  (bloquea < 1024 px de ancho)
  <EditorProvider projectId>       components/providers/editor-provider.tsx
    div.h-screen.w-screen.flex-col
      <DegradedRendererBanner/>    «For the best experience, open OpenCut in Chrome.» si no hay GPU
      <EditorHeader/>              components/editor/editor-header.tsx (alto 3.4rem)
      <EditorLayout/>              (abajo)
      <Onboarding/>                components/editor/onboarding.tsx (3 pasos, textos de OpenCut/Discord)
      <MigrationDialog/>           project/components/migration-dialog.tsx
      <ChangelogNotification/>
```

`EditorLayout` usa **react-resizable-panels v2** a través del wrapper
`components/ui/resizable.tsx` (es el único archivo que importa la librería):

```
ResizablePanelGroup vertical
├── Panel «mainContent» (def 50 %, min 30, max 85)
│   └── ResizablePanelGroup horizontal (px-3, gap 0.19rem)
│       ├── Panel «tools»      def 25 % (min 15, max 40)  → <AssetsPanel/>      (biblioteca)
│       ├── Handle
│       ├── Panel «preview»    def 50 % (min 30)          → <PreviewPanel/>     (visor)
│       ├── Handle
│       └── Panel «properties» def 25 % (min 15, max 40)  → <PropertiesPanel/>  (propiedades)
├── Handle
└── Panel «timeline» (def 50 %, min 15, max 70, px-3 pb-3) → <Timeline/>
```

- Tamaños por defecto en `panels/layout.ts`; se persisten en `localStorage` clave
  `panel-sizes` (zustand `persist`, `editor/panel-store.ts`, versión 2 con migración).
- Es el mismo esquema de 4 zonas que CapCut escritorio (biblioteca | visor | propiedades,
  timeline abajo). Lo que difiere es la piel: proporciones, colores, nombres y la barra de
  categorías (en OpenCut es una columna de íconos vertical dentro del panel izquierdo).
- Toda la página es `h-screen w-screen`: para meterla como tab de MaKo con sidebar hay que
  cambiar eso por `h-full`.

### 1.2 Núcleo (no visual)

`core/index.ts` → `EditorCore` **singleton** con 12 managers (`core/managers/`):
`timeline` (935 l.), `project` (707), `audio` (700), `scenes` (324), `playback` (257),
`renderer` (252), `selection` (195), `media` (172), `commands` (154), `save` (112),
`clipboard` (82), `diagnostics` (38). Un *reactor* borra solo las pistas overlay/audio que
quedan vacías después de cada comando.
Hook de acceso: `editor/use-editor.ts` (`useEditor(selector)`).
No depende de auth ni de base de datos (sólo `feedback/queries.ts` usa `@/db`).

### 1.3 Pantalla de proyectos `app/projects/page.tsx` (1.017 líneas) + `app/projects/store.ts`

- Cabecera con breadcrumb, alternador **Grid / List**.
- Barra: búsqueda («Search...»), orden por `createdAt`, `updatedAt` (default, desc), `name`,
  `duration`, asc/desc; selección múltiple con acciones **Duplicate / Delete**.
- Botón «New project» («New» en móvil).
- Menú por proyecto (dropdown y clic derecho): **Rename, Duplicate, Info, —, Delete**.
- Estados: skeleton, «No projects yet», «No results found».
- Los proyectos viven **sólo en el navegador** (IndexedDB + OPFS), ver §5.

---

## 2. Por panel

### 2.1 Cabecera (`components/editor/editor-header.tsx`)

Izquierda: logo como menú (**Exit project**, **Shortcuts**, —, **Discord**) + nombre del
proyecto editable en el lugar (Enter guarda, Escape cancela). Hay diálogos de Rename/Delete
montados pero el menú no los abre.
Derecha: `FeedbackPopover` (envía a `/api/feedback`), `ExportButton`, `ThemeToggle` (claro/oscuro con next-themes).

**Exportar** (`components/editor/export-button.tsx`, 336 l.): popover con
- Format: **MP4** / **WebM**
- Quality: Low «Smallest file size», Medium «Balanced», High «Recommended» (default), Very high
- Audio: «Include audio» (switch)
- Barra de progreso y cancelar. Descarga el `ArrayBuffer` como archivo.
- Resolución = tamaño del lienzo; fps = fps del proyecto. **No hay selector de resolución ni de fps en el diálogo.**

### 2.2 Biblioteca (assets) — `components/editor/panels/assets/`

Columna vertical de íconos (`tabbar.tsx`, botones 32×32, tooltip a la derecha) + vista.
Pestañas en `assets-panel-store.tsx` (`TAB_KEYS`), en este orden:

| # | Clave | Etiqueta | Vista | Estado |
|---|---|---|---|---|
| 1 | media | Media | `views/assets.tsx` (642 l.) | Funciona: importar (picker, arrastrar, pegar), grilla/lista, ordenar por Name/Type/Duration/File size, selección múltiple, «+» para agregar en el cabezal. Menú contextual: «Export clips» (**sin handler**), «Delete» / «Delete N items». |
| 2 | sounds | Sounds | `sounds/components/assets-view.tsx` (563 l.) | Sub-tabs **Sound effects** / **Saved**. Busca en **Freesound** vía `/api/sounds/search` (necesita `FREESOUND_API_KEY`). Búsqueda de canciones devuelve 501 «Songs are not available yet». Guardados en IndexedDB. |
| 3 | text | Text | `text/components/assets-view.tsx` (47 l.) | Un solo ítem: «Default text». Sin plantillas. |
| 4 | stickers | Stickers | `stickers/components/assets-view.tsx` (455 l.) | Búsqueda + categorías **All / Flags / Shapes** («Logos» comentado «v0.4.0»). |
| 5 | effects | Effects | `effects/components/assets-view.tsx` (92 l.) | Un solo efecto: **Blur**, con miniatura renderizada sobre `public/effects/preview.jpg`. Se arrastra a un clip (efecto del clip) o a la timeline (elemento efecto = capa de ajuste). |
| 6 | transitions | Transitions | — | **Placeholder**: «Transitions view coming soon...» |
| 7 | captions | Captions | `subtitles/components/assets-view.tsx` (339 l.) | Idioma (Auto detect + 9), botón generar (Whisper en el navegador), importar **SRT/ASS**, diagnósticos (p. ej. falta WebGPU). |
| 8 | adjustment | Adjustment | — | **Placeholder**: «Adjustment view coming soon...» |
| 9 | settings | Settings | `views/settings/index.tsx` (378 l.) + `background.tsx` (309 l.) | Sub-tabs **Project info** (fps 24/25/30/60/120; lienzo 16:9, 9:16, 1:1, 4:3 o Custom ancho×alto) y **Background** (Blur Light/Medium/Heavy; Colors 242 + selector; Pattern craft 22 degradados; Syntax UI 11 degradados). |

Arrastre: `draggable-item.tsx` + `drag-overlay.tsx`; los datos de arrastre llevan
`targetElementTypes` para soltar sobre un clip.

### 2.3 Visor (preview) — `preview/components/`

- `index.tsx` (348 l.) arma el lienzo, `preview-viewport.tsx` (572 l.) maneja zoom/paneo
  (min 0.25, max 16, paso 1.25 — `preview/zoom.ts`), pantalla completa.
- **Barra del visor** (`toolbar.tsx`): timecode editable `HH:MM:SS:FF` / duración total ·
  Play/Pausa · selector de zoom **Fit / 25 / 50 / 75 / 100 / 150 / 200 %** · pantalla completa.
  El botón de guías (`GridPopover`) está **comentado** («v0.4.0»).
- **Manijas de transformación** (`transform-handles.tsx`, `handle-primitives.tsx`,
  `preview/controllers/transform-handle-controller.ts`): 4 esquinas (escala), 4 bordes
  (escala por eje), manija de rotación arriba; snapping en el visor a centro/bordes del lienzo
  y otros elementos (`preview/preview-snap.ts`, 539 l.) con líneas guía (`snap-guides.tsx`).
- **Edición de texto en el lugar**: doble clic → `text-edit-overlay.tsx` (Escape sale).
- **Manijas de máscara** (`mask-handles.tsx`, 305 l.): mover, tamaño, rotar, pluma con
  puntos bezier.
- **Menú contextual** (`context-menu.tsx`): **Fit to screen**, —, **Full screen**,
  **Save snapshot**, **Copy snapshot**, — y casillas de overlays («Show bookmark notes» y las
  guías activas).
- **Guías** (`guides/`): Grid, TikTok, Reels, Shorts, Spotlight (+ Custom sin cablear,
  `guides/registry.tsx:20`). Implementadas pero **sin forma de abrirlas** desde la UI.

### 2.4 Propiedades — `components/editor/panels/properties/`

Con 0 elementos seleccionados: «It's empty here» (`empty-view.tsx`). Con 2 o más: «N elements
selected.0» (hay un «.0» de más en el texto, `index.tsx`). Con 1: columna vertical de íconos (pestañas) + contenido.
Definición en `registry.tsx` (354 l.). **La UI es generada por datos**: cada campo sale de
`params/registry.ts` y se dibuja con `components/property-param-field.tsx`, que tiene 6 widgets:
`number` (NumberField con arrastre), `boolean` (Switch), `select`, `color` (ColorPicker),
`text` (Textarea), `font` (FontPicker). Cada parámetro animable lleva un rombo de
keyframe (`keyframe-toggle.tsx`).

Pestañas por tipo de elemento (orden real):

| Tipo | Pestañas (default en **negrita**) |
|---|---|
| video | **Transform**, Audio (si el medio tiene audio), Speed, Blending, Masks, Effects |
| image | **Transform**, Blending, Masks, Effects |
| text | **Text**, Transform, Blending |
| sticker | **Transform**, Blending, Effects |
| graphic (forma) | **Graphic**, Transform, Blending, Masks, Effects |
| audio | **Audio**, Speed |
| effect (capa) | **Effects** |

Contenido de cada pestaña:

- **Transform**: Position X, Position Y, Scale X, Scale Y (mín 0.01), Rotate (−360…360).
- **Blending**: Opacity (0–1), Blend Mode con 17 modos: Normal, Darken, Multiply,
  Color Burn, Lighten, Screen, Plus Lighter, Color Dodge, Overlay, Soft Light, Hard Light,
  Difference, Exclusion, Hue, Saturation, Color, Luminosity.
- **Audio**: Volume (dB, −60…+20, `timeline/audio-constants.ts`), Muted.
- **Speed** (`speed/components/speed-tab.tsx`): Speed 0.01×–5× (`retime/rate.ts`), reset,
  switch «Change pitch» (mantener tono con soundtouchjs).
- **Text**: Content, Font Family, Font Size, Color, Text Align (Left/Center/Right),
  Font Weight (**sólo** Normal/Bold), Font Style (Normal/Italic), Text Decoration
  (None/Underline/Line Through), Letter Spacing, Line Height, Background Enabled,
  Background Color, Background Radius, Background Padding X/Y, Background Offset X/Y.
  **No hay contorno, sombra, brillo ni plantillas.**
- **Graphic** (`graphics/components/graphic-tab.tsx`): Fill, Color, Stroke Width,
  Stroke align (Inside/Center/Outside), Corner radius (rectángulo/polígono), Sides
  (polígono), Points y Depth (estrella).
- **Masks** (`masks/components/masks-tab.tsx`, 852 l.): botón «+» con 9 tipos
  (Rectangle, Ellipse, Diamond, Heart, Star, Split, Cinematic Bars, Text, Pen tool),
  invertir, quitar; Position, Size/Width/Height, Scale, Rotation, Feather, Stroke (ancho,
  color, alineación); para Text: Content, Font, Size, Spacing. **Una sola máscara por clip**
  (tooltip: «Only one mask is supported right now…»).
- **Effects** (`effects/components/effects-tab.tsx`, 309 l.): pila de efectos del clip con
  activar/desactivar, quitar y reordenar; parámetros animables (Blur → Intensity 0–100).

### 2.5 Línea de tiempo — `timeline/components/`

**Barra** (`timeline-toolbar.tsx`, alto 40 px), de izquierda a derecha:

| Botón | Tooltip | Acción |
|---|---|---|
| Tijera | Split element | `split` |
| AlignLeft | Split left | `split-left` (corta y borra a la izquierda) |
| AlignRight | Split right | `split-right` (corta y borra a la derecha) |
| Link/Unlink | Extract audio / Recover audio | `toggle-source-audio` |
| Copiar | Duplicate element | `duplicate-selected` |
| Copo de nieve | Freeze frame (coming soon) | **deshabilitado** |
| Tacho | Delete element | `delete-selected` |
| — separador — | | |
| Marcador | Add bookmark / Remove bookmark | `toggle-bookmark` |
| Gráfico | Open graph editor | popover de curvas bezier del keyframe seleccionado |
| (centro) | Selector de escena (split button) | `ScenesView`: cambiar, crear, borrar (la principal no se borra) |
| Imán | Auto snapping | toggle (persistido) |
| Ripple | Ripple editing | toggle (persistido) |
| — | zoom −, slider (w-28), zoom + | zoom 0.1×–100× sobre 50 px/s (`timeline/scale.ts`) |

**Cabecera de pistas** (columna de 112 px, `index.tsx` `TrackLabelsPanel`): ícono de tipo,
botón mute (pistas con audio), botón ojo (pistas visuales).

**Pistas** (`timeline/types.ts`): `SceneTracks = { overlay[], main, audio[] }`, 5 tipos
`video | text | audio | graphic | effect`. Altos: video 65, text 25, audio 50, graphic 25,
effect 25 px; separación 6 px; regla 22 px; fila de marcadores 16 px
(`timeline/components/layout.ts`). Colores de clip (`theme.ts`): texto `#5DBAA0`,
audio `#8F5DBA`, gráfico `#BA5D7A`, efecto `#5d93ba`, video sin color (miniaturas).
La pista principal se llama «Main Track» y sólo obliga a que el primer clip arranque en 0
(`timeline/placement/main-track.ts`); **no** cierra huecos como el imán de pista principal de CapCut.

**Elementos** (`timeline-element.tsx`, 1.298 l.): manijas de recorte izq/der, miniatura
**repetida en mosaico** (una sola imagen, no tira de fotogramas), forma de onda real
(`audio-waveform.tsx` 351 l.), línea de volumen arrastrable (`audio-volume-line.tsx`),
rombos de keyframes y carriles expandibles por propiedad, selección por caja
(`selection/selection-box.tsx`), Ctrl/Cmd/Shift-clic para multiselección, arrastre en
grupo (`timeline/group-move/`) y recorte en grupo (`timeline/group-resize/`), auto-scroll en
bordes, soltar archivos del sistema directamente en la timeline.
Zoom con Ctrl/Cmd + rueda; scroll horizontal con Shift + rueda.

**Marcadores** (`timeline/bookmarks/components/bookmarks.tsx`, 442 l.): popover con
Note («Add a note...»), Color (default `#009dff`) y Duration; se arrastran; borrar.

### 2.6 Menús contextuales (todos)

| Dónde | Ítems |
|---|---|
| Clip en timeline | Split · Copy · Duplicate (1 seleccionado) · Mute/Unmute · Extract/Recover audio · Show/Hide · Expand/Collapse keyframes · Reveal media · Replace media (**deshabilitado**) · — · Delete clip / Delete text / Delete N elements |
| Fondo de pista | Paste elements · Mute/Unmute track · Hide/Show track · Delete track (no en la principal) |
| Visor | Fit to screen · Full screen · Save snapshot · Copy snapshot · casillas de overlays |
| Medio en biblioteca | Export clips (**no hace nada**) · Delete / Delete N items |
| Proyecto (lista) | Rename · Duplicate · Info · Delete |

### 2.7 Atajos de teclado

Definidos en `actions/definitions.ts` (`ACTIONS` + `ACTION_DEFAULT_SHORTCUTS`), ejecutados en
`actions/use-editor-actions.ts` (520 l.), escuchados en `actions/use-keybindings.ts`.
«ctrl» equivale a ⌘ en Mac (`actions/keybinding.ts`). Las teclas sueltas se apagan cuando
el foco está en un campo de texto. **Son personalizables**: diálogo «Keyboard shortcuts»
(`actions/components/shortcuts-dialog.tsx`) con grabación de tecla y «Reset to default»;
se persisten con migraciones propias (`actions/keybindings/migrations/`, 6 archivos).

| Acción | Descripción | Atajo por defecto |
|---|---|---|
| toggle-play | Play/Pause | `Space`, `K` |
| seek-forward | Seek forward 1 second | `L` |
| seek-backward | Seek backward 1 second | `J` |
| frame-step-forward | Frame step forward | `→` |
| frame-step-backward | Frame step backward | `←` |
| jump-forward | Jump forward 5 seconds | `Shift+→` |
| jump-backward | Jump backward 5 seconds | `Shift+←` |
| goto-start | Go to timeline start | `Home`, `Enter` |
| goto-end | Go to timeline end | `End` |
| split | Split elements at playhead (seleccionados, o todo lo que cruza el cabezal) | `S` |
| split-left | Split and remove left | `Q` |
| split-right | Split and remove right | `W` |
| delete-selected | Delete current selection (clips, keyframes o puntos de máscara) | `Backspace`, `Delete` |
| copy-selected | Copy selected elements | `Ctrl+C` |
| paste-copied | Paste elements at playhead | `Ctrl+V` |
| toggle-snapping | Toggle snapping | `N` |
| select-all | Select all elements | `Ctrl+A` |
| cancel-interaction | Cancel current interaction | `Esc` |
| duplicate-selected | Duplicate selected element | `Ctrl+D` |
| undo | Undo | `Ctrl+Z` |
| redo | Redo | `Ctrl+Shift+Z`, `Ctrl+Y` |
| stop-playback | Stop playback | — |
| toggle-ripple-editing | Toggle ripple editing | — |
| toggle-source-audio | Extract or recover source audio | — |
| deselect-all | Deselect all elements | — |
| toggle-elements-muted-selected | Mute/unmute selected elements | — |
| toggle-elements-visibility-selected | Show/hide selected elements | — |
| toggle-bookmark | Toggle bookmark at playhead | — |
| remove-media-asset(s) | Remove media asset(s) | — (internas) |

Otros: flechas sobre el cabezal con foco (`timeline-playhead.tsx`), Enter/Escape en
timecode editable, Escape en edición de texto. Pegar archivos con `Ctrl+V` los importa
(`media/use-paste-media.ts`).

**Trampa:** la lista de teclas válidas (`KEYS` en `actions/keybinding.ts`) sólo tiene
a–z, 0–9, flechas, `/ ? .`, enter, tab, space, escape, backspace, delete, home, end. **No
existen** `+ - = [ ] ,` ni F1–F12 ni RePág/AvPág: atajos tipo CapCut como `Ctrl+B`
funcionan, pero `Ctrl+=` / `Ctrl+-` (zoom) o `[` `]` necesitan ampliar ese tipo primero.
No hay acción «cortar» (`Ctrl+X`).

---

## 3. Funcionalidades: CapCut vs OpenCut

Leyenda: **SÍ** = la tiene completa · **PARCIAL** = existe pero le falta lo que CapCut sí
hace · **NO** = no existe (ni modelo de datos).

| Funcionalidad (CapCut) | OpenCut | Dónde vive / qué falta |
|---|---|---|
| Importar medios | **SÍ** | `components/editor/panels/assets/views/assets.tsx`, `media/processing.ts` (mediabunny/WebCodecs), `media/use-paste-media.ts`, archivos soltados en `timeline/controllers/drag-drop-controller.ts:180`. Acepta `image/*,video/*,audio/*`. Falta: carpetas, reemplazar medio (`drag-drop-controller.ts:435` «not yet implemented»). |
| Dividir | **SÍ** | `actions/use-editor-actions.ts:220`, `commands/timeline/element/split-elements.ts`. |
| Recortar (trim) | **SÍ** | Manijas en `timeline-element.tsx`, `timeline/controllers/resize-controller.ts`, `timeline/group-resize/`; Q/W = borrar izquierda/derecha. |
| Borrar | **SÍ** | `delete-selected` (clips, keyframes o puntos de máscara según la selección). |
| Ripple | **SÍ** | `ripple/{apply,diff,shift}.ts`, aplicado en `core/managers/commands.ts`; toggle sin atajo. |
| Imán / snapping | **SÍ** | `timeline/snapping/`, fuentes: cabezal, bordes, marcadores, keyframes (`*-snap-source.ts`). |
| Imán de pista principal | **PARCIAL** | `timeline/placement/main-track.ts`: sólo fuerza inicio en 0; permite huecos. |
| Varias pistas | **SÍ** | `timeline/types.ts` (5 tipos), `commands/timeline/track/` (add, remove, mute, visibility). Falta: bloquear pista, renombrar pista en UI. |
| Texto con estilos | **PARCIAL** | `params/registry.ts:178-300`, `text/`, `fonts/`. Tiene fuente (≈1.920 Google + 9 de sistema), tamaño, color, alineación, negrita, itálica, subrayado/tachado, espaciado, interlineado, fondo. Falta: contorno, sombra, brillo, plantillas, efectos de texto, burbujas, pesos intermedios. |
| Stickers | **PARCIAL** | `stickers/` (providers `flags.ts`, `shapes.ts`, `logos.ts` vacío). 271 banderas + 6 formas. Sin emojis, animados ni GIF. |
| Efectos | **PARCIAL** | `effects/` + `rust/crates/effects`. Infraestructura completa (efecto por clip, pila, reordenar, keyframes, capa de efecto en la timeline) pero **un solo efecto: Blur**. |
| Filtros | **NO** | No hay registro de filtros ni LUT. |
| Transiciones | **NO** | Pestaña placeholder (`components/editor/panels/assets/index.tsx:22`). Sin modelo de datos. |
| Ajustes de color | **NO** | Pestaña «Adjustment» placeholder. Ningún shader de color. |
| Velocidad | **PARCIAL** | `retime/`, `speed/components/speed-tab.tsx`. Constante 0.01×–5× (CapCut llega a 100×), opción «Change pitch». Sólo video y audio. |
| Curva de velocidad | **NO** | `RetimeConfig` sólo tiene `rate` + `maintainPitch`. |
| Invertir (reverse) | **NO** | — |
| Congelar fotograma | **NO** | Botón deshabilitado, `timeline/components/timeline-toolbar.tsx:186`. |
| Espejo | **NO (motor sí)** | El compositor ya voltea con escala negativa (`services/renderer/compositor/frame-descriptor.ts:353`), pero `MIN_TRANSFORM_SCALE = 0.01` (`animation/transform.ts:1`) lo impide. Agregarlo es chico. |
| Rotar | **SÍ** | `transform.rotate` ±360 + manija en el visor; animable. |
| Recortar encuadre (crop) | **NO** | Se puede emular con máscara Rectangle. |
| Fotogramas clave | **SÍ** (más que CapCut en curvas) | `animation/` (3.129 l.), `commands/timeline/element/keyframes/`, `timeline/components/graph-editor/` (presets Smooth, Ease out, Ease in, In out, Pop, Linear + personalizados). Animable: posición, escala, rotación, opacidad, volumen, color, fondo del texto, parámetros de formas y de efectos. Interpolación linear/hold/bezier. Copiar/pegar keyframes. |
| Máscaras | **SÍ** (1 por clip) | `masks/` (6.548 l.): 8 integradas + pluma, feather, invertir, contorno. |
| Croma (chroma key) | **NO** | — |
| Quitar fondo | **NO** | — |
| Animaciones de entrada/salida | **NO** | Sólo keyframes a mano; no hay presets In/Out/Combo. |
| Subtítulos automáticos | **PARCIAL** | `subtitles/`, `transcription/`, `services/transcription/{service,worker}.ts`. Whisper con `@huggingface/transformers` en el navegador (q4, `device:"auto"`), modelos tiny/small (default)/medium/large-v3-turbo sin selector en UI, idiomas: en, es, it, fr, de, pt, ru, ja, zh + auto. Cortes de **3 palabras con tiempo estimado** (`transcription/caption.ts`; timestamps por segmento, no por palabra). Importa SRT/ASS. Falta: estilos/plantillas, resaltado palabra a palabra, editor de transcripción, traducción. |
| Texto a voz | **NO** | — |
| Grabar voz | **NO** | Ni `MediaRecorder` ni `getUserMedia` en todo el código. |
| Extraer audio | **SÍ** | `timeline/audio-separation/index.ts` («Extract audio» / «Recover audio»), `commands/timeline/element/toggle-source-audio-separation.ts`. |
| Volumen / fundidos | **PARCIAL** | Volumen en dB −60…+20, línea arrastrable en el clip, keyframes de volumen, mute, limitador maestro (`media/audio-mastering.ts`). **No hay fade in/out** (se emula con keyframes). |
| Forma de onda | **SÍ** | `timeline/components/audio-waveform.tsx`, `services/waveform-cache/service.ts`, `media/waveform-summary.ts`. |
| Detección de ritmo | **NO** | — |
| Separar voz (aislar voz) | **NO** | Ojo: la carpeta `timeline/audio-separation` **no es eso**; sólo separa la pista de audio del video. |
| Relación de aspecto | **SÍ** | `canvas/sizes.ts`: 1920×1080, 1080×1920, 1080×1080, 1440×1080 + Custom. CapCut ofrece más presets. |
| Fondo desenfocado | **SÍ (a nivel proyecto)** | `background/`, `services/renderer/nodes/blur-background-node.ts`, `components/editor/panels/assets/views/settings/background.tsx`. Blur Light 100 / Medium 200 / Heavy 500, colores y degradados. En CapCut es por clip. |
| Exportar mp4 / resoluciones / fps | **PARCIAL** | `export/`, `services/renderer/scene-exporter.ts` (mediabunny): MP4 H.264+AAC (cae a Opus si no hay AAC) o WebM VP9+Opus, 4 calidades. Resolución = lienzo y fps = proyecto: **no se eligen al exportar**. Sin solo audio, GIF ni HEVC. |
| Deshacer / rehacer | **SÍ** | `core/managers/commands.ts` (patrón Command, historial sin tope, restaura selección). |
| Copiar / pegar | **PARCIAL** | `clipboard/handlers/{elements,keyframes}.ts`, `commands/timeline/clipboard/`. Falta cortar (`Ctrl+X`) y copiar/pegar atributos. |
| Marcadores | **SÍ** | `timeline/bookmarks/` (nota, color, duración, snap, notas en el visor). Sin atajo por defecto. |
| Escenas | **SÍ (propio de OpenCut)** | `commands/scene/`, `core/managers/scenes-manager.ts`, `components/editor/scenes-view.tsx`: varias timelines por proyecto. CapCut no tiene escenas; lo más parecido es el clip compuesto. |
| Guardado automático | **SÍ (local)** | `core/managers/save-manager.ts` (debounce 800 ms) → `services/storage/` (IndexedDB + OPFS). Sin nube. |

Extras de OpenCut que conviene conservar: 17 modos de fusión, opacidad, guías de
plataforma (ocultas), snapshot del fotograma, atajos personalizables, editor de curvas,
biblioteca Freesound, detección de GPU con aviso.

---

## 4. Componentes de UI base y cuánto pesan

| Librería | Archivos que la importan | Notas |
|---|---|---|
| `@/components/ui/*` (shadcn) | 54 archivos (39 fuera de landing/blog) | 48 componentes, 4.996 l. Más usados: button 34, separator 12, popover 8, dialog 8, tooltip 7, label 7, input 7, context-menu 6, select 5, number-field 5, tabs 4, scroll-area 4, dropdown-menu 4, color-picker 4. Propios (no shadcn estándar): `number-field`, `color-picker`, `font-picker`, `split-button`. |
| `radix-ui` (paquete unificado) | 28 | Base de los componentes shadcn. `@radix-ui/*` sueltos: 1. |
| `@hugeicons/react` + `@hugeicons/core-free-icons` | 43 / 44 (40 del editor) | **103 íconos distintos**. Más íconos propios en `components/icons/ui.tsx` (404 l., `OcRippleIcon`, `OcShapesIcon`, `OcVideoIcon`, …). |
| `lucide-react` | 26 | 13 dentro de `components/ui`, el resto en editor/landing. |
| `class-variance-authority` | 14 | Variantes de botón, etc. |
| `@/utils/ui` (`cn` = clsx + tailwind-merge) | 83 | |
| `sonner` (toasts) | 16 | |
| `zustand` | 10 stores | panel-store, assets-panel-store, timeline-store, preview-store, properties-store, keybindings-store, sounds-store, stickers-store, projects/store, editor-store. |
| `next-themes` | 3 | |
| `motion` | 2 | Sólo landing y `guide-popover.tsx`. Irrelevante. |
| `react-resizable-panels` | 1 | Sólo `components/ui/resizable.tsx`. |
| `next/navigation`, `next/image`, `next/link` en el editor | 9 archivos | Acoplamiento chico a Next. |
| Declaradas pero sin uso | `wavesurfer.js`, `@hello-pangea/dnd`, `cmdk`, `embla-carousel-react` | No se importan. No traerlas. |

**Motor (no UI) que sí hay que traer tal cual:** `opencut-wasm` (27 archivos; 93 importan
`@/wasm`), `mediabunny` (7), `soundtouchjs` (2), `@huggingface/transformers` (1),
`eventemitter3` (1), `culori` (3), `use-deep-compare-effect` (1).

**MaKo hoy** (`dashboard-marketing/package.json`): Next 16.2.6, React 19.2.4,
Tailwind 4. **No tiene** radix, shadcn, zustand, lucide, hugeicons, sonner, cva ni
tailwind-merge. Tiene su propio kit (`app/_ui/`: Button, Modal, Select, Tabs, Toast,
Toggle, Tooltip…) y tokens CSS propios (`app/globals.css`: `--bg`, `--surface`,
`--ink`, `--primary #2F6FED`…). OpenCut usa tokens shadcn (`--background`,
`--foreground`, `--primary hsl(200 90% 52%)`, `--accent`, `--muted`…).
La CSP de MaKo (`next.config.ts:139`) sólo fija `frame-ancestors`, `object-src` y `base-uri`:
no bloquea WASM, workers, Google Fonts, Hugging Face ni Freesound.

**Lectura para decidir:** la UI de OpenCut pesa unas 18.450 líneas TSX, frente a ~52.000 de
lógica. Las partes difíciles de la UI (la timeline: `timeline-element.tsx` 1.298 l. e
`index.tsx` 953 l.; las manijas del visor; el panel de máscaras; el editor de curvas) están
muy atadas a sus controladores y conviene **portarlas y re-vestirlas**, no reescribirlas. Lo
que más cambia para parecerse a CapCut (barra de categorías arriba de la biblioteca, nombres,
pestañas, colores) es la capa delgada: `tabbar.tsx`, `assets-panel-store.tsx`,
`registry.tsx`, `params/registry.ts`, `theme.ts`, `layout.ts` y los tokens de color.
Como las propiedades se generan desde `params/registry.ts`, traducir etiquetas al español de
CapCut es cambiar strings en un solo archivo. Para eso conviene traer `components/ui` y sus
dependencias (radix-ui, cva, tailwind-merge, clsx, sonner, zustand) **aisladas dentro de la tab**
del editor, y cambiar los tokens shadcn por los colores de CapCut en un CSS con alcance de la
tab. No hace falta mezclarlo con `app/_ui` de MaKo.

---

## 5. Recursos que trae y de dónde salen

| Recurso | Cantidad | Origen | En tiempo de ejecución |
|---|---|---|---|
| Fuentes | ≈1.920 familias Google (`public/fonts/font-atlas.json`) + 15 sprites AVIF de vista previa (`font-chunk-0..14.avif`, 2,4 MB) + 9 de sistema (`fonts/system-fonts.ts`) | Sprites generados con `apps/web/scripts/generate-font-sprites.ts` | La fuente real se baja de **`fonts.googleapis.com`** (`fonts/google-fonts.ts`): externa. |
| Stickers: banderas | 271 SVG (`public/flags/`, 2,4 MB) | Paquete **flag-icons** (lipis, MIT; los SVG tienen `id="flag-icons-xx"`) | Local. |
| Stickers: formas | 6 SVG (`public/shapes/`) → elementos `graphic` editables (rectangle, ellipse, polygon, star) | Propio | Local. |
| Stickers: logos | 0 (provider vacío) | — | `next.config.ts` permite iconify/simplesvg/unisvg/brandfetch, pero el código no los usa. |
| Sonidos | Catálogo de **Freesound** | API externa vía `app/api/sounds/search/route.ts` (requiere `FREESOUND_API_KEY`; filtro `commercial_only`) | El clip guarda la **URL externa** (`LibraryAudioElement.sourceUrl`): si Freesound cambia, se rompe el proyecto. |
| Efectos | 1 (Blur) + `public/effects/preview.jpg` | Shader WGSL en Rust (`rust/crates/effects/src/shaders/gaussian_blur.wgsl`) | Local (WASM). |
| Máscaras | 9 definiciones | Código TS (`masks/builtin/definitions/`, `masks/freeform/`) + shaders JFA/SDF en Rust | Local. |
| LUTs / filtros | 0 | — | — |
| Fondos | 242 colores (`data/colors/solid.ts`), 22 degradados Pattern Craft, 11 Syntax UI | Copiados de patterncraft.fun y syntaxui.com (verificar licencia) | Local (CSS gradients parseados por `gradients/`, 1.577 l.). |
| Guías de plataforma | `public/platform-guides/tiktok-blueprint.png` + definiciones | Propio | Local. |
| Transcripción | Modelos Whisper ONNX | **huggingface.co** (`onnx-community/whisper-*`), descarga al primer uso | Externo, decenas a cientos de MB por modelo. |
| Motor GPU | `opencut-wasm` (npm) | Compilado de `rust/` con `wasm-pack` | WebGPU con caída a WebGL2; si no hay ninguno, modo degradado. |

---

## 6. Trampas encontradas

1. **Repo archivado**: no habrá parches de arriba; la reescritura vive en otro repo con otra arquitectura.
2. **Nuevos efectos/filtros/ajustes/croma = Rust.** El pipeline de efectos sólo conoce el
   shader `gaussian-blur`, registrado a mano en `rust/crates/effects/src/pipeline.rs:10-135`.
   El WASM no expone una forma de registrar WGSL desde JS. Para filtros, color o croma hay
   que forkear el crate y recompilar `opencut-wasm` con `wasm-pack` (Rust en el pipeline de
   build), o hacer un camino paralelo en TS (WebGL/Canvas) por fuera del motor.
3. **Todo es local por navegador**: IndexedDB + OPFS, 31 migraciones de esquema. En MaKo
   un cliente que cambia de compu pierde los proyectos, y se mezclarían proyectos de
   distintos workspaces en el mismo navegador si no se separa la base por workspace.
4. **Choque de alias**: 1.721 imports `@/…` apuntan a `src/` en OpenCut y a la raíz en
   MaKo. Hay que portar con un codemod (p. ej. `@/x` → `@/lib/editor-video/x`).
5. **Singleton** `EditorCore.getInstance()`: un solo editor por pestaña; hay que resetearlo
   al cambiar de proyecto o workspace (`EditorCore.reset()` existe).
6. **Layout a pantalla completa** (`h-screen w-screen`) y `MobileGate` < 1024 px: al meterlo en
   una tab con sidebar hay que cambiarlo.
7. **Cosas a medio hacer que parecen funcionar**: «Export clips» sin handler, «Replace
   media» deshabilitado, botón de congelar deshabilitado, guías sin botón, pestañas
   Transitions/Adjustment vacías, categoría Logos vacía, búsqueda de canciones 501, texto
   «N elements selected.0».
8. **Subtítulos con tiempos inventados**: cada bloque de 3 palabras reparte la duración del
   segmento en partes iguales por palabra (`transcription/caption.ts`); no hay timestamps reales
   por palabra, así que el resaltado palabra a palabra estilo CapCut no sale de acá.
9. **Atajos**: el tipo `Key` no admite `+ - = [ ] ,` ni teclas F; no hay «cortar».
10. **Freesound**: licencias CC mixtas (algunas NC/BY): hay que filtrar `commercial_only` y
    guardar atribución; además el proyecto depende de una URL externa.
11. **Miniaturas de video**: un solo fotograma repetido; la tira real de fotogramas tipo
    CapCut hay que hacerla.
12. **Dependencias muertas** en `package.json` (wavesurfer.js, @hello-pangea/dnd, cmdk,
    embla): no copiarlas a ciegas.

---

## 7. Decisiones que fuerza este relevamiento (con recomendación)

1. **Portar la UI y re-vestirla, no reescribirla.** Traer `components/ui` y sus
   dependencias aisladas en la tab; cambiar tokens, nombres y estructura de la barra de
   categorías al estilo CapCut.
2. **Efectos, filtros, ajustes, croma y transiciones**: decidir si se agrega Rust/wasm-pack al
   build de MaKo (fork de `opencut-wasm`) o si se escribe un pase WebGL en TS. Recomendación:
   forkear el crate y publicar el WASM compilado como paquete propio; así el build de
   Vercel no necesita Rust, porque el WASM ya llega compilado.
3. **Almacenamiento**: v1 local, como OpenCut, con la base separada por workspace. Sincronizar con Supabase
   Storage queda para después. El video pesa demasiado para subir todo de entrada.
4. **Alcance de «idéntico a CapCut»**: la tabla marca 15 NO y 9 PARCIAL. Hay que priorizar.
   Lo barato primero: espejo, fundidos de audio, congelar, invertir, cortar, presets de
   aspecto, selector de resolución y fps al exportar, contorno y sombra de texto, animaciones
   de entrada y salida como presets de keyframes. Lo caro después: transiciones, filtros con
   LUT, croma, quitar fondo, texto a voz, separar voz y detección de ritmo.
5. **Sonidos**: o se usa Freesound con clave propia y filtro comercial, o un catálogo propio en
   Supabase. Recomendación: Freesound con `commercial_only`, copiando el audio al proyecto
   en vez de guardar la URL.
6. **Subtítulos**: mantener Whisper en el navegador (gratis, no gasta saldo) pero pedir
   timestamps por palabra (`return_timestamps: "word"`) para poder copiar los estilos
   animados de CapCut.
