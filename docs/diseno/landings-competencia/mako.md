# /vsl/mako — los valores medidos de su referencia

**Referencia:** Holo, portada — https://tryholo.ai/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales, más las hojas de estilo de la página (`_next/static/immutable/chunks/*.css`: los tokens
`--text-h*`, `--neutral-*`, `.lp-liquid-text`, `@keyframes seo-fade-in`).
**Diseño copiado en:** `app/vsl/_competencia/disenos/mako.tsx`. **Contenido:** `app/vsl/_competencia/mako.ts`.

## Fuentes

| Uso | Familia en Holo | Pesos | En MaKo |
|---|---|---|---|
| Todo (títulos y texto) | NEXT Book («nextBook», propietaria) | 400, 500, 600, 700 | Figtree (Google Fonts, OFL, variable) |

NEXT Book es de pago. Se probaron ocho de Google al lado (Figtree, Plus Jakarta Sans, Urbanist, Lexend, Outfit, Manrope,
Gabarito, Onest) con «Your Marketing Department.» a 60,64 px: Figtree da 415 px de «Your Marketing» contra los 417 de Holo y
tiene la misma «a» de dos pisos y la «g» de un piso. Vive en `public/vsl-assets/fuentes/figtree/figtree-latin.woff2`.

## Colores

| Qué | Holo | En MaKo |
|---|---|---|
| Fondo de la mitad oscura | `#0A0B14` (`--neutral-onyx`) | igual |
| Texto en lo oscuro | `#F5F6F8` (ice); secundario `#C7C8CE` (pebble); terciario `#94959D` (mist) | igual |
| Mitad clara | `#FFFFFF`; texto `#1F2028` (carbon); secundario `#6D6E76` (ash); gris de la segunda mitad del título `#A5A5AD` | igual |
| Degradado de marca (botones, borde del botón de la barra, número grande) | `linear-gradient(103.56deg, #FF8030 5%, #FF5C2E 16%, #FF4988 32%, #D85FC8 51%, #A878E8 71%, #4F8AE6 86%)` | `linear-gradient(103.56deg, #F2B01E 5%, #F5A623 13%, #5B8EF5 30%, #2F6FED 62%, #1F57C8 90%)`; el número grande, sólo azules |
| Palabra que brilla del título («One Hire.») | `#fff 0–34%` → azul → violeta → rosa → naranja → `#fff 68–100%`, `background-size: 300%`, `8s linear infinite` | `#fff` → azules → dorados → `#fff`, el mismo barrido |
| Segunda mitad de los títulos en lo oscuro | `linear-gradient(#EDEEF2 0%, #B9BAC2 55%, #6D6E76 100%)` recortado al texto | igual |
| Tarjetas inclinadas | `#0E0F1A`, borde `rgba(255,255,255,.12)` | igual |
| Tarjetas de «Proactive» | `rgba(255,255,255,.03)`, borde `rgba(255,255,255,.05)` | igual |
| Tarjeta de resultados | `#0A0B15`, cajas de cifras con borde `#282931` | igual |
| Cajas de «Inside…» | `#F7F7F7` (medido en el píxel) | igual |
| Preguntas | `#F5F6F8` | igual |
| Pie | `#FAFAFA` | igual |

## Contenedor y espacios

- Contenedor: `max-width: min(1080px, 100% - 80px)`, centrado (x = 180 a 1440). A 390: 24 px a cada lado (342 de ancho).
- Secciones: `padding: 96px 24px` (las de «Proactive» 96/80, «How it works» 96/64, la de resultados 40/96). A 390: 64 px.
- Las preguntas usan un contenedor de 1032 px (x = 204).

## Escala tipográfica (1440 → 390)

| Nivel | Tamaño | Interlineado | Tracking | Peso |
|---|---|---|---|---|
| Hero h1 | 60,64 → 31 px | 69,55 → 35,65 | −0,8 px | 700 |
| Título de sección (`text-h2`) | 36,8 → 35,9 px | 42,32 → 41,29 | −0,552 px | 700 |
| «Doubling down…» | 52 → 41,44 px | 58,24 → 46,41 | −0,5 px | 700 |
| Títulos de «Any niche» | 44 → 28,24 px | 50,6 → 32,48 | normal | 700 |
| Número grande («0 %») | 88 → 71,8 px | 88 | normal | 700 |
| Título de paso / de tarjeta blanca | 22 px | 28,6 | −0,11 px | 700 |
| Título de tarjeta inclinada | 21 px | 26,25 | normal | 700 |
| Bajada del hero | 17 → 15,5 px | 23,375 → 21,31 | normal | 600 |
| Texto | 18 px | 23,4 | normal | 400 |
| Texto de «Proactive» | 16,32 → 15 px | 20,4 → 18,75 | normal | 700 |
| Preguntas y respuestas | 14 px | 18,9 | 0,14 px | 700 / 400 |
| Encabezado de columna del pie | 11 px, mayúsculas | 14,3 | 1,54 px | 600 |
| Links del pie | 15 px | 19,5 | normal | 400 |

## Barra

`position: fixed`, `top: 0`, `z-index: 80`, `padding: 12px 24px 0`. Tres píldoras de 44 px de alto, centradas, 8 px entre
ellas: el logo (113 px, `padding: 0 14px`, fondo `#0A0B14`, borde `1px rgba(255,255,255,.14)`), los links (543 px,
`padding: 0 32px`, `gap: 28px`, 15 px 700 `#F5F6F8`, mismo borde) y el botón (119 px, `padding: 0 20px`, borde de 1 px con el
degradado de marca: `linear-gradient(#0A0B14,#0A0B14) padding-box, <degradado> border-box`). A 390: sólo el logo a la
izquierda y el botón a la derecha (`padding: 12px 16px 0`). En MaKo la píldora de los links lleva fondo `#0A0B14` (en Holo
es transparente y la cambia un script al pasar por lo blanco).

## Hero

- `padding: 80px 24px 24px` sobre `#0A0B14`. Grilla `487.44px 560.55px`, `gap: 32px`, `align-items: center`, `margin-top: 24px`.
- La píldora de arriba: 38 px de alto, `padding: 6px 14px 6px 8px`, borde `1px rgba(255,255,255,.22)`, 12,5 px `#C7C8CE`.
- h1 a 24 px de la píldora, con `<br>` puestos; bajada a ~20 px, `max-width: 336px`; botón a 28 px; los dos renglones de
  confianza a 20 px (icono de 24 + 12, título 13,5/700, bajada 13/400 `#C7C8CE`, 32 px entre los dos).
- La ilustración mide 647 × 485 y arranca 86 px adentro de la columna del texto. Sus chips: `padding: 10px 16px`, radio 12,
  `rgba(10,11,20,.55)`, borde `1px rgba(255,255,255,.2)`, título 14/700, bajada 11,5 `#C7C8CE`.
- Entrada: `seo-fade-in` = `0% { opacity: 0; transform: translateY(16px) }`, `.7s cubic-bezier(.16,1,.3,1)`.
- A 390: `padding: 72px 24px 56px`, la ilustración arriba (342 × 257), el botón DEBAJO de la ilustración y antes del h1,
  todo centrado, y los dos renglones de confianza en dos columnas con el icono arriba.

## Botón

`height: 50px`, `padding: 10px 10px 10px 20px`, `border-radius: 9999px`, degradado de marca, brillo
`box-shadow: inset 0 0 10px rgba(255,255,255,.85)`, texto 17,2 px 700 `#FBFBFB`, flecha a la derecha. El chico del cierre:
42 px, `padding: 8px 8px 8px 20px`, 15 px.

## Secciones

| Sección de Holo | Medidas | En MaKo |
|---|---|---|
| «Ads that sell…» | 4 tarjetas de 264 × 462 (sin girar), `padding: 20px 20px 0` (A 390: 32 20 0), radio 26; giradas −4°, +2,5°, −2°, +3,5° con 0 / 21 / 7 / 26 px de caída; 7 px entre ellas; icono de 47 px, título 21 px a 12 | las tres capacidades de `filas`, con su gráfico de `FEATURE_VISUALS.mako` abajo en blanco; a 390 un carrusel |
| «How it works?» | título 346 px a la izquierda, texto 380 px a la derecha (18 px `#C7C8CE`); cinco pasos alrededor de un centro, rótulo 22 px y tarjeta blanca de radio 12 | los tres pasos en triángulo, la tarjeta blanca con el texto; aros de 260 / 470 / 680 px en lugar de su video |
| «Proactive. No prompt needed.» | título + botón en la misma fila; grilla de 2 × 524 px, 32 de espacio; tarjeta 325 px, radio 19,59, sombra `inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.3)`; píldora blanca de 34 px, radio 10,4, icono de 34, texto 17,96/700 `#16171D`; texto 16,32/700 a 73 px del borde | las seis sugerencias; abajo a la derecha el icono de cada una sobre un halo azul o dorado (en lugar de su muñeco y su gráfico) |
| «Real customer results» | texto 22/500 de 260 px, línea, número de 88 px con degradado, barra de 12 px `rgba(255,255,255,.16)`; tarjeta radio 24 con cabecera 16/700, tres cajas de cifras (13/700 + 28/400), gráfico y pie 20/700 `padding: 16px 20px 20px` | el caso de Mauricio: su titular, «+$40k en junio», sus tres meses, su video y su historia, y «Sin cambiar la oferta…» en el pie |
| «Any niche / language / integration» | tarjetas blancas de 1080, `padding: 64px` (A 390: 32 28), radio 28, sombra `inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.06)`, borde `rgba(16,17,26,.05)`; grilla 496,66 / 397,34 con 56; búsqueda de 53 px y píldoras de 42 (17/700, `padding: 10px 20px`) | las tres de «Hecho para tu negocio», con su segunda mitad gris; las píldoras dicen lo que tiene tu Second Brain, los roles y dónde le escribes |
| «Early signals… / Doubling down on what works» | título 52 px de 558, texto de 360 a la derecha; curva sobre líneas punteadas; cuatro pestañas de 270 con borde superior y 15 px `#6D6E76` (la activa `#1F2028` y la línea rosa) | «Cuanto más lo usas»: tres pestañas con su texto debajo, la curva en azul → dorado |
| «Inside your new marketing department.» | título a la izquierda; cajas de 400 × 460, radio 16, `#F7F7F7`, 20 de espacio, que siguen fuera de la pantalla; leyenda 18 px «**Título.** texto» `#6D6E76`; debajo tarjetitas blancas de 330 × 151, `padding: 24px`, radio 16, píldora de 36 px con icono y 15/700, texto 14/22,75 | tres capacidades en el carrusel (con la pantalla de MaKo de cada una adentro) y las otras tres en las tarjetitas |
| «With great powers comes great privacy.» | fondo `linear-gradient(#fff 0%, #fff 90px, #F5F6F8 340px, #F5F6F8 100%)`; título centrado de 439 px; tres tarjetas de 349, 16 de espacio, `padding: 28px`, radio 28; icono de 32 px, título 22/700, texto 18 `#6D6E76` | «Tus datos y tus decisiones, tuyos» |
| «Skeptical? Good. Read this.» | contenedor 1032; título de 351 + botón; preguntas `#F5F6F8` radio 12, `padding: 20px 24px`, 12 de espacio, chevron de 14; respuesta `padding: 0 24px 20px`, `max-width: 768px` | las seis preguntas en `<details>` |
| Cierre «Approve your first week…» | `padding: 144px 24px 288px` (A 390: 80 24 224); título centrado de 570; caja con el texto gris 17/24,65 `#9A9BA3` y el botón chico abajo a la derecha; cuatro etiquetas con flecha de cursor (14/500, `padding: 6px 12px`) | «¿Lo quieres andando en tu negocio?» con el texto de la banda de la llamada de /vsl; las etiquetas dicen CRM, WhatsApp, Llamadas y Second Brain |
| Pie | `#FAFAFA`; la marca a la izquierda (x = 40, texto 15/21,75, 260 de ancho); columnas de 280 en x = 512 / 816 / 1120; encabezado 11 px mayúsculas; links 15 px; fila de abajo con la línea y 14 px `#6D6E76` | las 18 otras funciones en tres columnas bajo «Funciones» |

## Lo que no se copió

La píldora de calificación, la tira de redes con su contador, los sellos de seguridad, «Holo runs your…» con sus tres
columnas, el carrusel de anuncios con 87 % / 11x / 23 h / 51 %, los testimonios, los premios G2, los inversores, la tarjeta
de soporte 24/7, los muñecos de Holo y las flechas del carrusel (piden JavaScript): ver la cabecera de `disenos/mako.tsx`.
