# Canva: el armazón del editor (paleta, proporciones, estructura, inicio, diálogos, atajos)

Relevamiento para copiar el editor de Canva **tal cual** dentro de MaKo. Fecha: 14/10/2026.
Referencia: el editor web de Canva "renovado" (*glow up* de 2024) más los cambios visibles en el material oficial de 2025–2026.

## 0. Cómo se obtuvo y cuánto confiar en cada dato

**No se midió el editor en vivo.** El Chrome de Martín **no tiene sesión en Canva**: `canva.com` muestra la portada pública con «Registrarme / Iniciar sesión», `/projects` redirige a «Iniciá sesión en tu cuenta de Canva» y «Empezá a diseñar» abre el modal de inicio de sesión. Siguiendo la consigna, no se inició sesión, no se aceptaron cookies ni condiciones y **no se creó ningún diseño**. Todo lo que sigue sale de fuentes públicas:

| Marca | Fuente | Confianza |
|---|---|---|
| **[TK]** | **Tokens oficiales del sistema de diseño de Canva ("Easel")**, publicados en el paquete npm `@canva/app-ui-kit@5.15.0` (`dist/styles.ltr.css` + `dist/esm/ui/base/tokens/*`). Son los colores, sombras, radios, espaciados y escala tipográfica que Canva usa en el panel lateral del editor. Se extrajeron con `research/canva-armazon/tools/tokens.py` y `typo.py`. | **Alta** para valores de componentes (botones, bordes, textos, superficies). No incluye el "cromo" propio del editor (degradado de la barra, fondo del lienzo) |
| **[DEV]** | Maqueta oficial del editor en canva.dev (`canva.dev/_next/static/media/hero.58c4d7aa.png`, 1600×733, editor de 2024 en inglés), **medida píxel a píxel** con PIL (`tools/px.py`). El texto de canva.dev dice que el panel lateral mide **"roughly 350px"** en computadora. | Alta para colores; **media** para px (es una maqueta reducida; se convirtió con el factor 0,551 que sale de 350 px de panel, ver §1) |
| **[MKT]** | Imágenes de marketing **localizadas al español** (`*_es-CO.png`) de canva.com/es_co/editor-fotos y /es_co/presentaciones (2016×1344 y 2016×1512): editor e Inicio de 2025–2026 **con la interfaz en español**. | **Alta para rótulos en español y colores**; media para proporciones (maquetas recortadas, escala desconocida) |
| **[AY]** | Centro de Ayuda de Canva en `es_419` (Español Latinoamérica). **Casi todos los artículos dicen "Este artículo se tradujo con la traducción automática"**: los nombres de botones pueden no coincidir letra por letra con la interfaz. | Media para rótulos, alta para qué opciones existen |
| **[AY-EN]** | El mismo artículo en inglés, para desambiguar | Alta |
| **[BTN]** | Tabla oficial de tipos de diseño y medidas del Canva Button: https://www.canva.dev/docs/button/reference/design-types/ | Alta (puede estar algo atrasada) |
| **[DS22]** | Capturas reales del editor de 2022 del sitio de Design School (`resourcepage.my.canva.site`) | Baja: **interfaz vieja** (riel oscuro). Solo se usó para la barra inferior |
| **[TAB]** | Título de una pestaña con un editor de Canva abierto que apareció en el grupo de pestañas (no la creé ni la toqué; ver §14) | Alta para ese dato puntual |
| **[I]** | Inferido o recordado por mí | Verificar antes de dar por cierto |

Material de trabajo (no va al repo): `C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/1186b401-6e6a-45db-b79a-cb05936fa0e2/scratchpad/research/canva-armazon/` (`dl/` imágenes y tokens descargados, `tools/` scripts de medición, `txt/` hojas de contacto y tokens resueltos).

**Trampas de la investigación (para no repetirlas):**
- **El Centro de Ayuda está traducido a máquina y se nota**: en la tabla de atajos "Shift" aparece como **«Deslizar»** («Deslizar + flecha arriba»), "Shift+F10" como **«Deslizar + 10»** (el inglés dice "Shift + 10", también roto), en Windows figura «Enviar comentario: Command + Enter». Mezcla «Añadir» y «Agregar», «vídeo» y «video», «Redimensionar» y «Cambiar tamaño» para el mismo botón. **No copiar rótulos de la ayuda sin cruzarlos con una imagen real de la interfaz.**
- **Canva tiene un idioma «Español (Argentina)»** (selector de idioma: Español (Argentina), Español (Colombia), Español (Latinoamérica), Español (México), Español (España), Español (Estados Unidos)) **y la interfaz argentina usa voseo**: el modal de inicio de sesión dice «Iniciá sesión o registrate en segundos», «Para acceder a Canva gratis, usá tu correo u otro servicio», «Si continuás, aceptás las Condiciones de uso». Las imágenes es-CO usan tuteo («Selecciona lo que quieres capturar»). El Centro de Ayuda `es_ar` es el mismo texto que `es_419` (tuteo).
- **El paquete `@canva/app-ui-kit` tiene licencia restrictiva**: "You must only use the Software Components and any Derivative on the Canva Platform". **No se copia su CSS ni su código**; acá solo se anotan los **valores** (un color o un radio son datos medidos, no código).
- **La mayoría de los artículos de ayuda ya no tienen capturas** (se revisaron change-colors, finding-and-arranging-layers, download-design, edit-photos, guides, slash-magic: cero imágenes). Las mejores imágenes del editor actual están en las **páginas de marketing localizadas** (`content-management-files.canva.com/.../*_es-CO.png`), que sí muestran la interfaz en español.
- Las capturas de Design School (2022) muestran el **editor viejo** (riel lateral gris oscuro, botón «Home», barra contextual fija). No sirven como referencia de diseño actual.
- Con la sesión cerrada, `fetch` a `/design/...` devuelve 403/404: no hay forma de bajar los textos del editor (los paquetes `*.es-419.js` tienen nombre con hash y solo se listan dentro del editor).

---

## 1. Estructura general y proporciones

Conversión usada: en la maqueta [DEV] el panel lateral mide 193 px y canva.dev dice que el real mide ~350 px ⇒ **factor 0,551** (px reales = px de maqueta ÷ 0,551). Cruce de control: la barra superior da 54 px y el riel 73 px, coherentes con lo que recuerdo del editor (56 y 72 px) [I]. **Todos los px reales de esta sección son estimados; fijarlos con 10 minutos de medición con sesión (ver §13).**

```
┌──────────────────── Barra superior ~54–56 px · degradado #00C4CC → #7D2AE8 ────────────────────┐
│ ☰  Archivo  Redimensionar  ✎ Editando ▾ │ ↶ ↷ │ ☁     Diseño sin título - 1080 × 1080 px  📊 💬 (VW) [⤴ Compartir] │
├──────┬───────────────────────┬─‹─────────────────────────────────────────────────────────────────┤
│ Riel │ Panel lateral ~350 px │      Área del lienzo (#F6F7F8)                                       │
│ ~72  │ (blanco; en 2025      │        [Barra de acciones rápidas del objeto, flotante]              │
│ px   │  tarjeta flotante con │      Página 1 - Agregar título de página      🔒 👁 ⧉ 🗑 ⊕            │
│      │  radio y sombra)      │      ┌──────────── página (blanca, centrada) ────────────┐         │
│ Dise.│                       │      │                                                    │         │
│ Elem.│                       │      └────────────────────────────────────────────────────┘         │
│ Texto│                       │      [ + Agregar página ] (ancho de la página)                      │
│ …    │                       │                                                                       │
├──────┴───────────────────────┴───────────────────────────────────────────────────────────────────┤
│ ✎ Notas  ⏱ Duración │                       ─────●──── 43 %   Páginas 1/3   ⊞   ⤢   ?           │ Barra inferior
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Medida | Maqueta [DEV] | Real estimado | Nota |
|---|---|---|---|
| Alto barra superior | 30 px | **54 px** (≈56 [I]) | degradado horizontal de punta a punta |
| Ancho del riel | 40–41 px | **73 px** (≈72 [I]) | ícono arriba + rótulo abajo, centrados |
| Paso entre pestañas del riel | 39 px | **71 px** | |
| Ancho del panel lateral | 193 px | **350 px** [DEV texto] | |
| Relleno interno del panel | 7 px | ~13 px (≈12–16, tokens `space150`/`space200`) | |
| Botón para cerrar el panel «‹» | Ø 12 px | Ø ~22 px | círculo pegado al borde derecho del panel, arriba |
| Del borde inferior de la barra a la página | 48 px | ~87 px | incluye el encabezado de página (~40 px) |
| Íconos del encabezado de página | 10 px sobre la página | ~18 px | alineados a la derecha de la página |
| Márgenes laterales de la página | 115/116 px | ~210 px c/u | la página queda **centrada** en el área (con "Ajustar" de zoom) |
| Botón «Compartir» | 51×23 px | **~93×42 px** | token de botón: alto 40 px |
| Avatar del usuario | Ø ~20 px | Ø ~36 px | |
| Botones con borde de la derecha (📊, 💬) | ~20×20 px | ~36×36 px | cuadrados con borde blanco translúcido |
| Margen derecho de «Compartir» | 4 px | ~8 px | |
| Botón primario del panel («Add to design») | alto 21 px | ~38–40 px | ancho completo del panel |

Posiciones horizontales de la barra superior (desde el borde izquierdo, real estimado): ☰ centro 34 px · «Archivo» 78 px · «Redimensionar» 129 px · «✎ Editando» 328 px · ↶ 455 · ↷ 501 · ☁ 561 px. A la derecha, el título termina ~265 px antes del borde.

### 1.1 Cómo cambió el armazón en 2025–2026 [MKT]
Las maquetas localizadas de 2025–2026 (editor de fotos y presentaciones) muestran un cromo distinto al de la maqueta de 2024:
- **Riel, área del lienzo, tira de miniaturas y barra inferior comparten el mismo gris `#F6F7F8`**; en 2024 el riel y el panel eran blancos.
- **La pestaña activa del riel es una baldosa blanca redondeada con sombra** sobre el gris (no un texto de color).
- **El panel lateral / panel de edición es una tarjeta blanca flotante**, separada ~9 px de la barra superior, con **radio ~13–14 px** (≈ token `radiusElementStandard` 12 px) y sombra suave (≈ `elevationSurfaceRaisedShadow`).
- **Botón redondo de Canva IA** (destello ✦ con aro de degradado) abajo a la izquierda, sobre el riel.
- La ayuda confirma el cambio de barra: *«La barra de herramientas fijada debajo del encabezado ahora se encuentra en una "barra de herramientas de acciones rápidas"»* y *«El panel de edición se abre después de seleccionar una opción o herramienta»* [AY glow-up].

### 1.2 Paleta medida (tema claro)

**Cromo del editor** (medido en imágenes oficiales):

| Token sugerido | Valor | Dónde | Fuente |
|---|---|---|---|
| `--cv-header-from` | **`#00C4CC`** | izquierda de la barra superior | [DEV] `#02c4cc`, [MKT] `#01c4cc` |
| `--cv-header-to` | **`#7D2AE8`** | derecha de la barra superior | [DEV] `#7d2ae8` |
| degradado medido (10 puntos) | 0 % `#02c4cc` · 10 % `#2db5cf` · 20 % `#41a7d2` · 30 % `#4e97d5` · 40 % `#5888d9` · 50 % `#6079db` · 60 % `#686ade` · 70 % `#6e5ae0` · 80 % `#744be3` · 90 % `#793be6` · 100 % `#7d2ae8` | **No es lineal en sRGB** (a mitad daría `#3e77da`); se parece a interpolar en Oklab (`#6785dd`). Para copiarlo: `linear-gradient(90deg in oklab, #00c4cc, #7d2ae8)` o poner las 11 paradas medidas | [DEV] + `tools/grad.py` |
| `--cv-canvas-area` | **`#F6F7F8`** | fondo del área del lienzo; en 2025 también riel, tira de miniaturas y barra inferior | [DEV] `#f6f7f8`/`#f6f7f9`, [MKT] `#f6f7f8` en 4 imágenes |
| `--cv-sunken` | `#F3F4F7` | superficie hundida del sistema de diseño (candidata alternativa al gris del área) | [TK] `elevationSurfaceSunkenBg` |
| `--cv-panel` | `#FFFFFF` | panel lateral, panel de edición, menús, diálogos | [TK] `elevationSurfaceBg/Raised/Floating` |
| `--cv-text` | **`#0E1318`** | texto de la interfaz en las maquetas | [MKT] (el token dice `#0F1015`, indistinguible) |
| `--cv-select` | **`#8B3DFF`** | **marco de selección del objeto**, anillo de la miniatura de página elegida, borde de chip elegido, pulgar del deslizador | [MKT] marco 2–3 px; [TK] `colorActionSelectedBorder` |
| `--cv-select-soft` | `#F1EAFF` / `#F3ECFF` | fondo de chip elegido («Fondo»), ítem elegido de «Crear un diseño» | [MKT], ayuda Quick Create |
| `--cv-select-text` | `#5100A8` | texto del ítem elegido en «Crear un diseño» | ayuda (captura Quick Create) |
| halo del deslizador | `#EBDCFF` / `#E8D8FF` | anillo alrededor del pulgar al arrastrar | [MKT] |
| tiradores | blanco `#FFFFFF`, círculos | esquinas de la selección; borde gris + sombra [I] | [MKT] |
| guías de alineación (snapping) | **no medido**: rosa/magenta [I] | líneas al arrastrar | — |
| «Compartir» sobre el degradado | fondo `#F3EBFD` (blanco ~95 % sobre violeta), texto `#0E1318` | | [DEV] |
| botones de la barra (📊 💬) | borde blanco translúcido sobre el degradado | | [DEV] |
| Lienzo de la página | `#FFFFFF` con sombra muy suave | | [DEV] |

**Componentes (valores oficiales del sistema de diseño, tema claro / oscuro)** [TK]:

| Rol | Claro | Oscuro |
|---|---|---|
| Botón primario fondo / hover / presionado | **`#8B3DFF`** / `#7630D7` / `#612DAE` | `#7630D7` / `#612DAE` / `#4A2E7E` |
| Botón primario texto | `#FFFFFF` | `#FFFFFF` |
| Botón secundario fondo / hover / presionado | transparente / `#404F6D0F` / `#39466024` | `#FFFFFF00` / `#FFFFFF12` / `#FFFFFF26` |
| Botón secundario borde / texto | `#35415A33` / `#0F1015` | `#FFFFFF33` / `#FFFFFF` |
| Botón terciario (sin borde) hover / presionado | `#404F6D0F` / `#39466024` | `#FFFFFF12` / `#FFFFFF26` |
| Elegido (fondo / hover / presionado / texto / borde) | `#A370FC26` / `#A370FC26` / `#A370FC33` / `#4A2E7E` / `#8B3DFF` | `#A370FC4D` / … / `#FFFFFF` / `#A370FC` |
| Deshabilitado (fondo / texto / borde) | `#404F6D0F` / `#1C213080` / `#39466024` | `#FFFFFF12` / `#FFFFFF80` / `#FFFFFF26` |
| Crítico (fondo / hover / presionado) | `#DB142C` / `#B61629` / `#911826` | `#B61629` / `#911826` / `#721D27` |
| Botón sobre imagen (overlay) | `#13162099`, hover `#101219B2` | igual |
| Campo (fondo / borde / borde hover / foco / error) | `#FFFFFF` / `#35415A33` / `#1C213080` / **`#8B3DFF`** / `#DB142C` | `#101219B2` / `#FFFFFF33` / `#FFFFFF80` / `#A370FC` / `#FD4958` |
| Control elegido (casilla, interruptor encendido) | `#8B3DFF`, hover `#7630D7` | igual |
| Tirador de deslizador / interruptor | `#FFFFFF` (deshabilitado `#C1C5CD`) | `#FFFFFF` |
| Enlace (normal / hover / presionado) | `#8B3DFF` / `#7630D7` / `#612DAE` | `#A370FC` / `#8B3DFF` |
| Texto principal / secundario / terciario / placeholder | `#0F1015` / `#0F1015D9` / `#101219B2` / `#13162099` | `#FFFFFFE5` / `#FFFFFFCC` / `#FFFFFFB2` / `#FFFFFF80` |
| Borde de interfaz (separadores, tarjetas) | `#39466024` | `#FFFFFF26` |
| Borde de foco (teclado) | `#3D8BFF` | `#3D8BFF` |
| Neutro sutil / normal / fuerte / más fuerte | `#404F6D0F` / `#39466024` / `#35415A33` / `#242C3D66` | `#FFFFFF12` / `#FFFFFF26` / `#FFFFFF33` / `#FFFFFF66` |
| Velo detrás de diálogos | `#242C3D66` | `#13162099` |
| Superficie / elevada / flotante | `#FFFFFF` / `#FFFFFF` / `#FFFFFF` | `#16171D` / `#1D1F26` / `#24262E` |
| Superficie hundida | `#F3F4F7` | `#0F1015` |
| Aviso info / éxito / advertencia / pista (fondo fuerte) | `#1A62FF` / `#008009` / `#AD5A00` / `#8B3DFF` | `#1854D7` / `#096D11` / `#944F05` / `#7630D7` |
| Aviso info / éxito / advertencia / error / pista (fondo suave + texto) | `#CCE1FF`+`#182C59` / `#C3EAC4`+`#133416` / `#FFD9AD`+`#3E2A14` / `#FFD6D8`+`#501B21` / `#E7DBFF`+`#352459` | |

**Sombras** [TK] (copiar tal cual en CSS; son valores, no código):
- Reposo: `0 0 0 .5px #404f6d0f, 0 1px 2px #151e821f, 0 2px 4px #151e820f`
- Elevada (paneles, tarjetas): `0 0 0 .5px #404f6d12, 0 2px 5px #151e821f, 0 6px 12px #151e820f`
- **Flotante (menús, selector de color, tooltips grandes, diálogos)**: `0 0 0 .5px #404f6d0f, 0 8px 16px #151e821f, 0 24px 24px #151e820f`
- Botón "elevado": `inset 0 24px 24px -18px #FFFFFF29, inset 0 1px .5px #FFFFFF40, inset 0 -1px .5px #151e821f, 0 4px 8px #151e8212, 0 8px 16px #151e8208`

**Tooltips**: oscuros con texto blanco [I: no hay token propio en el paquete; usar `#0F1015` o `#13162099`+blur y texto 12 px]. **Menús y diálogos**: superficie blanca + sombra flotante [TK].

**Inicio — colores de los accesos por tipo** [MKT, medidos]: Hoja de cálculo `#138EFF` · Doc `#13A3B5` · Pizarra online `#00A85D` · Presentación `#FF6105` · Redes sociales `#FF3B4B` · Foto `#FF339C` · Video `#E950F7` · Impresión `#992BFF` · Sitio web `#4A53FA` · Subir y Elegir el tamaño `#F2F3F5` (gris, ícono oscuro). Fondo superior del Inicio: degradado muy claro de `#DAF1F8` (izq.) a `#E9DEFC` (der.). El titular usa texto con degradado celeste→violeta (termina ~`#6430F5`).

### 1.3 Espaciado, radios y alturas [TK]
- **Unidad base 8 px.** Espacios: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px.
- **Radios: 12 px "estándar"** (botones, campos, tarjetas), **10 px "agudo"**, 9999 px (píldoras, chips, avatar). El panel flotante de 2025 mide ~13–14 px [MKT].
- **Alto de botón 40 px** (normal), 32 px (chico); también 48/56/64 en piezas grandes. Área táctil mínima: token `minTouchableArea`.
- Transiciones: tokens `hoverTransition`/`fadeTransition` (valores en `primitive/duration.js`/`ease.js`, no extraídos).

### 1.4 Tipografía
- Canva usa **Canva Sans** (y **Canva Sans Display** en titulares). Pila oficial: `"Canva Sans", "IBM Plex Sans Arabic", "Noto Sans Variable", "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` [TK]. **Es propiedad de Canva: no se copia** (se descarga como `.woff2` desde static.canva.com; no bajarla).
- **Reemplazo propuesto**: **Noto Sans** (OFL; es el respaldo que Canva mismo tiene en su pila, así que las métricas ya están pensadas para él) para la interfaz; para titulares tipo "Display", **Figtree** u otra geométrica libre [I: elegir comparando lado a lado].
- `html { font-size: 62.5% }` en Canva: `0.1rem = 1px` [TK].
- **Escala oficial** [TK] (tamaño / interlineado / peso):

| Estilo | Tamaño | Interlineado | Peso | Uso probable en el editor [I] |
|---|---|---|---|---|
| displayXLarge | 42 | 1.1 | 400 (−0,01em) | titular del Inicio |
| displayLarge / Medium | 36 | 1.1 | 400 | |
| displaySmall / XSmall | 32 | 1.1 / 1.25 | 400 | |
| titleXLarge | 36 | 1.25 | 500 | |
| titleLarge | 24 | 1.25 | 600 | título de diálogos («Crear un diseño») |
| titleMedium | 21 | 26 px | 600 | |
| titleSmall | 16 | 24 px | 600 | título de panel («Imagen», «Captura Mágica») |
| titleXSmall | 14 | 20 px | 700 | subtítulos de sección («Ajustar», «Seleccionar el área») |
| titleXxSmall | 12 | 18 px | 600 | |
| bodyXxLarge / XLarge | 21 / 18 | 1.5 | 400 | |
| bodyLarge (+Bold) | 16 | 24 px | 400 / 600 | |
| **bodyMedium** (+Bold) | **14** | **22 px** | 400 / 600 | **texto general, menús, rótulos de la barra** |
| bodySmall (+Bold) | 12 | 20 px | 400 / 600 | tooltips, pies |
| bodyXSmall (+Bold) | 11 | 16 px | 600 / 700 (+0,01em) | **rótulos del riel** |

---

## 2. Barra superior

De izquierda a derecha. Rótulos en español: **[MKT]** = vistos en una imagen real en español; **[AY]** = de la ayuda (traducción automática); **[I]** = traducción mía.

| # | Elemento | Rótulo en español | Comportamiento |
|---|---|---|---|
| 1 | ☰ | (ícono) «Menú» [AY: «selecciona el ícono del menú»] | abre el menú de la página de Inicio **sin salir del editor**; al pasar por el logo aparece «Cerrar»; desde ahí «Inicio» [AY glow-up] |
| 2 | **Archivo** | «Archivo» [AY] | menú con submenús (§9.3). En la maqueta 2024 lleva un globito rojo de novedades |
| 3 | **Redimensionar** | la ayuda usa «**Cambiar tamaño**» («En la barra de menú del editor, selecciona Cambiar tamaño») y también «**Redimensionar**» («En la barra de herramientas del editor, selecciona Redimensionar»). En inglés 2024: "Resize & Magic Switch", con ícono de corona/moneda (función paga) [DEV] | abre el diálogo de §9.2 |
| 4 | ✎ **modo ▾** | modos «**Editar**», «**Comentar**», «**Solo lectura**» (en Docs además «**Sugerir**») [AY]; el botón muestra el modo actual (en inglés "Edit ▾") | cambia el modo del editor |
| — | separador | | |
| 5 | ↶ ↷ | «Deshacer» / «Rehacer» [AY] | Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z) |
| — | separador | | |
| 6 | ☁ | estado de guardado (nube con tilde) [DEV] | rótulo exacto no relevado [I: «Se guardaron todos los cambios» / «Guardando…»] |
| 7 | título (a la derecha) | **«Diseño sin título»** por defecto [TAB]; la maqueta muestra "Untitled design - 426px × 426px" (nombre + medidas, texto blanco translúcido) [DEV]. El título de la pestaña del navegador es «Diseño sin título - Presentación» (nombre - tipo) [TAB] | clic para renombrar [I] |
| 8 | 📊 | Estadísticas [I] (ícono de barras en cuadrado con borde) | |
| 9 | 💬 | Comentarios (panel de comentarios, se expande u oculta) [AY glow-up] | Alt+Ctrl+N agrega un comentario |
| 10 | avatar | iniciales en círculo violeta (+ avatares de colaboradores) [DEV] | |
| 11 | **Presentar** | «Presentar» [AY] (solo en presentaciones; botón con ícono de pantalla) | menú: «Pantalla completa», «Vista de presentador», «Presentar y grabar», «Reproducción automática» [AY presentation-modes] |
| 12 | **⤴ Compartir** | **«Compartir»** [MKT] | botón claro sobre el degradado, ~93×42 px; abre el panel Compartir (§9.1). En cuentas gratis aparece antes un botón de prueba Pro («Prueba Canva Pro») [AY] — **no copiar** |
| — | (cuando hay pedido de impresión) | «Imprimir con Canva» / ícono de camión [AY] | fuera de alcance |

## 3. Riel lateral y panel

### 3.1 Pestañas del riel, en orden
Ícono arriba, rótulo de 11 px abajo. Pasar el mouse **abre el panel de vista rápida**; hacer clic **lo fija abierto**; volver a hacer clic o «Cerrar» lo cierra [AY glow-up]. Ctrl+/ muestra u oculta el panel lateral [AY atajos].

| Orden | Inglés [DEV] | Español | Fuente del rótulo |
|---|---|---|---|
| 1 | Design | **Diseño** | [AY] «se abrirá la pestaña "Diseño"» |
| 2 | Elements | **Elementos** | [AY] |
| 3 | Text | **Texto** | [AY] |
| 4 | Brand | **Marca** | [I] (la ayuda dice «Kit de Marca» para el contenido) |
| 5 | Uploads | **Subidas** (la ayuda: «Haz clic en Subidas para subir») | [AY] — verificar «Subidos»/«Subidas» |
| 6 | Draw → **Tools** | **Herramientas** (reemplazó a «Dibujar»: «La función "Dibujar" ahora está dentro de la pestaña Herramientas») | [AY tools-tab] |
| 7 | Projects | **Proyectos** | [AY] |
| 8 | Apps | **Apps** | [AY] |
| — | separador | | |
| 9+ | apps fijadas | «Fotos», «Audio», «Videos», «Fondo», «Gráficos», «Logos», «Crear en lote», y apps (Magic Media, etc.) | [AY editor-tabs-missing]: estas pestañas se pueden quitar del riel (✕ al pasar el mouse) y volver a agregar desde **Apps** |
| abajo | ✦ | botón redondo de **Canva IA** | [MKT] |

### 3.2 Qué muestra cada panel [AY + I]
- **Diseño**: buscador de plantillas («Plantillas») y, con una presentación, «Diseños»/composiciones; «Estilos» (paletas y combinaciones de fuentes) [AY: «Buscar paletas de colores y combinaciones de fuentes»]. Tiene **una sola barra de desplazamiento** aunque haya carruseles [canva.dev layout].
- **Elementos**: buscador «Buscar elementos» [AY: «En el campo Buscar elementos, escribe…»], filtros, secciones (Formas, Gráficos, Fotos, Videos, Audio, Marcos, Cuadrículas, Tablas, Gráficos de datos…) en carruseles con «Ver todo» [I].
- **Texto**: botón «Agregar un cuadro de texto» [I], estilos «Agregar un título / un subtítulo / un poco de texto» [I], **«Texto dinámico» → «Números de página»** [AY], combinaciones de fuentes.
- **Herramientas**: «Formas», «Líneas», «Notas adhesivas», «Dibujo», «Texto», «Tablas»; cada una abre un submenú para agregar al diseño [AY tools-tab].
- **Proyectos**: pestañas «Diseños», «Carpetas», etc.; clic en un diseño/página la agrega al diseño actual [AY merge-pages].
- **Apps**: catálogo de apps y las pestañas ocultas.
- **Encabezado de panel** (maqueta 2024): título a la izquierda (16 px semibold) + «⋯» a la derecha; botón primario de ancho completo abajo [DEV].

### 3.3 Panel de edición
Se abre a la izquierda (en el lugar del panel lateral) al elegir una opción de la barra del objeto (p. ej. **Editar**, **Efectos**, **Posición**, **Color**, fuente). Tiene título y «✕» arriba a la derecha [MKT: «Imagen ✕», «Captura Mágica ✕»]. Ejemplos en español real [MKT]:
- «**Imagen**» → «**Seleccionar el área**» (chips con ícono: … «Primer plano», «Fondo»; el elegido con borde `#8B3DFF` y fondo `#F1EAFF`) → «**Ajustar**»: «**Brillo**», «**Contraste**», «**Luces**», «**Sombras**», cada uno con deslizador y caja numérica a la derecha (−100…100 [I]).
- «**Captura Mágica**» → «**Selecciona lo que quieres capturar**»: chips «Pincel», «Clic», «Primer plano», › ; botón primario de ancho completo «**Capturar**».

## 4. Barra del objeto (contextual)

Desde el *glow up* hay **dos barras** [AY]:
1. **La barra de herramientas del editor** (la ayuda dice «la barra de herramientas arriba del editor»): fila de controles **flotante encima del lienzo**, cambia según lo elegido (fuente, tamaño, color, Efectos, Animar, **Posición**, Transparencia…). La ayuda la llama **«barra de herramientas de acciones rápidas»**.
2. **La barra que aparece cerca del elemento** («En la barra de herramientas que aparece cerca del elemento, selecciona Agrupar / Alineación / Editar / Eliminar»): mini-barra pegada a la selección con acciones rápidas y «⋯ Más».

Contenido por tipo de selección (orden aproximado; nombres de la ayuda salvo [I]):

| Selección | Controles |
|---|---|
| **Nada / página / fondo** | mosaico de color de fondo; **Editar** → panel «**Editar página**» (con «**Redimensionar**» y «**Diseños**»/composiciones) [AY]; Animar; «**Duración**» [AY]; en la mini-barra: Editar [AY] |
| **Texto** | **nombre de la fuente ▾** (abre el panel de fuentes) · **Tamaño de fuente** con **−** / **+** y lista · **Color del texto** (A con barra de color) · **negrita**, **cursiva**, **subrayado**, **tachado** · **aA** (mayúsculas) · **Alineación** (Izquierda, Centro, Derecha, Justificar) · **Lista** (viñetas, numerada; lista de control) · **Configuración avanzada** → «Espaciado» (interlineado, espaciado entre letras), «Más configuraciones» → «Posición del texto» (Ninguno / Subíndice / Superíndice), «Opciones avanzadas» → «Tipografía» (Kerning, Ligaduras), botón «Cambiar todo» · **Efectos** · **Animar** · **Posición** · **Transparencia** · **Copiar estilo** (rodillo) · bloquear [I] · ⋯ [AY format-text, element-color] |
| **Imagen** | **Editar** (abre el editor de fotos, §9.7) · **Recortar** (doble clic también entra en recorte; «Listo» para salir) · voltear («Girar y rotar elementos») · mosaicos de color si la imagen es vectorial · Animar · Posición · Transparencia · Copiar estilo [AY] |
| **Forma** | mosaico de color de relleno · estilo de borde · Animar · Posición · Transparencia [AY borders + I] |
| **Línea** | color · estilo de línea (grosor, punteado) · extremos (flechas) · tipo (recta, en codo — atajo Shift+\ —, curva) · Animar · Posición [I + AY atajos] |
| **Grupo** | **Desagrupar** (en la mini-barra) · Posición · Transparencia [AY] |
| **Varios** | **Agrupar** (mini-barra) · **Posición** → «Alinear elementos» · «Ordenar» (Alt+Shift+T) [AY] |
| **Elemento de app** | sin agrupar con otros [AY] |

Si una herramienta no entra, la barra se desplaza; en móvil la barra va abajo [AY].

## 5. Menú contextual (clic derecho)

**No hay artículo de ayuda que lo liste** (búsqueda sin resultados). Lo confirmado por la ayuda: «**Redimensionar editor a la selección**» (con 2+ elementos, grupo o una imagen/video) [AY resize], «**Descargar selección**» [AY layers], «**Expandir a ancho completo**» (Docs) [AY], en miniaturas de página «**Eliminar página**» y «**Combinar video**» [AY]. Shift+F10 abre «el menú de más acciones para un elemento seleccionado» [AY atajos].
Lista probable para un elemento [I, armada con los atajos oficiales]: Copiar (Ctrl+C) · Copiar estilo (Alt+Ctrl+C) · Pegar (Ctrl+V) · Duplicar (Ctrl+D) · Eliminar (Supr) · ─ · Capas ▸ (Hacia adelante Ctrl+], Al frente Alt+Ctrl+], Hacia atrás Ctrl+[, Al fondo Alt+Ctrl+[, Mostrar las capas Alt+1) · Alinear con la página ▸ · ─ · Comentar (Alt+Ctrl+N) · Vínculo (Ctrl+K) · Bloquear (Alt+Shift+L) · Texto alternativo · ─ · Redimensionar editor a la selección · Descargar selección; en imágenes además «Establecer imagen como fondo». **Relevar con sesión.**

## 6. Lienzo, páginas y selección

- **Vistas de página** (Archivo → «**Vista de página**»): «**Una sola página**», «**Miniaturas**», «**Desplazamiento**», «**Cuadrícula**» [AY page-view-settings]. Por defecto en computadora: **desplazamiento vertical**, páginas apiladas.
- **Encabezado de cada página** (vista de desplazamiento): a la izquierda «Página N» + campo «**Agregar título de página**»; arriba a la derecha íconos: subir/bajar (flechas), bloquear [I], ocultar [I], «**Duplicar página**», «**Eliminar página**», «**Añadir página**» (la ayuda alterna Añadir/Agregar) [AY manage-pages]. En una página sola, la maqueta muestra solo duplicar y agregar [DEV].
- **«+ Agregar página»**: botón ancho como la página, debajo de la última [DEV] (la maqueta dice "+ Add page"). Máximo **350 páginas** por diseño [AY].
- **Vista de miniaturas**: tira inferior con miniaturas; la elegida con **anillo `#8B3DFF` de ~2 px separado ~2 px** de la miniatura; al final una baldosa gris con «+» [MKT]; al pasar entre miniaturas aparece «+» para insertar [AY]; ⋯ en cada miniatura con «Agregar título de página» [AY].
- **Vista de cuadrícula**: páginas como mosaicos; ⋯ «Más», «Ocultar»/«Dejar de ocultar», arrastrar para reordenar, doble clic o «Cerrar vista de cuadrícula» para volver [AY].
- **Selección**: marco `#8B3DFF` de 2 px, **tiradores circulares blancos** en las esquinas (≈12 px [MKT, escala estimada]) y laterales, control de rotación (la ayuda: «manija giratoria») [AY + I]. Arrastrar en vacío dibuja recuadro de selección [AY]. Shift+clic suma a la selección.
- **Reglas y guías**: Shift+R; arrastrar desde la regla crea guías; mientras se mueve un elemento aparecen **luces grises en las reglas** con su posición [AY]. Guías predefinidas: 12 columnas, 3 columnas, Cuadrícula 3x3, Personalizado [AY].
- **Márgenes** (línea punteada), **sangrado para impresión** (0,125 in = 3,175 mm por lado, no editable), **zona fuera del área segura** (sombreado rojo) [AY margins-bleed].
- Medidas de diseño: **mínimo 40×40 px, máximo 8000×3125 px** («Dimensiones máximas: 8000 x 3125 px») [AY].

## 7. Barra inferior

| Lado | Control | Rótulo | Fuente |
|---|---|---|---|
| izq. | ✎≡ | «**Notas**» (notas de página / presentador) | [AY], [DS22] |
| izq. | ⏱ | «**Duración**» (muestra/oculta la línea de tiempo; Alt+D) | [AY] |
| izq. | ▶ | (vista previa / reproducir) | [MKT] ícono, rótulo no relevado |
| der. | deslizador + «43 %» | zoom: deslizador y caja de porcentaje; en la lista «**Ajustar**» y «**Aumentar**» (ancho del navegador) | [AY page-view-settings], [DS22] |
| der. | «**Páginas**» | muestra/oculta las miniaturas («Mostrar las miniaturas de la página» / «Ocultar…»); indica página actual/total [I] | [AY] |
| der. | «**Ir a la página**» | número de página (Alt+Ctrl+G) | [AY] |
| der. | ⊞ | «**Vista de cuadrícula**» | [AY] |
| der. | ⤢ | «**Pantalla completa**» (flechas que se juntan para salir) | [AY] |
| der. | ? | Ayuda / asistente [DS22, I] | |

## 8. Inicio de Canva [MKT salvo marca]

Imagen real en español: `photo-editor_promo-showcase_01_es-CO.png`.
- **Titular**: «**¿Qué diseñaremos hoy?**» en texto con degradado celeste→violeta, centrado.
- **Chips** debajo (píldoras con borde): «**Mis diseños**» (carpeta) · «**Plantillas**» · «**Canva IA**» + insignia violeta «**Nuevo**».
- **Buscador** grande con borde en degradado y sombra violeta suave: placeholder «**Busca en Canva y descúbrelo**», lupa con destellos a la izquierda y botón redondo «→» a la derecha.
- **Accesos por tipo** (círculos de color con ícono blanco, rótulo debajo; colores en §1.2): «**Hoja de cálculo**», «**Doc**», «**Pizarra online**», «**Presentación**», «**Redes sociales**», «**Foto**», «**Video**», «**Impresión**», «**Sitio web**», «**Subir**», «**Elegir el tamaño**», y «›» para desplazar.
- **«Diseños recientes»** con botón de vista lista/cuadrícula a la derecha; tarjetas con miniatura sobre gris, **nombre** debajo y avatar del dueño + tipo («Post de Facebook», «Presentación»).
- **Menú lateral del Inicio** [AY glow-up]: «Inicio», «Proyectos», «Plantillas», «Mis favoritos» (secciones propias con emoji), «Favoritos del equipo», notificaciones; botón «**Crear un diseño**» / pestaña «**Crear**».
- **Proyectos → Recientes**: filtros «Tipo» (Cualquier tipo, Diseños, Plantillas de la marca, Carpetas), «Titular» (Cualquier titular, Tú, Compartidos conmigo), «Fecha de modificación» (En cualquier momento, Hoy, Ayer, Últimos 30 días, Últimos 90 días, El año pasado); orden «Más relevante», «Ediciones más recientes», «Ediciones más antiguas», «Alfabético (A-Z)», «(Z-A)»; «Ver en forma de lista / de cuadrícula» [AY, mezcla inglés/español en el original].
- **Diálogo «Crear un diseño»** (captura de ayuda, en inglés, 2× de zoom): título grande a la izquierda, lista de categorías con ícono de color: For you, Docs, Whiteboards, Presentations, Social media, Videos, Print products, Websites, More → [I] «Para ti», «Docs», «Pizarras online», «Presentaciones», «Redes sociales», «Videos», «Impresión», «Sitios web», «Más». A la derecha buscador "What would you like to create?" (fondo `#FBFBFC`, borde `#E1E4E7`) y carruseles «Tus plantillas favoritas», «Plantillas favoritas del equipo» con «Ver todo». Ítem elegido: fondo `#F3ECFF`, texto `#5100A8`, radio ~10 px [captura].
- **«Tamaño personalizado»**: «Unidades» (px, in, mm, cm), ancho y alto (40–8000 px), botón «**Crear un nuevo diseño**» [AY design-from-scratch]. Los diseños se abren en pestaña nueva por defecto (Configuración → Mi perfil → «Apertura del enlace») [AY].
- **Tamaños** [BTN] (nombre en español [I]): Publicación de Instagram 1080×1080 px · Historia de Instagram 1080×1920 · Presentación 1920×1080 (4:3: 1024×768) · Post de Facebook 940×788 · Anuncio de Facebook 1200×628 · Portada de evento de Facebook 1920×1080 · Miniatura de YouTube 1280×720 · Arte de canal de YouTube 2560×1440 · Gráfico de Pinterest 735×1102 · Post de X/Twitter 1042×512 · Encabezado de X 1500×500 · Banner de LinkedIn 1400×425 · Logo 500×500 · Infografía 800×2000 · Redes sociales 800×800 · Portada de podcast 3000×3000 · Encabezado de correo 600×200 · Banner de blog 560×315 · Fondo de escritorio 1920×1080 · Mapa mental 1024×768 · Flyer / Carta / Currículum / Menú / Factura / Hoja de trabajo 21×29,7 cm · Documento A4 21×27 cm (sic en la tabla) · Póster 42×59,4 cm · Certificado 29,7×21 cm · Tarjeta de presentación 8,5×5 cm · Postal 14,8×10,5 cm · Invitación 14×14 cm · Collage de fotos 25×20 cm · Folleto 11×8,5 in · Tarjeta / Tarjeta de cumpleaños 7×5 in · Anuncio 5×7 in · Separador 2×6 in · Etiqueta 6×4 in · Entrada 8,5×2,8 in · Portada de libro 1410×2250 px · Geofiltro de Snapchat 1080×2340 · Anuncios: 300×250, 330×280, 728×90, 160×600 px. **Ojo**: la tabla puede estar vieja (Instagram ya promueve 1080×1350, 4:5) [I].

## 9. Diálogos y paneles

### 9.1 Compartir → Descargar [AY download-file-types + download-design + video/GIF]
Ruta: «**Compartir**» → «**Descargar**». Campos:
- «**Tipo de archivo**» (desplegable con ícono por formato, «Sugerido» arriba [I]):
  - **JPG** — «Tamaño» (deslizador ×, o se escribe; rango de PNG/JPG 0,5×–3,125× en Pro [AY resize]) · «Calidad»: Baja / Media / Alta / Límite (tamaño máximo en KB) [AY, traducción automática].
  - **PNG** — «Tamaño» · «Calidad»: Baja / Máxima / Límite de tamaño · «**Fondo transparente**» · comprimir archivo [AY].
  - **PDF estándar** — 96 dpi; protección con contraseña; «Aplanar PDF» [AY artículo relacionado].
  - **PDF para impresión** — 300 ppp; «**Sangrado y marcas de corte**»; «Aplanar PDF»; **perfil de color RGB / CMYK** [AY].
  - **SVG** — «Fondo transparente» [AY].
  - **Video MP4** — «Calidad»: 480p / 720p / 1080p / 4K [AY].
  - **GIF** — «Tamaño» 0.2x / 0.4x / 0.6x / 0.8x / 1x o manual; «Fondo transparente» [AY].
  - **PPTX** (solo presentaciones), **DOCX** (solo Docs), **CSV / XLSX** (solo hojas de cálculo) [AY].
- «**Seleccionar páginas**»: «Todas las páginas» / «Esta página» / «Personalizado» (la ayuda dice también «Todo») [AY].
- «**Guardar configuración de descarga**» (por dispositivo y tipo de diseño) [AY].
- Pie: «**Configuración avanzada**» (solo PDF) y botón primario «**Descargar**» (o «Pagar y descargar» con elementos pagos; o «Solucionar (n) el problema» si falta algo); consejos/advertencias abajo [AY].
- Límites gratis: MP4 hasta 30 min y 1920×1080; GIF hasta 1 min y 1280×720. Pro: MP4 2 h y 3840×2160; GIF 2 min 1920×1080 [AY].
- Varias páginas como imágenes → ZIP con el nombre del diseño, archivos «1.jpg», «2.jpg» o el título de página [AY].

### 9.2 Redimensionar [AY resize]
- Botón «Cambiar tamaño» / «Redimensionar» en la barra superior; también «Editar página» → «Redimensionar» para una sola página.
- Buscador «Buscar por categoría» [AY], sección «**Sugerido**» con paquetes («Videos verticales», «Tu última selección») con casillas por formato; lista de tamaños con casillas (se pueden elegir varios).
- «**Tamaño personalizado**»: ancho, alto, unidades, candado «Bloquear la relación de aspecto»; campos en rojo si se pasa de 40–8000 px.
- «**Todas las páginas**» (elegir qué páginas).
- Botones «**Copiar y redimensionar**» y «**Redimensionar este diseño**». Límites: 50 diseños por vez, 5 tamaños por diseño, 250 salidas por lote.

### 9.3 Archivo [AY page-view-settings, margins-bleed, guides, manage-pages, version-history]
Ítems confirmados por la ayuda (orden [I]):
- «Crear un diseño nuevo» [I] · «Subir archivos» [I]
- «**Configuración**» ▸ casillas: «**Mostrar reglas y guías**» (Shift+R) · «**Mostrar los márgenes**» · «**Mostrar sangrado para impresión**» · «**Mostrar detección de fuera del área segura de impresión**» · «Mostrar fondo» (camisetas) [AY]
- «**Reglas y guías**» ▸ «Mostrar las guías» · «**Añadir guías**» (12 columnas / 3 columnas / Cuadrícula 3x3 / Personalizado → «Añadir guías») · «**Añadir guía vertical**» · «**Añadir guía horizontal**» · «**Bloquear guías**» (Alt+Ctrl+;) · «**Borrar guías**» [AY]. (La ayuda dice que en algunas cuentas márgenes y sangrado viven acá en vez de en Configuración.)
- «**Vista de página**» ▸ «Una sola página» · «Miniaturas» · «Desplazamiento» · «Cuadrícula» · «**Editar como video**» [AY]
- «**Hacer una copia**» (abre la copia en pestaña nueva) [AY] · «Mover a una carpeta» [I] · «Descargar» [I]
- «**Historial de versiones**» (versiones guardadas automáticamente; «Restaurar», «Hacer una copia»; hasta 1000 versiones, solo planes pagos) [AY]
- «Imprimir» (Ctrl+P) [AY atajos] · «**Mover a la papelera**» [tercero: trupeer.ai] · Ayuda [I]

### 9.4 Selector de color [AY element-color]
- Clic en un **mosaico de color** de la barra → se abre el **panel «Color»** a la izquierda.
- Secciones: «**Colores del documento**» (ordenados por matiz, saturación y luminosidad; primer mosaico arcoíris «**Agregar un color nuevo**»), «**Colores de la foto**», «**Colores predeterminados**» (con nombres al pasar el mouse), paletas del Kit de Marca. Vista de lista con nombres.
- Botón **cuentagotas** «**Seleccionar un color**»; control «**Transparencia**» del relleno (en despliegue gradual).
- Abajo: reemplazar en «**Página actual**» / «**Todas las páginas**» («Cambiar todo»).
- Degradados: «Crear y usar degradados de color» [AY, no leído]. El selector "Agregar un color nuevo" abre un **popover** con espectro, barra de tono, campo hex y (para degradados) paradas [I].
- «Copiar estilo» = rodillo en la barra.

### 9.5 Selector de fuente [AY format-text]
- Clic en el **nombre de la fuente** → panel lateral de fuentes con **buscador** y **ícono de filtro** dentro (filtra por **idioma** y **precio**, botón «Aplicar»).
- Junto a la fuente en uso, un ícono abre los **pesos/variantes**.
- Secciones [I]: «Fuentes del documento», «Fuentes recientes», «Fuentes de la marca», «Fuentes populares»; cada fila muestra el nombre escrito con su propia fuente; ▸ si tiene familia.
- Atajo: Shift+Ctrl+F abre el menú de fuentes.

### 9.6 Posición (Organizar / Capas) [AY finding-and-arranging-layers + resize-and-crop]
- Botón «**Posición**» en la barra del objeto → panel lateral con dos pestañas: «**Organizar**» [I, el nombre de la primera pestaña no aparece en la ayuda] y «**Capas**».
- Organizar: «**Adelante**», «**Atrás**», «**Al frente**», «**Al fondo**» (la ayuda repite «Atrás»); «**Alinear a la página**» (un elemento: arriba, izquierda, medio, centro, abajo, derecha [I]) o «**Alinear elementos**» (varios) + distribuir [I]; «**Avanzado**»: «**Ancho**», «**Alto**», «**Relación de aspecto**» (candado), X, Y, rotación [I para X/Y/rotación].
- Capas: lista de la página actual (lo de arriba al frente); íconos de **agrupadas** y **de fondo**; al pasar el mouse «más opciones» (⋯); arrastrar para reordenar (línea indica dónde cae); **Shift** para elegir varias. Alt+1 muestra las capas.

### 9.7 Editar foto [AY image-editor + image-settings, MKT]
- Imagen elegida → «**Editar**» en la barra. El panel tiene secciones (el viejo «Efectos» se repartió):
  - **Herramientas / herramientas mágicas**: «Edición Mágica», «Capas mágicas», «**Quitafondos**», «Generador de Fondo», «Upscale», «Adaptación de estilos», «Imagen a video», «**Ajustar**», «Captura Mágica», «Captura de Texto», «Borrador» [I], «Expandir» [AY], **«Desenfoque», «Enfoque automático», «Retoque facial»** (ahora "en Herramientas").
  - «**Filtros**» (con «Duotono» al final de la lista).
  - «**Sombras**» (sección propia).
  - Apps sugeridas: Mockups, Image Upscaler, Colorize, Pixelify, ColorMix.
- **Ajustar**: «**Seleccionar el área**»: «Todo», «Clic» («Hacer clic»), «Pincel», «Primer plano», «Fondo»; deslizadores «**Brillo**», «**Contraste**», «**Luces**», «**Sombras**» [MKT] y más (balance de blancos, saturación, nitidez, viñeta… [I]); botones «**Ajuste automático**» y «**Restablecer ajuste**» [AY].
- «**Recortar**» aparte en la barra (doble clic = recorte; proporciones de recorte para elementos sin marco; Shift al arrastrar estira sin mantener proporción) [AY].

### 9.8 Presentar [AY presentation-modes]
«Presentar» → «**Pantalla completa**» (predeterminado; flechas cambian de diapositiva) · «**Vista de presentador**» (dos ventanas: «Vista del público» y «Vista del presentador» con notas y siguientes diapositivas) · «**Presentar y grabar**» · «**Reproducción automática**». Alt+Ctrl+P = modo presentación.

## 10. Atajos de teclado oficiales (Windows) [AY canva-keyboard-shortcuts, cruzado con AY-EN]

Corrección aplicada: «Deslizar» = **Shift**, «Mayús» = **Shift**, «Entrar» = **Enter**, «Retroceso» = **Backspace**, «Supr» = **Delete**. En Mac Ctrl→Cmd y Alt→Option.

**Básicos**: Deshacer Ctrl+Z · Rehacer Ctrl+Y (alt. Ctrl+Shift+Z) · Guardar Ctrl+S · Seleccionar todo Ctrl+A · Mostrar u ocultar el panel lateral Ctrl+/ · Agregar texto **T** · Agregar un rectángulo **R** · Agregar una línea **L** · Agregar línea con ángulo de 90° (en codo) **Shift+\\** · Agregar un círculo **C** · Agregar un enlace Ctrl+K · Agregar una nota adhesiva **S** · Emojis (solo Docs y comentarios) Win+; · Agregar una página en blanco / salto de página Ctrl+Enter · Eliminar una página en blanco Ctrl+Backspace · Foco a la barra del editor Ctrl+F1 · Foco al editor Ctrl+F2 · Foco al panel lateral Ctrl+F3 · Siguiente / anterior superficie Ctrl+F6 / Shift+Ctrl+F6 · **Acciones rápidas «/» o Ctrl+E** · Menú de más acciones del elemento **Shift+F10** · Mostrar las capas Alt+1 · Bloquear guías Alt+Ctrl+; · Ir al comentario del elemento Alt+Ctrl+J · Ir a la página Alt+Ctrl+G · Mostrar/ocultar la duración Alt+D · Imprimir Ctrl+P.

**Elementos**: Eliminar Backspace o Delete · Activar/desactivar selección múltiple (con selección) F8 · Seleccionar el más cercano arriba/izq./abajo/der. Shift+W/A/S/D · Duplicar Ctrl+D · Agrupar Ctrl+G · Desagrupar Ctrl+Shift+G · Bloquear elemento Alt+Shift+L · Justificar nivel de elementos Ctrl+Shift+J · Hacia adelante Ctrl+] · Hacia atrás Ctrl+[ · Al frente Alt+Ctrl+] · Al fondo Alt+Ctrl+[ · Ordenar elementos Alt+Shift+T · Siguiente/anterior elemento Tab / Shift+Tab · Mover chico ←→↑↓ · Mover grande Shift+flechas · Girar chico Alt+, / Alt+. · Girar grande Alt+Shift+, / Alt+Shift+. · Alternar redimensión proporcional/un eje F2 · Redimensionar chico Ctrl+flechas · grande Shift+Ctrl+flechas.

**Texto**: Menú de fuentes Shift+Ctrl+F · Buscar y reemplazar Ctrl+F · Negrita Ctrl+B · Cursiva Ctrl+I · Subrayado Ctrl+U · Tachado Shift+Ctrl+S · Subíndice Ctrl+, · Superíndice Ctrl+. · Mayúsculas Shift+Ctrl+K · Alinear izq./centro/der. Shift+Ctrl+L / C / R · Tamaño ±1 Shift+Ctrl+. / Shift+Ctrl+, · Interlineado − / + Alt+Ctrl+↓ / ↑ · Interletrado + / − Alt+Ctrl+. / Alt+Ctrl+, · Anclar arriba/medio/abajo Ctrl+Shift+H / M / B · Lista numerada / viñetas / de control Ctrl+Shift+7 / 8 / 9 · Copiar / pegar estilo de texto Alt+Ctrl+C / Alt+Ctrl+V · Estilos de Docs (cuerpo, H1–H5) Alt+Ctrl+0…5.

**Video**: Reproducir/pausar Espacio · Silenciar M.
**Zoom**: Acercar Ctrl++ · Alejar Ctrl+- · Tamaño real Ctrl+0 · Ajustar a la ventana Alt+Ctrl+0 · Ajustar a pantalla completa Shift+Ctrl+0.
**Vista**: Reglas y guías Shift+R · Vista de desplazamiento Alt+Ctrl+1 · Vista en miniatura Alt+Ctrl+2 · Vista de cuadrícula Alt+Ctrl+3 · Modo presentación Alt+Ctrl+P.
**Comentarios**: Agregar Alt+Ctrl+N · Emoji Shift+; · Otra línea Shift+Enter · Enviar Ctrl+Enter (la ayuda dice "Command + Enter" también en Windows: error).
**App de escritorio** (no aplica a MaKo web): Ctrl+T diseño nuevo, Ctrl+W cerrar pestaña, Ctrl+1…8 pestañas, etc.

Otros gestos [AY]: Alt+arrastrar duplica un elemento [tercero]; doble clic en imagen = recorte; doble clic en página (cuadrícula) vuelve al editor; Shift+clic multi-selección; Ctrl+clic varias páginas en miniaturas.

## 11. Qué NO se copia y con qué se reemplaza
| De Canva | Por qué no | Reemplazo |
|---|---|---|
| Canva Sans / Canva Sans Display (`.woff2` de static.canva.com) | fuente propietaria | Noto Sans (respaldo oficial de Canva) / Figtree, mismos tamaños de §1.4 |
| Logo de Canva (wordmark en la barra y el menú) | marca | logo de MaKo |
| Íconos del riel, barra y paneles | binarios propietarios | set libre (Lucide/Tabler) con la misma forma: layout, shapes, T, kit/maletín, nube con flecha, lápiz/regla, carpeta, grilla+ |
| Plantillas, fotos, elementos, ilustraciones de las maquetas | licencias | contenido propio |
| Código y CSS de `@canva/app-ui-kit` | licencia: solo para apps dentro de Canva | **anotar los valores a mano** (ya están en §1.2–1.4) |
| Nombres de marca de funciones («Canva IA», «Edición Mágica», «Captura Mágica», «Redimensión Mágica», «Magic Switch») | son marcas de Canva | nombre equivalente de MaKo («MaKo IA», etc.) — **decidir** |
| Botón «Prueba Canva Pro», coronas de funciones pagas | modelo de negocio ajeno | el gating del plan de MaKo |

## 12. Decisiones que esto obliga a tomar (con recomendación)
1. **¿Armazón 2024 o 2025–26?** El material oficial muestra dos generaciones: 2024 (riel y panel blancos, barra contextual) y 2025–26 (todo el cromo en `#F6F7F8`, panel como tarjeta flotante redondeada, pestaña activa como baldosa blanca, botón redondo de IA). **Recomiendo la 2025–26**, que es lo que Martín ve hoy en Canva; confirmarlo con una captura suya.
2. **Voseo**: Canva tiene «Español (Argentina)» con voseo en la interfaz (modal de login). Si el editor también lo usa, copiar «tal cual» y la regla de voz de MaKo coinciden. **Recomiendo voseo** en las frases imperativas y los sustantivos tal como en es-419 («Compartir», «Archivo», «Posición», «Capas»).
3. **Rótulos que la ayuda traduce de dos formas** («Redimensionar» vs «Cambiar tamaño», «Añadir» vs «Agregar», «Subidas» vs «Subidos»): elegir uno con una captura real; por defecto **«Redimensionar»**, **«Agregar»** (latino) y **«Subidos»** [I].
4. **Barra del objeto**: copiar las **dos** piezas (barra flotante arriba del lienzo + mini-barra junto a la selección) y el **panel de edición a la izquierda**; la barra fija bajo el encabezado ya no existe.
5. **Atajos que el navegador no deja tomar**: Ctrl+T, Ctrl+W, Ctrl+N no llegan a la página en Chrome; los de la app de escritorio no se copian. Ctrl+E, Ctrl+K, Ctrl+P, Ctrl+F, Ctrl+D, Ctrl+G, Ctrl+B/I/U se toman con `preventDefault` [I, probar]. Escuchar por `event.code` (BracketLeft/Right, Backslash, Semicolon) por los teclados latinos.
6. **Descargar**: mostrar la lista de formatos de Canva y deshabilitar los que MaKo no pueda generar en el navegador (PPTX, PDF CMYK) en vez de recortarla.

## 13. Lo que falta medir y cómo hacerlo en 10 minutos
Con **una sesión de Canva abierta por Martín** (no la abre el agente), en una pestaña nueva con un diseño de prueba, correr en la consola (o con `javascript_tool`) este script de solo lectura y pegar la salida acá:

```js
// Relevamiento del cromo del editor de Canva (solo lectura)
const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    bg: s.backgroundColor, bgi: s.backgroundImage.slice(0, 160), color: s.color, font: s.font, radius: s.borderRadius, shadow: s.boxShadow.slice(0, 160) }; };
const byLabel = (t) => [...document.querySelectorAll('[aria-label],button,[role=tab]')].find(e => (e.getAttribute('aria-label') || e.textContent || '').trim().startsWith(t));
const out = { win: [innerWidth, innerHeight, devicePixelRatio],
  header: R(document.querySelector('header') || byLabel('Archivo')?.closest('header,div')),
  archivo: R(byLabel('Archivo')), compartir: R(byLabel('Compartir')),
  tabs: [...document.querySelectorAll('[role=tab]')].map(t => [t.textContent.trim(), R(t)]).slice(0, 20),
  labels: [...new Set([...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')))].slice(0, 300) };
JSON.stringify(out);
```

Pendientes concretos: alto real de la barra superior; ancho del riel y del panel; color exacto de **guías de alineación** (rosa/magenta [I]) y de **guías de regla**; tamaño de **tiradores** y control de rotación; barra contextual por tipo (texto/imagen/forma/línea/grupo/varios) con sus `aria-label`; **menú contextual** completo; menú **Archivo** completo con submenús; panel **Descargar** real (rótulos exactos de calidad/tamaño); tooltips (fondo, radio, tamaño de letra); barra inferior completa; estado de guardado («Se guardaron…»); si el editor en **Español (Argentina)** usa voseo.

## 14. Riesgos y avisos
- **Ningún px del editor está medido en vivo**: los de §1 salen de una maqueta oficial reducida con un factor deducido. Los colores sí son de imágenes oficiales sin pérdida (PNG) y de tokens oficiales.
- **Otra pestaña con un editor de Canva** («Diseño sin título - Presentación», `canva.com/design/DAHX-ICTUd4/.../edit`) apareció en el grupo de pestañas de esta sesión durante el relevamiento. **No la abrí, no la creé y no la toqué** (mi pestaña seguía sin sesión, así que es un diseño de otro actor, probablemente otro agente o Martín). Si la creó otro agente, ese diseño puede haber quedado en alguna cuenta o como invitado: revisarlo.
- La ayuda puede describir funciones en despliegue gradual («Transparencia» del relleno, «Vista de página» en Archivo) que la cuenta de Martín todavía no tenga.
- La interfaz de Canva cambia seguido (2024 *glow up*, 2025 «Herramientas» reemplazó a «Dibujar», el editor de fotos sin «Efectos»): **este informe queda fijado al 14/10/2026**.

## 15. Fuentes
- Tokens: `@canva/app-ui-kit@5.15.0` (`https://cdn.jsdelivr.net/npm/@canva/app-ui-kit@5.15.0/dist/styles.ltr.css` y `dist/esm/ui/base/tokens/*`, `styles/typography.js`, `fonts/font_stacks.stylex.js`); licencia en `LICENSE.md` del paquete.
- canva.dev: https://www.canva.dev/docs/apps/design-guidelines/layout/ (panel ~350 px, maqueta `hero.58c4d7aa.png`) · https://www.canva.dev/docs/button/reference/design-types/
- Marketing localizado (interfaz en español): https://www.canva.com/es_co/editor-fotos/ (`photo-editor_promo-showcase_01..04_es-CO.png`, `photo-editor-how-to-feature_1..3_es-CO.png`) · https://www.canva.com/es_co/presentaciones/ (`presentations_promo-showcase_01..05 2x_es-CO.png`)
- Centro de Ayuda es_419: canva-keyboard-shortcuts · glow-up · glow-up-variantb · editor-tabs-missing · tools-tab · manage-pages · page-view-settings · resize · margins-bleed-crop-marks · adding-and-removing-guides · finding-and-arranging-layers · download-file-types (+ artículos relacionados de descarga, video/GIF y configuración guardada) · image-editor · image-settings · element-color · format-text · presentation-modes · design-from-scratch (todas bajo `https://www.canva.com/es_419/help/<slug>/`)
- Inglés para cruzar: https://www.canva.com/help/canva-keyboard-shortcuts/
- Design School 2022 (editor viejo): https://resourcepage.my.canva.site/
- Tercero (menú Archivo → Mover a la papelera): https://www.trupeer.ai/es/tutorials/how-to-delete-canva-presentation
- Herramientas de medición reutilizables: `research/canva-armazon/tools/{px.py, grad.py, tokens.py, typo.py, sheet.py}`; tokens resueltos en `research/canva-armazon/txt/tokens_semanticos.txt`.
