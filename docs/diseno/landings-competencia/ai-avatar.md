# /vsl/ai-avatar — los valores medidos de su referencia

**Referencia:** HeyGen, «Anuncios de video estilo UGC» (es-MX) — https://www.heygen.com/es-mx/business/marketing/ugc-video-ads
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales. A 390 la página de HeyGen se desborda (el documento mide 444 px de ancho): la de MaKo no.
**Diseño copiado en:** `app/vsl/_competencia/disenos/ai-avatar.tsx`. **Contenido:** `app/vsl/_competencia/ai-avatar.ts`.

## Fuentes

| Uso | Familia en HeyGen | Pesos | En MaKo |
|---|---|---|---|
| Titulares, miga de pan, números, pastillas «Paso N» | ABC Solar Display (Dinamo, de pago) | 700 | Gabarito 900, `letter-spacing: -0.04em` (Google Fonts, OFL, variable) |
| Texto, botones, links, preguntas | TT Norms Pro (TypeType, de pago) | 400, 450, 500, 700 | Figtree (Google Fonts, OFL, variable) |

Las dos son de pago: se eligieron las de Google más parecidas (Gabarito por la forma redonda y apretada del titular;
Figtree por el ojo y el ancho de TT Norms). Viven en `public/vsl-assets/fuentes/gabarito/` y `public/vsl-assets/fuentes/figtree/`.

## Colores

| Qué | HeyGen | En MaKo |
|---|---|---|
| Fondo de la página | `#FFFFFF` | igual |
| Texto | `#171717`; titulares `#1A1A1A`; texto secundario `#333` | igual |
| Botones de marca | cian `#00C3FF`, texto `#033337` | azul `#2F6FED`, texto blanco (hover `#1F57C8`) |
| Botón del hero | negro `#000`, texto cian | negro, texto azul claro `#6E9BF5` |
| Botón gris de la barra («Contactar a ventas») | `#D9D9D9`, texto negro | igual («Funcionalidades») |
| Borde de la barra | degradado cian → rosa | degradado azul → dorado |
| Miga activa, tildes | cian | azul |
| Banda de los números | `#F2F2F2`, radio 70 | igual |
| Tarjetas de los números | `#1A1A1A`, radio 24 | igual |
| Tarjetas de filas y pasos | crema `#FDFBF9`, radio 80 | igual |
| Pastilla «Paso N» | fondo `#DFF8FF`, texto cian | fondo `#E4EDFD`, texto azul |
| Paneles de imagen | cian / rosa / verde pastel (dentro de la imagen) | azul `#DCE8FD`, dorado `#FBEFD3`, gris `#EDF0F5` |
| Título del testimonio | verde petróleo `#033337` | tinta `#12151B` |
| Tarjetas de preguntas | `#F2F2F2`, radio 20 | igual |
| Banda final | degradado cian `#67D5FF` con un trazo rosa | degradado azul `#6E9BF5` → `#8FB2F7` con un trazo dorado claro |
| Pie | `#000`, línea `#333` | igual |

## Contenedores y espacios (1440)

- **Barra:** caja flotante de 1272 px (x = 84), a 16 px del borde, radio 28, blanca al 70 % con desenfoque; padding
  16 / 32, gap 16. Links 18 px 400 (botón 500, -0.18 px). Botones de 40 px de alto, radio 12, padding 0 16, 18 px 700,
  -0.36 px.
- **Miga:** ABC Solar 15 px / 22.5, flechas «→», el último paso en el color de marca.
- **Hero:** dos columnas de 583 px (x = 100 y x = 758). h1 68 / 72, 700, `#1A1A1A`; 30 px de la miga al h1 y del h1 a la
  bajada (18 / 23.4, 450, -0.36 px); dos renglones con tilde (16 / 24, padding 5 0, gap 8 entre tilde y texto, 10 entre
  renglones); el botón negro 30 px abajo. El video a la derecha: caja negra con radio 24.
- **Banda de números:** ancho completo, `#F2F2F2`, radio 70, padding 100 / 28. Tres tarjetas de 448 × 122 con gap 20,
  `#1A1A1A`, radio 24, padding 24; número ABC Solar 44 / 44 700 blanco; rótulo 18 / 18 500, -0.18 px. Debajo, la cinta de
  logos y un renglón de 16 px con una línea fina hasta el borde.
- **Secciones:** padding 120 / 20 (contenido de 1400 px). Encabezado: h2 60 px (renglones de 63), 700, `#171717`, hasta
  780 px de ancho; bajada 18 / 25.2, -0.16 px, 600 px de ancho, 30 px debajo; el botón alineado abajo a la derecha; 75 px
  hasta lo que sigue.
- **«Sin / Con»:** dos tarjetas de 690 px, gap 20, borde 1 px negro al 10 %, radio 22, padding 30, gap interno 40.
  Pastilla: borde 1 px negro al 10 %, radio redondo, padding 10 15, 14 / 14. h3 40 / 40. Texto 16 / 22.4, `#333`.
- **Filas de capacidades:** tarjetas de 1400 px, `#FDFBF9`, radio 80, padding 50, 75 px entre una y otra. Dos columnas de
  625 px con gap 50; imagen de 625 × 406; h2 50 / 60 `#000`; texto 16 / 22.4, 30 px debajo; el botón «Empieza gratis →» al
  pie de la columna de texto. La imagen alterna: izquierda, derecha, izquierda…
- **Pasos:** tarjetas de 1400 × 450, `#FDFBF9`, radio 80, 50 px entre una y otra; imagen de 625 px (una foto inclinada
  unos -10°); texto con padding 20 / 50 y gap 10: pastilla «Paso N» (ABC Solar 15 / 22.5 700, padding 6 12, radio 80),
  h2 30 / 37.5, texto 16 / 22.4, botón.
- **Casos de uso:** grilla de 3 columnas de 411 px (gap ~80), 75 px entre filas; ícono de 36 px; h3 ABC Solar 24 / 32
  700, 13 px debajo del ícono; texto 16 / 22.4 450.
- **Reseñas de G2:** estrellas, h2 32 / 48 centrado, cuatro tarjetas con borde `#D9D9D9` radio 20, insignias. (No va.)
- **Testimonio:** h2 70 / 77 700 `#033337`, 842 px; bajada 18 / 23.4 500, -0.45 px, `rgba(22,22,22,.7)`. Tarjeta de 1208 px,
  borde 1 px negro al 20 %, radio 40: el texto a la izquierda (482 px, padding 50: nombre 24 / 30 800 -0.6 px, cita 14 / 20,
  firma 14 / 20 con 20 px arriba) y el video negro a la derecha (724 px). Flechas cian de 48 × 40 y tres puntos (no van).
- **Preguntas:** título a la izquierda (x = 111, 350 px, 40 / 40, 0.4 px, `#333`); a la derecha tarjetas de 745 px,
  `#F2F2F2`, radio 20, padding 30, gap 20, abiertas (sin acordeón): pregunta 18 / 25.2 500 -0.14 px negro, respuesta 16 / 22.4
  `#333` 20 px debajo.
- **Explora más soluciones:** h2 60 centrado y tres columnas de links centrados. (No va: las funciones van en el pie.)
- **Banda final:** ancho completo, radio 40, 636 px de alto; contenido de 1280 px con padding 100 / 130, centrado: h2 60 / 60,
  550 px; texto 16 / 22.4 con padding 20 0 30; botón; tres tildes en fila (gap 6 / 32). El pie negro asoma 50 px debajo de
  las esquinas.
- **Pie:** negro; la miga en blanco arriba; logo de 132 px en x = 84; columnas de 146 px desde x = 297 (gap 6), título
  14 / 21 700 0.35 px en mayúsculas, links 14–16 px gris; línea `#333` con padding 50 arriba y «Derechos de autor» 14 / 21
  700.

## A 390

- Barra sin caja: logo, el botón de marca y la hamburguesa.
- h1 40 / 48; h2 de sección 44 (renglones de 46); h2 de fila 44 / 52.8; h2 de paso 30 / 37.5; testimonio 35 / 38.5;
  preguntas 30 / 30, respuestas 14 / 19.6; banda final 32 / 32.
- Todo en una columna: la imagen de cada fila va DEBAJO del texto; en los pasos, arriba. Las tarjetas de números, una
  debajo de otra. Secciones con padding 100 / 20; encabezados con 15 px más de sangría.
- Pie: columnas de a dos.

## Animaciones

HeyGen no anima la entrada de las secciones (el video del hero y la cinta de logos se mueven solos). En MaKo: el hero sube
14 px al cargar, el panel de cada fila y la pieza de cada paso se mueven un poco al pasar el mouse, y los botones cambian de
tono. Todo con CSS y apagado con `prefers-reduced-motion`.
