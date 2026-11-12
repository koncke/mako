# /vsl/agenda — los valores medidos de su referencia

**Referencia:** la portada de iClosed — https://www.iclosed.io/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (es un sitio de Framer: las clases son hash, así que se midió buscando cada pieza por su texto y
por coordenadas). Las líneas grises del marco del hero se midieron por píxel en la captura.
**Diseño copiado en:** `app/vsl/_competencia/disenos/agenda.tsx`. **Contenido:** `app/vsl/_competencia/agenda.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| h1, h2, h3 de tarjetas, números «01» | Poppins | 500, 600 | Poppins de Google Fonts, 500 y 600 (`public/vsl-assets/fuentes/poppins/`) |
| Cuerpo, barra, botones, pestañas, h3 de las tarjetas oscuras | Inter | 400, 500, 600 | Inter variable (`public/vsl-assets/fuentes/inter/`) |

## Escala tipográfica

| Pieza | 1440 | 390 |
|---|---|---|
| Ceja del hero | Inter 14 px / 20, 500, `uppercase`, `#6B7280` | 12 px |
| h1 | Poppins 40 px / 56 px, 500, −0.4 px, `#0A0D14`, ancho 540 | 28 px / 39.2 px |
| Bajada del hero | Inter 18 px / 28, 500, −0.4 px, `#4B5563` | 16 px / 26 |
| Texto chico bajo el botón | Inter 14 px / 16, −0.28 px, `#6B7280` | igual |
| h2 de sección | Poppins 36 px / 50.4 px, 500, −0.4 px, `#0A0D14`; la segunda frase en `#1C64F2` y en su renglón | 28 px / 39.2 px, la frase azul sigue en la misma línea |
| h2 de la banda oscura, de la prueba y del cierre | Poppins 40 px / 50–52 px, 500, blanco o `#171717`; la segunda frase `#76A9FA` | 26 px / 32.5 px |
| Ceja de sección (clara) | Inter 14 px / 20, 500, `letter-spacing` 0.84 px, `uppercase`, `#1C64F2` | igual |
| Ceja sobre oscuro | Inter 12 px / 16, 600, `letter-spacing` 1.44 px, `uppercase`, `#76A9FA`, con un guion de 16 px | igual |
| Bajada de sección | Inter 18 px / 28, `#020418` | igual |
| Pestaña | Inter 14 px / 20, 500, −0.084 px; activa `#000` sobre `#FAFAFA`, inactiva `#737373` | igual |
| h3 del panel | Poppins 18 px, 500, −0.36 px, `#171717`; texto Inter 16 px / 23.04, −0.24 px, `#31353F` | igual |
| Número de paso | Poppins 44 px / 61.6, 600, texto con `linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,.06))` | igual |
| h3 de paso | Inter 20 px / 28, 600, blanco; texto 15 px / 25 `#AAB1C2` | igual |
| h3 de tarjeta de producto | Poppins 18 px / 21.6, 500, −0.4 px, `#111928`; texto Inter 16 px / 28, 500, `#6B7280` | 17 px / 20.4 |
| Barra | links Inter 14 px / 22, −0.14 px, `#31353F`, `padding 8px 16px`; «Login» 15 px / 24 | se pliegan al menú |
| Pie | títulos Inter 14 px / 20, 500, blanco; links 14 px / 22 `#A3A3A3`; texto 14 px / 22 `#D5D7DA`; © 12 px / 16 `#737373` | igual |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Botones primarios | `#0236C2` (borde igual), sombra `rgba(255,255,255,.24) 0 1px 4px 1px inset, rgba(255,255,255,.2) 0 4px 16px 1px`; el de la barra `#0037C2` | `#2F6FED` (borde `#1F57C8`), la misma sombra |
| Palabras resaltadas y cejas | `#1C64F2` | `#2F6FED` |
| Resaltado sobre oscuro | `#76A9FA` | igual (es el celeste de su sistema, no su marca) |
| Caja de la demo y demos de pestañas | `#EBF5FF`, radio 8 | igual |
| Tarjetas de producto | `linear-gradient(163deg, #ECF2FC 0%, #FAFBFE 100%)`, borde `#E5E7EB`, radio 6, `padding` 25 | igual |
| Panel de pestañas | fondo de la zona `#F9FAFB`; tarjeta blanca, borde `#E5E7EB`, radio 4 | igual |
| Banda oscura | `#020418` con bordes `rgba(255,255,255,.06)` y un brillo azul | igual (brillo con `#2F6FED`) |
| Tarjetas de paso | `linear-gradient(rgba(255,255,255,.055), rgba(255,255,255,.02))`, borde `rgba(255,255,255,.09)`, radio 14, `padding 24px 20px` | igual |
| Tarjeta de cifras | artículo `#020418` radio 8 con foto de fondo; caja de cifras `rgba(2,4,24,.52)` + `linear-gradient(148deg, rgba(255,255,255,.14), rgba(255,255,255,.05) 26%, transparent 58%)`, sombra `rgba(255,255,255,.24) 0 1px 0 inset, rgba(255,255,255,.09) 0 0 0 1px`, radio 8 | igual, con el video de Mauricio de fondo |
| Banda del cierre | `linear-gradient(#0A1329, #05091A)`, botón blanco texto `#04072A` con `rgba(118,169,250,.45) 0 12px 40px -12px` | igual |
| Pie | `#020418` | igual |
| Líneas | `#E5E7EB`; barra con borde inferior `#F2F2F2` | igual |

## Contenedores y espacios (1440)

- **Barra:** 64 px de alto, blanca, `padding 14px 0`, contenido de x = 40 a 1400; botón de 36 px de alto, `padding 0 24px`,
  radio 8. (Arriba tiene una barra negra de anuncio de 40 px: no va.)
- **Hero:** marco de 1376 px (x = 32 a 1407) con líneas verticales `#E5E7EB` y una línea abajo; 602 px de alto. Texto en
  x = 40 (540 de ancho), ceja en y = +80; demo en x = 740, 660 × 477, desde y = +61.
- **Pestañas:** `padding-top` 120; el h2 centrado; la fila de pestañas de borde a borde (55 px, bordes arriba y abajo,
  separadores verticales), y la zona gris con `padding` 100 arriba y la tarjeta de 1144 px (x = 148), `padding 16px 24px`,
  480 px de alto; el texto en una columna de 486 y la demo pegada al borde derecho (547 px, radio 4 0 0 4, `padding` 22).
- **Banda oscura:** `padding` 88; texto en x = 40 (520), demo de 660 × 430; tarjetas de 421 × 240 con 56 px entre ellas y
  un «+» en el medio, a 88 px del bloque de arriba.
- **Producto:** `padding` 100 arriba; grilla de 1360 con `gap` 24: tres tarjetas de 437 × 445 arriba y dos más anchas abajo;
  botón centrado a 48 px.
- **Equipo:** el h2 y la bajada (812 de ancho) y la ventana de 1152 sobre un marco con foto de cielo (`padding` 10, radio 8
  arriba), con tres paneles: 260 / el medio `#F9FAFB` / 288.
- **Prueba:** `padding` 100; tarjetas `#F9FAFB` con borde y radio 8; la tarjeta oscura de 1008 × 480 con la caja de cifras de
  254 de ancho a 24 px del borde y la cita abajo a la derecha (Inter 18–20 px, 500, blanco).
- **Cierre:** `padding` 96, todo centrado, h2 de 760 de ancho.
- **Pie:** `padding 100px 40px 80px`; a la izquierda logo, texto de 360 y botones; a la derecha tres columnas de links con
  16 px entre renglones; el © abajo a la izquierda.

## Animaciones (CSS en MaKo)

- Hero: el texto y la demo entran subiendo 16 px con `opacity` (`.8s cubic-bezier(.16,1,.3,1)`).
- Pestañas: el panel nuevo aparece con un fundido de .4s.
- Botones: suben 1 px al pasar; las tarjetitas de demo de las tarjetas de producto suben 4 px.
- `prefers-reduced-motion: reduce` apaga todo.

## Lo que no se copió

La barra negra del anuncio, las tres citas con foto, la fila de logos de clientes, «You already follow them», «Coaches,
agencies, creators», «Drops into the stack you already have», «Build on iClosed», «Book a 5-min demo», las estrellas, el G2,
el «7-day free trial», el lema «Same traffic. More profit.» y el carrusel de casos: no tienen contenido de MaKo. Las fotos de
cielo de sus demos son un degradado azul.
