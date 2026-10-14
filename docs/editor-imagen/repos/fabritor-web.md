# fabritor-web (sleepy-zone/fabritor-web): ¿sirve como base del editor de imagen?

Relevamiento de solo lectura del clon en
`scratchpad/research/repos/fabritor-web` (`git clone --depth 50`, HEAD `af35a01`, 30/08/2024,
«fix: multi img group(#50)»). No se instaló ni se corrió nada: todo sale de leer el código. Las
rutas son relativas a la raíz del repo salvo aviso.

> **Lo primero que hay que saber:** fabritor es un editor de pósters chino sobre **fabric.js 5.3**
> (no 6), con **React 18**, **antd 5** y el framework **ice.js** de Alibaba. Está **parado desde el
> 30/08/2024** (13,5 meses sin commits) y sin un fork vivo. Es chico (**7.717 líneas**), con TS no
> estricto y sin tests. Lo que tiene se parece más a Canva que tela (fuentes, texto curvo,
> trazo, filtros, recorte, QR, emoji, controles de selección con píldoras), pero está escrito
> contra una API de fabric que la v6 rompió: portarlo es reescribirlo. Es **un solo lienzo**
> (sin páginas). **Veredicto: recetario de fabric, no base** (ver §9).

---

## 0. Resumen en cifras

| Qué | Número | Fuente |
|---|---|---|
| Licencia del repo | MIT («Copyright (c) 2023 SleepyZone») | `LICENSE` |
| Estrellas / forks / issues abiertos | 1.201 / 171 / 10 | `api.github.com/repos/sleepy-zone/fabritor-web` (14/10/2026) |
| Creado / último push | 04/11/2023 / 30/08/2024 | ídem |
| Commits | 84 visibles en el clon (profundidad 50, con merges); el último, 30/08/2024 | `git log` |
| Código TS/TSX/CSS/SCSS en `src/` | 108 archivos, **7.717 líneas** | `wc -l` |
| Fuentes empaquetadas | 17 fuentes chinas, **175 MB** (la mayor, 28,6 MB) | `src/assets/fonts/` |
| Tests | **0** | `find -name "*.test.*"` |
| `@ts-ignore` / `@ts-nocheck` / `any` | 30 / 2 archivos / 10 | `grep` |
| Forks con mantenimiento | ninguno (el más activo, 1 estrella, último push 29/05/2024) | `…/forks?sort=stargazers` |

Líneas por carpeta (solo código):

| Carpeta | Líneas | Qué hay |
|---|---|---|
| `src/fabritor/UI` | 4.064 | header (exportar, deshacer, mano), paneles izquierdos, *setters* (inspector) |
| `src/editor` | 2.194 | clase `Editor` (451), controles (407), objetos propios `FText/FImage/FArrow/FLine` (389), objetos (391), guías (304), historial/autosave/atajos (252) |
| `src/utils` | 513 | copiar/pegar, capas, grupos, portapapeles, colores, descarga |
| `src/fabritor/components` | 435 | menú contextual, selectores de imagen, globo de ángulo |
| `src/fabritor/index.tsx` | 168 | armado de la pantalla |
| `font.css`, `global.css` | 157 | `@font-face` de las 17 fuentes |
| `pages`, `i18n`, `context`, `config`, `app.ts`, `document.tsx` | 146 | ice.js + i18next |

---

## 1. Licencia

- **Repo: MIT** (`LICENSE`, `package.json`). Hay que conservar el aviso en lo que se copie.
- Dependencias núcleo (según `registry.npmjs.org/<paquete>/latest`): fabric **MIT**, antd **MIT**,
  cropperjs **MIT**, roughjs **MIT**, hotkeys-js **MIT**, emoji-mart y `@emoji-mart/*` **MIT**,
  i18next **MIT**, fontfaceobserver **BSD-2-Clause**, `@ice/*` **MIT**. Nada pago ni con key.
- `src/editor/extensions/history.ts` declara venir de `alimozdemir/fabric-history` (MIT) y
  `src/editor/guide-lines/*` son los *demos* de guías de fabric.js (sin cabecera de licencia en el
  archivo; el demo original es de fabric, MIT).
- ⚠️ **Fuentes: no hay ningún archivo de licencia de fuentes en el repo** (`find -iname "*licen*"`
  solo encuentra el `LICENSE` del código). Entre las 17 hay de licencias abiertas (Source Han,
  LXGW, Smiley Sans, Xiaolai: OFL), de licencia propia gratuita (Alibaba PuHuiTi, ZCOOL) y al menos
  una comercial: **方正楷体 es de FounderType**, cuyo uso comercial se licencia. Además, son fuentes
  para chino: no sirven como catálogo de un producto en español. **No se reutilizan.**
- Los íconos SVG de pinceles y formas llevan los atributos `t="1701335…"` y `p-id` de
  **iconfont.cn** (`PaintPanel/brush-list.tsx`, `ShapePanel/*`), un repositorio donde cada ícono
  tiene la licencia que puso quien lo subió. No reutilizar esos SVG sin rehacerlos.

---

## 2. Arquitectura

### 2.1 Motor de lienzo: fabric.js 5.3 (canvas 2D)

- `package.json`: `"fabric": "^5.3.0"`; `yarn.lock` resuelve **5.3.0** (publicada el 20/12/2022).
  La v6 salió el 29/06/2024 y la actual es **7.4.0** (`registry.npmjs.org/fabric`).
- `src/editor/index.tsx` (451): clase `Editor` que crea un `fabric.Canvas` del tamaño del
  contenedor, con fondo gris `#dddddd`, y un **`sketch`**: un `fabric.Rect` blanco que hace de
  página (1242×1660 por defecto, el formato de Xiaohongshu). El lienzo se recorta a ese rectángulo
  con `canvas.clipPath` y se centra/escala con `viewportTransform`. Rueda = zoom hacia el centro
  (0,01×–20×); «mano» = paneo.
- Objetos propios con `fabric.util.createClass` (`src/editor/custom-objects/`):
  `FText` (Textbox con `path` para texto curvo y estilos serializados), `FImage` (grupo imagen +
  rectángulo de borde, con `clipPath` redondeado), `FArrow`, `FTriArrow`, `FLine`.
- Controles propios (`src/editor/controller/index.ts`, 251): manijas laterales en **forma de
  píldora**, esquinas redondas, rotación con ícono **debajo** del objeto, y botones **copiar** y
  **borrar** encima: es lo más parecido al marco de selección de Canva que hay en los dos repos.
  Están escritos mutando `fabric.Object.prototype.controls` (global).

### 2.2 Modelo de datos

No hay modelo propio: **el documento es el JSON de fabric** (`canvas.toJSON(FABRITOR_CUSTOM_PROPS)`
+ `fabritor_schema_version: 3.1`, `src/editor/index.tsx:389`). Las propiedades extra que se guardan
están en `src/utils/constants.tsx` (`id`, `fabritor_desc`, `sub_type`, `imageSource`,
`imageBorder`, `oldArrowInfo`…). Si la versión del esquema no coincide, el JSON se rechaza
(`loadFromJSON`, línea 406). Para MaKo esto es un problema: la API (regla «toda feature nueva va a
la API de MaKo») tendría que escribir JSON de fabric, atado a una versión de la librería.

### 2.3 Exportación

`export2Img` (línea 345): resetea el `viewportTransform`, saca el `clipPath`, pone **fondo blanco**
y hace `canvas.toDataURL({ left, top, width, height, format })` del área del sketch. PNG y JPG a
**1×** (el `multiplier: 2` está comentado), JPG sin control de calidad, PNG nunca transparente.
`export2Svg` usa `canvas.toSVG` con `viewBox` del sketch. También exporta el JSON (plantilla) y
copia el PNG al portapapeles (`header/Export/index.tsx`). No hay PDF.

### 2.4 Deshacer / rehacer

`src/editor/extensions/history.ts`: en cada `object:added/removed/modified/skewing` y en el evento
propio `fabritor:object:modified` guarda `JSON.stringify(canvas2Json())` entero (tope 100).
Deshacer **recarga todo el lienzo** con `loadFromJSON` (vuelve a crear cada objeto y a cargar
fuentes). Con imágenes en dataURL dentro del JSON, cada paso pesa lo que pesan las imágenes.

### 2.5 Selección y transformación

La de fabric: selección múltiple (`ActiveSelection`), recuadro, escalar, rotar (con globo de
ángulo, `ObjectRotateAngleTip`), voltear, grupos (`utils/helper.ts:groupSelection/ungroup`), doble
clic para editar texto dentro de un grupo (desarma y rearma el grupo, `_editTextInGroup`).

### 2.6 Snapping

`src/editor/guide-lines/aligning_guidelines.ts` (213, `@ts-nocheck`) y
`centering_guidelines.ts` (90, `@ts-nocheck`): los demos clásicos de fabric. Imán a bordes y
centros de los otros objetos y al centro del lienzo, líneas verdes. Sin distancias ni espaciado
igual (lo pide el issue #42, abierto).

### 2.7 Multipágina

**No existe.** Un `Editor` = un `fabric.Canvas` = un `sketch`.

### 2.8 Fuentes y texto

- `src/font.css` declara las 17 fuentes y `utils/index.ts:loadFont` espera con `fontfaceobserver`
  antes de aplicar una (el mecanismo es bueno: es la trampa «un texto insertado antes de que cargue
  su fuente queda con la de respaldo» de `docs/hallazgos-video-editor.md`).
- Texto: familia, tamaño, color o degradado, alineación (izq/centro/der), negrita, itálica,
  subrayado, tachado, espaciado de letras, interlineado (`setter/TextSetter/`).
- Efectos (`TextSetter/TextFx/`): trazo (color y ancho), sombra, **texto curvo** (path cuadrático
  `M 0 0 Q w/2 (w/2·offset/100) w 0`, offset −100…100, `editor/objects/textbox.tsx:drawTextPath`)
  y **relleno con imagen** (patrón).
- Textos predefinidos: título, subtítulo, cuerpo y «con borde» (`panel/TextPanel/PresetFontPanel.tsx`).

### 2.9 Plantillas

Solo `src/assets/demo.json` («empezar con el demo») e importar un JSON. El repo hermano
`sleepy-zone/fabritor-assets` (MIT) tiene 5 plantillas, todas en chino.

### 2.10 Imágenes

Subir del disco o pegar una URL (`components/ImageSelector/`); `crossOrigin: 'anonymous'`
(`editor/objects/image.ts`). Recorte con **cropperjs** (`setter/ImageSetter/Clip.tsx`): hornea un
dataURL nuevo, no se puede volver a encuadrar. Borde con radio y punteado. Filtros de fabric
(`ImageFx/FilterGroup`): sepia, Kodachrome, vintage, Polaroid, desenfoque, relieve, pixelado,
blanco y negro, tono — **de a uno** (`FImage.applyFilter` hace `filters = [filter]`).
Reemplazar imagen (`ReplaceSetter.tsx`).

### 2.11 Persistencia

`extensions/autosave.ts` guarda el JSON en `localStorage['fabritor_web_json']`, pero
`src/config.ts` lo trae **apagado**: `AUTO_SAVE_WHEN_CHANGE = false` y
`LOAD_FROM_LOCAL_WHEN_INIT = false`. El README dice lo contrario.

---

## 3. Dependencias y compatibilidad con MaKo (React 19.2.4, Next 16.2.6)

| Paquete | Versión | Licencia | ¿React 19 / Next 16? |
|---|---|---|---|
| fabric | 5.3.0 | MIT | funciona, pero la v6 cambió la API (abajo) |
| react / react-dom | ^18.2.0 | MIT | hay que subir |
| antd | ^5.11.0 | MIT | ⚠️ en React 19, los métodos estáticos `message.*`, `Modal.confirm` y `notification` y el efecto de onda **no andan** sin `@ant-design/v5-patch-for-react-19`; antd 6 ya no lo necesita (ant.design/docs/react/v5-for-19). fabritor usa `message` estático en 5 lugares y `Modal.confirm` en `header/Toolbar` |
| @ice/app, @ice/runtime | ^3.3 / ^1.2.7 | MIT | `@ice/runtime` pide React ^18.1: se saca entero (Next ocupa su lugar) |
| @emoji-mart/react | ^1.1.1 | MIT | peer React ^16.8‖^17‖^18 |
| react-colors-beauty | 1.0.3 | MIT | peer React ^17‖^18 |
| cropperjs | ^1.6.1 | MIT | sin React; hay v2 con otra API |
| roughjs | ^4.6.6 | MIT | OK |
| hotkeys-js | ^3.12.0 | MIT | OK (hay v4) |
| i18next + http-backend | ^23 / ^2.5 | MIT | se reemplaza por textos fijos en español neutro |
| typescript | ^4.9.5 | — | MaKo usa 5 |

Qué rompe fabric 6 (fabricjs.com/docs/upgrading/upgrading-to-fabric-60/): desaparece
`createClass` (se usan clases con `extends`), las funciones con *callback* pasan a devolver
promesas, el espacio de nombres `fabric.*` pasa a importaciones con nombre (`fabric.Object` →
`FabricObject`, `fabric.Image` → `FabricImage`), los valores por defecto ya no van en el prototipo
y los controles dejan de ser compartidos, y `Group` se rehízo. En `src/` hay 5 `createClass`,
7 `callSuper`, 9 `fromObject`, 8 `loadFromJSON`, 4 `setSrc`, 2 `loadSVGFrom*`, 3 `.clone(cb)`,
4 `addWithUpdate` y 1 `_restoreObjectsState` (los dos últimos son de `Group` y no existen en v6),
11 `controlsUtils` y 22 `fabric.Object`. Es decir: todo `src/editor/` y `src/utils/helper.ts`.

Para Next: `editor/controller/index.ts` crea `<img>` con `document.createElement` **al cargar el
módulo**, así que todo el editor tiene que ir del lado cliente (`dynamic(…, { ssr: false })`,
como el Video Editor). 161 imports con alias `@/` → `src/` (en MaKo `@/` es la raíz).

---

## 4. Calidad

- **TS no estricto** (`tsconfig.json`): `strictNullChecks: false`, `noImplicitAny: false`, sin
  `strict`; 30 `@ts-ignore` y 2 archivos con `@ts-nocheck`.
- **Sin tests y sin CI** (no hay `.github/`).
- 60 renglones con texto chino escrito a mano en el código (mensajes como «加载图片失败»), además
  de los 114 textos de `public/locales/*/translation.json`.
- Código chico y directo, fácil de seguir; la lógica está mezclada con antd (`Form`,
  `onValuesChange`) en los *setters*: 59 archivos importan `antd`.
- Issues abiertos relevantes: #60 eventos del historial mal desenganchados, #52 SVG exportado mal
  con flechas, #48 rotación de imágenes, #42 imán entre formas, #58 móvil.

---

## 5. Checklist de Canva

SÍ = está y funciona por lectura · PARCIAL = existe pero incompleto o distinto · NO = no existe.

| Área | Función | fabritor | Dónde / nota |
|---|---|---|---|
| Inicio | Crear por tamaño | PARCIAL | ancho/alto libre del sketch (`SketchSetter`), sin presets (`SizeSetter`: `// @TODO preset size`) |
| | Recientes | NO | un solo documento |
| | Plantillas | PARCIAL | `assets/demo.json` + importar JSON |
| Lienzo | Zoom | PARCIAL | rueda hacia el centro, 0,01×–20×; sin control en pantalla |
| | Multipágina (agregar/duplicar/borrar/reordenar/cuadrícula) | NO | |
| | Fondo color / imagen / degradado | PARCIAL | color y degradado; imagen no |
| | Reglas y guías | PARCIAL | guías de alineación del demo de fabric; sin reglas |
| | Snapping con distancias | PARCIAL | bordes y centros, sin distancias ni espaciado |
| | Márgenes / sangrado | NO | |
| Texto | Fuentes | PARCIAL | 17 fuentes chinas; el mecanismo de carga sirve |
| | Tamaño, color | SÍ | también degradado |
| | Negrita / itálica / subrayado / tachado | SÍ | a todo el objeto (ver §6.5) |
| | Mayúsculas | NO | |
| | Alineación | PARCIAL | izq/centro/der |
| | Listas | NO | |
| | Espaciado (letras, interlineado) | SÍ | |
| | Efectos (sombra, elevar, hueco, salpicadura, eco, glitch, neón, fondo) | PARCIAL | trazo, sombra, relleno con imagen |
| | Curvar | SÍ | curva cuadrática, una línea |
| Formas | Formas con texto adentro, borde, radio | PARCIAL | 12 formas + 6 «a mano» (rough.js), borde con punteado, radio; sin texto adentro |
| | Líneas y flechas | SÍ | recta, punteada, 2 flechas, extremos editables |
| | Marcos (máscara) | NO | |
| | Cuadrículas | NO | |
| | Gráficos | NO | |
| | Tablas | NO | |
| | Stickers SVG recoloreables | NO | |
| | Fotos de biblioteca | NO | disco o URL |
| | Videos | NO | |
| | QR | SÍ | `AppPanel/QRCode.tsx` (QRCode de antd → imagen; texto, tamaño, color, fondo, nivel de corrección, logo al centro) |
| | Emoji | SÍ | `AppPanel/Emoji.tsx` (emoji-mart nativo, como texto) |
| Operaciones | Selección múltiple | SÍ | |
| | Mover / escalar / rotar | SÍ | con globo de ángulo |
| | Voltear | SÍ | |
| | Recortar | PARCIAL | cropperjs, destructivo |
| | Transparencia | SÍ | |
| | Capas / alinear / distribuir | PARCIAL | orden y lista de capas sí; alinear solo a la página (con error, §6.6); distribuir no |
| | Agrupar | SÍ | |
| | Bloquear | SÍ | |
| | Duplicar | SÍ | |
| | Copiar / pegar | SÍ | también pega texto e imagen del portapapeles del sistema |
| | Copiar estilo | NO | |
| | Deshacer / rehacer | SÍ | JSON entero por paso (§2.4) |
| | Atajos | PARCIAL | copiar, pegar, borrar, deshacer, rehacer, flechas de a 1 px |
| | Menú contextual | SÍ | copiar, pegar, duplicar, borrar, agrupar, orden |
| | Comentarios | NO | |
| | Enlace | NO | |
| | Animaciones | NO | |
| Imagen | Ajustes | NO | |
| | Filtros | SÍ | 9 filtros de fabric, de a uno |
| | Efectos | PARCIAL | borde, radio, punteado |
| | Quitar fondo | NO | |
| | Reemplazar | SÍ | |
| | Como fondo | NO | |
| Color | Documento / marca / por defecto | PARCIAL | colores predefinidos del selector; sin marca ni documento |
| | Degradados | SÍ | lineal y radial en texto, formas y fondo |
| | Cuentagotas | NO | |
| Panel lateral | Diseño | PARCIAL | en fabritor «Diseño» es la lista de capas + demo |
| | Elementos | PARCIAL | «Material»: formas, líneas, a mano |
| | Texto | SÍ | textos predefinidos |
| | Marca | NO | |
| | Subidos | PARCIAL | subir o URL, sin biblioteca |
| | Dibujar | SÍ | lápiz y marcador (color, ancho, sombra) |
| | Proyectos | NO | |
| | Apps | SÍ | QR y emoji |
| Barra superior | Archivo | PARCIAL | importar JSON, limpiar |
| | Redimensionar | PARCIAL | cambia el tamaño de la página, no reacomoda |
| | Guardado | NO | autosave apagado por `config.ts` |
| | Título | SÍ | `fabritor_desc` |
| | Compartir / Descargar | PARCIAL | descargar sí |
| | Presentar | NO | |
| Barra inferior | Notas | NO | |
| | Zoom | NO | solo rueda |
| | Cuadrícula de páginas | NO | |
| Exportar | PNG transparente / tamaño | PARCIAL | PNG 1×, fondo blanco forzado |
| | JPG con calidad | PARCIAL | sin control de calidad |
| | PDF | NO | |
| | SVG | SÍ | con el error de flechas del issue #52 |
| | Elegir páginas | NO | |
| Colaboración | | NO | |
| IA | | NO | |

Cuenta: SÍ 25 · PARCIAL 23 · NO 31 (de 79 renglones; tela: SÍ 29 · PARCIAL 25 · NO 25).

---

## 6. Trampas encontradas leyendo

1. **fabric 5 → 7 no es una actualización, es una reescritura** de `src/editor/` y
   `src/utils/helper.ts` (§3).
2. **antd 5 + React 19:** `message.*` y `Modal.confirm` estáticos se rompen sin el parche (§3).
3. **El historial no se desengancha:** `dispose()` hace `canvas.off(this._historyEvents())`, y
   `_historyEvents()` devuelve funciones **nuevas** con `.bind(this)`, que no son las que se
   engancharon: quedan escuchando. Lo mismo en `autosave.ts`. Coincide con el issue #60.
4. **Deshacer recarga el lienzo entero** y guarda las imágenes en cada paso (§2.4). El propio
   archivo tiene el `@TODO` de que los *sliders* llenan el historial.
5. **Los estilos por carácter se borran:** en `setter/TextSetter/index.tsx`, cualquier cambio que
   no sea familia, estilos o color hace `object.set('styles', {})`; y la rama
   `selectedText && key === 'fill'` (pintar solo lo seleccionado) **nunca se ejecuta**, porque
   `'fill'` ya lo atrapa el `else if` anterior. fabric soporta estilos por tramo; la UI no.
6. **Alinear a la derecha/abajo usa el tamaño sin escalar:** `CommonSetter/index.tsx:95` y `:105`
   usan `object.width/height` en vez de `getScaledWidth/Height`, así que un objeto escalado queda
   mal alineado.
7. **El autosave del README está apagado** en `src/config.ts`.
8. **Miniaturas de filtros enlazadas en caliente** a `raw.githubusercontent.com` y `pixabay.com`
   (`ImageFx/FilterGroup/index.tsx`): con la CSP de MaKo o sin red, salen rotas.
9. **175 MB de fuentes** dentro del bundle y licencias sin documentar (§1).
10. **Módulos con efectos al importar** (`document.createElement` en `controller/index.ts`): sin
    `ssr: false`, Next falla en el servidor.
11. **Emoji:** si se trae un catálogo de emoji a `app/`, la guarda del repo acusa el U+1F5D1 (ver
    «Las guardas del repo sobre el port» en `docs/hallazgos-video-editor.md`).

---

## 7. Esfuerzo: portar fabritor vs escribir sobre fabric.js / Konva

Orden de magnitud, en jornadas de una persona con agentes, para «Canva v1» (sin colaboración en
tiempo real ni video). No es una promesa.

**A. fabritor como base, en `app/image-editor/`**

| Bloque | Jornadas |
|---|---|
| Sacar ice.js (pages, layout, `useSearchParams` de ice) → rutas Next; i18next → textos en español neutro; 161 imports `@/` | 2–3 |
| fabric 5 → 7: reescribir `src/editor/` (2.194) y `utils/helper.ts` con clases y promesas, controles por instancia, `Group` nuevo; TS estricto de paso | 6–9 |
| Sacar antd (59 archivos) y escribir la UI Canva (riel de paneles, barra contextual, páginas, barra inferior), CSS con alcance `.cv` | 15–20 |
| Multipágina (no existe) | 5–7 |
| Snapping con distancias, alinear/distribuir, atajos, copiar estilo | 5–7 |
| Inicio, recientes, crear por tamaño, plantillas | 3–5 |
| Catálogo de fuentes latinas + estilos por carácter (arreglar §6.5) + listas + mayúsculas | 4–6 |
| Efectos de texto que faltan (elevar, eco, glitch, neón, fondo) | 3–5 |
| Imagen: ajustes, filtros combinables, recorte no destructivo con `clipPath`, marcos, quitar fondo (MediaPipe del Video Editor), como fondo | 5–8 |
| Elementos nuevos: stickers, fotos de stock, cuadrículas, tablas, gráficos, texto en formas | 8–12 |
| Exportar: PDF, PNG transparente, escala, calidad JPG, elegir páginas | 2–4 |
| Persistencia en Supabase (hoy apagada), historial nuevo, API de MaKo, plantillas del SuperAdmin | 8–12 |
| **Total** | **≈ 70–105** |

**B. Editor propio sobre fabric.js 7 (con el modelo de documento propio y piezas de tela y de
fabritor):** ≈ 68–99 jornadas (desglose en `tela.md` §7).

Lectura: fabritor no ahorra. Lo que trae hecho (QR, emoji, texto curvo, formas a mano, filtros,
controles con look Canva) son unas 5–8 jornadas de trabajo, pero hay que reescribirlo para
fabric 7 igual; y obliga a sacar ice.js, antd e i18n antes de empezar. Además su documento es el
JSON de fabric, cuando MaKo necesita un modelo propio que la API pueda escribir sin cargar fabric.

Konva (MIT 10.8.0; `react-konva` 19.2.x para React 19.2.4) no edita texto en el lienzo ni con
estilos por tramo y no exporta SVG: para Canva, fabric 7 sigue siendo el motor más cercano.

---

## 8. Piezas que valen la pena aunque no sea la base

Todas son **recetas de fabric**: se leen y se reescriben para fabric 7 (clases, promesas,
controles por instancia), conservando el aviso MIT.

| Archivo | Líneas | Para qué en MaKo |
|---|---|---|
| `src/editor/controller/index.ts` + `rect.ts` + `ftext.ts` + `fline.ts` | 251 + 59 + 41 + 56 | marco de selección tipo Canva: manijas píldora, rotar con ícono debajo, copiar/borrar encima, texto que solo se estira a lo ancho |
| `src/fabritor/components/ObjectRotateAngleTip/index.tsx` | 48 | globo con el ángulo al rotar (Canva lo muestra) |
| `src/editor/custom-objects/FImage.ts` | 129 | imagen con borde y radio por `clipPath` + filtro: base de «Marcos» e imagen con borde |
| `src/editor/custom-objects/FArrow.ts` + `FLine.ts` + `editor/objects/line.ts` + `handleFLinePointsWhenMoving` (`utils/helper.ts:234`) | 136 + 40 + 80 + ~10 | líneas y flechas con extremos editables; resuelve que `fabric.Line` no mueve sus `points` al arrastrar |
| `src/editor/objects/textbox.tsx` (`drawTextPath`, `getPathOffset`, `removeTextPath`) | 104 | «Curvar» de Canva (Canva usa un arco; la curva cuadrática se cambia por arco) |
| `src/fabritor/UI/setter/TextSetter/TextFx/*` | 271 | trazo, sombra y relleno con patrón: base de los efectos «Hueco», «Sombra», «Fondo» |
| `src/utils/index.ts` (`loadFont`, `getSystemClipboard`, `readBlob`) + `copyObject/pasteObject` en `utils/helper.ts` | ~80 | esperar la fuente antes de aplicarla; pegar imagen o texto del portapapeles del sistema |
| `src/editor/index.tsx` (`_adjustSketch2Canvas`, `export2Img`, `export2Svg`) | ~90 | página como rectángulo dentro de un canvas con viewport; exportar solo el área de la página |
| `src/fabritor/UI/setter/ImageSetter/ImageFx/FilterGroup/index.tsx` | 116 | lista de filtros de fabric con su parámetro (sin las miniaturas enlazadas) |
| `src/fabritor/UI/panel/ShapePanel/rough-type-list.tsx` + `editor/objects/path.ts` | 69 + 37 | formas «dibujadas a mano» con rough.js (MIT) |
| `src/fabritor/UI/panel/AppPanel/QRCode.tsx` | 109 | flujo QR → canvas → imagen (se rehace con una librería de QR sin antd) |
| `src/fabritor/UI/panel/AppPanel/Emoji.tsx` | 54 | emoji como texto; en MaKo ya existe `app/whatsapp/EmojiPicker.tsx` |
| `src/fabritor/components/ContextMenu/index.tsx` | 164 | lista de acciones del menú contextual |
| `src/editor/guide-lines/*` | 303 | solo como referencia: el snapping de `tela` (`useSnapComputation.ts`) es mejor y se porta sobre los rectángulos de fabric |

**No reutilizar:** las fuentes, los SVG de iconfont, la UI con antd, ice.js, el historial por
snapshots JSON y el autosave.

---

## 9. Veredicto

**Recetario, no base (descartar como base).** Motivos:

1. Está parado desde agosto de 2024 sobre fabric 5, React 18, antd 5 e ice.js: subirlo a fabric 7,
   React 19 y Next 16 es reescribir `src/editor/` y sacar la UI entera.
2. Un solo lienzo, sin páginas, sin persistencia activa, sin inicio ni plantillas.
3. El documento es el JSON de fabric: la API de MaKo y las plantillas del SuperAdmin necesitan un
   modelo propio.
4. TS no estricto, sin tests, con errores abiertos en el historial, la exportación y la alineación.
5. Lo valioso son recetas concretas de fabric (controles tipo Canva, texto curvo, imagen con
   borde, flechas, filtros, pegar del sistema), que se reescriben en un editor propio sobre
   fabric 7.

---

## Fuentes

- Código: `https://github.com/sleepy-zone/fabritor-web` en
  `af35a0118362dbbce5036c759ade0d34aec3ff08` (archivos citados con su ruta).
- Metadatos e issues: `https://api.github.com/repos/sleepy-zone/fabritor-web`,
  `…/issues?state=open`, `…/forks?sort=stargazers` (14/10/2026).
- Plantillas: `https://api.github.com/repos/sleepy-zone/fabritor-assets/contents/template`.
- Licencias y versiones: `https://registry.npmjs.org/<paquete>/latest` para cada paquete de §3;
  fechas de fabric en `https://registry.npmjs.org/fabric` (campo `time`).
- Cambios de fabric 5 → 6: `https://fabricjs.com/docs/upgrading/upgrading-to-fabric-60/`.
- antd 5 con React 19: `https://ant.design/docs/react/v5-for-19` y
  `https://ant.design/docs/react/migration-v6`.
- react-konva: `https://registry.npmjs.org/react-konva` (peerDependencies por versión).
