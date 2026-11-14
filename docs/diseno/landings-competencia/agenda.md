# /vsl/agenda — los valores medidos de su referencia

**Referencia:** la portada de iClosed — https://www.iclosed.io/
**Medido:** 11/11/2026 y OTRA VEZ el 14/11/2026 (la página cambió: ahora el hero es una demo en HTML y hay secciones nuevas). Chromium
(Playwright) a 1440 × 900 y 390 × 844: capturas, video del scroll con una parada en cada sección, `getAnimations()`, MutationObserver,
hovers. Cada sección de iClosed es un componente de código de Framer con su `<style>` dentro del HTML: las medidas de abajo salen de
ahí, no de la captura. Relevo con capturas: carpeta de notas de la sesión, `referencias-landings/agenda/relevo.md`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/agenda.tsx`. **Contenido:** `app/vsl/_competencia/agenda.ts`.
**Pantallas:** banco `C:/dev/bancos-portada/banco-agenda-landing` → `public/vsl-assets/agenda/`.

## Cortes

Por contenedor a **1279** y **809** px (aquí, por ancho de ventana). Contenedor de 1440 con 40 px de margen (20 en el teléfono).

## Movimiento (lo que se copió)

| Pieza | iClosed | Aquí |
|---|---|---|
| Vistas del hero | la que sale: `scale(.97)` origen 32 % 42 %, opacidad 500 ms + transform 550 ms `cubic-bezier(.4,0,.2,1)`; la que entra: opacidad 450 ms, transform 500 ms `cubic-bezier(.2,.8,.2,1)` | igual (script) |
| Pestañas del hero | opacidad ,5 → 1 en 420 ms; la activa con borde 2 px `#76A9FA` | igual |
| Pastilla del hero | `#04072A`, punto `#31C48D`, Inter 13,2 600; entra con opacidad y 8 px en 360 ms | igual |
| Pestañas de «Keep the same funnels» | avanzan solas; barra negra 2 px, `width` 12 000 ms lineal | lo que dura la grabación de la pestaña |
| Lista de la tarjeta | tenue ,4; marcada ,7; la actual 1; el tilde verde `#DEF7EC` entra de `scale(.55)` en 400 ms | igual |
| Conectores de la banda oscura | `stroke-dasharray 6 6`, `stroke-dashoffset` −12 en 1,1 s lineal | igual |
| Pastilla de la banda | `box-shadow` que respira, 2,6 s | igual (azul de MaKo) |
| Pasos (hover) | `translateY(-3px)`, borde `rgba(118,169,250,.38)`, sombra `0 16px 48px -16px`, 200 ms | igual |
| Demos del producto | entran al verse (400–450 ms, escalonadas) | la foto sube 14 px y aparece, 450 ms, 120 ms entre una y otra |
| Botones | `brightness(1.1)` en 150 ms (al apretar ,96); el blanco ,94 | igual |
| Creadores, integraciones, reseñas | marquesinas de 60 s, 44/40 s y 83,7 s | no van (no hay contenido de MaKo) |

## Escala tipográfica (1440 · 390)

| Pieza | iClosed |
|---|---|
| Ceja del hero | Inter 14/20 500 mayúsculas `#6B7280` · 12 |
| h1 | Poppins 40/1,4 500 −0,4 `#0A0D14`, columna de 540 · 36 a ≤1279 · 28 |
| Bajada del hero | Inter 18/28 500 `#4B5563` · 16/26 |
| Texto bajo el botón | Inter 14/16 −0,28 `#6B7280` |
| h2 de sección | Poppins 36/1,4 500 −0,4; la segunda línea `#1C64F2` · 30 (≤1279) · 24–28 |
| h2 de la banda oscura y del cierre | Poppins 40/1,25 500 blanco; la segunda frase `#76A9FA` · 32 · 26–28 |
| h2 de reseñas y casos | Poppins 40/52 `#171717` · 32/44 · 26/36 |
| Ceja de sección | Inter 14/20 500, `letter-spacing` ,84 px, mayúsculas, `#1C64F2` |
| Ceja sobre oscuro | Inter 12/16 600, ,12 em, `#76A9FA`, guion de 18 px |
| Pestaña | Inter 14/20 500 −0,084 `#737373`; la activa negra sobre `#FAFAFA` |
| Título de la tarjeta de pestaña | Inter 18 500 −0,36 `#171717`; texto 16/23,04 −0,24 `#31353F`; lista 14/20 |
| Número de paso | Poppins 44/1,4 600 con degradado blanco ,55 → ,06 |
| Título / texto de paso | Inter 20/1,4 600 blanco · 15/25 `#AAB1C2` |
| Tarjeta del producto | Poppins 18/1,2 500 −0,4 · Inter 16/28 500 `#6B7280` (17 y 15/24 en el teléfono) |

## Colores y cajas

| Qué | iClosed | En MaKo |
|---|---|---|
| Botón primario | `#0236C2`, 203 × 54, radio 8, sombras internas blancas ,24/,2 | `#2F6FED` |
| Palabras resaltadas y cejas | `#1C64F2` | `#2F6FED` |
| Escenario del hero | foto de cielo claro, 660 × 477, radio 8; ventana de vidrio 595 px (`rgba(255,255,255,.2)`, blur 6, borde ,5) | degradado celeste |
| Zona de las pestañas | `#F9FAFB`, 680 de alto; tarjeta 1144 × 480 blanca, borde `#E5E7EB`, radio 4, `drop-shadow(0 0 6px rgba(0,0,0,.12))`, copia de 501, demo `#EBF5FF` | igual |
| Banda oscura | `#020418`, padding 88, tres degradados radiales y la trama de puntos de 26 px | igual (azul de MaKo en los degradados) |
| Pasos | borde `rgba(255,255,255,.09)`, radio 14, degradado ,055 → ,018, línea celeste arriba | igual |
| Tarjetas del producto | degradado `163deg #ECF2FC → #FAFBFE`, borde `#E5E7EB`, radio 6, padding 25, 440 / 416 de alto | igual |
| Cielo de «Your whole team» | foto, 1200 de ancho, padding 24 24 0, radio 8 8 0 0 | degradado azul |
| Tarjeta del caso | 1008 × 480, velo `rgba(2,4,24,.5)`, panel de 254 con vidrio, cita a 302 px | igual, con el video de Mauricio |
| Cierre | `linear-gradient(#0A1329, #05091A)`, padding 96, botón blanco con sombra celeste | igual |

## Lo que no se copió

La barra negra del anuncio, las caras con su globo y el «5/5 on G2», las tres citas, la pared de logos, la pestaña «AI Agent», «You
already follow them», el contador en dólares, «Coaches, agencies, creators», «Drops into the stack you already have», «Build on
iClosed», las estrellas y la marquesina de reseñas, el carrusel de casos con sus flechas y «Book a 5-min demo»: no tienen contenido
de MaKo.
