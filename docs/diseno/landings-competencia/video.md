# /vsl/video — los valores medidos de su referencia

**Referencia:** Cherry Studio, editor de reels con IA — https://cherrysweet.app/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales. La portada tiene dos variantes del hero (una con su video amarillo entre el titular y los
botones, otra con un párrafo en ese lugar): se midieron las dos.
**Diseño copiado en:** `app/vsl/_competencia/disenos/video.tsx`. **Contenido:** `app/vsl/_competencia/video.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares, números, calcomanías | Outfit | 800, 900 | la misma (Google Fonts, OFL, variable) |
| Texto, botones, preguntas | Space Grotesk | 400, 500, 700 | la misma (variable 300–700) |
| Cejillas, chips del comparador | DM Mono | 500 | la misma |
| Notas a mano («toca cada paso», «arrástrame») | Caveat | 700 | (no va: son pistas de sus controles) |

Viven en `public/vsl-assets/fuentes/{outfit,space-grotesk,dm-mono}/`.

## Colores

| Qué | Cherry | En MaKo |
|---|---|---|
| Fondo de la página | crema `#ECE3DD` | igual |
| Paneles | `linear-gradient(#FFFFFF, #FBF7F4)` + `radial-gradient(120% 90% at 78% 72%, rgba(20,12,17,.05), transparent 60%)`, borde 1 px `rgba(20,12,17,.09)` | igual |
| Tinta | `#140C11`; texto secundario `rgba(20,12,17,.68)`; nota `rgba(20,12,17,.48)` | igual |
| Marca | rosa `#FF2D8A` (pastilla del titular, palabras resaltadas, número abierto, banda rasgada, × y +) | azul `#2F6FED` |
| Banda rasgada | `radial-gradient(90% 70% at 20% 0%, #FF5AA3, transparent 60%), linear-gradient(160deg, #FF2D8A, #D8156E)` | `radial-gradient(… #6E9BF5 …), linear-gradient(160deg, #2F6FED, #1F57C8)` |
| Hoja de calcomanías | `#FFF6FA` | `#F6F9FF` |
| Botón principal | negro `#140C11`, texto crema `#ECE3DD` | igual |
| Comparador | `#140D12`; lado «con» `linear-gradient(#172019, #0F1511)` y verde `#6ED49C` | igual (el chip del lado «sin», en azul) |
| Calcomanías («pega») | negra `#0B0709`, crema `#F4ECE7`, verde `#6ED49C`, rosa | negra, crema, azul y dorado `#F2B01E` |

## Contenedores y espacios (1440)

- **Página:** `body` con padding 0 / 24 / 60; `main` de 1160 px centrado (márgenes de 116 px), en grilla con gap 16.
- **Barra:** píldora de 1160 × 58, radio 999, padding 9 10 9 18, gap 10, con el mismo fondo y sombra de los paneles;
  links 14 / 14 500 `rgba(20,12,17,.68)` con padding 10 12 y radio 999; botón negro 14 / 14 500, padding 12 18.
- **Panel:** radio 30; sombra `inset 0 1px 0 rgba(255,255,255,.9), 0 1px 0 …, 0 26px 50px -26px rgba(70,40,50,.22)`.
- **Hero:** padding 64 40 0, todo centrado, gap 16. Cejilla DM Mono 10.5 / 12.6 500, 1.47 px, mayúsculas, con una
  trama de puntos al costado. h1 Outfit 60 / 58.8 900, -2.7 px, 852 px de ancho; la marca dentro de una pastilla rosa
  inclinada (radio 14, sombra de color). Video de 780 × 439, radio 20, sombra `0 26px 50px -24px rgba(50,20,35,.65)`.
  Botones: negro (padding 17 26, 16 / 16 700, radio 999) y de línea (borde 1 px `rgba(20,12,17,.22)`). Nota 13 / 17.55.
  Al pie, tarjetas inclinadas de 245–272 × 299–320 (radio 22) con calcomanías encima (padding 11 15 12, radio 12, anillo
  blanco de 4 px, sombra `0 10px 18px rgba(70,40,50,.28)`).
- **«Lo que hace»:** padding 48 48 48 36, grilla de 569 px + el resto, gap 26 / 40. h2 Outfit 58 / 52.2 900, -2.61 px.
  Lista: botones de 569 px, radio 22, padding 14 14 14 10, gap 14; el activo blanco con borde y sombra
  `0 14px 28px -20px rgba(70,40,50,.22)`; título Outfit 21 / 22.05 900 -0.42 px; texto 14.5 / 21. A la derecha, el video
  de 360 × 450, radio 30, con su calcomanía.
- **Comparador:** panel con padding 40 / 44, gap 12; párrafo 15 / 22.5. Caja oscura de 1070 × 240, radio 22, borde 1 px
  blanco al 9 %, dividida en dos; chips DM Mono 10.5 500, 1.26 px, padding 7 9, radio 8.
- **Banda rasgada:** 1160 px, padding 44 40 36, borde de papel rasgado arriba y abajo, trama de lunares; h2 Outfit 66 /
  59.4 900 -2.97 px negro, 580 px. Hoja: radio 28, padding 22 16 20, sombra `0 30px 60px -24px rgba(90,0,40,.7)`; cuatro
  calcomanías en fila (gap 16 / 12), rótulo negro Outfit con anillo blanco de 4 px, texto 13.5 / 18.2 500.
- **Tres pasos:** tarjeta de 477 px, padding 24 / 22, gap 16; h2 Outfit 42 / 39.5 900 -1.89 px; números en cuadros negros
  (el segundo rosa); título Outfit 18 / 20.7 800; texto 14 / 21; botón negro a todo el ancho (50 px).
- **Preguntas:** cabecera suelta (padding 28 6 2), h2 62 / 55.8; panel con padding 8 / 32 y dos columnas de `<details>`
  (527 px, gap 40), abiertas las dos primeras; pregunta 15.5 / 20.9 700 con padding 17 0; respuesta 14.5 / 21.75.
- **Banda final:** rasgada, padding 70 40 60; cejilla; h2 Outfit 92 / 81 900 -4.6 px, 746 px; texto 16 / 24 500; botón
  negro; tres tarjetas inclinadas cortadas por el borde de abajo; calcomanías a los costados.
- **Pie:** centrado, padding 26 8 0, gap 14: logo, fila de links 14 / 21 `rgba(20,12,17,.68)` (gap 6 / 16), textos 12.5 /
  18.75 `rgba(20,12,17,.48)`.

## A 390

- `body` con padding 16; barra de 54 px sin los links (sólo «Entrar» y el botón 13.5 px).
- h1 34 / 33.3 -1.53 px; h2 35.1 / 31.6 -1.58 px; h2 de la banda 39 / 35.1; de la tarjeta de pasos 31.2 / 29.3; de las
  preguntas 37 / 33.3; de la banda final 46.8 / 41.2 -2.34 px.
- Paneles con padding 26 / 18–20. Todo en una columna; la hoja de calcomanías en dos columnas; preguntas en una.

## Animaciones

Cherry anima la entrada de los paneles al hacer scroll (con JavaScript) y las calcomanías al pasar el mouse. En MaKo: el
hero y «Lo que hace» suben 16 px al cargar (nada arranca invisible), las calcomanías se enderezan al pasar el mouse, los
botones suben 2 px, y el + de cada pregunta gira a ×. Todo apagado con `prefers-reduced-motion`.
