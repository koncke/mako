# /vsl/cobranza — los valores medidos de su referencia

**Referencia:** la portada de Rebill en español — https://www.rebill.com/es
**Medido:** 11/11/2026 y otra vez el **14/11/2026** con Chromium (Playwright) a 1440 × 900 y a 390 × 844: `getComputedStyle`, la
rotación del hero cada 500 ms, la ventana en cada paso de un scroll lento, `getAnimations()`, `MutationObserver`, los hovers en una
página limpia (antes, a 120 ms y a 900 ms) y **sus scripts**, que vienen en el HTML (la página es hoy un clon en Astro de su Webflow).
El relevo con capturas y videos: carpeta de notas de la sesión, `referencias-landings/cobranza/relevo.md`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/cobranza.tsx`. **Contenido:** `app/vsl/_competencia/cobranza.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo | SF Pro Display (de Apple, no se puede servir) | 300, 400, 500 | **Inter** variable (`public/vsl-assets/fuentes/inter/`) |

Sus `rem` cambian con el ancho: `html { font-size }` es 16 px hasta 767, `calc(12px + 4 * ((100vw - 768px) / 223))` de 768 a 991,
`calc(10.49px + 5.51 * ((100vw - 992px) / 448))` de 992 a 1439 y 16 px desde 1440. En MaKo es la variable `--r` de la raíz, con la
misma fórmula (no se toca el `html` del sitio).

## Escala tipográfica (1440)

| Pieza | Valor |
|---|---|
| h1 del hero | 64 / 70,4, 500, −0,64 px, blanco; dos palabras `#CCDEFF` |
| Párrafos del hero | 18 / 25,56, 300, +0,36 px (dos, con una línea en blanco entre ellos) |
| Botones | 16 / 20, 500, −0,2 px, `8px 16px`, radio 8, 40 de alto; chevron de 24 px |
| h2 | 64 / 70,4; 500 (plataforma `#E5EEFF` en 680 de ancho, «Conexiones», historias `#001131` en 768); 400 (integración, preguntas, cierre) |
| Tarjeta de la plataforma | frase 22 / 140 %, 300, +0,02 em (la cifra en 500); detrás, 18 / 140 % |
| Subtítulo de «Conexiones» | 24 / 28,8 `#E5EEFF`; párrafo 20 / 28,4, 300, en 768 |
| Pieza | título 24 / 120 %, +0,02 em; texto 20 / 28, 300, +0,4 px; ícono 32 px; línea de 1 px `#0056F6 → #172B85` |
| Forma | título 20 / 140 %, 400; texto 16 / 150 %, 300, +0,02 em |
| Historias | ceja 20 / 30, 500, azul; bajada 20 / 28, +0,4 px, `#333`, en 690 |
| Pregunta | 31 / 120 %, 300, `#E5EEFF`; respuesta: título 28 / 120 % `#000919` sobre blanco |
| Pie | links 16 / 20, 300, `#E0E0E0`, `8px 0` |

A 390: h1 y h2 44 px (`2.75rem`), el de «Integración» 48; pregunta 22; los botones del hero a lo ancho.

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Hero | `linear-gradient(#000919 20.73%, #003497 71.22%, #0056F6 99.99%)`, 90svh, como mucho 800 | `#000919 → #1B3E8F → #2F6FED` |
| Plataforma + piezas (`.sections_wrapper`) | `linear-gradient(#0056F6, #003497 11.52%, #000919 56.1%)` | con `#2F6FED` y `#1B3E8F` |
| Tarjetas de la plataforma | `rgba(0,0,0,.5)`, radio 10, 421 × 500, `40px 32px`; con el mouse `#0E0F11` (la 3.ª `#000`) | igual |
| Integración | `#0E0F11`; forma activa `#000`, borde 1,13 px `#2D2D2D`, `36px 18px 50px`, sombra `0 0 6.8px 1px #1E2025`; las otras ,3 | igual |
| Historias | `#FAFAFA`; tarjeta blanca radio 8,8; con el mouse `0 -1px 17.3px #C4C8CF, 0 2px 47.3px rgba(0,0,0,.1)` | igual |
| Preguntas | `#000`; tarjetas 421 × 480, borde `#788191`, radio 8; respuesta en blanco | igual, de a tres por fila (9 preguntas) |
| Cierre | `linear-gradient(#0056F6, #020C22 86.16%)` | con `#2F6FED` |
| Botón blanco con el mouse | `#F9FAFB` | igual |

## Lo que se mueve (sus scripts, copiados con sus números)

- **Hero:** 4 grupos, `setInterval` de 4 s. Grupo `opacity .3 → 1` en 1 s; pastilla +0,2 s, caja +0,4 s (sube 5 px), pieza chica +0,5 s;
  todo en 0,8 s `cubic-bezier(.4,0,.2,1)`. La pieza chica: `top: 75%`, `right: 0`, `translateY(-50%)`, sombra `0 0 30px`.
- **«Conexiones locales» (≥ 992 px):** 600svh, dos capas `sticky` a 88 px (5,5 rem): progreso ≤ 0,16 el título (la imagen sube al
  40 % de ese tramo, 1 s), 0,16–0,22 se apaga, > 0,22 una pieza por quinto (0,6 s).
- **«Integración simple» (≥ 992 px):** 600vh, caja `sticky` a 72 px. < 0,3 pantalla el título centrado; ≥ 0,4 el armado (título +0,3 s,
  formas +0,5 s, cubo de ,8 a 1, formulario de +30 px); el código ,3 desde 0,8 pantalla y sube 105 px desde 1,5; desde 2,5 pantallas
  una forma cada 1,5 (la de antes se pliega). En la 2.ª la tarjeta sube de +85 a −140 px con el scroll (easeOutCubic); en la 3.ª, 5
  piezas giran cada 1,5 s hacia el centro.
- **Preguntas (≥ 992 px):** `flex: 1.35` la del mouse y `.825` las otras, 0,4 s; la pregunta se apaga en 0,3 s y a los 150 ms aparece la
  respuesta. En el teléfono se tocan, una a la vez.
- **Marquesinas** (logos de clientes, «Respaldado por»): 35 s lineal. **No van** (MaKo no tiene ese contenido).
- Hasta 991 px las dos secciones pegadas son listas quietas, como en Rebill. Con «menos movimiento», también en escritorio.

## Contenedores y espacios (1440)

`padding-global` 72 px (32 hasta 991, 16 hasta 767); contenedor de 1600. Hero: `padding-top` 80 (el h1 a 80 de la barra), texto y
animación al 50 % cada uno (la animación hasta 660). Plataforma: `padding` 144 arriba y abajo, 192 entre el título y las tarjetas,
tarjetas en 3 columnas con 16 de separación (2 hasta 767, 1 a 390). Historias: `padding` 80; tarjeta de hasta 800 con 3 rem arriba y
abajo. Preguntas: `padding` 96. Cierre: `padding` 112.

## Lo que no se copió

La franja de logos de clientes con «Leer historia», «Hablar con un experto» (MaKo no agenda llamadas: el segundo botón baja a las
piezas), sus cifras, su cubo con «SDK» (aquí dice Stripe), sus logos de Make (aquí, los disparadores de las plantillas de cobranza),
los otros cinco casos del carrusel y sus puntos, «Respaldado por», sus redes y el selector de idioma.
