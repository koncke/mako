# /vsl/image — los valores medidos de su referencia

**Referencia:** PostNitro, la portada en español — https://postnitro.ai/es
**Medido:** 11/11/2026 y otra vez el **14/11/2026** con Chromium (Playwright) a 1440 × 900 y 390 × 844: `getComputedStyle` antes y
después de cada hover, capturas por sección y un video de la bajada (side-session-notes/…/referencias-landings/image/relevo.md), y
**su CSS** (los módulos de cada sección, bajados de `/_next/static/immutable/chunks/*.css`): de ahí salen las fórmulas fluidas
(`clamp(…, vw, …)`) que la copia usa tal cual.
**Diseño copiado en:** `app/vsl/_competencia/disenos/image.tsx`. **Contenido:** `app/vsl/_competencia/image.ts`.
**Láminas:** `public/vsl-assets/image/laminas/` (banco `C:/dev/bancos-portada/banco-image-landing`, el motor del editor, sin IA);
**outliers:** `public/vsl-assets/image/outliers/` (seis portadas de la biblioteca, 432 × 540).
**«Lienzo»:** `public/vsl-assets/image/lienzo.webm` (el editor REAL montado en `banco-image-landing/editor`, bucle de 9,3 s con
`codificar-bucle.sh`, póster en el primer cuadro). **«Editar»:** la grabación de la portada (`sitio/carruseles.webm`) con su
póster propio en el PRIMER cuadro (`image/editar-poster.jpg`).

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares, números, preguntas, tarjetas negras | Archivo, `font-variation-settings: "wdth" 92` en el h1, los h2 centrados, las preguntas y las tarjetas | 600, 700, 800 | la misma, con su eje de ancho (`archivo-latin-wdth-wght.woff2`) |
| Texto y botones | Instrument Sans | 400, 500, 600, 700 | la misma |
| Cejillas, pestañas de los marcos, índices, el comando | JetBrains Mono | 500, 700 | la misma |

## Colores (sus tokens `--pn-*`)

| Qué | PostNitro | En MaKo |
|---|---|---|
| Fondo (`--pn-ground`) y celdas | `#F5F8F7` | igual |
| Secciones blancas (`--pn-surface`), borde arriba y abajo `--pn-rule-soft` | `#FFFFFF`, `#E9EFED` | igual |
| Tinta / texto / suave | `#07120F` / `#384843` / `#5A6C67` | igual |
| Líneas (`--pn-rule`) | `#D5E0DC` | igual |
| Marca (`--pn-accent`, botones, marcos, tildes, cejillas, índices, la pregunta abierta) | verde `#087A68`; el botón lleno pasa a `#076C5C` (un escalón, medido) y el botón falso del póster a `#065D50` | azul `#2F6FED`; el botón lleno a `#2962D4` |
| Marca clara (`--pn-accent-bright`, en lo negro) | `#0DC7A9` | `#8FB2F7` |
| Tarjetas negras (`--pn-agent-bg`) | `#07120F`, título blanco, texto `#9FB4AE` | igual |
| Botón de línea | blanco, borde `#CED4DA`, hover `#F8F9FA` | igual |

## Medidas (1440; las fluidas, con su fórmula)

- **Página:** `--pn-gutter` clamp(20, 5vw, 80) → 72; contenido de 1312 como máximo (`--pn-w-page`); prosa de 768.
- **Secciones:** padding `clamp(56, 7vw, 96)` arriba y abajo (96 a 1440, 56 a 390). Blancas con borde 1 px `#E9EFED`.
- **Hero:** una pantalla entera (`min-height: 100svh`, flex en columna, el contenido con `margin: auto`); fondo de puntos
  `radial-gradient(#D5E0DC .5px, transparent .5px)` cada 14 px. Grilla `.92fr / 1.08fr` (574 + 674 a 1440), gap clamp(24, 4vw, 48).
  Cejilla: caja blanca, borde 1 px, sombra xs, 11 px 700 `.06em` mayúsculas, margen de abajo 20,8. h1 Archivo ancho 92, clamp(33.6,
  5vw, 56) / 1.02, 800, `-.032em`, `text-wrap: balance`. Bajada clamp(16, 1.6vw, 18) / 1.55, máximo 44ch. Botón md (42 px, padding 22,
  14,67 del lado del ícono, radio 8, 16 px, etiqueta 600). Nota 12 px `#5A6C67`. «Publica en»: mono 10 px 700 `.09em` y chips de 27,2
  px, radio 7, sombra `0 1px 3px #07120f29`.
- **Marco de selección (`.pn-frame`):** fondo blanco, borde 1 px del color, padding clamp(11.2, 1.5vw, 17.6) (9,6 desde 768);
  pestaña mono 10 / 700 sobre el color, radio 3 3 0 0, a −24 px; cuadraditos de 7 px con borde de 1,5 px a −4 px.
- **Las cuatro láminas (SlideWall):** grilla de 4, abajo alineadas, gap 8,8 (6,4 desde 768); las del medio suben 8 px (no desde
  768); radio 9, sombra sm. **Kit de marca:** borde punteado arriba, 13,6 / 12; mono 10 px; muestras de 16,8 px.
- **Tarjeta negra a lo ancho:** grilla texto | acciones, gap clamp(20, 3vw, 40), padding 20, radio 9. Cejilla mono 11 px 500 `.14em`
  del verde claro; título Archivo clamp(17.6, 2vw, 22.4) 600; texto 14,72 / 1.55 `#9FB4AE`; botones sm (36 px); el comando en mono
  12,48, borde de línea, se bordea del color al pasar el mouse.
- **Franja de prueba social:** blanca, borde 1 px arriba, padding 16,8 / gutter, gap clamp(14.4, 2.5vw, 25.6); textos 12–13 px 700;
  divisor de 1 px (no desde 768); chips de socios con borde, radio 6, 11,5 px 600.
- **Cabecera centrada:** cejilla mono 11 px 700 `.11em` del color; h2 Archivo ancho 92, clamp(25.6, 3.4vw, 37.6) / 1.1, 800,
  `-.026em`; bajada 16 / 1.6, 28 de margen abajo.
- **El editor en su marco:** hasta 819,2 px, padding 9,6; capa del 8 % de tinta que pasa al 18 % con el mouse (`.18s`); el botón
  falso del color con sombra md; debajo, el botón y una pista de 12 px.
- **Plantillas:** 6 columnas desde 1200, 3 desde 768, 2 abajo; gap 16; radio 8; sombra `1px 1px 1px #e4e7ec, 18px 26px 64px -12px
  #10182826`. Debajo un renglón de 17,6 px `#475467` y el botón de línea con flecha.
- **Tres pasos:** título a la izquierda Archivo 600 clamp(28, 3.6vw, 42.4) / 1.1; grilla `auto-fit minmax(240px, 1fr)`, gap
  clamp(24, 3vw, 44); «01» Archivo 32 / 600 del color y su raya; ícono en caja de 32 con borde, radio 9; título 18,4 / 600; texto
  15,68 / 1.6. Botón de línea con flecha.
- **Grupos numerados («01 DISEÑO ——»):** índice mono 12 px 500 `.14em` (el número del color, la palabra en `#384843`) y la raya;
  título Archivo 600 clamp(28, 3.6vw, 42.4); bajada 16,8 / 1.6. Filas de dos columnas, gap clamp(32, 4vw, 64), entre filas clamp(48,
  6vw, 88); la segunda y la cuarta con el marco a la izquierda. h3 clamp(20.8, 2.2vw, 27.2) / 1.2 600; texto 16 / 1.65; lista con
  gap 18,4, tilde en círculo de 18,4 con borde del color, título 16 / 600, texto 15,2 / 1.55.
- **Grilla de celdas:** el fondo es la línea (gap 1 px), borde 1 px, radio 9; 3 columnas, 2 desde 992, 1 desde 560; celda padding
  22,4 / 21,6, título 15,68 / 600, texto 14,4 / 1.55, ícono del color.
- **Tarjetas negras de «Automatizar»:** 4 columnas desde 992, 2 desde 576, 1 abajo; gap 12; padding 16 / 18,4; título Archivo
  ancho 92, 15 / 700; línea mono 12 px del verde claro; texto 13 / 1.5.
- **Testimonios:** columnas (3, 2 desde 1024, 1 desde 768), gap 16; tarjeta gris con borde, radio 9, padding clamp(20, 2.5vw,
  25.6), gap 13,6; texto 15,2 / 1.6; monograma de 37,6 en mono 12.
- **Preguntas:** columna de 768; cada una con borde 1 px, radio 9, 8 entre una y otra; pregunta Archivo ancho 92, 15 / 700
  (14 desde 768), padding 13,6 / 17,6; respuesta 15 / 1.65 con 48 a la derecha (17,6 desde 768).
- **Pie:** blanco, borde arriba, padding clamp(40, 5vw, 64) gutter 0; marca de 240 y cuatro columnas (gap clamp(16, 2.2vw, 32));
  títulos mono 10 / 700 `.11em`; links 13 / 500 que pasan al color; abajo, borde `#E9EFED`, 17,6 de padding, 13 px.

## A 390

h1 33,6; h2 centrado 25,6; títulos de grupo 28; h3 de las filas 20,8; secciones con 56 arriba y abajo y 20 a los costados. El hero en
una columna y centrado (la cejilla con 35,2 arriba), el marco debajo del texto y la tarjeta negra centrada; las láminas sin escalón;
la franja sin divisor; las plantillas en 2; las filas en una con el marco arriba; las celdas en una; las tarjetas negras en una.

## Animaciones y hovers (los suyos)

PostNitro **no anima nada al bajar** ni al cargar (no hay entradas con el scroll: el contenido está quieto). Lo que se mueve:
- **Botón lleno:** al pasar el mouse sólo cambia el fondo un escalón (`#087A68` → `#076C5C`, medido; no sube); al apretar baja 1 px (`.mantine-active`).
- **Botón de línea:** fondo a `#F8F9FA`.
- **Chips de redes:** suben 1 px con sombra `0 3px 8px #07120f38` (`.12s`).
- **El comando de la tarjeta negra:** el borde pasa al color; se copia al tocarlo.
- **El póster del editor:** la capa de 8 % a 18 % de tinta (`.18s`) y el botón falso más oscuro.
- **Tarjetas negras de «Automatizar»:** suben 2 px y el borde pasa al color (`.16s`).
- **Preguntas:** el borde pasa a una mezcla del 45 % del color al pasar el mouse (`.16s`); la abierta lleva el borde del color y la
  flecha girada y del color. Se abre una a la vez; el panel se abre y se cierra en 200 ms (alto y opacidad, `ease`).
- **Links del pie:** pasan al color (`.16s`).
- **Menos movimiento:** todas las transiciones y animaciones a 0,01 ms.
