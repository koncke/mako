# /vsl/ai-avatar — los valores medidos de su referencia

**Referencia:** HeyGen, «Anuncios de video estilo UGC» (es-MX) — https://www.heygen.com/es-mx/business/marketing/ugc-video-ads
**Medido:** 11/11/2026 y otra vez el 14/11/2026 (noche, para la copia fiel), con Chromium (Playwright) a 1440 × 900 y a
390 × 844 (con user agent de teléfono): `getComputedStyle`, `getBoundingClientRect`, los hovers antes y después con su tiempo,
lo que cambia por JavaScript al bajar (MutationObserver) y lo que observa (IntersectionObserver). A 390 la página de HeyGen se
desborda; la de MaKo no. Relevo con capturas y videos: notas de la sesión, `referencias-landings/ai-avatar/relevo.md`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/ai-avatar.tsx`. **Contenido:** `app/vsl/_competencia/ai-avatar.ts`.

## Fuentes

| Uso | Familia en HeyGen | Pesos | En MaKo |
|---|---|---|---|
| Titulares, miga de pan, números, pastillas «Paso N» | ABC Solar Display (Dinamo, de pago) | 700 | Gabarito 900, `letter-spacing: -0.04em` (Google Fonts, OFL, variable) |
| Texto, botones, links, preguntas | TT Norms Pro (TypeType, de pago) | 400, 450, 500, 700 | Figtree (Google Fonts, OFL, variable) |

## Colores (sus fichas de Tailwind → MaKo)

| Papel | HeyGen | En MaKo |
|---|---|---|
| Marca (botones, relleno de la línea del video) | cian `#00C3FF` | azul `#2F6FED` |
| Marca sobre oscuro (letra del botón negro, letra del hover) | cian `#00C3FF` | azul claro `#6E9BF5` |
| Oscuro de marca (hover del botón, texto de los tildes, título del testimonio, «Watch video») | verde petróleo `#033337` / `#012E3C` | marino `#0B2150` |
| Tinta de marca (botones del reproductor, último paso de la miga) | `#00779C` | `#1F57C8` |
| Claro de marca (pastilla «Paso N», pista de la línea, «Watch video») | `#DFF8FF` / `#E1F8FF` | `#E4EDFD` |
| Acento (la perilla del video) | rosa `#F3A6FF` | dorado `#F2B01E` |
| Texto | `#171717`; h1 `#1A1A1A`; secundario `#333` | igual |
| Banda de los números / tarjetas de preguntas | `#F2F2F2` | igual |
| Tarjetas de números | `#1A1A1A`, radio 30 | igual |
| Tarjetas de filas y pasos | crema `#FDFBF9`, radio 80 | igual |
| Bordes | negro al 10 % y al 20 % | `#E6E6E6` y `#CCCCCC` OPACOS: el sol y la luna aclaran en el modo claro todo borde oscuro, y el negro al 10 % desaparecía |

## Botones y hovers (medidos)

- 40 px de alto, radio 12, padding 0 16, 18 px 700, −0.02em. `transition-colors`: 0,15 s `cubic-bezier(.4,0,.2,1)`. No se
  mueven ni se achican (ni al pasar ni al apretar).
- De marca: fondo cian / letra petróleo → hover y active: fondo petróleo / letra cian. En MaKo: azul / blanco → marino / azul claro.
- Negro (el del hero): negro / cian → cian / negro. En MaKo: negro / azul claro → azul / blanco.
- En las filas el botón dice «Empieza gratis →» con la flecha como TEXTO; en el hero, una flecha llena dibujada.
- Links de la miga, tarjetas de filas y pasos, «Watch video»: sin hover.

## Contenedores y espacios (1440)

- **Miga:** ABC Solar 15 / 22.5, flechas llenas de 11 px con 4 px a cada lado, en un renglón; el último paso en la tinta de marca,
  cortado con «…» (máx. 300 px).
- **Hero:** contenedor de 1280 con 20 px a los lados; dos columnas `flex-1` con 75 de separación (583 cada una); la miga a 165 px
  del borde de la página, h1 a 218. h1 68 / 72 (55 / 60 en tablet, 40 / 48 en teléfono); 30 px entre miga, h1, bajada (18 / 23.4,
  450, −0.36 px, 610 px) y botón; los tildes van en FILA que se parte (cada uno de 40 px de alto, ícono de 24 en cian, texto 18 / 18
  500 −0.18 px en petróleo). 100 px abajo.
- **Reproductor (VideoPlayer):** caja negra radio 24 con el video 16:9 (583 × 328) en la columna derecha (padding 20 0). El video
  ARRANCA SOLO, sin sonido, al cargar (no tiene `autoplay`: lo arranca su script). La barra de controles flota a 30 px de los
  costados y 14 px por debajo del borde (padding 5 6, separación 5): play/pausa, la línea (27 px, radio 12, pista `#E1F8FF`,
  relleno cian, perilla = una gota rosa de 50 × 17 que asoma 7 px por encima), sonido (arranca silenciado, «Mute» con
  `aria-pressed`) y pantalla completa; botones de 27 × 27, radio 10, `#00779C`. Mientras corre, la barra sólo se ve con el mouse
  encima (opacidad, 0,2 s). Tocar el video lo pausa o lo sigue; pausado, aparece al centro el play de 27 px agrandado 2,4 veces
  (65 px) y la barra queda visible. No hace bucle.
- **Banda de números:** ancho completo, `#F2F2F2`, radio 70, padding 100 / 28 (24 / 28 / 60 en teléfono). Tres tarjetas en fila con
  20 de separación, padding 24, radio 30; número 44 / 1, rótulo 18 / 1 500 −0.18 px. Debajo, 16 px más abajo, la CINTA: logos de 60 px
  de alto con 80 de separación (40 en teléfono), máscara del 8 % a cada lado, `logo-slide` 25 s lineal (de 0 a −50 %: ~72 px/s), se
  frena con el mouse encima, y un botón de pausa redondo de 28 px (blanco, borde negro al 10 %, desenfoque 6) a 8 px del borde
  derecho. Después un renglón de 16 px gris con una línea fina hasta el borde.
- **Secciones:** padding 120 / 20 (100 / 20 en teléfono), contenido de 1408. Encabezado: h2 44 → 60 px con renglón de 1.05em, hasta
  780 px; bajada 18 / 140 %, −0.16 px, 600 px, 30 px debajo; el botón abajo a la derecha; 75 px hasta lo que sigue. Sangría de
  15 px hasta 1280.
- **«Sin / Con»:** dos tarjetas `flex-1` con 20 de separación, borde negro al 10 %, radio 22, padding 30 (20 en teléfono), 40 entre
  bloques. Pastilla 14 / 1, padding 10 15, 20 px debajo. h3 40 / 1. Texto 16 / 140 %, `#333`. En HeyGen llevan una imagen entre el
  título y el texto (no va: ver la cabecera del diseño).
- **Filas:** tarjetas de 1408, `#FDFBF9`, radio 80, padding 50 (50 0 en teléfono), 75 entre una y otra (¡240 en teléfono!). Imagen
  a la izquierda en las impares (`lg:flex-row-reverse`), recortada con radio 80; en una columna, el texto ARRIBA y la imagen debajo.
  h2 50 / 120 % (44 en teléfono).
- **Pasos:** tarjetas de 1408 × 450, radio 80, 50 entre una y otra; imagen a la izquierda en el 1 y el 3, a la derecha en el 2; en
  una columna, la imagen ARRIBA. Texto con padding 20 50 (20 10 en teléfono), separación 10: pastilla «Paso N» (15 / 22.5, padding
  6 12, radio 80), h2 30 / 125 %, texto 16 / 140 %, botón.
- **Casos de uso:** grilla de 3 columnas (2 en tablet, 1 en teléfono) con 75 de separación (38 en teléfono), cada una de hasta
  411 px; ícono de 36 con 13 debajo; h3 24 / 32 (18 en teléfono); texto 16 / 140 % 450.
- **Testimonio:** h2 70 / 110 % (35 en teléfono) en petróleo, 842 px; bajada 18 / 130 % 500 al 70 %. Tarjeta de hasta 1208 px, borde
  negro al 20 %, radio 40: texto 40 % (padding 50; nombre 24 800; la cita 14 / 20 gris al pie) y el video 60 %. El video NO arranca
  solo: encima, la pastilla «Watch video» (20 px 700, padding 10 16, radio 12, `#DFF8FF` / `#012E3C`, círculo de 32 px) que al
  tocarla arranca el video CON sonido y se va (opacidad 0,3 s); con el video corriendo vuelve con el mouse encima como «Pause video».
  Es un carrusel (Embla) con flechas de marca y tres puntos: con un solo caso no va.
- **Preguntas:** el título a la izquierda (40 / 1, 0.4 px, `#333`, 350 px) PEGADO a 120 px de arriba mientras se bajan las
  tarjetas (`position: sticky`); a la derecha, tarjetas `#F2F2F2` radio 20 padding 30 (con 24 de aire extra abajo), separación 20;
  pregunta 18 / 140 % 500; respuesta 16 / 140 % (14 en teléfono). En una columna el título va centrado (30 px) y no se pega.
- **Banda final:** radio 40, contenedor de 1280, padding 100 / 130 (100 / 40 en teléfono); su fondo es una imagen: cian a la
  izquierda (~30 %) que se funde en blanco con un trazo rosa. h2 60 / 1 (32 en teléfono), 550 px; texto 16 / 140 % en petróleo con
  padding 20 0 30; botón; tildes en fila (gap 6 / 32). El pie negro asoma 50 px debajo de las esquinas.

## Animaciones

Lo que se mueve en HeyGen, todo medido: el video del hero (arranca solo), la cinta de logos (25 s lineal, se frena con el mouse),
la barra del reproductor (aparece con el mouse, 0,2 s), el carrusel de testimonios (Embla: sólo con las flechas, ~0,7 s), el
«Watch video» (opacidad 0,3 s), los cambios de color de los botones (0,15 s) y el título pegado de las preguntas. NO anima la entrada
de las secciones al bajar ni las tarjetas al pasar el mouse. En MaKo, lo mismo (menos el carrusel); con `prefers-reduced-motion`
la cinta queda quieta y el video no arranca solo.
