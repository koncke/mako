# /vsl/prioridades — los valores medidos de su referencia

**Referencia:** Motion, portada — https://www.usemotion.com/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (las clases de Tailwind de cada nodo vienen en el mismo volcado: `font-display`, `text-5xl`,
`from-[#6a86e3] to-[#4064dd]`…).
**Diseño copiado en:** `app/vsl/_competencia/disenos/prioridades.tsx`. **Contenido:** `app/vsl/_competencia/prioridades.ts`.

## Fuentes

| Uso | Familia en Motion | Pesos | En MaKo |
|---|---|---|---|
| Títulos (`font-display`) | Albert Sans | 600 (el cierre, 700) | Albert Sans, la misma (Google Fonts, OFL, variable) |
| Texto, botones, links | Inter | 400, 500, 600 | Inter, la misma (variable) |

Motion las carga de `fonts.bunny.net` (`albert-sans:400,500,600,700,800|inter:400,500,600,700`). En la nube ese dominio no
responde, así que en las capturas de la referencia los títulos salen con la letra de respaldo (parecida a Arial): la página real
usa Albert Sans. Las de MaKo viven en `public/vsl-assets/fuentes/albert-sans/albert-sans-latin.woff2` y
`public/vsl-assets/fuentes/inter/inter-latin-var.woff2`.

## Colores

| Qué | Motion | En MaKo |
|---|---|---|
| Fondo | `#FFFFFF`; texto `#000`; secundario `#495161`; links de la barra `#475467`; títulos de columna `#101828` | igual |
| Fondo del hero | `linear-gradient(125deg, rgba(115,103,240,.05), rgba(78,205,196,.05), rgba(115,103,240,.08), rgba(78,205,196,.05), rgba(115,103,240,.05))` | el mismo dibujo con el azul `rgba(47,111,237,…)` y el dorado `rgba(242,176,30,…)` |
| Botón | `linear-gradient(#617FE3, #3E63DD)` | `linear-gradient(#5B8EF5, #2F6FED)` |
| Palabras resaltadas del titular | `linear-gradient(80.74deg, #D874FE 9.74%, #5E8DFE 93.68%)` recortado al texto | `linear-gradient(80.74deg, #7FA6F7 9.74%, #2F6FED 93.68%)` (dorado con azul se ensucia en el medio) |
| Línea de arriba del titular | degradado azul recortado al texto | `linear-gradient(#5B8EF5, #2F6FED)` |
| Columna «con IA» | degradado rosa-violeta | `linear-gradient(122deg, #8FB2F8, #5B8EF5 35%, #2F6FED 72%, #1F57C8)` |
| Columna de siempre | `#F0F4F8`, título `#6F7788`, íconos `rgba(71,84,103,.5)` | igual |
| Tilde de la columna «con IA» | círculo `#CDF0DD` | igual |
| Acordeón abierto | fondo `#F1FAFF`, borde izquierdo 4 px `#469FE7` | fondo `#F1F7FF`, borde `#2F6FED` |
| Acordeón cerrado | borde izquierdo 1 px `rgba(16,24,40,.1)`, título `#848B97` | igual |
| Ventana de producto | celeste `#E5F5FF → #DFEDFF`, radio 12 | igual |
| Tarjeta de los casos | `linear-gradient(to right bottom, #5893EA, #2C77E7)` | `linear-gradient(to right bottom, #5B8EF5, #2F6FED)` |
| Renglones de «Why…» | `#EEF5FF`, tilde en círculo azul | igual, tilde `#2F6FED` |
| Panel de integraciones | `#F7F8FB` | igual |
| Título del cierre | `linear-gradient(#6A86E3, #4064DD)` recortado al texto | `linear-gradient(#5B8EF5, #2F6FED)` |
| Sección después del hero, cierre, pie | `linear-gradient(#EEF5FF 0%, white 200px / 50% / 120px)` | igual |

## Contenedor y espacios

- Contenedor de 1200 (x = 120 a 1440), con 32 de relleno a los lados del envoltorio; a 390, 16.
- Barra: 96 de alto (24 0), por encima del hero; links con 12 de relleno, 16 / 24, 500.
- Hero: 96 arriba; la línea de arriba en y = 183; tarjeta del hero 76 debajo del botón.
- Secciones: 64 0 (`py-16`); la de después del hero, 80 arriba. Entre una función y la siguiente, ~128 (el botón de la función
  termina ~164 px antes del título siguiente).
- Cierre: 96 32. Pie: 96 32.

## Escala tipográfica (1440 → 390)

| Pieza | 1440 | 390 |
|---|---|---|
| H1 | Albert 88 / 96,8, 600, -2,2 px, ancho 783 | 31,2 / 34,32, -0,78 px |
| Línea de arriba del H1 | 16 / 32, 600, -0,4 px | igual |
| Bajada del hero | Inter 18 / 28, ancho 900 | 16 / 24 |
| Título de una función («AI Task Planner») | 60 / 75, 600, -0,3 px, 64 abajo | 28 / 38,5 |
| Títulos de los casos y de integraciones | 48 / 60, 600, -0,3 px | 28 / 38,5 |
| «Stop using…» y «Why…» | 34 / 46,75, 600, -0,3 px | 28 / 38,5 |
| Título de la tarjeta del hero | 24 / 32, 600, -0,6 px | 20 / 28 |
| Título de un acordeón y de una columna | 20 / 28, 600 | igual |
| Texto de un acordeón | 14 / 20 | igual |
| Título de una tarjeta de caso | 24 / 32, 600, blanco; texto 14 / 22,75 | igual |
| Cierre | 64 / 80, 700, -1,92 px | 40 / 48 |
| Pie: encabezado / links | 16 / 24, 600 `#101828` / 16 / 24 `#495161`, 8 0 | igual |

## Piezas

| Pieza | Motion | En MaKo |
|---|---|---|
| Botón | 48 alto, 12 20, radio 8, Inter 16 / 600 blanco, sombra `0 2px 5px rgba(0,0,0,.2), inset 0 0 0 1px rgba(0,0,0,.1), inset 0 2px 0 rgba(255,255,255,.2)` | igual, con el texto de la llamada |
| Tarjeta del hero | 1200 de ancho, 32 de relleno, radio 12, sombra `rgba(105,124,229,.05) 0 -4px 80px, rgba(105,124,229,.14) 0 2px 32px, inset 0 0 0 1px #F1F2F4`; grilla 368 \| 736 con 32 | igual (sombra en el azul de MaKo); a la izquierda «Cuatro vistas en un tablero» con una casilla por vista, a la derecha el visual del Plan |
| Casillas | 178 × 80, radio 8, 12 de relleno, borde `#EDEFF0`; ícono en caja 28 `#EEF5FF`, 14 / 500 `#495161` | igual |
| Columnas «normal / con IA» | 588 + 588 con 24; radio 24, 0 8 8; adentro blanco radio 16, 24 de relleno; renglones con 12 entre ícono y texto y 16 abajo | igual; a 390 apiladas, radio 12 |
| Funciones | grilla 460,8 \| 691,2 con 48, alternando el lado; acordeón con el abierto en celeste; ventana a la derecha (en el teléfono, ADENTRO del abierto) | igual; la ventana vive adentro de cada `<details>` y en la computadora se ubica en la columna de al lado |
| Tarjeta de caso | imagen arriba radio 12 12 0 0, panel azul 16 de relleno | una tarjeta a lo ancho: el video de Mauricio a la izquierda (16:9) y el panel azul a la derecha |
| «Why…» | grilla 493,7 \| 658,3 con 48; título, botón; renglones `#EEF5FF` radio 6, 16, 8 entre ellos | igual |
| Integraciones | panel `#F7F8FB` radio 32, 48 arriba; baldosas 94 × 94, 16, blancas radio 8, sombra `rgba(61,98,208,.06) 0 2.34px 14.02px`, 40 entre ellas; nombre 14 / 500 `#475467` | igual, con los tres logos de la landing |
| Pie | logo a la izquierda, columnas en x = 520 / 787 / 1053 de 267 | igual, con las otras landings de función |

## Lo que no se copió

Su logo y su nombre; sus capturas y videos de producto (en su lugar, los visuales de MaKo de `FEATURE_VISUALS` y ventanas
propias del Plan); el premio de Amplitude; «Over 1 million top performers» y sus logos; las cuatro citas; las reseñas de
usuarios; las fotos y textos de sus casos; «Motion replaces…»; «Enterprise Grade Security»; los logos de prensa; la nota de
prueba gratis debajo de cada botón; las funciones que MaKo no tiene (calendario hora por hora, flujos desde un SOP, API).
