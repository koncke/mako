# /vsl/ads — los valores medidos de su referencia

**Referencia:** la portada de Master Ads — https://masterads.ai/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales, sus variables CSS (`.masterads-home`), sus `@keyframes` y sus reglas de animación.
**Diseño copiado en:** `app/vsl/_competencia/disenos/ads.tsx`. **Contenido:** `app/vsl/_competencia/ads.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares (h1, h2, «Se conecta con») | Space Grotesk (Google Fonts) | 500, 600, 700 | la misma, variable 300–700, `public/vsl-assets/fuentes/space-grotesk/space-grotesk-latin-var.woff2` |
| Todo lo demás | IBM Plex Sans (Google Fonts) | 400, 500, 600 | la misma, variable 100–700, `public/vsl-assets/fuentes/ibm-plex-sans/ibm-plex-sans-latin-var.woff2` |

## Colores (sus variables) y su equivalente

Toda la paleta de Master Ads es de marca (verdes). Pasa a la misma familia en el azul de MaKo, con la misma luminosidad: las
bandas oscuras siguen oscuras y los fondos claros siguen claros.

| Variable | Referencia | Uso | En MaKo |
|---|---|---|---|
| `--ma-deep` | `#0A2E23` | bandas oscuras, barra del tablero, cabecera del teléfono | `#0A1C3D` |
| `--ma-forest` | `#0E3B2D` | botones, burbuja, marcos (video, teléfono), texto de la etiqueta | botones y burbuja `#2F6FED`; marcos `#0E2650` |
| `--ma-action` | `#14794C` | opción encendida, anillo de los botones (`rgba(20,121,76,.086)` 9 px) | `#2F6FED`, anillo `rgba(47,111,237,.086)` |
| `--ma-action-hover` | `#105E3B` | hover | `#1F57C8` |
| `--ma-brand` | `#146C43` | rótulo «Agente desde WhatsApp», «Datos de ejemplo» | `#1F57C8` |
| `--ma-mist` | `#E3F3EA` | píldora de la etiqueta, insignias | `#E4ECFC` |
| `--ma-fog` | `#F3F9F6` | fondo del hero, tira de logos, columna del tablero | `#F3F6FC` |
| `--background` | `#F5F8F6` | fondo de las secciones claras, opciones, botón claro | `#F5F7FA` |
| `--border` | `#D7E3DC` | filetes | `#D7DFEC` |
| `--foreground` | `#12241D` | tinta | `#12192A` |
| `--muted-foreground` | `#52645B` | textos secundarios | `#525D6E` |
| sombra del reporte | `0 24px 48px -16px #0A2E232E` | tablero | `0 24px 48px -16px rgba(10,28,61,.18)` |
| sombra de los marcos | `0 20px 60px -20px oklch(.55 .24 280 / .35)` | video y teléfono | igual (`rgba(70,90,230,.35)`) |
| globos del teléfono | `#DCF8C6` (tuyo), `#FFF` (respuesta), fondo `#ECE5DD`; insignia `#25D366` | WhatsApp | igual (son los de WhatsApp) |

## Contenedor y espacios (1440)

- **Contenedor:** `max-w-6xl` 1152 px con 24 de padding (contenido 1104). Hero: `max-w-4xl` 896 (contenido 848).
- **Barra:** 64 px + filete. Logo 151 × 32. «Iniciar Sesión»: 131 × 42, píldora, fondo `--background`, borde `--border`,
  sombra `0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`, 14 px / 600, padding 10 20. «Registrarse»: 114 × 40,
  `--ma-forest`, blanco.
- **Hero** (`bg-ma-fog`): padding 96 / 24. Etiqueta: píldora 32 de alto, padding 6 16, `--ma-mist`, 14 px / 500 / 20.
  Titular: Space Grotesk 60 px / 700 / 60 / `letter-spacing −1.5px` (−0.025 em), 24 px abajo de la etiqueta. Bajada: 18 px /
  400 / 28, máx. 672, 20 px abajo. «¿Con qué arrancamos?» (48 px abajo, 576 de ancho): círculo de 36 con el rayo y la burbuja
  (padding 10 20, 14 px / 500) con la animación `ma-breathe` (2.8 s, `scale(1) → scale(1.1)` y un anillo de 0 a 12 px).
  Caja: blanca, radio 18, borde, padding 16, grilla 2 × 2 con 12 de separación; opciones de 48 px, radio 10, padding 12 16,
  14 px / 500, ícono de 16, que se encienden por turno (`ma-option-light`, 8 s, retrasos de 2 s). Botón «Probar gratis»:
  172 × 60, píldora, padding 16 32, 16 px / 600, con el anillo de 9 px y la misma respiración; 40 px abajo.
- **«Inteligencia artificial, atención humana»** (`bg-background`): padding 96 / 24; grilla `446.66px 625.34px`, separación
  32, centrada en vertical. H2 Space Grotesk 48 px / 700 / 48 / `letter-spacing −1.2px`. Texto 18 / 28, máx. 448, 20 px abajo.
  Botón 32 px abajo. Marco: `--ma-forest`, radio 18, padding 10, imagen de 605 × 343 con radio 14.
- **Banda oscura «"Master, lo de siempre"»** (`bg-ma-deep`): padding 96 / 24; h2 48 px blanco centrado; texto 18 / 28
  `rgba(255,255,255,.72)` 16 px abajo; 48 px hasta la grilla de 5 columnas (208 c/u, separación 16). Tarjetas: radio 18,
  fondo `rgba(255,255,255,.05)`, anillo `0 0 0 1px rgba(255,255,255,.1)`, padding 20; ícono de 20; título 14 px / 600 / 20
  blanco, 12 px abajo; texto 14 / 20 al 72 %, 6 px abajo.
- **Reporte** (`bg-card`, blanco): padding 96 / 24; ícono de 48 (persona + mano); h2 Space Grotesk 36 px / 700 / 40, 20 px
  abajo; texto 18 / 28, 16 px abajo. Tablero 40 px abajo: radio 10, borde, sombra del reporte; barra de 56 (`--ma-deep`,
  padding 0 20, separación 12, 14 px); columna de 56 (`--ma-fog`, padding 24 0, íconos de 16 cada 28); contenido con
  padding 28: título 20 px / 700 y la insignia «Datos de ejemplo» (padding 4 12, 12 px / 600); pestañas 20 px abajo (14 px,
  separación 20, la activa con 2 px de `--ma-action` abajo); 4 × 2 tarjetas de cifras y dos gráficos (radio 10, borde,
  padding 20, título 14 / 600). Botón 40 px abajo.
- **Agente desde WhatsApp** (`bg-background`): grilla `528px 528px`, separación 48. Rótulo 12 px / 600 / `letter-spacing
  1.2px` mayúsculas `--ma-brand`; h2 48 px, 12 px abajo; texto 18 / 28 máx. 448; preguntas 32 px abajo: tarjetas de 46
  (blancas, radio 14, borde, padding 12 16, separación 12, sombra chica), ícono de 16. Teléfono: 300 × 440, `--ma-forest`,
  radio 32, padding 12; pantalla radio 24 `#ECE5DD`; cabecera 60 (`--ma-deep`, padding 12 16, avatar de 32, nombre 14 / 600
  y «en línea» 12 / 16); globos 14 / 20, padding 10 14, máx. 85 %, radios `14 6 14 14` y `6 14 14 14`; insignia de WhatsApp
  de 40 en la esquina (−12, −12).
- **Se conecta con** (`bg-ma-fog`, filetes arriba y abajo): padding 40 0; título Space Grotesk 18 px / 600 / 28; tarjetas de
  176 × 112 (blancas, radio 10, borde, sombra chica) con el logo de 48 de alto, en un carrusel de 75 s.
- **Banda oscura «Pensado para…»**: padding 96 / 24; h2 48 px blanco; grilla de 3 (357 c/u, separación 16), 48 px abajo;
  tarjetas con padding 24, título 16 px / 600 / 24, texto 14 / 20 al 72 %, 8 px abajo. Cierre: 56 px abajo, 24 px / 600 / 32
  centrado, con el precio en `--ma-action`.
- **Pie** (blanco): padding 40 / 24; logo de 28 de alto; filete y padding 24 arriba; © 14 px / 20 `--muted-foreground`; tres
  íconos de redes de 16 a la derecha.

## Teléfono (390)

- Barra: 64; botones de 96 × 31 y 82 × 29 (12 px).
- Hero: padding 64 / 16; titular 36 px / 40 / `letter-spacing −0.9px`; bajada 16 / 24; las cuatro opciones en una columna
  (324 de ancho); el botón 164 × 57.
- Secciones: padding 64 / 16; h2 30 px / 36 / `letter-spacing −0.75px`, centrados; la sección de dos columnas pasa a una (el
  marco del video queda vertical, 240 × 380); las cinco tarjetas en una columna; el reporte sin la columna de íconos, cifras en
  2 columnas y los gráficos en una; el teléfono abajo de las preguntas.

## Lo que se mueve (relevado el 14/11/2026: video del recorrido, `getAnimations()`, hovers)

La referencia es QUIETA: cero videos, cero apariciones al bajar (ningún elemento oculto al cargar, ningún cambio de estilo por JS,
ningún `IntersectionObserver`). Se mueven tres animaciones CSS, desde la carga:

- `ma-breathe` (2,8 s, `cubic-bezier(.4,0,.2,1)`): la burbuja y los TRES «Probar gratis». Escala 1 → 1,1 al 45 % con un anillo de 0 a
  12 px que se apaga. `transform-origin: 0 center`: crecen hacia la derecha, también los botones centrados. No hay anillo fijo: el que
  se ve en una captura es la animación a mitad.
- `ma-option-light` (8 s, `ease-in-out`, retrasos 0/2/4/6 s): una opción encendida a la vez (5 %–20 % del ciclo). Su
  `hover:bg-accent` no se ve: la animación pisa el fondo en todos sus cuadros.
- `ma-integrations-scroll` (75 s, lineal, −50 % sobre dos copias): se frena al pasar el mouse y con su botón de pausa (36 × 36, radio 8;
  «Pausar integraciones» ↔ «Reanudar integraciones», ícono pausa ↔ play). Con «menos movimiento»: fila con scroll, sin la copia.

Hovers: los botones bajan al 90 % su fondo (`hover:bg-ma-forest/90`); «Iniciar Sesión» pasa a `--ma-fog`; el botón de pausa toma la
menta. Las tarjetas, las preguntas, el tablero y el teléfono no tienen hover. Cortes de Tailwind: 640 / 768 / 1024. Space Grotesk
también en los h3 de las tarjetas. El relevo completo, con capturas y videos: las notas de la sesión,
`referencias-landings/ads/relevo.md`.

## Lo que quedó distinto, y por qué (14/11/2026)

- Los botones y la burbuja van en el azul de MaKo (en la referencia son del verde bosque oscuro): es su color de marca. Con el sol y la
  luna en modo claro, las bandas oscuras y los marcos pasan a celeste (`TemaSitio`, regla de Martín del 12/11: «si estoy en white mode,
  todo debería ser white mode»); en la referencia son verde profundo.
- Donde la referencia pone imágenes y dibujos, van pantallas grabadas de MaKo: las decisiones del CoPilot en el marco (y su versión
  vertical debajo de 1024, como la imagen vertical de la referencia), la vista Campañas del CoPilot donde dibuja su tablero (y la misma
  pantalla grabada a 390 debajo de 640, donde la referencia rearma su tablero en una columna), y lo que MaKo
  contesta por WhatsApp en la pantalla del teléfono (el teléfono, su marco y la insignia son los de la referencia).
- «Se conecta con»: la misma tira (que corre, se frena con el mouse y con su botón) con las 8 integraciones del catálogo que usa el
  CoPilot, con su nombre (son íconos, no logotipos con la palabra). El botón de pausa es una casilla con su rótulo, sin JavaScript.
- El cierre de «Pensado para…» lleva la frase de los días de la prueba en lugar del precio, con el mismo resaltado.
- La barra y el pie son los del sitio (BarraGlobal, PieGlobal).
