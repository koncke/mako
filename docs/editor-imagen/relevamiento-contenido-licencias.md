# Contenido y licencias para el «Canva» de MaKo (tab Image de Content Machine)

> Relevamiento del 14/10/2026. Los términos se leyeron ese día en la URL que se cita al lado de cada
> cláusula (cita textual corta, en el idioma original). Lo marcado **«medido»** salió de pegarle con
> `curl` a la API o al CDN ese mismo día; lo marcado **«estimado»** NO se midió y hay que medirlo antes de
> prometerlo. **Esto no es asesoramiento legal**: es una lectura atenta del texto.
> Contexto de la casa que manda sobre todo lo de abajo: «el Plan NUNCA paga IA», «un default que cobra es
> un cobro silencioso», y la decisión del 11/10: la imagen con IA va por el **puente a Google Flow** con la
> cuenta del cliente, no por API paga.

## 0. Veredicto por rubro

| Rubro | Por defecto | Licencia / condición | Plan B | Descartado |
|---|---|---|---|---|
| Fotos | **Unsplash API** | Unsplash License (comercial, sin atribución en el diseño); la API exige *hotlink*, avisar la descarga y dar crédito en el panel | **Pexels API** (crédito «Pexels» en el panel; es de Canva) | Openverse y Wikimedia como fuente por defecto (licencias mezcladas y atribución por foto) |
| Íconos | **Iconify** (API pública sin key, filtrada a una lista blanca de sets) | MIT / Apache-2.0 / ISC según set | Self-host del API de Iconify o paquetes `@iconify-json/<set>` | Sets CC BY, CC BY-SA, GPL y NC (lista en §2.2) |
| Emoji | **Fluent Emoji** (MIT) + **Noto** (Apache-2.0) como SVG | sin atribución | Twemoji (CC BY 4.0, alcanza un crédito en «Acerca de») | OpenMoji (CC BY-SA: contagia) |
| Ilustraciones | **Open Peeps, Humaaans, Open Doodles, 3dicons** | CC0 | Lukasz Adam (CC0/MIT, ambiguo) | **unDraw y DrawKit** (sus licencias prohíben meterlos en una app/editor) |
| Formas, líneas, marcos, cuadrículas | **Generadas por nosotros** (SVG/objetos fabric) | propias | — | copiar los SVG de Canva |
| Fuentes | **64 Google Fonts curadas, alojadas por nosotros** + catálogo completo bajo demanda | OFL-1.1 / Apache-2.0 / UFL | Fontsource por jsDelivr para lo que no está alojado | cargar todo desde `fonts.googleapis.com` sin aviso (Múnich 2022) |
| Plantillas | **Propias, en un JSON propio** (~70 para arrancar), hechas en desarrollo | propias | Figma Community / Penpot (CC BY 4.0, con crédito) | copiar de Canva; las de Polotno (atadas a su SDK pago) |
| Quitar fondo | **MediaPipe selfie** (personas, ya está en el repo) + **BiRefNet_lite** (objetos) | Apache-2.0 / MIT (ojo datos, §6.6) | MODNet (Apache-2.0, 6,6 MB) | **RMBG-1.4/2.0** (no comercial), **@imgly/background-removal** (AGPL) |
| Borrador mágico | **MI-GAN** (`migan_pipeline_v2.onnx`, 28 MB) | MIT (código y pesos; ojo datos) | LaMa (Apache-2.0, 93–208 MB) | — |
| Ampliar | **Real-ESRGAN General x4v3** (4,65 MB) | BSD-3-Clause (ojo datos) | `pica` (MIT, reescalado clásico, cero riesgo) | — |
| Exportar | **fabric 7** directo (PNG/JPG/WebP/SVG) + **jsPDF** (PDF) + **gifenc** (GIF, ya está) | todo MIT | pdf-lib + svg2pdf.js (MIT) | — |

---

## 1. Fotos de biblioteca

### 1.1 Comparación

| | Unsplash | Pexels | Pixabay | Openverse | Wikimedia Commons |
|---|---|---|---|---|---|
| Key | Sí (Access Key) | Sí | Sí | **No** (opcional) | No |
| Cupo | 50/h en demo; 1000/h en producción (con aprobación) | 200/h y 20.000/mes (ampliable gratis) | 100 cada 60 s | Anónimo: 20/min y 200/día (**medido**), páginas de ≤20 y tope de 240 resultados | sin cupo publicado; etiqueta de User-Agent |
| Hotlink | **Obligatorio** | No lo regula (CORS abierto, medido) | **Prohibido el permanente**: hay que bajarla a nuestro servidor | Sí (URLs de la fuente original) | Posible pero «not recommended» |
| Atribución | En la app: fotógrafo + Unsplash con link y UTM | «Prominent link to Pexels»; al fotógrafo «when possible» | Mostrar de dónde vienen al mostrar resultados | La que pida cada licencia CC (BY: obligatoria) + «made using Openverse» | La de cada archivo |
| ¿Editor de un SaaS? | Permitido (prohíbe replicar *Unsplash*: clientes no oficiales, apps de fondos de pantalla) | Permitido (prohíbe replicar *Pexels*) | Permitido (prohíbe replicar *Pixabay*) | Permitido, con aviso | Permitido |
| Dueño | Getty Images (desde 2021) | **Canva** (desde 2019) | **Canva** (desde 2019) | WordPress.org | Wikimedia Foundation |

### 1.2 Unsplash — recomendado por defecto

- **Cupo**: «rate-limited to 50 requests per hour» en demo y «After approval for production, this limit is
  increased to 1000 requests per hour»; «Image file requests (`images.unsplash.com`) do not count against your
  rate limit» (https://unsplash.com/documentation). El cupo es **de la app entera** (todos los clientes de
  MaKo juntos): las búsquedas van por nuestro servidor con caché por consulta.
- **Hotlink obligatorio**: «All API uses must use the hotlinked image URLs returned by the API under the
  `photo.urls`» (https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines); en los términos,
  §6: «you must directly use or embed the related image URLs returned by the API» (https://unsplash.com/api-terms).
  En la práctica: el diseño guarda la URL de `images.unsplash.com`, no una copia.
- **Avisar la descarga**: «you must send a request to the download endpoint returned under the
  `photo.links.download_location`» (guidelines). Se dispara **cuando el usuario inserta la foto** en el
  diseño (es «usarla»), no al mostrar la miniatura.
- **Atribución**: «your application must attribute Unsplash, the Unsplash photographer, and contain a link
  back to their Unsplash profile» y «All links back to Unsplash should use utm parameters» (guidelines). Va
  en el panel de fotos (hover o pie de la miniatura: «Foto de X en Unsplash»). **No** va en el diseño
  exportado: la licencia dice «without permission from or attributing the photographer or Unsplash»
  (https://unsplash.com/license).
- **Lo prohibido**: «You cannot replicate the core user experience of Unsplash (unofficial clients,
  wallpaper applications, etc.)» y «You cannot use the API to sell unaltered Unsplash photos directly or
  indirectly (prints, on products, etc.)» (guidelines); «This license does not include the right to compile
  images from Unsplash to replicate a similar or competing service» y «Images cannot be sold without
  significant modification» (licencia). Un editor de diseño no es un banco de fotos: entra.
- **Riesgo a futuro**: §12 de los términos: «Unsplash may also decide, in its sole discretion, to charge a
  technology fee to certain businesses».
- **Unsplash+** (las pagas): no se encontró documentación oficial; un usuario reporta que la API no las
  devuelve. Tratar como no confirmado y filtrar si aparecieran.
- **Por qué éste y no Pexels por defecto**: calidad editorial y, sobre todo, **no es de Canva**. Pexels y
  Pixabay son de Canva desde mayo de 2019 (TechCrunch, 17/05/2019,
  https://techcrunch.com/2019/05/17/australias-design-unicorn-canva-picks-up-two-free-image-sharing-services-and-launches-new-photo-product);
  Unsplash es de Getty desde el 30/03/2021 (https://newsroom.gettyimages.com/en/getty-images/getty-images-to-acquire-unsplash-the-preeminent-image-platform-for-global-creators).
  Construir «un Canva tal cual» sobre el API del dueño de Canva es depender de que no nos corte.

### 1.3 Pexels — plan B (y fuente de VIDEO para el Video Editor)

- Cupo: «By default, the API is rate-limited to 200 requests per hour and 20,000 requests per month» y se
  puede pedir más gratis con una demo (https://www.pexels.com/api/documentation/).
- Atribución en la app: «show a prominent link to Pexels» (texto o logo) y acreditar al fotógrafo «when
  possible» (misma página). En el diseño no hace falta: «You do not need to credit Pexels or the contributor
  of Content when you use it» (https://www.pexels.com/terms-of-service/, §6).
- Prohibido: «You may not copy or replicate core functionality of Pexels» (doc del API); §8 de los
  términos: «use or compile any Content to replicate a similar or competing service to the Service»; y la
  licencia: «Don't redistribute or sell the photos and videos on other stock photo or wallpaper platforms»
  (https://www.pexels.com/license/). Ojo con el §5: usar la foto **sola** con filtros, color, recorte o
  tamaño sigue siendo uso «Standalone» (prohibido venderla así); combinada en un diseño nuevo, no.
- Hotlink: la doc no lo regula; `images.pexels.com` responde `Access-Control-Allow-Origin: *` (**medido**).
- Como la key va en la cabecera `Authorization`, se llama desde nuestro servidor.

### 1.4 Pixabay — tercero, sólo si hace falta volumen

- Cupo generoso: «By default, you can make up to 100 requests per 60 seconds»; pero «requests must be cached
  for 24 hours» (https://pixabay.com/api/docs/).
- **Hotlink prohibido**: «permanent hotlinking of images (using Pixabay URLs in your app) is not allowed»;
  hay que bajar la foto a nuestro servidor (Storage = costo) y la `webformatURL` es «URL valid for 24 hours».
- Atribución en la app: «show your users where the images and videos are from, whenever search results are
  displayed». «Systematic mass downloads are not allowed.»
- Términos (https://pixabay.com/service/terms/): §8 «use or compile any Content to replicate a similar or
  competing service to the Service»; §5 «You cannot sell or distribute the Content (either in digital or
  physical form) on a Standalone basis»; §6 «You do not need to credit Pixabay». Licencia
  (https://pixabay.com/service/license-summary/): con marcas o logos reconocibles, «you cannot use that
  Content for commercial purposes».
- También es de Canva. Trae ilustraciones y vectores (`image_type`), pero el vector original pide acceso
  ampliado (no verificado).

### 1.5 Openverse — sin key, pero no sirve como fuente por defecto

- Términos (https://docs.openverse.org/terms_of_service.html): §4 «you must prominently indicate that it was
  made using Openverse but is not endorsed or certified by Openverse»; §2 «You must not scrape the content
  in the Openverse catalog»; §5 «Openverse reserves the right to charge fees for commercial uses of
  Openverse».
- **Medido** (cabeceras de `api.openverse.org/v1/images/`): `x-ratelimit-limit-anon_burst: 20/min`,
  `anon_sustained: 200/day`; `page_size=50` → «page_size may not exceed 20 for anonymous requests»; cualquier
  búsqueda tope 240 resultados (12 páginas). Ojo: los valores por defecto del código
  (`api/conf/settings/rest_framework.py`: 5/hour, 100/day) **no** son los de producción.
- **Medido**: «coffee» con `license_type=commercial,modification` devolvió 12 CC BY y 8 **CC BY-SA**, todas
  de Flickr. BY obliga a atribuir en el diseño; BY-SA además obliga a licenciar el diseño derivado igual: no
  sirve para anuncios de clientes. Con `license=cc0,pdm` vienen fotos de Flickr de 1024 px. Y Openverse
  avisa que no garantiza la licencia («Openverse cannot make any claims about the accuracy of license
  information»). Personas sin autorización de imagen = riesgo en publicidad.
- Uso posible: pestaña secundaria «Dominio público» filtrada a `cc0,pdm`, llamada **desde el navegador**
  (el cupo anónimo es por IP del usuario, no de MaKo). No vale el esfuerzo en la primera versión.

### 1.6 Wikimedia Commons — no

- «Each media file has its licensing specified on its file description page»; el hotlink «is also possible,
  but is not recommended» (https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).
- **Trampa medida**: una miniatura de 320 px devuelve **HTTP 400** «Use thumbnail sizes listed on
  https://w.wiki/GHai»; 330 y 500 px devuelven 200. Sólo se pueden pedir los anchos de la lista.

### 1.7 Qué hay que mostrar (lista para la UI)

1. Panel de fotos con el proveedor visible: «Fotos de Unsplash» (logo o texto con link) y en cada
   miniatura «Foto de {nombre}» con link a su perfil + `?utm_source=mako&utm_medium=referral`.
2. Si se suma Pexels: link visible a Pexels en el panel; crédito al fotógrafo en el hover.
3. Al insertar una foto de Unsplash: `GET download_location` (desde el servidor, con la key).
4. Nada en el diseño exportado.

### 1.8 Integración y CORS

- **Medido**: `images.unsplash.com`, `images.pexels.com`, `cdn.pixabay.com`, `upload.wikimedia.org` responden
  `Access-Control-Allow-Origin: *`. Sin eso el lienzo queda «contaminado» y `toDataURL` explota al exportar:
  toda imagen de afuera se carga con `crossOrigin: 'anonymous'`.
- Proveedor detrás de una interfaz propia (`buscarFotos(proveedor, consulta, página)`), igual que la regla
  de Flow («diseñar para degradar»): cambiar Unsplash por Pexels es cambiar una implementación.

---

## 2. Elementos: íconos, emoji, ilustraciones, stickers

### 2.1 Iconify: cómo se consume

- **API pública sin key**: «servers are free to use, but please do keep in mind that running those servers
  is not free»; no publica cupo ni términos de uso aparte; pide apoyo económico
  (https://iconify.design/docs/api/). CORS abierto (**medido** en `api.iconify.design/mdi/home.svg`).
- **Búsqueda**: `GET https://api.iconify.design/search?query=casa&prefixes=ph,tabler,material-symbols&limit=64`
  (`limit` mínimo 32, por defecto 64, máximo 999; `prefixes` acepta lista separada por comas,
  https://iconify.design/docs/api/search.html). El SVG: `https://api.iconify.design/<prefix>/<nombre>.svg`.
- **Self-host**: «You can host your own Iconify API service» (misma doc), en Docker/npm.
- **npm**: `@iconify/json` pesa **502 MB** desempaquetado (**medido** en el registro de npm): no. Los
  paquetes por set son razonables: `@iconify-json/lucide` 0,6 MB, `tabler` 2,1 MB, `ph` 4,6 MB,
  `material-symbols` 8,9 MB, `fluent-emoji-flat` 9,2 MB, `noto` 25,6 MB, `fluent-emoji` 103,7 MB.
- **Recomendación**: buscar contra la API pública **siempre con `prefixes=` de la lista blanca** (§2.2) y,
  al insertar, **guardar el SVG dentro del diseño** (no un link al API). Así el diseño no depende de Iconify
  y una caída de su servidor sólo afecta la búsqueda. Si un día el volumen lo pide, se levanta el API propio
  con sólo los sets de la lista blanca.

### 2.2 Licencia por set (leída del `collections.json` oficial el 14/10)

Fuente: https://raw.githubusercontent.com/iconify/icon-sets/master/collections.json (campo `license.spdx`).

**Verde — comercial, sin atribución visible** (MIT/ISC/Apache piden conservar el aviso de licencia en el
código o en «Licencias de terceros», no en el diseño):

| Set (prefijo) | Licencia | Íconos |
|---|---|---|
| Material Symbols (`material-symbols`) | Apache-2.0 | 15.728 |
| Phosphor (`ph`) | MIT | 9.072 |
| Material Design Icons (`mdi`) | Apache-2.0 | 7.447 |
| Tabler (`tabler`) | MIT | 6.238 |
| Hugeicons (`hugeicons`) | MIT | 6.065 |
| MingCute (`mingcute`) | Apache-2.0 | 3.320 |
| Remix (`ri`) | Apache-2.0 | 3.188 |
| IconPark (`icon-park`) | Apache-2.0 | 2.658 |
| Carbon (`carbon`) | Apache-2.0 | 2.631 |
| Bootstrap (`bi`) | MIT | 2.078 |
| Healthicons (`healthicons`) | MIT | 2.042 |
| Lucide (`lucide`) | ISC | 1.890 |
| Iconoir (`iconoir`) | MIT | 1.671 |
| Heroicons (`heroicons`) | MIT | 1.288 |
| Line MD animados (`line-md`) | MIT | 1.218 |
| Flat Color Icons (`flat-color-icons`) | MIT | 329 |
| Banderas: `circle-flags` / `flag` / `flagpack` | MIT | 444 / 542 / 254 |
| **Emoji**: Fluent Emoji (`fluent-emoji`) / Flat / High Contrast | MIT | 3.126 / 3.145 / 1.595 |
| **Emoji**: Noto (`noto`) / Noto v1 / Firefox OS (`fxemoji`) | Apache-2.0 | 3.729 / 2.162 / 1.034 |

**Amarillo — comercial, pero exige crédito (CC BY)**: Twemoji (`twemoji`, 3.988), Solar (`solar`, 8.706),
Streamline (`streamline`, `streamline-emojis`), Font Awesome 6/5 free (`fa6-*`, `fa-*`: CC BY 4.0),
Game Icons (`game-icons`, CC BY 3.0), Pepicons, EmojiOne (`emojione`). Twemoji es el más fácil: el proyecto
acepta «a mention in a project README or an 'About' section or footer on a website»
(https://github.com/jdecked/twemoji, gráficos «licensed under CC-BY 4.0»). Para no armar un «Acerca de»
con créditos, **no entran en la primera versión**.

**Rojo — fuera**: CC BY-SA (OpenMoji `openmoji`, `emojione-v1`, `entypo`, `si-glyph`, `fontelico`: el
diseño derivado tendría que salir con la misma licencia), GPL (`dashicons`, `gala`, `icomoon-free`, `et`) y
no comercial (`ps`: CC BY-NC 4.0).

**Marcas**: `logos` y `simple-icons` son CC0 en el dibujo, pero son **marcas registradas**: sirven para
«Seguinos en Instagram», no para que parezca que la marca respalda al anunciante. unDraw lo dice de los
suyos: los logos de marcas «Are included on a promotional basis».

### 2.3 Emoji: no copiar lo del Video Editor

El Video Editor dibuja los emoji con la **fuente del sistema** (`app/video-editor/_opencut/stickers/providers/emojis.ts`:
«el mismo proyecto abierto en otra máquina dibuja el emoji con la fuente de esa máquina»). En un editor
cuyo producto es el archivo exportado, eso hace que el mismo diseño salga distinto en Windows y en Mac.
Acá el emoji tiene que ser un **SVG fijo**: Fluent Emoji (MIT, https://github.com/microsoft/fluentui-emoji)
como estilo principal y Noto («Tools and most image resources are under the Apache license, version 2.0»,
https://github.com/googlefonts/noto-emoji) como alternativa.

### 2.4 Ilustraciones

| Fuente | Licencia (cita) | ¿Se puede meter en el editor? |
|---|---|---|
| Open Peeps | «Free for commercial and personal use under CC0 License» (https://www.openpeeps.com/) | **Sí**, alojadas por nosotros |
| Humaaans | «CC0 Free for commercial or personal use by Pablo Stanley» (https://www.humaaans.com/) | **Sí** |
| Open Doodles | «Free for Commercial and Personal Use. No need to credit, license, or anything» (https://www.opendoodles.com/) | **Sí** |
| 3dicons (3D) | «The current version of 3dicons is under CC0 - Creative Commons License» (https://3dicons.co/) | **Sí**: son el equivalente a los stickers 3D de Canva |
| Lukasz Adam | «under the CC0 license (MIT license)», «No attribution required» (https://lukaszadam.com/illustrations) | Sí, pero la licencia es ambigua; segundo plano |
| **unDraw** | «This license does not include the right to compile assets … to replicate a similar or competing service», «This extends to automated and non-automated ways to link, embed, scrape, search or download the assets»; en su resumen pide permiso para «add them in an app» (https://undraw.co/license) | **No**, salvo permiso escrito |
| **DrawKit** | prohíbe usarlas «in design templates, or in design template creators or applications» y redistribuirlas «as a compilation» (https://www.drawkit.com/license) | **No** |
| SVG Repo | licencia **por ícono** (MIT, CC BY, «Logo License», CC0…); su página de licencias devolvió 429 | **No** como biblioteca (habría que auditar ícono por ícono) |

Las CC0 se descargan una vez, se pasan a SVG optimizado y se guardan en Storage o en `public/` (ojo con el
proxy, §4.5).

### 2.5 Animados (Lottie)

- El reproductor es libre: `lottie-web` (MIT) y `dotlottie-web` (MIT).
- **LottieFiles no**: su Lottie Simple License dice «This license does not include the right to collect or
  compile Files from LottieFiles … to replicate or develop a similar or competing service»
  (https://lottiefiles.com/page/license). El usuario puede **subir** su propio Lottie; MaKo no arma una
  biblioteca con los de ellos.
- Noto Animated Emoji: varios proyectos lo citan como CC BY 4.0 (p. ej. https://pub.dev/packages/animated_emoji);
  no se pudo leer la licencia en la fuente oficial. Queda para después y con crédito.
- `line-md` y `svg-spinners` de Iconify (MIT) ya son SVG animados.

---

## 3. Formas, líneas, marcos y cuadrículas: generarlas nosotros

**Conviene generarlas**: una forma geométrica no tiene autor que reclamar, son pocas líneas de SVG o un
objeto nativo de fabric (`Rect`, `Circle`, `Polygon`, `Path`, `Line`), quedan con nuestros parámetros
editables (radio, puntas, grosor) y no hay licencia que auditar. **No se copian los SVG de Canva.** El Video
Editor ya tiene un proveedor de formas (`app/video-editor/_opencut/stickers/providers/shapes.ts`) que sirve
de punto de partida para el catálogo.

**Categorías del panel Elementos de Canva** (su ayuda oficial agrupa: gráficos e íconos, fotos y videos,
formas, líneas, marcos, gráficos de datos y tablas, stickers, audio y lo generado con IA; guías de terceros
suman cuadrículas, degradados y mockups. Canva no se dejó leer el 14/10 —403—: verificar en vivo):
Líneas y formas · Gráficos · Stickers · Fotos · Videos · Audio · Gráficos de datos · Tablas · Marcos ·
Cuadrículas · Degradados · Mockups · 3D · Colecciones · Generador de imágenes con IA.

**Catálogo propio para la primera versión**:

- **Formas**: cuadrado, rectángulo redondeado (radio editable), círculo/elipse, triángulo, triángulo
  rectángulo, rombo, pentágono, hexágono, octógono, polígono de N lados, estrella de 4/5/6/8/12 puntas,
  estallido/sello de N puntas, corazón, cruz, flechas (simple, doble, bloque, chevron, curva), globos de
  diálogo (redondo, rectangular, pensamiento), nube, media luna, píldora, paralelogramo, trapecio, arco,
  anillo, «blob» orgánico generado con semilla.
- **Líneas**: recta, punteada, a rayas; extremos ninguno / flecha / flecha abierta / círculo / cuadrado /
  rombo / barra; trazado recto, en codo y curvo; grosor, color y punta redondeada.
- **Marcos** (foto recortada con `clipPath` de fabric): círculo, cuadrado, redondeado, ventana en arco,
  hexágono, estrella, corazón, blob, polaroid, tira de película, teléfono, laptop y ventana de navegador
  simples, y **letras/números** (el texto como máscara).
- **Cuadrículas**: 1×2, 2×1, 2×2, 1×3, 3×1, 3×3 y mosaicos (1 grande + 2, 1 + 3, 2 + 3), con separación y
  radio editables.
- **Degradados**: lineales y radiales de una paleta propia.
- Gráficos de datos, tablas, mockups y 3D quedan para después.

---

## 4. Fuentes

### 4.1 Licencias

Las familias de Google Fonts están bajo **OFL-1.1**, **Apache-2.0** o **UFL** (Ubuntu): todas permiten uso
comercial e incrustarlas en un producto. **Medido** en el catálogo del 14/10: 1.950 familias, todas con
`isOpenSource: true`. El catálogo **no trae el campo licencia**; Fontsource sí (`"license":"OFL-1.1"` en
`api.fontsource.org/v1/fonts/inter`, **medido**). La página de preguntas de Google Fonts no se pudo leer (es
JS); lo de «uso comercial» viene de fuentes secundarias.
Fuentes propias de Canva («Canva Sans» y compañía) **no**: la de reemplazo por defecto es Inter o Figtree.

### 4.2 Listar el catálogo sin key

| Vía | Qué trae | Ojo |
|---|---|---|
| `https://fonts.google.com/metadata/fonts` | JSON de 2,7 MB (**medido**): 1.950 familias — Sans Serif 722, Display 468, Serif 351, Handwriting 358, Monospace 51 — con `category`, `subsets`, `fonts` (pesos), `axes` (variables), `popularity` | **No documentado**: puede cambiar sin aviso; sin licencia |
| `https://api.fontsource.org/v1/fonts` | Documentado: «a read-only API that can be accessed by any HTTP client»; «The current hard limit is 2500 requests per 10 seconds» (https://fontsource.org/docs/api/introduction). Trae licencia, categoría, pesos, `variable`, `unicodeRange` y la URL de cada archivo | Es un tercero (jsDelivr sirve los archivos) |
| Google Fonts Developer API (`webfonts/v1`) | Oficial | **Pide key** |

**Recomendación**: un script de desarrollo baja el catálogo de Fontsource (con licencia), lo filtra y lo
guarda como JSON en el repo; la app no consulta catálogos en vivo.

### 4.3 Cómo cargarlas

1. **CSS2 API de Google** (`https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap`): sin
   key, subconjuntos por `unicode-range`, pero cada visita le pasa la IP del usuario a Google (§4.4).
2. **Fontsource por jsDelivr** (patrón **medido**:
   `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2`, responde `font/woff2`
   con `Access-Control-Allow-Origin: *`; también da `.woff` y **`.ttf`**, que jsPDF necesita, §8). Sigue
   siendo un tercero que ve la IP.
3. **Self-host**: las 64 curadas (§4.6) en Storage o `public/`, sólo los subconjuntos `latin` + `latin-ext`
   y los pesos que se usan. Cuenta estimada: 64 familias × ~4 archivos × ~25 KB ≈ 6–7 MB en total.

**Recomendación**: (3) para las curadas y (2) para «ver todas» bajo demanda. El texto en español entra en
`latin` (U+0000–00FF trae á é í ó ú ñ ü ¿ ¡, **medido** en el `unicodeRange` de Fontsource), así que las
familias sin `latin-ext` (Prata, Arvo, Satisfy, Tangerine, Permanent Marker, Rock Salt…) igual sirven.

### 4.4 Privacidad: el fallo de Múnich

LG München I, sentencia del **20/01/2022, Az. 3 O 17493/20**: 100 € de daño inmaterial a un visitante porque
la web cargaba Google Fonts desde los servidores de Google y le pasó la IP sin consentimiento; el tribunal
rechazó el «interés legítimo» y amenazó con multa de hasta 250.000 € si se repetía; después vinieron
cartas masivas de reclamo de 100–170 € (https://www.ihk.de/bergische/recht-und-steuern/wettbewerbsrecht/google-fonts-5646176,
https://www.dr-datenschutz.de/schadensersatz-urteil-google-fonts-und-die-dsgvo/). Es primera instancia y
alemana; los clientes de MaKo son de LATAM, pero la regla barata es **alojar las fuentes nosotros**: así no
hay nada que discutir. El mismo razonamiento alcanza a jsDelivr (por eso el self-host va primero).

### 4.5 CSP y proxy

- **Hoy no hay que tocar la CSP**: la global es `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`
  (`next.config.ts:142`): no limita `img-src`, `font-src`, `connect-src` ni `script-src`.
- Si algún día se endurece, el editor necesita como mínimo: `img-src` `images.unsplash.com`
  `images.pexels.com` `api.iconify.design` `data:` `blob:`; `connect-src` `api.iconify.design`
  `huggingface.co` `*.hf.co` (los modelos redirigen a `us.aws.cdn.hf.co`, **medido**) `cdn.jsdelivr.net`;
  `font-src` `cdn.jsdelivr.net` `fonts.gstatic.com` `data:`; `style-src` `fonts.googleapis.com`;
  `worker-src blob:`; y `script-src` con `'wasm-unsafe-eval'` (sin eso no compila ningún WASM) y
  `cdn.jsdelivr.net` (MediaPipe baja su JS con un `<script>`; ver `docs/hallazgos-video-editor.md` →
  «Quitar el fondo con MediaPipe»).
- **Trampa conocida**: lo que se aloje en `public/` (fuentes, modelos, SVG) queda detrás del login salvo
  que el matcher de `proxy.ts` lo exima por ruta, como `public/ve/`; si no, el `fetch` recibe **200 con el
  HTML del login** (`docs/hallazgos-video-editor.md` → «El proxy y `public/`»). Hay que eximir la carpeta
  del editor de imágenes de la misma forma.

### 4.6 Lista curada (64 familias, todas verificadas en el catálogo del 14/10)

| Estilo | Familias |
|---|---|
| **Sans** (16) | Inter · Montserrat · Poppins · Open Sans · Roboto · Lato · Raleway · Nunito · DM Sans · Manrope · Plus Jakarta Sans · Outfit · League Spartan · Figtree · Work Sans · Rubik |
| **Serif** (12) | Playfair Display · Merriweather · Lora · Libre Baskerville · Cormorant Garamond · EB Garamond · DM Serif Display · Fraunces · Cinzel · Bodoni Moda · Instrument Serif · Roboto Slab |
| **Display / impacto** (12) | Bebas Neue · Anton · Oswald · Archivo Black · Abril Fatface · Alfa Slab One · Bungee · Righteous · Lobster · Fredoka · Titan One · Unbounded |
| **Script / caligráfica** (8) | Great Vibes · Dancing Script · Pacifico · Sacramento · Parisienne · Allura · Alex Brush · Yellowtail |
| **Manuscrita** (8) | Caveat · Kalam · Shadows Into Light · Permanent Marker · Indie Flower · Patrick Hand · Amatic SC · Architects Daughter |
| **Monoespaciada** (5) | JetBrains Mono · Space Mono · IBM Plex Mono · Courier Prime · DM Mono |
| **Retro / especial** (3) | Press Start 2P · Special Elite · Monoton |

Variables (un archivo para todos los pesos, **medido** en `axes`): Inter, Montserrat, Open Sans, Roboto,
Raleway, Nunito, DM Sans, Manrope, Plus Jakarta Sans, Outfit, League Spartan, Figtree, Work Sans, Rubik,
Playfair Display, Merriweather, Lora, Cormorant Garamond, EB Garamond, Fraunces, Cinzel, Bodoni Moda,
Roboto Slab, Oswald, Fredoka, Unbounded, Dancing Script, Caveat, JetBrains Mono.
Repuestos ya verificados por si alguna no convence: Syne, Space Grotesk, Sora, Urbanist, Archivo, Barlow,
Josefin Sans, Quicksand, Bricolage Grotesque, Lexend, Mulish, Karla, Crimson Pro, Source Serif 4, Prata,
Marcellus, Yeseva One, Kaushan Script, Pinyon Script, Satisfy, Gloria Hallelujah, Luckiest Guy, Bangers,
Poiret One, Limelight.

### 4.7 Combinaciones de fuentes (título + cuerpo)

| Nombre | Título | Cuerpo |
|---|---|---|
| Elegante | Playfair Display 700 | Lato 400 |
| Editorial | DM Serif Display | DM Sans 400 |
| Impacto | Bebas Neue | Montserrat 500 |
| Moderno | Montserrat 800 | Inter 400 |
| Lujo | Cinzel 600 | Cormorant Garamond 400 |
| Boda | Great Vibes | Cormorant Garamond 400 |
| Divertido | Fredoka 700 | Nunito 400 |
| Tecnológico | Unbounded 700 | Manrope 400 |
| Cartel retro | Alfa Slab One | Work Sans 400 |
| Cercano | Caveat 700 | Outfit 400 |
| Callejero | Permanent Marker | Rubik 400 |
| Corporativo | Archivo Black | Roboto 400 |
| Clásico | Libre Baskerville 700 | Montserrat 400 |
| Fresco | Fraunces 600 | Figtree 400 |

En Canva las «combinaciones» del panel Texto son grupos de texto ya diseñados (con tamaños, interlineado y
a veces curvas), no sólo pares: se arman como mini-plantillas de texto con estos pares.

### 4.8 Trampa de fuentes en el lienzo

El canvas no espera a la fuente: si se dibuja antes de que cargue, mide con la de reserva y el texto queda
mal cortado. Antes de pintar: `await document.fonts.load('700 48px "Inter"')`; si la fuente llega después,
limpiar la caché de anchos de fabric (`cache.clearFontCache(familia)`), recalcular el objeto
(`initDimensions()`) y `requestRenderAll()`. Mismo tipo de problema que «libass no avisa cuando le falta la
fuente» (`docs/hallazgos-generativa.md`): falla en silencio.

---

## 5. Plantillas

- **Las de Canva no se copian**: además del derecho de autor, su acuerdo de contenido prohíbe «copy,
  download or distribute the Pro Content as a standalone item» (versión del 20/06/2024, citada por
  búsqueda; Canva devuelve 403 al lector).
- **Sets libres en formato reusable: no hay.** No apareció ningún set CC0/MIT de plantillas en JSON de
  fabric, JSON de Polotno o SVG que valga la pena:
  - **Polotno**: sus plantillas viven atadas a su SDK, que para uso comercial pide licencia paga
    (https://polotno.com/license); no se confirmó la licencia de su biblioteca de plantillas.
  - **Figma Community**: los archivos gratis son **CC BY 4.0** («Community members need to give credit to
    the original creator», https://help.figma.com/hc/en-us/articles/360042296374-Figma-Community-copyright-and-licensing).
    Usables con crédito, pero convertir Figma a nuestro JSON es trabajo manual.
  - **Penpot**: el repo de archivos de la comunidad es CC BY 4.0 por defecto, con excepciones GPL por
    librería (búsqueda sobre el README de `penpot-files`).
- **Recomendación: generarlas nosotros, en un JSON propio** (objetos de fabric serializados + **roles**:
  `titulo`, `subtitulo`, `cuerpo`, `cta`, `foto`, `logo`, `colorMarca`), para que «Magic Design» y
  «Redimensionar» puedan rellenar y reacomodar por rol. Se hacen **en desarrollo** (Claude Code escribe el
  JSON, se revisa en el editor), no en tiempo de uso: costo cero por cliente.
- **Primer catálogo (~70)**, con los rubros de los clientes de MaKo (coach/infoproducto high-ticket,
  inmobiliaria, e-commerce, servicio local) y los usos que más se piden (testimonio, oferta/descuento,
  webinar/lanzamiento, frase, antes/después, pasos, preguntas frecuentes, «agendá tu llamada»):

| Tipo | Medida | Cantidad |
|---|---|---|
| Post de Instagram cuadrado | 1080×1080 | 15 |
| Post vertical | 1080×1350 | 10 |
| Historia / portada de Reel | 1080×1920 | 12 |
| Carrusel (5 láminas) | 1080×1350 | 4 juegos |
| Miniatura de YouTube | 1280×720 | 8 |
| Anuncio de Meta (el mismo diseño en 1:1, 1,91:1 y 9:16) | 1080×1080 / 1200×628 / 1080×1920 | 8 |
| Presentación (8 diapositivas) | 1920×1080 | 3 |

- **Fotos de las plantillas**: no hotlinkear Unsplash dentro de la plantilla (si la borran, la plantilla
  se rompe): usar fondos propios, formas, ilustraciones CC0 o imágenes generadas por Flow una vez y
  guardadas, y dejar el hueco de foto como **marco** que el usuario llena.
- **¿Generarlas con Gemini gratis?** Para el texto/JSON es posible, pero no hace falta (lo hace Claude Code
  en desarrollo). Y Gemini gratis **no genera imágenes**: en la página de precios del 14/10, todos los modelos
  de imagen dicen «Not available» en el tier gratis (https://ai.google.dev/gemini-api/docs/pricing).

---

## 6. IA en el navegador, gratis y con licencia comercial

### 6.1 Cómo se carga

- **transformers.js** (`@huggingface/transformers`, Apache-2.0; en el repo `^3.8.1`, en npm ya va por 4.3.1):
  `pipeline('background-removal', 'Xenova/modnet')` o `pipeline('image-segmentation', 'onnx-community/BiRefNet_lite-ONNX')`,
  `device: 'webgpu' | 'wasm'`, `dtype` por modelo. Baja de Hugging Face (redirige a `us.aws.cdn.hf.co`,
  **medido**) y cachea en el navegador. Es lo que ya usa Whisper en el Video Editor.
- **onnxruntime-web** (MIT, 1.30.0) para los ONNX que transformers.js no conoce (MI-GAN, LaMa, Real-ESRGAN).
- **MediaPipe Tasks Vision** (Apache-2.0): ya en el repo, modelo en `public/ve/modelos`, wasm de jsDelivr
  con versión fija.
- **Self-host vs Hugging Face**: para producción, copiar los `.onnx` elegidos a Storage (versión
  congelada, no depende de que el autor borre el repo). Los de más de 50 MB conviene bajarlos sólo cuando el
  usuario aprieta el botón, con barra de progreso.
- **WASM multihilo pide aislamiento de origen** (COOP/COEP): sin él, onnxruntime-web corre en un solo hilo,
  bastante más lento (el caso de Software Mansion,
  https://swmansion.com/blog/client-side-ai-model-inference-for-real-time-video-processing-style-transfer-52be282968f9).
  MaKo **no** manda COOP/COEP hoy, y prenderlos obliga a que toda imagen de afuera venga con CORS o CORP
  (Unsplash manda `Cross-Origin-Resource-Policy: cross-origin`; Pexels sólo CORS). Recomendación: **WebGPU
  primero**, WASM de un hilo como respaldo, y no tocar COOP/COEP en la primera versión.

### 6.2 Quitar fondo

| Modelo | Licencia (cita) | Tamaño (**medido** en la API de HF) | Velocidad | Veredicto |
|---|---|---|---|---|
| **MediaPipe Selfie Segmenter** | Apache-2.0 (repo `google-ai-edge/mediapipe`) | ya en `public/ve/modelos` | **Medido 12/10** en el Video Editor: ~14 ms por cuadro a 512×288 en GPU; 4,6–7,4 s la primera vez | **Sí, para personas** (bordes de pelo flojos) |
| **BiRefNet_lite** | «License: mit» (https://huggingface.co/ZhengPeng7/BiRefNet_lite); entrenado «on DIS-TR» | ONNX fp16 114,5 MB / fp32 224 MB | 0,85 s a 512 y 3,4 s a 1024 en WebGPU (autor del export parcheado, hardware no dicho); WASM 3–5× más lento (rembg-webgpu) — **estimado** | **Sí, para objetos y productos**, usando el export parcheado (trampa abajo) |
| **MODNet** | «The code, models, and demos in this repository (excluding GIF files…)» bajo Apache 2.0 (https://github.com/ZHKKKe/MODNet) | q8 6,6 MB / fp16 13 MB / fp32 25,9 MB | **estimado** < 1 s a 512 en WASM | Plan B liviano para retratos |
| U²-Net | Apache-2.0 (repo) | no medido | — | Alternativa vieja; peor que BiRefNet |
| ISNet (DIS) | código Apache-2.0; pesos sin licencia escrita; el ONNX de `onnx-community/ISNet-ONNX` está etiquetado **agpl-3.0** (**medido**) | 44–176 MB | — | No (el ONNX disponible es AGPL) |
| **RMBG-1.4** | «Commercial use is subject to a commercial agreement with BRIA» (https://huggingface.co/briaai/RMBG-1.4) | 44–176 MB | — | **No** (confirmado no comercial) |
| **RMBG-2.0** | «released under a CC BY-NC 4.0 license for non-commercial use» (https://huggingface.co/briaai/RMBG-2.0) | — | — | **No** (confirmado no comercial) |
| **@imgly/background-removal** | **AGPL-3.0** (API de GitHub de `imgly/background-removal-js`) | — | — | **No** (confirmado: AGPL obligaría a publicar el código de MaKo) |

- ⚠️ **Trampa**: el ONNX «oficial» de BiRefNet_lite no corre en WebGPU: «falls back to the CPU EP on most
  of its graph and dies of `std::bad_alloc`» (80 nodos `GatherND` y un `Split` de 59 salidas). Hay un
  export parcheado, MIT, con los mismos pesos: https://huggingface.co/jiabins0303/birefnet-lite-1024-webgpu.
  Probar ése (o repetir su parche) antes de concluir que «BiRefNet no anda en el navegador».
- Bonus barato con la misma máscara: **desenfocar el fondo** («Auto Focus» de Canva) y **sombra/contorno
  del recorte**.

### 6.3 Seleccionar un objeto con un clic («Magic Grab»)

- **SlimSAM** (`Xenova/slimsam-77-uniform`, Apache-2.0, **medido**: codificador q8 8,9 MB + decodificador
  q8 4,9 MB). El codificador corre una vez por imagen (**estimado** 1–3 s en WASM) y cada clic es sólo el
  decodificador (**estimado** < 100 ms). transformers.js lo soporta.
- SAM 2.1 tiny (`onnx-community/sam2.1-hiera-tiny-ONNX`): codificador 28,5–134 MB; el código y los pesos de
  SAM 2 son Apache-2.0 en `facebookresearch/sam2` (la tarjeta del ONNX no declara licencia).
- MediaPipe Interactive Segmenter (MagicTouch, 768×768 int8): no se pudo leer la licencia de su tarjeta (PDF).
- «Magic Grab» = SlimSAM para recortar el sujeto + borrador mágico (§6.4) para rellenar el hueco.

### 6.4 Borrador mágico (inpainting)

| Modelo | Licencia | Tamaño | Velocidad | Veredicto |
|---|---|---|---|---|
| **MI-GAN** | Código MIT y pesos MIT («see LICENSE-WEIGHTS»: «MIT License … Copyright (c) 2024 Picsart AI Research»), https://github.com/Picsart-AI-Research/MI-GAN | `migan_pipeline_v2.onnx` **28,1 MB** (**medido**, `andraniksargsyan/migan`, MIT); entrada uint8 de imagen + máscara, 512 | «one order of magnitude smaller and faster than recent SOTA»; **estimado** 1–3 s a 512 en WASM | **Sí** |
| LaMa (big-lama) | Apache-2.0 (API de GitHub de `advimman/lama`) | `Carve/LaMa-ONNX` 207,5 MB (apache-2.0); `opencv/inpainting_lama` 92,6 MB (sin licencia en la tarjeta) | **estimado** 5–20 s a 512 en WASM | Plan B, mejor en fondos grandes |

Proyecto de referencia que corre MI-GAN en el navegador: `lxfater/inpaint-web` — es **GPL-3.0**: sirve para
mirar, **no para copiar código**.

### 6.5 Ampliar / mejorar

| Modelo | Licencia | Tamaño | Velocidad | Veredicto |
|---|---|---|---|---|
| **Real-ESRGAN General x4v3** | BSD-3-Clause (API de GitHub de `xinntao/Real-ESRGAN`; «bsd-3-clause» en https://huggingface.co/qualcomm/Real-ESRGAN-General-x4v3) | «1.21M» parámetros, «4.65 MB» (float); ONNX en el zip de Qualcomm AI Hub (v0.64.0) | entrada por mosaicos de 128×128: **estimado** 10–60 s para 1024 px en WASM, mucho menos en WebGPU | **Sí** |
| Swin2SR | Apache-2.0 (API de GitHub de `mv-lab/swin2sr`); los ONNX de Xenova no declaran licencia en la tarjeta | lightweight ×2: 4–8 MB; classical ×2 / realworld ×4: 15,5–54 MB (**medido**) | transformer, **estimado** más lento que Real-ESRGAN por píxel | Plan B |
| `pica` | MIT (API de GitHub) | ~0 | inmediato | **Respaldo sin riesgo**: reescalado clásico Lanczos, no inventa detalle |

### 6.6 Los datos de entrenamiento (lo que una licencia MIT no resuelve)

La licencia del modelo la da su autor; **el dataset con el que se entrenó puede ser no comercial**, y si eso
alcanza a los pesos es una pregunta legal abierta. Lo que se encontró:

- **Places2** (LaMa y MI-GAN): el sitio no respondió (ECONNREFUSED); los términos del dataset hermano de
  MIT CSAIL (ADE20K, https://ade20k.csail.mit.edu/terms) dicen «Researcher shall use the Database only for
  non-commercial research and educational purposes».
- **FFHQ** (MI-GAN): el dataset es CC BY-NC-SA 4.0: «use, redistribute, and adapt it for non-commercial
  purposes» (https://github.com/NVlabs/ffhq-dataset).
- **DIV2K** (Real-ESRGAN, Swin2SR): «this dataset is made available for academic research purpose only»
  (https://data.vision.ee.ethz.ch/cvl/DIV2K/).
- **DIS5K** (BiRefNet_lite, ISNet): el README de DIS dice que no restringe el uso comercial de DIS5K V1.0
  «free of charge for the current version», pero que los usuarios comerciales firmen otros términos por
  mail (vía búsqueda; el PDF de términos no se pudo abrir). El autor del export parcheado de BiRefNet lo lee
  como restricción comercial.
- **MediaPipe** (datos propios de Google) es el único con la cadena limpia de punta a punta.

Postura práctica: es el mismo riesgo que corre todo producto que usa estos modelos; pesa poco frente a usar
RMBG/AGPL, que están prohibidos **por su propia licencia**. Si Martín quiere riesgo cero: MediaPipe para
personas, `pica` para ampliar, y borrador mágico «Próximamente».

---

## 7. Texto a imagen y Magic Studio: qué se puede dar gratis

**Texto a imagen va por el puente a Flow**, confirmado por dos lados: (1) la decisión del 11/10 y el estado
en `docs/hallazgos-editor-landing.md` → «Lo que quedó sin hacer» (el Flow nuevo sólo deja cambiar el TEXTO
del pedido; falta parchear la extensión para imágenes sin referencia); (2) el API de Gemini no tiene imagen
gratis («Not available» en el tier gratis para todos los modelos de imagen, página de precios del 14/10).
El puente no tiene API oficial: va detrás de una interfaz propia (`docs/hallazgos-generativa.md` → «No
existe API oficial de Flow: diseñar para degradar»).

**Texto (Magic Write, Traducir) — ojo con «Gemini gratis»**: los términos del tier gratis dicen «Google uses
the content you submit to the Services and any generated responses to provide, improve, and develop», «human
reviewers may read, annotate, and process your API input and output» y «Do not submit sensitive,
confidential, or personal information to the Unpaid Services»; además «You may use only Paid Services when
making API Clients available to users in the European Economic Area» (y Suiza y Reino Unido)
(https://ai.google.dev/gemini-api/terms). Con textos de clientes eso choca con la regla de la casa (Gemini
gratis entrena: no se usa con datos reales). Rutas gratis que sí sirven:

- **IA de Chrome en el dispositivo** (Gemini Nano): la página oficial lista Translator, Language Detector y
  Summarizer desde Chrome 138 (https://developer.chrome.com/docs/ai/built-in-apis) y un post de enero de
  2026 lo da estable en escritorio y Chromebook Plus desde la 144
  (https://developer.chrome.com/blog/ai-translation-chromebook-plus); Writer/Rewriter/Prompt no se
  confirmaron como estables. Gratis, privado, sólo Chrome de escritorio.
- **`lib/ai-cheap.ts`** (Groq: no entrena; el tier gratuito tiene límites por organización) con
  respaldo a lo que ya define el registro de modelos.

| Función de Canva | Ruta en MaKo | Estado |
|---|---|---|
| Magic Media — texto a imagen | Puente a Flow con la cuenta del cliente | **Sí**, cuando el puente acepte imágenes sin referencia (parche pendiente) |
| Magic Media — texto a video / Dream Lab | Flow / Video Editor | Próximamente |
| Magic Write (escribir, reescribir, acortar) | Chrome IA o `ai-cheap` | **Sí** |
| Traducir el diseño | Translator API de Chrome; si no hay, `ai-cheap` | **Sí** |
| Magic Design (diseño desde una frase) | LLM elige plantilla, rellena roles y busca fotos en Unsplash por palabra clave | **Sí** (sin imagen IA) |
| Magic Switch / Redimensionar | Reacomodo propio por roles de la plantilla + LLM para cambiar el formato del texto | **Sí** el tamaño; parcial la conversión |
| Quitar fondo | §6.2 | **Sí** |
| Magic Eraser | MI-GAN (§6.4) | **Sí** (con la nota de datos) |
| Magic Grab | SlimSAM + MI-GAN | **Sí**, más trabajo |
| Grab Text (texto de una foto a editable) | Tesseract.js (Apache-2.0, 7.0.0) | **Sí** |
| Ampliar / mejorar | Real-ESRGAN x4v3 o `pica` | **Sí** |
| Auto Focus / desenfocar fondo | máscara de quitar fondo + desenfoque | **Sí** (barato) |
| Magic Animate | animaciones de entrada programadas (sin IA) + exportar GIF/MP4 | Parcial |
| Magic Edit (cambiar una zona por un pedido) | necesita generación con máscara | Próximamente |
| Magic Expand (agrandar la foto) | necesita generación (outpainting) | Próximamente |
| Magic Morph (texto/forma con estilo IA) | generación | Próximamente |
| Magic Charts / texto a gráfico | LLM + biblioteca de gráficos | Después |

---

## 8. Exportar

| Formato | Cómo | Licencia |
|---|---|---|
| PNG / JPG / WebP | **fabric 7 directo**: `toDataURL(options)` y `toBlob(options): Promise<Blob \| null>` con `format`, `quality`, `multiplier` y recorte; `toCanvasElement(multiplier)` para tamaños grandes (https://fabricjs.com/api/classes/staticcanvas/). PNG transparente = sin fondo | fabric 7.4.0, MIT |
| SVG | **fabric 7 directo**: `toSVG(options, reviver)` | MIT |
| PDF | **jsPDF**: cada página `toCanvasElement(multiplier)` a ~300 ppp → `addImage` (fidelidad total, texto no seleccionable). PDF vectorial: `toSVG` → **svg2pdf.js** → jsPDF («supports only a limited part of the SVG specification», https://github.com/yWorks/svg2pdf.js) | jsPDF 4.2.1 MIT; svg2pdf.js 2.8.1 MIT |
| PDF (unir, metadatos) | **pdf-lib** (+ `@pdf-lib/fontkit` para fuentes) | pdf-lib 1.17.1 MIT; fontkit 1.1.1 MIT |
| GIF | **gifenc** (ya en el repo); alternativa `modern-gif` | MIT / MIT |
| MP4 | el motor de export del Video Editor | — |

Trampas del export:

1. **Lienzo contaminado**: una imagen cargada sin CORS hace que `toDataURL`/`toBlob` tiren `SecurityError`.
   Toda imagen de afuera con `crossOrigin: 'anonymous'` (los CDN de §1.8 responden CORS, medido).
2. **El SVG no lleva fuentes ni fotos adentro**: `toSVG` referencia la familia por nombre y la imagen por
   URL. Para un SVG que se abra igual en otra máquina hay que inyectar `@font-face` con la fuente en base64 y
   pasar las imágenes a `data:`.
3. **jsPDF sólo incrusta TrueType** (`addFileToVFS` + `addFont`, no woff2): Fontsource sirve `.ttf` por peso
   (§4.3). Para el PDF «de imagen» no hace falta.
4. El PDF rasterizado pesa más; el vectorial pierde filtros, sombras y mezclas que svg2pdf no soporta.
   Ofrecer «PDF estándar» (raster) primero, como Canva, y el vectorial después.

---

## 9. Trampas del entorno encontradas en este relevamiento

- **Openverse**: los límites del código (5/hour, 100/day) no son los de producción (20/min, 200/day en las
  cabeceras); el anónimo no puede pedir más de 20 por página y ninguna búsqueda pasa de 240 resultados.
- **Wikimedia**: una miniatura de ancho «no estándar» devuelve 400, no la imagen.
- **Pixabay**: la `webformatURL` vence a las 24 h; guardarla en un diseño es dejarlo roto al otro día.
- **Unsplash**: el cupo de demo (50/h) es para TODA la app; sin caché por consulta, un par de clientes
  buscando lo agotan.
- **Google Fonts**: el catálogo útil (`/metadata/fonts`) no está documentado y no trae licencia.
- **`@iconify/json`** pesa 502 MB: instalarlo en esta máquina es exactamente lo que no hay que hacer.
- **BiRefNet_lite**: el ONNX de la comunidad cae a CPU y revienta por memoria en WebGPU; el diagnóstico
  obvio («el modelo es muy pesado para el navegador») es el equivocado: es el grafo exportado.
- **ISNet en HF** está etiquetado AGPL aunque el código de DIS sea Apache.
- **Emoji del sistema** (lo que hace el Video Editor): el mismo diseño se ve distinto en cada máquina.

## 10. Lo que no se pudo confirmar

- Las páginas de Canva (Magic Studio, ayuda de Elementos, acuerdo de contenido) devuelven 403 al lector:
  la lista de categorías y de funciones de Magic Studio sale de su ayuda vía búsqueda y de terceros.
- Si la API de Unsplash devuelve fotos Unsplash+ (sólo un reporte de usuario dice que no).
- Los términos del API de Iconify: no publica cupo ni términos aparte de «free to use».
- La página de licencias de SVG Repo (429).
- La licencia oficial de Noto Animated Emoji (sólo fuentes secundarias: CC BY 4.0).
- La FAQ de Google Fonts (página JS; lo de uso comercial es secundario).
- Los términos de Places2 (sitio caído) y el PDF de términos de DIS5K.
- La licencia del modelo MagicTouch de MediaPipe (PDF ilegible).
- **Todas las velocidades marcadas «estimado»**: hay que medirlas en una notebook sin GPU dedicada, con
  WebGPU y con WASM de un hilo, después del primer uso (sin contar la descarga).
- El acceso a vectores originales del API de Pixabay.
