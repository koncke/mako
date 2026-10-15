# tela (heyimjames/tela): ¿sirve como base del editor de imagen?

Relevamiento de solo lectura del clon en
`scratchpad/research/repos/tela` (`git clone --depth 50`, HEAD `7d46c26`, 10/07/2026,
«docs(readme): reflect the new tooling…»). No se instaló ni se corrió nada: todo lo que
sigue sale de leer el código. Las rutas son relativas a la raíz del repo salvo aviso.

> **Lo primero que hay que saber:** tela es un editor **estilo Figma** (lienzo infinito con
> *frames*, panel de capas a la izquierda e inspector a la derecha), no estilo Canva. Lo
> escribió **una sola persona en tres días** (43 commits del 08/07 al 10/07/2026, el primero
> «Initial commit: Canvas Studio»), sin tests, y desde entonces no se tocó. El código es
> prolijo y el stack es casi el de MaKo (React 19, Zustand 5, Tailwind 4, culori, motion,
> nanoid, lucide), pero le faltan los pilares de Canva: **una sola fuente** (Inter, fija en
> el código), texto sin estilos por tramo, imagen sin recorte ni filtros, sin PDF, sin
> páginas tipo Canva. **Veredicto: piezas, no base** (ver §9).

---

## 0. Resumen en cifras

| Qué | Número | Fuente |
|---|---|---|
| Licencia del repo | MIT («Copyright (c) 2026 Tela contributors») | `LICENSE` |
| Estrellas / forks / issues abiertos | 25 / 8 / 0 | `api.github.com/repos/heyimjames/tela` (14/10/2026) |
| Creado / último push | 09/07/2026 / 10/07/2026 | ídem |
| Commits | 43 (todos de James Frewin, 08–10/07/2026) | `git log` |
| Código TS/TSX/CSS en `src/` | 139 archivos, **23.817 líneas** (TS/TSX: 23.571) | `wc -l` |
| Recursos | 100 fotos `.webp` de caras (2,8 MB, origen sin documentar) | `src/assets/avatars/` |
| Tests | **0** | `find -name "*.test.*"` |
| `any` / `@ts-ignore` + `eslint-disable` | 10 / 6 | `grep` |

Líneas por carpeta (solo código):

| Carpeta | Líneas | Qué hay |
|---|---|---|
| `src/components/panels` | 6.298 | inspector (texto, forma, imagen, SVG, degradado, fondo, efectos), capas, alinear, exportar, IA, plantillas |
| `src/components/canvas` | 3.087 | escena SVG, overlays de selección/hover/medidas, edición de texto, ⌘K, menú contextual |
| `src/store` | 2.744 | 9 stores Zustand (diseño, workspace, archivos, assets, IA, UI…) |
| `src/engine` (+`renderers`) | 2.515 | export Canvas 2D, SVG, medición de texto, reflow, auto layout, trazo a mano alzada |
| `src/hooks` (+`canvas`) | 2.158 | interacción con el lienzo, snapping, resize, atajos, zoom |
| `src/components/layout` | 2.046 | TopBar, ToolBar, sidebars, PreviewPanel (el lienzo, 1.074) |
| `src/components/library` | 1.287 | inicio: archivos, carpetas, recientes, ajustes |
| `src/brand` | 1.281 | marca, paleta, 5 plantillas, 7 «layouts», componentes de diseño |
| `src/types` | 634 | modelo de datos |
| `src/components/ui` | 609 | shadcn sobre Base UI + vaul |
| `src/lib` | 360 | geometría, contraste, API de IA |
| `src/agent` | 319 | bus de comandos `window.tela` |
| `index.css`, `App.tsx`, `main.tsx`, `controls/` | 479 | |

---

## 1. Licencia

- **Repo: MIT** (`LICENSE`, y `"license": "MIT"` en `package.json`). Se puede copiar, modificar y
  revender; hay que conservar el aviso de copyright en lo que se copie.
- `src/engine/freehand.ts` declara ser una reimplementación del algoritmo de `perfect-freehand`
  (Steve Ruiz, MIT): conservar esa atribución si se porta.
- Dependencias núcleo (licencia según `registry.npmjs.org/<paquete>/latest`):
  React/Zustand/culori/motion/vaul/nanoid/Base UI/tailwind-merge/tw-animate-css **MIT**;
  lucide-react **ISC**; Inter y Geist (`@fontsource-variable/*`) **OFL-1.1**. Nada pago ni con key.
- ⚠️ **Trampa: `@paper-design/shaders-react` está fijo en una versión con licencia restrictiva.**
  `package.json` pide `^0.0.76` y el `package-lock.json` resuelve `0.0.76`. En semver, `^0.0.76`
  **solo acepta 0.0.76**: un `npm install` nunca sube. Esa versión se publicó el 15/04/2026 con
  `"license": "SEE LICENSE IN …/LICENSE"`, y en esa fecha el LICENSE del repo de Paper era
  **PolyForm Shield** (commit `8925330f`, 22/08/2025). Paper pasó a **Apache-2.0** recién el
  27/06/2026 (commit `931beca6`) y la primera versión publicada con Apache es **0.0.77**
  (02/07/2026). PolyForm Shield prohíbe usar el software en un producto que compita con el del
  licenciante, y Paper es un editor de diseño. Si se quieren los fondos animados: **≥ 0.0.77**.
  Fuentes: `registry.npmjs.org/@paper-design/shaders-react` (campo `time` y `license` por versión),
  `api.github.com/repos/paper-design/shaders/commits?path=LICENSE`.
- Las 100 fotos de `src/assets/avatars/` no dicen de dónde salen (`src/brand/avatars.ts` solo las
  describe como «100 compressed 512px webp faces»). **No reutilizarlas.**
- `shadcn` (el CLI, con `undici`, `execa`, `ora`…) está en `dependencies` solo porque
  `src/index.css` hace `@import "shadcn/tailwind.css"`. No es un problema de licencia, pero no hay
  que arrastrarlo a MaKo.

---

## 2. Arquitectura

### 2.1 Motor de lienzo: SVG-DOM para editar, Canvas 2D para exportar

- **Edición:** `src/components/canvas/DesignSvgScene.tsx` (713 líneas) dibuja el documento como un
  `<svg viewBox>` en coordenadas de diseño: cada capa es un `<g transform>` con
  `translate/rotate/scale` (volteo), sombra y desenfoque como `filter: drop-shadow() blur()` de
  CSS. El **texto es HTML real dentro de `<foreignObject>`** (el navegador parte líneas, usa
  `text-wrap: pretty/balance` y `text-box-trim`). Los SVG importados se inyectan con
  `dangerouslySetInnerHTML` dentro de otro `<foreignObject>`.
- **Exportar PNG/JPG/WebP:** `src/engine/compositor.ts` + `src/engine/layerRenderer.ts` (492) +
  `renderers/{textRenderer,gradientRenderer}.ts` **vuelven a dibujar todo a mano** en un canvas 2D.
  Son dos renderizadores que tienen que coincidir; el README promete «no wrap drift», pero el de
  Canvas 2D parte líneas con un algoritmo goloso (`engine/textMeasure.ts:wrapText`) y no entiende
  `textWrap: 'pretty' | 'balance'`, que es **el valor por defecto de todo texto nuevo**
  (`createTextLayer` en `useDesignStore.ts:1112`). Por lectura: el PNG puede cortar las líneas
  distinto que el lienzo (no medido).
- **Exportar SVG:** `src/engine/svgExport.ts` serializa la misma escena con
  `renderToStaticMarkup` (de `react-dom/server`, usado en el cliente). Texto e íconos van en
  `<foreignObject>`: Illustrator y Figma no los ven (lo admite el propio comentario del archivo).
- `src/components/canvas/DesignCanvas.tsx` (el renderizador Canvas 2D en vivo) es **código
  muerto**: nadie lo importa.

Consecuencia para MaKo: cada efecto de texto, filtro de imagen, máscara o texto curvo de Canva hay
que escribirlo **dos veces** (SVG/CSS para ver y Canvas 2D para exportar) y mantenerlos iguales.

### 2.2 Modelo de datos

`src/types/design.ts` (362) y `src/types/workspace.ts`:

```
Workspace → Page[] (como las páginas de Figma) → Frame[] (mesas de trabajo con x/y en el lienzo
infinito) → Layer[]
Layer = background | text | image | svg | shape | gradient | group(legado) | draw
```

- `LayerBase`: `x, y, width, height, rotation, zIndex, opacity, visible, locked, flipH/V,
  constraints (anclas tipo Figma para redimensionar), groupId (grupo plano, sin contenedor),
  layoutGrow, shadow, blur`.
- `TextLayer`: `content: string` (**texto plano, sin tramos**), `fontSize`, `fontWeight 100–900`,
  `textAlign` (izq/centro/der), `color`, `letterSpacing`, `lineHeight`, `textTransform`,
  `underline`, `strikethrough`, `verticalAlign`, `textSizing` (fijo / ancho auto / alto auto).
  **No hay `fontFamily` ni itálica.**
- `ImageLayer`: `imageUrl` (dataURL), `fit`, `cropX/Y/W/H` (en el modelo, **sin UI**), `borderRadius`.
- `ShapeLayer`: `rectangle | ellipse | line | pill | triangle | star`, relleno **solo color**,
  `stroke`, `borderRadius`, flechas y punto de control Bézier para líneas.
- `GradientLayer`: lineal, radial, cónico y *mesh*, con paradas en **OKLCH**.
- `BackgroundLayer`: sólido, degradado, imagen o *shader* WebGL.
- Los colores son `BrandColor { token, hex }` para atarlos a la paleta de marca.
- `DesignDocument.autoLayouts`: configuración tipo *Auto Layout* de Figma, por `groupId`.

El documento **activo** vive en `useDesignStore`; al cambiar de frame se copia desde y hacia
`useWorkspaceStore` (`_syncBackToFrame`, con `structuredClone` de todas las capas en cada cambio).

### 2.3 Deshacer / rehacer

`useDesignStore.pushSnapshot`: guarda `structuredClone(document)` entero, tope 100. **Es por frame
activo**: `loadFromFrame` vacía el historial, así que cambiar de frame pierde el deshacer. El menú
contextual de capa hace `pushSnapshot()` y después `removeLayer()`, que vuelve a hacerlo: dos pasos
de deshacer para un borrado (`PreviewPanel.tsx:651`).

### 2.4 Selección y transformación

Todo propio (no hay librería de lienzo): `src/hooks/useCanvasInteraction.ts` (788) hace hit-test
con rotación inversa y tolerancia mayor en táctil, arrastre con zona muerta, selección por
recuadro, alt-arrastrar para duplicar, resize por manija (`hooks/canvas/useResizeComputation.ts`),
resize de grupo con escala del `fontSize` y rotación con Shift a 15° (45° en táctil). **Rotar solo
con una capa seleccionada** (`SelectionOverlay.tsx:61`). Cada `pointermove` llama `updateLayer`.

### 2.5 Snapping

`src/hooks/canvas/useSnapComputation.ts` (315): imán a bordes y centros de las otras capas y del
frame (umbral 9 px), a la grilla de columnas (`GridOverlay.tsx`) y **«rhythm snap»**: si hay dos o
más capas con un espacio regular, ofrece el mismo espacio y dibuja todos los huecos iguales con su
valor (el «smart spacing» de Figma, lo que Canva muestra como distancias rosadas).
`DistanceMeasurement.tsx` (130) muestra distancias con Alt. Es la mejor pieza del repo.

### 2.6 Multipágina

Hay **frames** sobre un lienzo infinito (agregar, duplicar, borrar, renombrar, mover arrastrando la
etiqueta, `arrangeFrames` para acomodarlos) y **páginas tipo Figma** (`addPage/removePage`). Solo
el frame activo es editable; los demás se dibujan como miniatura (`FrameThumbnail.tsx`). No hay
lista ordenada de páginas, ni reordenar, ni cuadrícula de páginas como en Canva.
`generateFormatVariants` crea un frame por cada formato de anuncio a partir de uno (el «Magic
Switch» de Canva, con las anclas `constraints` de `engine/reflow.ts`).

### 2.7 Fuentes y texto

`src/engine/textMeasure.ts:6`: `export const FONT_FAMILY = "'Inter Variable', system-ui,
sans-serif"`. Una sola fuente para medir, dibujar, editar y exportar. Agregar fuentes implica
`fontFamily` en el modelo, carga (y espera) antes de medir, y tocar los dos renderizadores.
La edición es un `contentEditable` superpuesto (`TextEditOverlay.tsx`) que pega solo `text/plain`.

### 2.8 Plantillas

`src/brand/templates.ts`: **5 plantillas** (búsquedas laborales, testimonio, CTA…) escritas como
datos. Además 7 «layouts» (esqueletos de composición, `brand/layouts.ts`) y una librería de
componentes de UI (botones, inputs, tarjetas, avatares: `brand/dsComponents.ts`, 745).

### 2.9 Imágenes y recursos

- Subir: `AssetLibraryPanel.tsx` (soltar archivo **en el panel**, no en el lienzo) y botón en la
  barra. Se guardan como **dataURL en localStorage** (`useAssetStore.addAsset` con `FileReader`).
- Íconos: todos los de `lucide-react` (ISC), convertidos a SVG con `renderToStaticMarkup` y
  recoloreables (`IconPickerPanel.tsx`).
- SVG subido: se extraen sus colores y se remapean uno por uno (`engine/svgColors.ts`).

### 2.10 Persistencia

Tres stores con `persist` de Zustand a `localStorage` (`tela-design`, `tela-workspace`, archivos y
assets). Con imágenes en dataURL, el cupo de ~5 MB del navegador se llena enseguida. Por lectura:
cada `pointermove` de un arrastre actualiza el store de diseño y, en microtarea, el del workspace;
los dos están persistidos, así que se serializa el documento entero (con las imágenes) en cada
movimiento. No medido.

### 2.11 IA y automatización

- `src/agent/commands.ts` (270) + `rpc.ts`: bus de comandos serializables `{ op, ...args }` con
  `getSchema` (addFrame, addText, addShape, updateLayer, setFrameFormat, generateFormatVariants,
  relayoutFrame…), expuesto como `window.tela.dispatch` y por `postMessage`. **No valida el origen**
  del mensaje (solo una etiqueta `source: 'tela-agent'`).
- Panel de IA (`AIPanel.tsx` + `store/useAIStore.ts`): cliente delgado contra un endpoint propio
  (contrato SSE en `docs/ai-endpoint.md`). `AIAdBuilder.tsx` e `InlineAIPrompt.tsx` son código
  muerto (nadie los importa).

---

## 3. Dependencias y compatibilidad con MaKo

| Paquete (tela) | Versión | Licencia | En MaKo | Nota |
|---|---|---|---|---|
| react / react-dom | 19.2.7 (lock) | MIT | 19.2.4 | OK |
| zustand | 5.0.14 | MIT | ^5.0.15 | OK, mismo patrón |
| culori | ^4.0.2 | MIT | ^4.0.2 | idéntico |
| motion | ^12.42.1 | MIT | ^12.43.0 | OK |
| nanoid | ^5.1.16 | MIT | ^5.1.16 | idéntico |
| lucide-react | ^1.22.0 | ISC | ^0.562.0 | MaKo usa otra mayor: revisar nombres de íconos |
| tailwindcss | ^4.3.2 | MIT | ^4 | OK; el CSS va con alcance `.cv` |
| @base-ui/react | ^1.6.0 | MIT | no (MaKo usa `radix-ui`) | se reemplaza o se suma |
| vaul | ^1.1.2 | MIT | no | hojas inferiores en móvil |
| @paper-design/shaders-react | 0.0.76 | **PolyForm Shield** | no | ver §1; ≥0.0.77 es Apache-2.0 |
| shadcn (CLI) | ^4.12.0 | MIT | no | no se arrastra |
| vite 8 | 8.1.3 | MIT | — | `import.meta.glob` en `brand/avatars.ts` no existe en Next |

Para montarlo en Next 16 (`app/image-editor/`):
- Alias: tela usa `@/*` → `./src/*` en **440 imports**; en MaKo `@/*` es la raíz del repo (el mismo
  choque que tuvo el port de OpenCut, `docs/editor-video/relevamiento-opencut.md` §0).
- Router propio (`store/useRouterStore.ts`) y puente con un host `/studio` (`useStudioBridge.ts`):
  se reemplazan por rutas de Next.
- Todo es cliente: entrada con `dynamic(…, { ssr: false })`, como el Video Editor.
- `react-dom/server` en el cliente (`svgExport.ts`, `IconPickerPanel.tsx`): verificar en el build de
  Next.
- Textos en inglés escritos a mano (no hay i18n): se traducen todos a español neutro con «tú».

---

## 4. Calidad

- **TS estricto:** sí (`tsconfig.app.json`: `"strict": true`, `noFallthroughCasesInSwitch`,
  `erasableSyntaxOnly`), pero con `noUnusedLocals/Parameters: false` y el lint con
  `no-explicit-any`, `exhaustive-deps` y varias reglas de hooks bajadas a *warning*
  (`eslint.config.js`).
- **Tests:** ninguno. CI (`.github/workflows/ci.yml`): `typecheck`, `lint`, `build`.
- **Comentarios:** abundantes y buenos; explican el porqué. Es fácil de leer.
- **Código muerto:** `DesignCanvas.tsx`, `CommentPins.tsx`, `AIAdBuilder.tsx`,
  `InlineAIPrompt.tsx` (sin importadores).
- **Madurez:** 3 días de historia, un autor, 0 issues, 25 estrellas. Lo que se porte pasa a ser
  nuestro: no va a haber arreglos de arriba.

---

## 5. Checklist de Canva

SÍ = está y funciona por lectura · PARCIAL = existe pero incompleto o distinto · NO = no existe.

| Área | Función | tela | Dónde / nota |
|---|---|---|---|
| Inicio | Crear por tamaño | PARCIAL | 7 formatos de anuncio (`brand/formats.ts`) + ancho/alto libre (`FramePropertiesPanel.tsx`); «New file» crea siempre LinkedIn 1200×627 |
| | Recientes | SÍ | `HomePage.tsx` (Recientes, carpetas, archivados) |
| | Plantillas | PARCIAL | 5 plantillas + 7 layouts + componentes |
| Lienzo | Zoom | SÍ | `useSmartZoom.ts`, ⌘+/−/0, pellizco, ajustar (0,1×–4×) |
| | Multipágina (agregar/duplicar/borrar/reordenar/cuadrícula) | PARCIAL | frames: agregar/duplicar/borrar sí; reordenar y cuadrícula no |
| | Fondo color / imagen / degradado | SÍ | `BackgroundPanel.tsx` (+ shader animado) |
| | Reglas y guías | PARCIAL | guías de imán y grilla de columnas sí; reglas y guías manuales no |
| | Snapping con distancias | SÍ | `useSnapComputation.ts` + `DistanceMeasurement.tsx` |
| | Márgenes / sangrado | NO | solo márgenes de la grilla de columnas |
| Texto | Fuentes | NO | una sola (Inter) |
| | Tamaño, color | SÍ | |
| | Negrita / itálica / subrayado / tachado | PARCIAL | peso 100–900, subrayado, tachado; sin itálica; sin estilos por tramo |
| | Mayúsculas | SÍ | `textTransform` |
| | Alineación | PARCIAL | izq/centro/der + vertical; sin justificado |
| | Listas | NO | |
| | Espaciado (letras, interlineado) | SÍ | |
| | Efectos (sombra, elevar, hueco, salpicadura, eco, glitch, neón, fondo) | PARCIAL | solo sombra y desenfoque genéricos de capa (`EffectsPanel.tsx`) |
| | Curvar | NO | |
| Formas | Formas con texto adentro, borde, radio | PARCIAL | 6 formas, borde y radio sí; texto adentro no; relleno solo color |
| | Líneas y flechas | SÍ | curva Bézier, puntas inicio/fin, extremos; sin punteado |
| | Marcos (máscara) | NO | |
| | Cuadrículas | NO | |
| | Gráficos | NO | |
| | Tablas | NO | |
| | Stickers SVG recoloreables | SÍ | íconos lucide + SVG subido con remapeo por color (`svgColors.ts`); sin biblioteca de stickers |
| | Fotos de biblioteca | PARCIAL | 100 avatares empaquetados (origen dudoso); sin stock |
| | Videos | NO | |
| | QR | NO | |
| | Emoji | NO | |
| Operaciones | Selección múltiple | SÍ | Shift-clic y recuadro |
| | Mover / escalar / rotar | SÍ | rotar solo de a una capa |
| | Voltear | SÍ | Shift+H / Shift+V |
| | Recortar | NO | campos `crop*` sin UI |
| | Transparencia | SÍ | |
| | Capas / alinear / distribuir | SÍ | `LayerListPanel.tsx` (arrastrar), ⌘[ ⌘], `AlignmentPanel.tsx` (alinear, distribuir por bordes y centros, igualar tamaños) |
| | Agrupar | SÍ | ⌘G (grupo plano) + Auto Layout |
| | Bloquear | SÍ | |
| | Duplicar | SÍ | ⌘D y alt-arrastrar |
| | Copiar / pegar | PARCIAL | portapapeles interno; no pega imágenes ni texto del sistema |
| | Copiar estilo | SÍ | ⌘⌥C / ⌘⌥V (`useKeyboardShortcuts.ts`) |
| | Deshacer / rehacer | PARCIAL | por frame; se pierde al cambiar de frame |
| | Atajos | SÍ | herramientas de una tecla, ⌘K, hoja de atajos con «?» |
| | Menú contextual | SÍ | capa, lienzo y frame |
| | Comentarios | NO | `CommentPins.tsx` existe pero está muerto |
| | Enlace | NO | |
| | Animaciones | NO | (el shader se anima en vivo, se exporta quieto) |
| Imagen | Ajustes | NO | |
| | Filtros | NO | solo desenfoque de capa |
| | Efectos | PARCIAL | sombra, desenfoque, radio |
| | Quitar fondo | NO | |
| | Reemplazar | SÍ | «Replace Image» |
| | Como fondo | PARCIAL | el fondo admite imagen, no «convertir esta foto en fondo» |
| Color | Documento / marca / por defecto | PARCIAL | paleta de marca en código (`brand/palette.ts`); sin colores del documento |
| | Degradados | PARCIAL | capa de degradado y fondo; formas y texto no |
| | Cuentagotas | SÍ | API EyeDropper (solo Chromium, solo modo Pro) |
| Panel lateral | Diseño | PARCIAL | plantillas en modal + layouts |
| | Elementos | PARCIAL | componentes + íconos + formas de la barra |
| | Texto | PARCIAL | «roles» de texto; sin combinaciones de fuentes |
| | Marca | PARCIAL | paleta en código; sin kit editable por el usuario |
| | Subidos | SÍ | `AssetLibraryPanel.tsx` (en localStorage) |
| | Dibujar | SÍ | lápiz con presión simulada, resaltador, borrador |
| | Proyectos | SÍ | inicio con archivos y carpetas (fuera del editor) |
| | Apps | NO | |
| Barra superior | Archivo | PARCIAL | |
| | Redimensionar | SÍ | cambio de formato con reflow + variantes para todos los formatos |
| | Guardado | PARCIAL | automático a localStorage, sin nube |
| | Título | SÍ | |
| | Compartir / Descargar | PARCIAL | descargar sí, compartir no |
| | Presentar | NO | |
| Barra inferior | Notas | NO | |
| | Zoom | SÍ | |
| | Cuadrícula de páginas | NO | |
| Exportar | PNG transparente / tamaño | PARCIAL | PNG 1×/2×/3×; sin tamaño libre; transparente solo ocultando el fondo |
| | JPG con calidad | SÍ | (+ WebP, + copiar al portapapeles) |
| | PDF | NO | |
| | SVG | PARCIAL | texto en `foreignObject` |
| | Elegir páginas | NO | exporta el frame activo |
| Colaboración | | NO | local, un usuario |
| IA | | PARCIAL | chat y re-maquetado contra un endpoint propio |

Cuenta: SÍ 29 · PARCIAL 25 · NO 25 (de 79 renglones).

---

## 6. Trampas encontradas leyendo

1. **Paper Shaders 0.0.76 = PolyForm Shield**, y `^0.0.76` no sube nunca (§1).
2. **Inyección de SVG sin sanear:** `DesignSvgScene.tsx:582` mete el SVG subido con
   `dangerouslySetInnerHTML`. En tela (un usuario, local) es inofensivo; en MaKo, con diseños
   compartidos en un workspace o plantillas del SuperAdmin, un SVG con `onload`/`<script>` corre
   en la sesión de quien lo abre. Hay que sanear (DOMPurify con perfil SVG) antes de guardar y de
   dibujar.
3. **`postMessage` sin verificar origen** (`agent/rpc.ts`): cualquier ventana puede mandar
   comandos. En MaKo: fijar el origen o sacarlo.
4. **Exportar puede salir sin imágenes (por lectura, no reproducido):** el renderizador Canvas 2D
   pide las imágenes con `getOrLoadImage` (`engine/renderers/imageCache.ts`), que la primera vez
   devuelve `null` y carga en segundo plano; `renderImageLayer`, `renderImageBackground` y
   `renderSvgLayer` hacen `if (!img) return`. `exportDesign` no precarga nada y el único que
   calentaba la caché en el editor (`DesignCanvas.tsx`) está muerto. Lo calientan las miniaturas
   del inicio (`HomePage.tsx:740`), así que el error aparece con una imagen recién subida dentro
   del editor.
5. **El PNG puede partir líneas distinto que el lienzo** (`text-wrap: pretty` contra el algoritmo
   goloso, §2.1). No medido.
6. **localStorage como base de datos** con imágenes en dataURL: cupo y serialización en cada
   movimiento (§2.10).
7. **Deshacer por frame** y doble paso al borrar desde el menú (§2.3).

---

## 7. Esfuerzo: portar tela vs escribir sobre fabric.js / Konva

Estimaciones de orden de magnitud, en jornadas de una persona con agentes, para llegar a «Canva
v1» (sin colaboración en tiempo real, sin video). Salen de la lista de §5 y de lo que hubo que
hacer en el port de OpenCut; no son una promesa.

**A. tela como base, en `app/image-editor/`**

| Bloque | Jornadas |
|---|---|
| Montaje en Next 16: 440 imports `@/`, `import.meta.glob`, router propio, cliente con `ssr:false`, Base UI/vaul/shadcn → radix, CSS con alcance `.cv` | 3–5 |
| Persistencia en Supabase por workspace (hoy 3 stores en localStorage) + imágenes a Storage (hoy dataURL; con URLs hace falta `crossOrigin` para exportar) | 5–8 |
| Re-vestido Canva: los ~13.400 renglones de `components/` son un layout Figma; Canva es riel de 8 paneles, barra contextual sobre el lienzo, páginas apiladas, barra inferior. Se reescribe casi todo | 15–20 |
| Páginas tipo Canva (lista ordenada, reordenar, cuadrícula, deshacer global) sobre los frames | 4–6 |
| Fuentes (catálogo, carga, medición), itálica, estilos por tramo y listas, **en los dos renderizadores** | 10–15 |
| Efectos de texto de Canva + curvar, dos veces (SVG/CSS y Canvas 2D) | 6–9 |
| Imagen: recorte, ajustes y filtros (filtro SVG + `ctx.filter`), marcos/máscaras, quitar fondo (MediaPipe ya está en el Video Editor), como fondo | 8–12 |
| Elementos nuevos: QR, emoji, stickers, fotos de stock, cuadrículas, tablas, gráficos, texto en formas | 10–15 |
| Exportar: PDF multipágina, PNG transparente, tamaño libre, elegir páginas, arreglo de §6.4 | 3–5 |
| API de MaKo (sobre `agent/commands.ts`), plantillas del SuperAdmin, saneo de SVG, origen del `postMessage` | 4–6 |
| **Total** | **≈ 68–101** |

**B. Editor propio sobre fabric.js 7 (MIT, 7.4.0) con piezas de tela**

fabric ya trae selección múltiple, transformador con rotación, grupos, edición de texto en el
lienzo **con estilos por carácter**, texto sobre un path (curvar), filtros WebGL de imagen
(brillo, contraste, saturación, tono, desenfoque, ruido, pixelado…), `clipPath` (marcos y recorte
no destructivo), export a PNG/JPG con `multiplier` y a SVG, y serialización JSON. Lo que no trae:
páginas, snapping con distancias (se porta el de tela), deshacer (se hace sobre el modelo propio).

| Bloque | Jornadas |
|---|---|
| Esqueleto Next + fabric cliente + **modelo de documento propio** (los tipos de tela como punto de partida) + adaptador modelo ↔ fabric | 6–9 |
| Interacción: controles con look Canva, snapping y espaciado (porte de `useSnapComputation`), alinear/distribuir, atajos, menú contextual, copiar estilo, deshacer | 7–10 |
| UI Canva (igual que en A: se escribe de cero en los dos casos) | 15–20 |
| Páginas tipo Canva | 4–6 |
| Texto: fuentes + estilos por carácter + listas (fabric ya edita con estilos) | 5–8 |
| Efectos de texto + curvar (un solo renderizador) | 4–6 |
| Imagen: filtros nativos, `clipPath`, quitar fondo | 6–9 |
| Elementos nuevos | 10–15 |
| Exportar (PNG/JPG nativos, SVG nativo, PDF) | 3–4 |
| Persistencia, API de MaKo, plantillas, saneo | 8–12 |
| **Total** | **≈ 68–99** |

Lectura: los totales empatan. tela ahorra la capa de interacción (snapping, alinear, atajos:
~7–10 jornadas) pero cobra un **impuesto permanente**: todo lo visual de Canva (texto rico,
efectos, filtros, máscaras) hay que hacerlo dos veces y mantenerlo igual, sobre un código de 3 días
sin tests ni comunidad. fabric cobra el adaptador modelo ↔ lienzo y el porte del snapping.

Konva (MIT, 10.8.0) encaja aún mejor con un modelo propio en Zustand porque `react-konva` es
declarativo, pero no edita texto en el lienzo ni con estilos por tramo y no exporta SVG; para
paridad con Canva en texto, fabric gana. Ojo: `react-konva` 19.3.0 pide React ^19.3.0; con el
React 19.2.4 de MaKo va la 19.2.x (`registry.npmjs.org/react-konva`).

---

## 8. Piezas que valen la pena aunque no sea la base

Copiar con su aviso MIT. Todas son TS puro o casi, sobre rectángulos `{x, y, width, height,
rotation}`, así que sirven con cualquier motor.

| Archivo | Líneas | Para qué en MaKo |
|---|---|---|
| `src/hooks/canvas/useSnapComputation.ts` | 315 | imán a bordes/centros + espaciado igual con el valor del hueco: las guías rosadas de Canva |
| `src/components/canvas/DistanceMeasurement.tsx` | 130 | cálculo de distancias a vecinos (la parte de cálculo; el dibujo se rehace) |
| `src/hooks/canvas/useResizeComputation.ts` + `applyGroupResize` en `src/hooks/useCanvasInteraction.ts` | 109 + ~45 | resize con ancla y Shift; resize de grupo escalando `fontSize` y radios |
| `src/components/panels/AlignmentPanel.tsx` | 315 | extraer las funciones de alinear, distribuir (bordes y centros) e igualar tamaños |
| `reorderSelection` en `src/store/useDesignStore.ts` (585–643) | ~60 | traer al frente / adelante / atrás / al fondo una selección conservando su orden relativo |
| `src/engine/reflow.ts` + `src/engine/autoResize.ts` + `LayerConstraints` en `src/types/design.ts` | 104 + 88 | «Redimensionar» de Canva: llevar un diseño a otro tamaño sin que nada se salga |
| `src/brand/formats.ts` | 17 | semilla de «Crear por tamaño» (formatos de anuncio) |
| `src/engine/svgColors.ts` | 206 | stickers recoloreables: extraer y remapear cada color de un SVG (fill, stroke, `style`, `<style>`) |
| `src/engine/svgMeasure.ts` | 91 | tamaño intrínseco de un SVG importado |
| `src/engine/freehand.ts` + `src/hooks/useDrawTool.ts` | 369 + 194 | panel «Dibujar»: lápiz con presión simulada, resaltador, borrador (atribuir perfect-freehand) |
| `src/lib/geometry.ts` | 57 | triángulo, estrella, puntas de flecha, distancia a polilínea (hit-test de trazos) |
| `src/hooks/useSmartZoom.ts` | 159 | zoom al cursor, ajustar a pantalla, pellizco |
| `src/hooks/useKeyboardShortcuts.ts` | 465 | mapa de atajos y `pickStyle/styleFor` (copiar estilo solo con las claves válidas para el tipo destino) |
| `src/engine/textMeasure.ts` | 153 | medir y partir texto con `letterSpacing` y recorte a la altura de mayúscula (si se mide en canvas) |
| `src/agent/commands.ts` | 270 | patrón de comandos `{ op, ...args }` con `getSchema`: esqueleto de los endpoints del editor en la API de MaKo |
| `src/types/design.ts` | 362 | punto de partida del modelo de documento (sumar `fontFamily`, itálica, tramos, página) |
| `src/hooks/useCoarsePointer.ts` + tolerancias táctiles de `useCanvasInteraction.ts` | — | MaKo Mobile: manijas y hit-test más generosos en táctil |

**No reutilizar:** las 100 fotos de `src/assets/avatars/` (origen sin documentar), Paper Shaders
0.0.76, la UI (`components/layout`, `panels`, `library`: es Figma, no Canva), la persistencia, y
los archivos muertos (`DesignCanvas`, `CommentPins`, `AIAdBuilder`, `InlineAIPrompt`).

---

## 9. Veredicto

**Piezas, no base.** Motivos:

1. El paradigma es Figma (lienzo infinito, capas, inspector, Auto Layout) y la UI se reescribe
   entera para que se vea igual a Canva: lo que se «ahorra» de UI es casi nada.
2. Le faltan los pilares de Canva y, con su arquitectura de dos renderizadores, cada uno cuesta
   el doble: fuentes, texto con estilos por tramo, efectos, recorte, filtros, máscaras, PDF.
3. Es un código de 3 días, sin tests, sin usuarios ni mantenedor: lo que se porte es nuestro desde
   el primer día.
4. Lo bueno es motor-agnóstico (snapping, alinear/distribuir, reflow, SVG recoloreable, trazo a
   mano alzada, bus de comandos) y se lleva en limpio a un editor sobre fabric.js.

---

## Fuentes

- Código: `https://github.com/heyimjames/tela` en `7d46c2640c9cbf303676a809f465ae344722508d`
  (archivos citados arriba con su ruta).
- Metadatos del repo: `https://api.github.com/repos/heyimjames/tela` (consultado el 14/10/2026).
- Licencias y versiones: `https://registry.npmjs.org/<paquete>/latest` para cada dependencia de §3.
- Paper Shaders: `https://registry.npmjs.org/@paper-design/shaders-react` (campos `time` y
  `versions[*].license`) y `https://api.github.com/repos/paper-design/shaders/commits?path=LICENSE`.
- react-konva: `https://registry.npmjs.org/react-konva` (peerDependencies por versión).
- Cambios de fabric 5 → 6: `https://fabricjs.com/docs/upgrading/upgrading-to-fabric-60/`.
- Precedente de port: `docs/editor-video/relevamiento-opencut.md` y `docs/hallazgos-video-editor.md`.
