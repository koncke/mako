# /vsl/competitor-spy — los valores medidos de su referencia

**Referencia:** la portada de Foreplay — https://www.foreplay.co/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (árbol completo hasta 22 niveles), sus `::before`/`::after`, los elementos de 1 px (los filetes del
pie) y el estado `:hover` de botones, links, pestañas y menús (leído pasando el mouse por encima). Desde ese día la red deja
cargar `cdn.prod.website-files.com` y `publicassets.foreplay.co`, así que la página se ve entera (con su CSS de Webflow).
**Diseño copiado en:** `app/vsl/_competencia/disenos/competitor-spy.tsx`. **Contenido:** `app/vsl/_competencia/competitor-spy.ts`.

## Fuente

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Títulos (h1, h2, h3, h4) | «Inter Display» (Inter con el corte de display) | 600 | `public/vsl-assets/fuentes/inter/inter-latin-opsz-var.woff2` (Inter variable con eje óptico) con `font-variation-settings: 'opsz' 32` |
| Todo lo demás | «Inter» | 400, 500, 550, 600 | el mismo archivo con `'opsz' 14` (el corte de texto). El peso 550 de botones y sobrelíneas sale del eje `wght` |

Los títulos llevan `text-wrap: balance` (h1, h2, h4 y los párrafos de cabeza); el h3 de las filas, `wrap`.

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Fondo de la página | `#020308` (rgb 2 3 8) | igual |
| Texto base (body) | `rgba(255,255,255,.36)` | igual |
| Blancos de texto | titular `.88` con `radial-gradient(circle at 50% -100%, #fff, rgba(255,255,255,.88))` recortado al texto; bajada del hero `.84`; párrafos de cabeza `.68`; sobrelínea de cabeza `.36`; sobrelínea de fila `.84`; sobrelínea del hero `.68`; links de la barra `.52` (hover `.84`); pestaña apagada `.44` (activa y hover `#fff`); links del pie `.68` (hover `#fff`); legal `.36` | igual |
| Botón principal | fondo `#fff`, texto `#090A0E`; hover `rgba(255,255,255,.84)`; el de la barra, hover `#DDDEE5` (transición .6 s `cubic-bezier(.19,1,.22,1)`) | igual (es neutro, no es su color de marca) |
| Botón oscuro | fondo `#090A0E`, filete 1 px `#24262E`, texto `#fff`; hover `rgba(255,255,255,.06)` | igual |
| Botón fantasma («Learn More») | fondo `#020308`; hover `rgba(255,255,255,.1)` | no va |
| Anillos de tarjeta | fila `0 0 0 1px rgba(255,255,255,.1)`; banda `0 0 0 1px #171920`; tarjetas blancas `0 0 0 1px #E9EAEF` | igual |
| Figura de cada fila | `rgba(255,255,255,.06)` con una imagen de fondo de color por producto (azul Swipe File, rojo Spyder, violeta Discovery, gris Lens, verde Briefs) | el mismo 6 % con un halo en `radial-gradient` del azul `#2F6FED`, del dorado `#F2B01E` o neutro (plata) |
| Bloque blanco | `#fff`; título `#171920`; párrafo `#24262E`; etiqueta de tarjeta `#090A0E`; texto de tarjeta `#343642`; sobrelínea `#4C505F` | igual |
| Filetes del pie | `rgba(255,255,255,.16)`, 1 px | igual |
| Menús | panel `#020308`, filete `#2A2B30`, radio 28 | igual |

## Barra (1440)

- `position: sticky`, `top: 0`, z 100, alto 72, fondo `rgba(2,3,8,.92)` (`.94` a 390) con `backdrop-filter: blur(24px)`, sin filete.
- Contenedor 1440 con padding 0 40; pila interna con padding 16 y separación 36. Logo 116 × 40 (padding 4, radio 10) en x = 56.
- Links desde x = 208, separación 12: 15 px / 400 / 20 / −0.18, padding 6 10 (los desplegables 6 6 6 10 con chevrón de 20), radio 10.
- Derecha, separación 8: «Sign in» como link; botón 146 × 40, padding 8, radio 10, texto 15 / 550 con 6 px a los lados, chevrón de 24 al 68 %.
- Menú desplegable: panel de 1306 px, radio 28, entra con `opacity 0 → 1` y `scale(.96) translateY(-8px) → none` en .5 s `cubic-bezier(.19,1,.22,1)`.
- 390: alto 72, contenedor padding 0 8, pila 12 16; botón de menú 44 × 44 (padding 12, radio 8) con ícono de 20.

## Hero

- Sección con la grilla de puntos (`dot-grid.webp`, 380 × 380 en mosaico, posición 50 % 0, opacidad .66) enmascarada con
  `linear-gradient(transparent 0, #000 20 %, #000 75 %, transparent 100 %)`. Medido en píxeles: un punto de ~3 px cada 20 px,
  luminancia ~25 sobre 2 (algunos más brillantes). En MaKo, la misma grilla con `radial-gradient` (sin su archivo).
- Contenedor 1344 con padding 0 40 (contenido de 1264, x = 88). Padding superior 60 (64 a 390), columna con 64 de separación.
- Titular en y = 132: 60 px / 600 / 68 / −0.45 (38 / 48 / −0.285 a 390), máximo 960, centrado.
- Bajada 12 px debajo: 18 / 400 / 28 / −0.26, `.84`, balanceada (~670 px de renglón).
- Botón 40 px más abajo (159 × 40; a 390 ocupa todo el ancho, 342 × 40).
- 80 px de aire hasta la sobrelínea «Powering…» (12 / 550 / 16, tracking 2 px, mayúsculas, `.68`); 40 px hasta la grilla de
  logos (7 columnas de 167 px, separación 16, celdas de 52 con padding 12; a 390, 3 columnas y separación 24).
- Captura de la app (video): 1264 × 659 a 64 px de los logos, con `linear-gradient(0deg, #020308, transparent)` en sus últimos
  330 px y el bloque blanco que la tapa 32 px. A 390: 374 × 195 (x = 8). Encima, a la izquierda, su tarjeta «Click Me!» (no va).

## Antes / después (el bloque blanco)

- Sección con padding 8; bloque `#fff`, radio 36 (16 a 390). Contenedor 1344 / padding 0 40 (0 24 a 390).
- Padding 80 0 (48 0 a 390), columna centrada con 72 de separación.
- Cabeza máx. 720: h2 36 / 600 / 44 / −0.26 `#171920`; párrafo 16 / 24 `#24262E`, máx. 512, 12 debajo.
- Grilla de 2 × 470 con 20 de separación (máx. 960); a 390, una columna de 326.
- Tarjetas: 470 × 519, padding 24, radio 24, anillo `#E9EAEF`, columna con 24 de separación. Etiqueta 18 / 500 / 27 / −0.26
  (16 / 24 a 390), texto 16 / 24, 4 px debajo. La clara lleva abajo una imagen de 326 × 264 (a 390) con chats y capturas
  amontonados; la oscura (`#020308`) un video de 400 × 400 (280 a 390) con una órbita y cuatro etiquetas.

## Secciones de producto («Research & Inspiration», «Creative Analytics & Production»)

- Contenedor 1344 / padding 0 40. Padding 128 0 40, columna con 80 de separación (64 a 390).
- Cabeza máx. 720, 12 de separación: sobrelínea 12 / 550 / 16 / 2 px `.36`; h2 44 / 600 / 53.76 / −0.33 blanco (36 / 48 / −0.27
  a 390); párrafo 18 / 28 / −0.26 `.68`, máx. 512.
- **Fila**: 1264 × 640, flex con 16 de separación.
  - Tarjeta 419 × 640: padding 32 (32 24 a 390), radio 24 (16), anillo `.1`, columna con 32 de separación (24), `overflow` recortado.
  - Cabeza con 8 de separación: sobrelínea `.84`; h3 36 / 600 / 44 / −0.26.
  - Botones con 12 de separación: «Get Free Trial» oscuro 151 × 42 y «Learn More» fantasma 134 × 40 (a 390, uno debajo del otro, a todo el ancho).
  - Pestañas: columna con 6 de separación; cada una 36 de alto, padding 6 20 6 6, radio 10, separación 6, ícono de 20 (trazo 1.5),
    texto 16 / 500 / 24 / −0.18; transición .4 s `cubic-bezier(.19,1,.22,1)`.
  - Objeto 3D (video escalado 1.6) abajo a la izquierda, cortado por el borde; a 390, imagen de 175 × 175 arriba a la derecha.
  - Figura 829 × 640 (342 × 299 a 390), `rgba(255,255,255,.06)`, radio 24 (16), imagen de fondo y captura que cambian con la
    pestaña. La de «Swipe File» lleva arriba su pastilla «Save to Foreplay» y abajo la leyenda «Supported ad libraries»
    (sobrelínea + nombres en 16 / 500).
- **Banda de la extensión**: 1264 × 226, padding 40, radio 32, anillo `#171920`, flex con 40 de separación. Logo de 128 px al 50 %
  en x = −51 respecto de la banda. Contenido con 80 de padding izquierdo y 20 de separación; título máx. 480: sobrelínea `.84` +
  h3 28 / 600 / 36 / −0.2; detalles con 36 de separación (ícono 24 + 16 / 500 `.84`); botón blanco abajo a la derecha. A 390 la
  referencia la esconde.

## Lo que no se copió (y por qué)

«Collaboration» (bloque blanco con el diagrama de avatares), «Sharing & presenting» y «Features / Miles beyond the status quo»
(grilla de 1152 px con radio 28 y tres tarjetas de 383 × 469): Competitor Spy no tiene equipos, tableros compartidos, perfiles de
expertos, app propia ni API de su biblioteca. La fila «Discovery» (buscador del mercado): Spy mira sólo a los competidores que
sumas.

## Cierre

- Padding superior 108 (80 a 390), columna centrada con 36 de separación.
- Cabeza máx. 960: h2 44 / 53.76 (36 / 48 a 390); párrafo 18 / 28 `.68`, máx. 640.
- Botones: «Start free trial» blanco 153 × 40 y «View Pricing» oscuro 124 × 42 (a 390, a todo el ancho).
- Foto de 1440 × 924 (dos personas frente a una laptop con la app, sobre una mesa en penumbra). En MaKo, una laptop de 540 px con el
  visual de Competitor Spy en la pantalla, un foco tenue y la franja de la mesa.

## Pie

- `padding: 40px 0` (96 0 40 a 390); contenedor 1216 / padding 0 40 (contenido 1136, x = 152); columna con 44 de separación
  (40 a 390) y 60 de padding abajo.
- Fila de productos: 5 de 214 × 60, padding 8 10, separación 12; ícono 44 × 44; renglón 14 / 20 `.72` y nombre 16 / 500 blanco.
  A 390, uno debajo del otro (342 × 52, padding 4 0).
- Filetes de 1 px `rgba(255,255,255,.16)` entre productos, compañía, links y legal.
- Compañía: logo 108 × 32 y dos reseñas (no van).
- Links: grilla de 5 × 214 con 16 de separación; cada columna con 10 de separación: sobrelínea 12 / 550 / 2 px `.92` y lista con 4
  de separación (link padding 3 0, 14 / 20 / −0.09 `.68`). La quinta es su contador de anuncios (no va).
- «Ask AI about Foreplay.co» con 5 botones de 35 px (no va).
- Legal: 14 / 20 `.36`, separación 16; redes a la derecha al 68 % (no van). A 390, centrado en columna.
