# Doory (shaongitbd/doory) como base del «Canva» de MaKo

> Lectura a fondo del 14/10/2026 sobre el commit `a1f676736163595e76503eec8a1be59fe68fd19f`
> (13/10/2026, último de `main`). Clon de solo lectura en el scratchpad de la sesión
> (`research/repos/doory`). No se ejecutó nada del repositorio. Las rutas `frontend/…` y `backend/…`
> son relativas a ese clon. **Esto no es asesoramiento legal**: es una lectura atenta del texto.

## 0. Veredicto en una línea

**Es el mejor código de referencia que hay para un Canva sobre fabric.js, pero no conviene usarlo como
base sin hablar antes con el autor:** su licencia obliga a mostrar en pantalla «Siam, Creator and
maintainer of Doory, https://github.com/shaongitbd/doory» cada vez que se abre el editor, y eso choca
con un producto de marca propia que además debe verse «igual a Canva». Recomendación: **(1)** escribirle
a Siam para pedir permiso por escrito o una licencia MIT o comercial (el propio `NOTICE` dice «the
rest is MIT, like the code»); **(2)** si no responde o no acepta, construir sobre **fabric 7 (MIT)** con
nuestro propio código y usar Doory solo como **plano de arquitectura**, sin copiar código.

---

## 1. Licencia: qué obliga exactamente

### 1.1 El texto (fuente: `LICENSE`, completo)

- Encabezado: «Attribution Assurance License · Copyright (c) 2026 by Siam, creator and maintainer of
  Doory … **All Rights Reserved** · ATTRIBUTION ASSURANCE LICENSE (adapted from the original BSD license)».
- Concesión: «Redistribution and use in source and binary forms, with or without modification, are
  permitted provided that the conditions below are met».
- **Condición 1, código fuente:** «Redistributions of source code, **in whole or part** and with or
  without modification … must prominently display this **GPG-signed text** in verifiable form».
- **Condición 2, binario:** «Redistributions of the Code in binary form must be accompanied by this
  GPG-signed text **in any documentation** and, **each time the resulting executable program or a
  program dependent thereon is launched, a prominent display (e.g., splash screen or banner text)** of
  the Author's attribution information, which includes: (a) Name ("Siam"), (b) Professional
  identification ("Creator and maintainer of Doory"), and (c) URL ("https://github.com/shaongitbd/doory")».
- **Condición 3:** no se puede usar el nombre del autor para promocionar productos derivados sin permiso.
- **Condición 4:** el usuario responde por el cumplimiento de otras licencias y regulaciones.
- Es la AAL estándar: OSI la tiene **aprobada**, pero la marca como «Redundant with more popular»
  (https://opensource.org/license/attribution-php). GitHub no la reconoce: `"spdx_id": "NOASSERTION"`
  (https://api.github.com/repos/shaongitbd/doory/license).

### 1.2 Cómo la interpreta el propio autor

- `NOTICE`: «Anyone who redistributes it must keep this credit with it and display it prominently each
  time the program starts (**for a web app: on its pages**): "Doory by Siam, creator and maintainer of
  Doory, https://github.com/shaongitbd/doory"».
- `README.md`, sección «License and credit»: «keep the licence and NOTICE with it, and **display this
  credit prominently in the running app**».
- En la práctica, su propia app muestra el crédito **solo en el pie de las páginas de marketing**
  (`frontend/src/app/layouts/MarketingLayout.tsx:158-165`), no dentro del editor. Es decir, el autor
  se lo exige a los demás con más rigor del que se aplica a sí mismo; no cuenta como precedente.

### 1.3 ¿Qué pasa en un SaaS que sirve el bundle JS? (MaKo en Vercel)

| Pregunta | Lectura |
|---|---|
| ¿Servir JS al navegador es «redistribuir»? | **Sí.** A diferencia del código de servidor (que en un SaaS no se distribuye), el JS se **copia al navegador de cada usuario**. La excepción del «SaaS» no cubre el frontend. |
| ¿Es «binary form» o «source code»? | El bundle de Next (TS compilado, empaquetado y minificado) se lee razonablemente como **forma binaria/objeto**: no es la forma preferida para modificarlo. **Si publicamos los source maps**, pasa a ser también redistribución de **código fuente**. Las dos lecturas generan obligaciones. |
| ¿Qué es «each time … is launched»? | En la web, **cada carga del editor** (cada vez que el navegador ejecuta el código). «A program dependent thereon» podría alcanzar a toda la app de MaKo si el código de Doory va en el bundle común; con code-splitting de Next queda acotado a la ruta del editor. |
| ¿Alcanza con un crédito en el pie? | Dice «**prominent display (e.g., splash screen or banner text)**». Un pie gris de 10 px es discutible. Lo seguro es un **cartel o splash visible en cada apertura del editor**, o una línea permanente y legible en la barra del editor. |
| ¿Hay que reproducir la licencia? | Sí: el texto de la licencia «**in any documentation**» (ayuda, términos, página de licencias de terceros de MaKo). |
| ¿Copiar solo «piezas»? | «Source code, **in whole or part** … with or without modification» → **un solo archivo adaptado ya activa la obligación**. Traducir o reescribir línea por línea sigue siendo obra derivada. Lo único libre son las **ideas** (arquitectura, algoritmos, decisiones), reimplementadas sin copiar expresión. |
| ¿El «GPG-signed text»? | **No existe.** Ni el `LICENSE` ni los commits están firmados (`git log --format=%G?` da `N` en los 11 commits de Siam; la API dice `"verified": false, "reason": "unsigned"`). La condición 1, tal como está escrita («in verifiable form»), **no se puede cumplir al pie de la letra**. Es un defecto de redacción y no habilita nada: hay que mostrar el texto de todos modos. |
| «All Rights Reserved» | Fórmula heredada de BSD que va antes de la concesión; no la anula. Pero suma ambigüedad. |
| Contradicción interna | `NOTICE` (última línea): «The shapes, graphics, audio and test fonts are dedicated to the public domain under CC0 1.0; **the rest is MIT, like the code**». Contradice el `LICENSE` (AAL) y el `THIRD_PARTY.md` («Starter templates … Attribution Assurance License, like the code»). Manda el `LICENSE`. **No hay que apoyarse en esa frase**, pero sirve como argumento para pedirle al autor una licencia MIT. |

**Obligación concreta si se porta código de Doory a MaKo:**

1. **Cada vez que se abra el editor**, mostrar de forma visible (cartel o splash, en inglés literal para
   no discutir la traducción): *«Doory by Siam, Creator and maintainer of Doory —
   https://github.com/shaongitbd/doory»*. Lo verían todos los clientes de MaKo.
2. Incluir el texto completo del `LICENSE` (y conviene también el `NOTICE`) en la documentación de MaKo:
   una página «Licencias de terceros», enlazada desde ayuda y términos.
3. Si se publican source maps, mostrar el texto de la licencia de forma «prominente» junto al código.
4. No usar «Siam» ni «Doory» para promocionar MaKo (condición 3).
5. Fijar el commit (`a1f6767`): el autor puede cambiar la licencia de versiones futuras, pero no la de
   lo ya publicado.

**Conflictos con las reglas de MaKo:** «Copiar una app TAL CUAL» (Canva no muestra créditos de
terceros) y marca propia (los negocios que usan MaKo verían el nombre de otra persona en su editor).

### 1.4 Partes con OTRA licencia (fuente: `THIRD_PARTY.md`, `NOTICE`)

| Parte | Licencia | ¿Atada a la AAL? | Uso para MaKo |
|---|---|---|---|
| Dependencias que llegan al navegador (45 paquetes npm) | MIT, ISC, Apache-2.0, BSD-3, OFL-1.1; `dompurify` se usa como Apache-2.0 | No | Se instalan directo desde npm, sin ninguna obligación hacia Doory |
| Formas (168) y gráficos (404) generados por `backend/data/generate_shapes.py` y `generate_graphics.py` | **CC0-1.0** (los SVG que salen) | Los scripts sí son AAL; lo que generan, no | **Los SVG no están en el repo** (0 archivos `.svg`): hay que correr los scripts de Python. Usarlos está permitido; lo que sale es CC0 |
| Biblioteca de audio (24 loops y 88 efectos, `backend/data/audio/`, 6,9 MB) | CC0-1.0 | No | Libre (poco relevante para imagen) |
| 10 plantillas (`backend/data/templates/*.json` + `thumbs/`) | **AAL**, como el código | **Sí** | Mismo problema que el código |
| Packs de íconos y emoji (Lucide, Tabler, Phosphor, Heroicons, Material Symbols, Noto Emoji, Fluent Emoji, Open Doodles y Open Peeps) | MIT, ISC, Apache-2.0, CC0 | No: el backend los baja de npm o de la fuente original | **Sirven**: se toman de las fuentes originales (versiones exactas en `backend/data/element_packs.json`). Cerca de 25.000 íconos |
| Catálogo de fuentes (253 familias de Fontsource, `backend/data/popular_fonts.json`) | 239 OFL, 12 Apache-2.0, **2 UFL-1.0** (Ubuntu, Ubuntu Mono) | El JSON es «MIT (data)», compilado de Fontsource | Sirve como lista. Conviene sacar las UFL |
| Modelo para quitar fondo, U²-Net (`u2netp.onnx`, 4,6 MB) | Apache-2.0 según los autores, **con riesgo residual**: se entrenó con DUTS/ImageNet, que no tienen licencia comercial (lo documenta el mismo `THIRD_PARTY.md`, «Background-removal models») | No: se baja de rembg o Hugging Face | Sirve con ese riesgo anotado |
| Conejo mascota (`frontend/src/assets/bunny-*.webp`) | «**Its author and licence are not recorded yet**» | — | No tocar |
| Fuentes de la interfaz (Nunito, Fraunces, Caveat) | OFL | No | No hacen falta (Canva usa otras) |

---

## 2. Qué es y en qué estado está

- Creado el **10/10/2026**; ~1.095★ y 59 forks al 14/10; 19 issues abiertos, la mayoría de Dependabot
  (https://api.github.com/repos/shaongitbd/doory).
- **13 commits.** El primero (`eac7e3b`, 10/10) mete **1.696 archivos y 207.688 líneas de una vez**;
  después vienen ajustes. 11 commits son de Siam y 2 de colaboradores externos, sin CLA. Hay un PR #20
  «Add claude GitHub actions» y un PR #18 abierto, «streaming AI designer». **No tiene historia ni uso
  en producción**: todo indica una generación masiva asistida por IA. Depende de una sola persona.
- CI en verde en `a1f6767` (https://api.github.com/repos/shaongitbd/doory/actions/runs).
- Pila: React 19.3 + TS 5.9 + Vite 7 + **fabric 7.4** + Zustand 5 + Yjs en el navegador; Django 5.2 +
  DRF + Channels + pycrdt + PostgreSQL + Playwright/Chromium (PDF del servidor) en el backend
  (`frontend/package.json`, `THIRD_PARTY.md`).

### 2.1 Líneas por carpeta (medido con `wc -l` sobre `.ts`, `.tsx`, `.css`, `.py`, `.js` y `.mjs`)

| Carpeta | Líneas | Nota |
|---|---:|---|
| `frontend/src` (todo) | **109.588** | 947 archivos |
| └ `editor/`: fuente `.ts`/`.tsx` | **50.895** | El editor propiamente dicho |
| └ `editor/`: tests | 24.857 | 205 archivos `*.test.*` en todo `src` |
| └ `editor/`: CSS Modules | 9.677 | |
| └ `features/` (shell: auth, dashboard, crear, plantillas, subidas) | 9.354 | Depende de react-router y react-query |
| └ `pages/`, `ui/`, `lib/`, `app/`, `types/` | 5.320 · 4.001 · 3.104 · 915 · 895 | |
| `frontend/e2e` (Playwright) | 15.595 | 78 specs |
| `frontend/scripts` | 2.887 | Generación de plantillas y presupuesto del bundle |
| `backend/apps` | 47.645 | ≈21.700 de fuente y ≈25.800 de tests |
| `backend/tools`, `backend/data` | 3.318 · 5.335 | Sintetizador de audio y generadores SVG |

Dentro de `editor/` (fuente con CSS / tests):

| Subcarpeta | Fuente | Tests | Qué hace |
|---|---:|---:|---|
| `engine/` | 14.825 | 8.103 | Motor: raíz 5.837 · `api/` 2.210 · `export/` 3.256 · `objects/` 2.126 · `bgRemoval/` 1.192 · `text/` 204 |
| `panels/` | 7.107 | 2.432 | Capas, Plantillas, Marca, Animar, Audio, Comentarios, Fondo, Stickers, Notas |
| `workspace/` | 5.748 | 1.913 | Pila de páginas, reglas, zoom, tira de páginas, línea de tiempo, pines de comentarios |
| `collab/` | 4.844 | 2.675 | Co-edición con Yjs (necesita el servidor Django) |
| `dialogs/` | 4.627 | 2.174 | Descargar, Redimensionar, Compartir, Versiones, Presentar, PDF de imprenta, video |
| `audio/` · `animation/` · `presenter/` | 3.295 · 3.219 · 2.867 | 1.907 · 1.904 · 1.861 | Sonido, animaciones y transiciones, modo presentación |
| `ui/` · `toolbar/` · `chrome/` | 2.701 · 2.311 · 1.694 | — | Primitivas, barra contextual, barra superior y paneles |
| `fonts/` · `dev/` · `drawers/` | 1.613 · 1.015 · 914 | — | Fuentes subidas, adaptador en memoria, menús de Texto/Imagen/Formas |
| Raíz (`EditorApp`, `TopBar`, `strings.ts`…) | 2.393 | — | `strings.ts` tiene 1.348 líneas |

---

## 3. Arquitectura del frontend

**Motor de lienzo: fabric.js 7.4 (MIT)**, envuelto en un motor propio sin React
(`editor/engine/editor.ts`: «framework-free; React only reads the store and calls these methods»).

- **Una `fabric.Canvas` por página** (`engine/pageCanvas.ts`, 1.128 líneas). El `<canvas>` cubre solo
  una **ventana** de la mesa de trabajo (lo visible más un margen), para que la memoria no se dispare
  al 800 % de zoom. Un **canvas superpuesto** dibuja guías, grilla, contorno al pasar el mouse y
  sangrado, así nada del editor termina en una exportación. Las páginas se apilan **en vertical con
  scroll, como en Canva** (`workspace/Workspace.tsx`), y solo se montan las cercanas a la vista.
- **Modelo de datos** (`types/document.ts`): `DoryDocument { schemaVersion, width, height, unit
  (px|mm|in), pages[], audioTracks?, meta{presetId, bleedPx, brandKitId} }`. `DocPage { id, name,
  width?/height? (páginas de distinto tamaño), background (solid | gradient linear/radial | image
  cover/contain/tile), objects[], notes, durationSec, guides[], transition }`. `DocObject` es la salida
  de `fabric.toObject(EXTRA_PROPS)` más las propiedades de Doory: `curveAmount`, `effects`, `maskShape`,
  `slot`, `colorMap`, `elementId`, `link`, `qr`, `animation`, etc. Se guarda en px a 96 dpi y tiene
  migraciones (`engine/migrations.ts`).
- **Tipos de objeto** (`engine/objects/builtinKinds.ts`): registro con `prepare`/`hydrate`/`dehydrate`
  para text (textbox/itext), shape (rect, ellipse, triangle, polygon, path), line (`DoryLine` con
  puntas), image, element (SVG recoloreable), placeholder (marco), qr y group. **No hay** video,
  tabla, grilla ni texto dentro de formas.
- **Deshacer/rehacer** (`engine/history.ts`, 122 líneas): pila lineal de documentos inmutables con
  **memoria compartida entre versiones** (cada paso cuesta lo que cambió) y un `coalesceKey` que agrupa
  arrastres, sliders y tipeo en ráfagas de 1,2 s; tope de 200 pasos. En co-edición usa un undo por
  usuario (`collab/undo.ts`).
- **Selección y transformación:** la de fabric (`selectionKey: 'shiftKey'`, selección por recuadro),
  con controles propios (`engine/objects/controls.ts`), «bake» de escala (`objects/bake.ts`) y
  empujar con flechas.
- **Snapping** (`engine/snapping.ts`, 273 líneas, geometría pura): bordes y centros de la página y de
  cada objeto, umbral de 5 px, **guías de espaciado igual con la distancia en px dibujada**
  (`pageCanvas.ts:1046-1060`) y snapping también al redimensionar.
- **Multipágina** (`engine/api/pages.ts`): agregar, duplicar, borrar, mover (arrastrando en la tira),
  renombrar, tamaño por página, fondo de una página o de todas, notas, duración y transición.
- **Fuentes** (`engine/fonts.ts`, `editor/fonts/`): catálogo del servidor con subsets unicode bajo
  demanda; el usuario puede subir sus fuentes; aviso de fuentes faltantes.
- **Plantillas:** `services.templates` (categorías, lista, detalle) del backend; panel en el editor y
  galería en el shell. Son 10.
- **Imágenes:** `adapter.uploadAsset` y `adapter.resolveSrc` (`idb://` para invitados, `/media/…` o
  `https://…`); arrastrar y soltar, pegar, reemplazar y rellenar un marco.
- **Exportación** (`engine/export/`): se renderiza **desde el JSON sobre una `StaticCanvas` aparte**
  (`engine/render.ts`), nunca desde el lienzo vivo. PNG (escala y transparencia), JPG (calidad), SVG
  (con `@font-face` embebidas), PDF en el cliente con jsPDF (**raster JPEG a 300 dpi**, con sangrado y
  marcas de corte) o PDF **vectorial en el servidor** (Chromium con Playwright), ZIP para varias
  páginas, y MP4/WebM/GIF con WebCodecs y workers.
- **Extensiones:** `editor/extensions.ts` expone `registerPanel`, `registerToolbarSection`,
  `registerCommand`, `registerExportFormat`, `registerObjectKind` y presets de animación. Los paneles
  ya se declaran con `placement: 'drawer' | 'sidebar'`, así que mover herramientas a un riel izquierdo
  estilo Canva no obliga a reescribir el motor.
- **Textos:** todos en `strings.ts` y otros 5 `strings.ts` (≈2.000 líneas): «All user-visible English
  strings of the editor live here so they can be translated». No encontré texto suelto en el JSX.
- **Estado:** Zustand vanilla (`store/editorStore.ts`).

### 3.1 ¿Se separa del backend Django? **Sí, limpio.**

`types/adapter.ts` declara: «The only seam between the app shell and the editor. The editor never
touches routing, auth or HTTP directly — everything goes through an EditorAdapter». Lo comprobé:
`editor/` no importa react-router ni react-query, y solo 4 archivos importan `@/lib/api` (tipos de
error). Ya existe un **adaptador en memoria** (`editor/dev/memoryAdapter.ts`, 219 líneas) con el que
el editor corre sin servidor, y los adaptadores reales son chicos (`accountAdapter.ts` 95,
`guestAdapter.ts` 121, `services.ts` 105).

Lo que hoy viene de Django y habría que reemplazar con Supabase o recursos estáticos:

| Servicio del adaptador | Reemplazo en MaKo |
|---|---|
| `save`/load del diseño, revisiones y conflictos | Tabla `disenos` (jsonb) con revisión y miniatura |
| `uploadAsset`/`resolveSrc` | Supabase Storage y URLs firmadas |
| `fonts.list` (catálogo de 253 familias) | JSON estático + CDN de Fontsource o Google Fonts |
| `elements.packs/list` (cerca de 25.000 íconos) | Índice estático de los packs originales (MIT/ISC/Apache) |
| `templates` | Propias |
| `stock` (Unsplash/Pexels con key) | `null`, o un route handler con key |
| `brand`, `versions` | Tablas propias, o `null` |
| `sharing`, `comments`, `realtime` (Yjs sobre Channels + pycrdt) | `null` en la primera etapa. La co-edición necesita un servidor Yjs propio |
| `exportPdf` (Chromium) | Se omite: queda el PDF raster del cliente |
| Modelo U²-Net (`/media/models/…`, vía `GET /config/`) | Archivo en Storage o `public/` |

---

## 4. Dependencias y compatibilidad con MaKo (Next 16.2.6, React 19.2.4)

- **Nada pago ni con key obligatoria.** Las keys son opcionales: Unsplash/Pexels para fotos de stock y
  Google Client ID para el login. Todo lo que llega al navegador es MIT, ISC, Apache-2.0, BSD u OFL
  (`THIRD_PARTY.md`, «Result»).
- **React 19:** lo usa (19.3.0). **fabric 7.4** no depende de ningún framework, pero necesita DOM: el
  editor tiene que cargarse con `next/dynamic` y `ssr:false`. fabric declara `canvas` y `jsdom` como
  dependencias **opcionales**; en Windows conviene instalar sin ellas si falla la compilación nativa.
- **Detalles de Vite (solo 3):** `onnxruntime-web/…wasm?url` (`engine/bgRemoval/bundled.ts:1`),
  `import.meta.env.BASE_URL` (`presenter/channel.ts:219`) y dos workers con
  `new Worker(new URL('./x.ts', import.meta.url), {type:'module'})`. Ese patrón ya funciona en MaKo:
  `app/video-editor/_opencut/services/transcription/service.ts:169`.
- **Choque con `lucide-react`:** Doory usa la **1.52**; MaKo, la **0.562**. Hay que adaptar los imports
  o subir la versión de MaKo.
- **Choque de tokens CSS:** `styles/tokens.css` define en `:root` variables `--color-*`, `--text-*`,
  `--font-sans` y `--space-*`, que se pisan con los namespaces de Tailwind 4. Hay que moverlas a `.cv`
  y renombrarlas (por ejemplo, `--cv-*`). Los CSS Modules (9.677 líneas) andan en Next tal cual; hay
  un solo `:global`.
- **Peso:** el presupuesto del autor para la carga inicial del editor es de **450 kB gzip**
  (`frontend/scripts/bundleReport.mjs:29`). La wasm de onnxruntime y el modelo (4,6 MB) se cargan
  solo al quitar un fondo.
- Yjs, y-protocols y lib0 solo hacen falta con co-edición (se cargan con `import()` dinámico).

## 5. Calidad

- **TS estricto:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` y
  `verbatimModuleSyntax` (`frontend/tsconfig.app.json`). Hay 2 `any` en código que no es de test, 0
  `@ts-ignore` y 4 `eslint-disable`.
- **Tests:** 205 archivos unitarios (Vitest; 24.857 líneas solo en `editor/`), 78 specs e2e de
  Playwright (editor, app, colaboración, comentarios, imprenta, quitar fondo, rendimiento,
  accesibilidad con axe) y tests del backend en SQLite y Postgres. CI en verde.
- Código prolijo y muy comentado, con APIs pequeñas y registros extensibles. **La contra:** no tiene
  años de uso en producción. Hay errores reales recién descubiertos (issue #23, colaboración caída con
  la caché en base de datos; issue #17, el mail de confirmación no anda; issue #21, falta texto de
  derecha a izquierda).

## 6. ¿Se parece a Canva? (capturas en `.github/readme/`)

- **`editor.webp`:** barra superior blanca con el logo del conejo, el título del diseño y una píldora
  «Saved». En el centro, **las herramientas como botones con ícono y rótulo** (Text, Sticker, Image,
  Shapes, More). Después, deshacer/rehacer, comentarios, «…», descargar, un botón oscuro de compartir y
  «Saved in this browser · Sign up». Debajo hay una **segunda barra contextual** a todo el ancho
  (sin selección muestra Poster, el color de la página, +, duplicar y borrar). Fondo de trabajo
  **lavanda con grilla de puntos**, página centrada. Abajo a la izquierda, una píldora «Page 1 of 1»
  con flechas, cuadrícula y +; abajo en el centro, una píldora amarilla «+ Add page»; abajo a la
  derecha, un slider de zoom con «30 %».
- **`feature-layers.webp`:** panel izquierdo acoplado «Layers», con título en serif (Fraunces), filas
  con ícono T, candado y ojo, y menú contextual (Cut, Copy, Paste, Duplicate, Delete, Bring to front…,
  Lock, con atajos). La barra contextual de texto tiene la fuente en píldora, el tamaño con −/+,
  color, B, I, U, alineación, interlineado, espaciado, mayúsculas, efectos, posición, rotar, candado,
  duplicar y borrar.
- **`feature-animate.webp`:** panel «Animate» con pestañas Element/Page y Enter/Exit/Emphasis, y una
  grilla de tarjetas de animación (Fade, Rise, Drop, Pop…).
- **`feature-export.webp`:** el botón descargar abre un menú: PNG «Transparent», JPG «Smaller», PDF
  «Print-ready», SVG «Vector», «Video or GIF…» y «More options…».
- **`templates.webp`:** galería del shell con buscador, filtros por orientación, chips de categoría y
  tarjetas grandes con nombre en serif y medidas.

**Conclusión visual:** tiene **los ingredientes** de Canva (barra contextual sobre el lienzo, páginas
apiladas con «Agregar página», zoom con slider, paneles a la izquierda), pero **otro armazón y otra
estética**. Las herramientas viven en la barra superior y no en el **riel vertical izquierdo con
panel de 360 px** de Canva. No tiene el encabezado con degradado violeta-turquesa, ni «Archivo» y
«Redimensionar» a la izquierda, ni el botón «Compartir» violeta, ni la barra inferior de Canva
(Notas · duración · zoom · cuadrícula de páginas · pantalla completa · ayuda). La paleta es la del
conejo (lila, rosa y marrón tinta) y la tipografía, Nunito y Fraunces. **Para que se vea igual a Canva
hay que rehacer el armazón (TopBar, ToolHost, PagesPill, ZoomControls) y re-vestir los 9.677 renglones
de CSS.**

---

## 7. Checklist de Canva: SÍ / PARCIAL / NO

| Área | Ítem | Doory | Evidencia o comentario |
|---|---|---|---|
| Inicio | Crear por tamaño | SÍ | `features/create/CreateDesignDialog.tsx`, 31 presets y medida libre en px, mm, cm o in (`features/presets.ts`). Es del shell: hay que rehacerlo en Next |
| | Recientes | SÍ | Panel de inicio con carpetas, papelera y acciones en lote (`features/dashboard/`), sobre la API de Django |
| | Plantillas | PARCIAL | Galería con categorías y filtros, pero **solo 10 plantillas** (AAL) |
| Lienzo | Zoom | SÍ | Slider, ajustar, ajustar al ancho, 100 %, rueda; hasta 800 % |
| | Multipágina: agregar, duplicar, borrar, reordenar | SÍ | `engine/api/pages.ts`; arrastrar en la tira (`workspace/usePageDnd.ts`); páginas de distinto tamaño |
| | Vista en cuadrícula de páginas | PARCIAL | Tira de miniaturas (`PageStrip`), sin la grilla a pantalla completa de Canva |
| | Fondo de color, imagen o degradado | SÍ | `PageBackground` sólido, degradado lineal/radial o imagen cover/contain/tile, más tramas |
| | Reglas y guías | SÍ | `workspace/Rulers.tsx`; guías arrastrables guardadas por página |
| | Snapping con distancias | SÍ | `engine/snapping.ts`: bordes, centros y espaciado igual con etiqueta en px |
| | Márgenes y sangrado | PARCIAL | Muestra el sangrado; PDF con sangrado y marcas de corte. No tiene «márgenes» por separado |
| Texto | Fuentes, tamaño, color | SÍ | Catálogo de 253 familias (servidor), subida de fuentes, combinaciones |
| | B, I, U, tachado | SÍ | `toolbar/sections/text.tsx` |
| | Mayúsculas | SÍ | `textCase`: upper, lower, title, sentence |
| | Alineación, listas, espaciado | SÍ | Incluye justificado, viñetas y numeración (`text/lists.ts`), interlineado y espaciado entre letras |
| | Efectos | PARCIAL | Sombra, hueco, contorno, brillo («neón») y resaltado («fondo»). **Faltan elevar, salpicadura, eco y glitch** |
| | Curvar | SÍ | `text/curve.ts` y `objects/curvedText.ts` |
| Formas | Básicas, borde, radio | SÍ | Rect, elipse, triángulo, polígono y estrella; 168 formas SVG CC0; grosor y trazo discontinuo; radio |
| | Texto dentro de la forma | NO | — |
| | Líneas y flechas | PARCIAL | `DoryLine` con 5 tipos de punta y trazo discontinuo; sin líneas en codo ni curvas |
| | Marcos (máscara) | SÍ | 10 máscaras más marcadores de posición que se rellenan al hacer clic o soltar una foto (`objects/slot.ts`) |
| | Cuadrículas | NO | — |
| | Gráficos | PARCIAL | 4 tipos (barras, línea, torta, dona) como **SVG estático** recoloreable; los datos no se editan |
| | Tablas | NO | — |
| | Stickers SVG recoloreables | SÍ | `colorMap`; packs de unos 25.000 íconos e ilustraciones servidos por el backend |
| | Fotos de biblioteca | PARCIAL | Unsplash/Pexels con key, a través del backend |
| | Videos dentro del diseño | NO | Solo exporta a video |
| | QR | SÍ | `objects/qr.ts` |
| | Emoji | SÍ | Noto y Fluent (packs servidos por el backend) |
| Operaciones | Selección múltiple; mover, escalar, rotar | SÍ | Más un panel de posición con X, Y, ancho, alto y ángulo |
| | Voltear, recortar, transparencia | SÍ | Recorte con proporciones fijas (`engine/crop.ts`) |
| | Capas, alinear, distribuir | SÍ | Panel de capas con arrastre, renombrar, ocultar y bloquear; alinear a página o selección; distribuir; «tidy» |
| | Agrupar, bloquear, duplicar, copiar y pegar | SÍ | Portapapeles del sistema con formato propio; pega imágenes |
| | Copiar estilo | NO | Solo existe el texto `copyStyle` en `strings.ts`, sin uso |
| | Deshacer y rehacer | SÍ | 200 pasos con agrupación |
| | Atajos y menú contextual | SÍ | 55 comandos (`builtins/commands.tsx`) y diálogo de atajos |
| | Comentarios | SÍ | Pines, hilos y resolver; **necesita backend** |
| | Enlace | SÍ | Solo http(s); va en PDF y SVG |
| | Animaciones | SÍ | 27 de entrada y salida, 12 de énfasis, 16 transiciones y línea de tiempo |
| Imagen | Ajustes | PARCIAL | Brillo, contraste, saturación, tono, desenfoque, viñeta, gris y sepia; sin temperatura, luces, sombras ni nitidez |
| | Filtros | SÍ | 8 presets (vivid, warm, cool, mono, noir, fade, vintage, dramatic) |
| | Efectos | PARCIAL | Solo sombra y borde; sin duotono ni pixelado |
| | Quitar fondo | SÍ | U²-Net en el navegador, en un worker (`engine/bgRemoval/`) |
| | Borrador y expansión mágicos | NO | — |
| | Reemplazar | SÍ | `insert.pickAndReplaceImage` |
| | Usar como fondo | PARCIAL | Desde el panel Fondo («Use this image as background»), no desde la imagen seleccionada |
| Color | Colores del documento, de marca y por defecto | SÍ | `ui/ColorPicker.tsx`: documento, recientes y paletas, más los kits de marca |
| | Degradados | SÍ | `ui/FillEditor.tsx`, lineal y radial |
| | Cuentagotas | SÍ | API `EyeDropper` (solo Chromium) |
| Panel lateral | Diseño | PARCIAL | Panel de Plantillas; sin «Diseños» ni «Estilos» |
| | Elementos | PARCIAL | Separado en Stickers, Formas e Imagen; sin un buscador unificado |
| | Texto | SÍ | Menú con títulos y combinaciones |
| | Marca | SÍ | Necesita cuenta y backend |
| | Subidos | SÍ | Pestaña del menú Imagen |
| | Dibujar | NO | — |
| | Proyectos | NO | Dentro del editor, no (está el panel de inicio del shell) |
| | Apps | NO | — |
| Barra superior | Archivo | PARCIAL | Menú «More» con renombrar, historial, reiniciar, vista y atajos |
| | Redimensionar | SÍ | Redimensionado mágico, escalar o mantener; esta página o todas, con vista previa |
| | Guardado y título | SÍ | Autoguardado, estado y manejo de conflictos |
| | Compartir y Descargar | SÍ | Enlaces de ver, comentar o editar, con contraseña (backend) |
| | Presentar | SÍ | Vista de presentador en otra ventana, notas, puntero láser y avance automático |
| Barra inferior | Notas y zoom | SÍ | `panels/NotesBar.tsx`, `workspace/ZoomControls.tsx` |
| | Cuadrícula de páginas | PARCIAL | Píldora «Page X of N» y tira de miniaturas |
| | Pantalla completa | PARCIAL | Solo al presentar |
| Exportar | PNG transparente y tamaño | SÍ | Multiplicador de escala y transparencia |
| | JPG con calidad | SÍ | |
| | PDF | PARCIAL | En el cliente sale **raster** a 300 dpi; el vectorial necesita Chromium en el servidor |
| | SVG | SÍ | Con las fuentes embebidas |
| | Elegir páginas | SÍ | ZIP si son varias. Además exporta MP4, WebM y GIF |
| Colaboración | Co-edición, cursores, enlaces | SÍ\* | \*Todo apoyado en Django Channels y pycrdt: no se porta sin un servidor Yjs propio |
| IA | — | PARCIAL | Solo quitar fondo. El PR #18 («AI designer») está abierto y sin fusionar |

Cuenta aproximada: **≈60 % SÍ, ≈25 % PARCIAL, ≈15 % NO**.

---

## 8. Esfuerzo: portar su frontend o escribir el nuestro

Estimaciones gruesas, en **días de una persona trabajando con agentes**. Precedente: el Video Editor
portó ~110.000 líneas de OpenCut (`app/video-editor/_opencut/`).

### A) Portar el frontend de Doory a `app/image-editor/` (aceptando el cartel de crédito)

| Paso | Días |
|---|---:|
| Copiar `editor/`, `types/`, `lib/document.ts` y `lib/uuid.ts` a `app/image-editor/_doory/`; cargar con `'use client'` y `next/dynamic` sin SSR; arreglar las 3 cosas de Vite; aliases; dependencias (fabric 7.4, jspdf, qrcode, fflate, onnxruntime-web, gifenc, mp4-muxer, webm-muxer); resolver lucide 1.x frente a 0.x; quitar `collab/` | 2–4 |
| Tokens a `.cv` con prefijo propio, `global.css` acotado, fuentes de la interfaz | 1–2 |
| Adaptador de Supabase (diseños, Storage, catálogo estático de fuentes e íconos, plantillas, marca y versiones o `null`) y rutas de inicio y recientes en Next | 5–8 |
| Traducir unas 2.000 líneas de `strings*.ts` al español neutro con «tú» | 1–2 |
| **Re-vestir como Canva:** riel izquierdo con panel de 360 px (usando el `placement:'sidebar'` existente), encabezado de Canva, barra inferior y restilo de los CSS Modules | 10–15 |
| **Primera versión usable** | **≈20–30** |
| Lo que falta frente a Canva: texto en formas, tablas, cuadrículas, video en el diseño, dibujar, copiar estilo, 4 efectos de texto, vista de cuadrícula de páginas, pantalla completa, panel de Elementos unificado, más ajustes de imagen e IA | 20–40 |
| **Total a nivel Canva** | **≈40–70** |

### B) Editor propio sobre fabric 7 (MIT), con Doory solo como plano

| Paso | Días |
|---|---:|
| Motor: modelo, un canvas por página con ventana y overlay, serialización, historial, snapping, recorte y máscaras, texto curvo y listas, efectos, filtros, exportación PNG/JPG/SVG/PDF y quitar fondo (≈12–15 mil líneas) | 25–35 |
| Interfaz copiada de Canva (sin re-vestir: se escribe ya con esa forma) (≈15–20 mil líneas) | 20–35 |
| **Nivel de Doory sin colaboración, audio ni video** | **≈45–70** |
| Lo que falta frente a Canva (igual que en A) | 20–40 |
| **Total a nivel Canva** | **≈65–110** |

**Portar ahorra unos 25–40 días, pero obliga a mostrar el crédito para siempre.** Konva no conviene
frente a fabric: no edita texto de forma nativa (necesita un textarea DOM encima) ni exporta SVG.
Doory confirma que fabric 7 alcanza para un Canva completo.

---

## 9. Piezas que valen la pena (archivo por archivo)

**Si Martín acepta el crédito, o si Siam da permiso**, en orden de valor (rutas bajo
`frontend/src/editor/`):

1. Núcleo: `engine/editor.ts` (857), `engine/pageCanvas.ts` (1.128), `engine/layout.ts` (141),
   `engine/zoom.ts`, `engine/dragCache.ts` (128), `engine/geometry.ts` y `engine/registry.ts`.
2. Modelo: `../types/document.ts` (230), `../types/adapter.ts` (247), `engine/serialization.ts` (242),
   `engine/migrations.ts`, `engine/docOps.ts` (240), `engine/json.ts` y `store/editorStore.ts` (248).
3. `engine/history.ts` (122), `engine/snapping.ts` (273) y `engine/align.ts` (111).
4. Objetos: `objects/factories.ts`, `masks.ts`, `slot.ts` (marcos), `curvedText.ts`, `effects.ts`,
   `textStyle.ts`, `filters.ts` (filtros WebGL con 2D de respaldo), `elements.ts` (recolorear SVG),
   `DoryLine.ts`, `qr.ts`, `fills.ts`, `controls.ts` y `bake.ts`; `text/curve.ts`, `lists.ts` y `case.ts`.
5. `engine/crop.ts` (320) y `engine/magicResize.ts` (213).
6. Las API de alto nivel en `engine/api/` (insert, arrange, style, pages, clipboard, crop y view:
   2.210 líneas).
7. Exportación: `engine/render.ts`, `export/formats.ts`, `registry.ts`, `exporter.ts`,
   `printGeometry.ts`, `svgEmbed.ts` y `zip.ts`.
8. Quitar fondo: todo `engine/bgRemoval/` (1.192), con el modelo bajado de rembg o Hugging Face.
9. Interfaz para re-vestir: `toolbar/` (barra contextual), `ui/ColorPicker.tsx` y `FillEditor.tsx`,
   `panels/LayersPanel.tsx`, `BackgroundPanel.tsx`, `TemplatesPanel.tsx`, `NotesBar.tsx`,
   `dialogs/DownloadDialog.tsx`, `ResizeDialog.tsx` y `ResizePreview.tsx`, `ContextMenuHost.tsx`,
   `commands.ts`, `shortcuts.ts` y `hooks/useKeyboardShortcuts.ts`.
10. Opcionales: `animation/` y `export/video/` (animación y MP4/GIF); `presenter/` y
    `dialogs/Presenter*` (presentar).
11. **No traer:** `collab/` (necesita un servidor Yjs), `audio/` (fuera de alcance), la subida de
    fuentes de `fonts/` (depende del backend), `dev/` (solo como ejemplo de adaptador) ni el shell
    (`features/`, `pages/`, `app/`, con react-router y react-query).

**Si no hay permiso, no se copia código.** Se toman solo estas **ideas**, que no tienen copyright:

- la costura `EditorAdapter`;
- el esquema de documento (página con fondo, objetos que son JSON de fabric más propiedades propias,
  y migraciones);
- un canvas por página que cubre solo la ventana visible, con un canvas aparte para las guías;
- el historial de documentos inmutables con memoria compartida y `coalesceKey`;
- el registro de tipos `prepare`/`hydrate`/`dehydrate`;
- exportar desde el JSON sobre una `StaticCanvas` aparte;
- el PDF de imprenta (sangrado y marcas) y el SVG con fuentes embebidas;
- U²-Net-p en un worker con onnxruntime-web.

Los **assets** que se pueden usar igual son los packs de íconos y emoji tomados de sus fuentes
originales, el catálogo de fuentes de Fontsource (sin las UFL) y, si se corren los generadores en un
entorno aislado, las 572 formas y gráficos CC0.

## 10. Riesgos

1. **Licencia:** el crédito obligatorio en cada apertura del editor (y en la documentación) choca con
   «copiar Canva tal cual» y con la marca propia. El texto «GPG-signed» no existe, la frase MIT del
   `NOTICE` contradice el `LICENSE` y hay contribuciones externas sin CLA: todo suma ambigüedad, y la
   ambigüedad se resuelve hablando con el autor, no interpretando.
2. **Madurez:** el repo tiene 4 días, entró en un solo volcado de 207 mil líneas, depende de un único
   autor y nunca corrió en producción. Ya aparecieron errores de base (#17, #23).
3. **Dependencia del backend:** fuentes, íconos, plantillas, fotos de stock, marca, versiones,
   comentarios, colaboración y PDF vectorial vienen de Django: todo eso hay que rehacerlo.
4. **Visual:** el armazón no es el de Canva; el re-vestido es trabajo de UI real, no solo de colores.
5. **Técnico en Next:** solo cliente (sin SSR); choque de versiones de `lucide-react`; tokens CSS que
   se pisan con Tailwind 4; la wasm de onnxruntime y el modelo (unos 15 MB) hay que servirlos aparte.
6. **Modelo U²-Net:** riesgo residual por los datos de entrenamiento (DUTS/ImageNet), según el propio
   `THIRD_PARTY.md`.

## 11. Fuentes

- Código: clon de `https://github.com/shaongitbd/doory` en `a1f6767` (`LICENSE`, `NOTICE`, `README.md`,
  `THIRD_PARTY.md`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig.app.json`
  y los archivos citados en cada fila).
- Metadatos: https://api.github.com/repos/shaongitbd/doory ·
  https://api.github.com/repos/shaongitbd/doory/license ·
  https://api.github.com/repos/shaongitbd/doory/issues?state=all ·
  https://api.github.com/repos/shaongitbd/doory/actions/runs ·
  https://api.github.com/repos/shaongitbd/doory/commits/eac7e3b
- Licencia: https://opensource.org/license/attribution-php
- MaKo: `C:/dev/wt-canva/package.json` (next 16.2.6, react 19.2.4, lucide-react ^0.562.0),
  `app/video-editor/_opencut/services/transcription/service.ts:169`.
