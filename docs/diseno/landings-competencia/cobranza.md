# /vsl/cobranza — los valores medidos de su referencia

**Referencia:** la portada de Rebill en español — https://www.rebill.com/es
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (sitio de Webflow: se midió por clase y por texto). Las imágenes de Rebill viven en
`cdn.sanity.io`, que desde la máquina de medición no carga: de sus capturas y fondos se midió la caja (tamaño y lugar), no el
dibujo. Las secciones que se fijan al hacer scroll se miraron con capturas de la ventana mientras se baja.
**Diseño copiado en:** `app/vsl/_competencia/disenos/cobranza.tsx`. **Contenido:** `app/vsl/_competencia/cobranza.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo (títulos, cuerpo, barra, botones) | SF Pro Display (propia de Apple, no está en Google Fonts) | 300, 400, 500 | **Inter** variable, la más parecida de Google Fonts (`public/vsl-assets/fuentes/inter/`) |

## Escala tipográfica

| Pieza | 1440 | 390 |
|---|---|---|
| h1 del hero | 64 px / 70.4, 500, −0.64 px, blanco; las palabras resaltadas `#CCDEFF` | 40 px / 44, −0.4 px |
| Párrafos del hero | 18 px / 25.56, 300, +0.36 px, blanco; dos párrafos con 25 px entre ellos | igual |
| h2 de sección (claras sobre oscuro) | 64 px / 70.4, 500, −0.64 px, `#E5EEFF` | 36 px / 39.6 (500) |
| h2 de «Integración», preguntas y cierre | 64 px / 70.4, **400**, blanco; la segunda frase `#CCDEFF` | 36 px / 39.6, 400 |
| Bajada de «Conexiones locales» | 24 px / 28.8, `#E5EEFF`; el párrafo 20 px / 28.4, 300, ancho 768 | 20 px; 16 px |
| Texto de las tarjetas de cifras | 24 px / 33.6, 300, +0.48 px, la cifra en 500 | 18 px / 25.2, +0.36 px |
| Título de pieza (fila con línea azul) | 20–22 px / 24–29, 400, +0.4 px, blanco | 20 px / 24 |
| Título de tarjeta de la pila | 20 px / 28, 400, +0.4 px, `#D8DADF`; texto 16 px / 24, 300 | igual |
| Ceja de «Historias» | 20 px / 30, 500, `#0056F6` | igual |
| h2 de «Historias» | 64 px / 70.4, 500, `#001131`; texto 20 px / 28, `#333` | 36 px |
| Cifra de la historia | 38 px, 500, `#0051FF` | igual |
| Pregunta (tarjeta) | 31 px / 37.2, 300, `#E5EEFF` | 20 px |
| Barra | links 18 px / 20, 300, blanco, `padding 8px 16px`; «Iniciar sesión» 18 px | se pliegan al menú |
| Pie | links 16 px / 20, 300, `#E0E0E0`, `padding 8px 0`; © 14 px / 21, 300 | igual, una sola columna |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Barra y pie | `#000C24` | igual |
| Hero | `linear-gradient(#000919 20.73%, #003497 71.22%, #0056F6 99.99%)` | `#000919` → `#1B3E8F` → `#2F6FED` |
| Sección de cifras | `linear-gradient(#0056F6, #003497 8%, #000919 25%)` | con `#2F6FED` y `#1B3E8F` |
| Tarjetas de cifras | `rgba(0,0,0,.5)`, radio 10, 421 × 500, `padding 40px 32px`; foto de fondo abajo | igual; la foto es un brillo azul |
| Botón blanco | `#fff`, texto `#1F315C`, 16 px / 20, 500, `padding 8px 16px`, radio 8 | igual |
| Botón de la barra | blanco con borde de 3 px `linear-gradient(135deg, #2580FF, #fff, #0041F7)`, texto `#1F315C` 18 px, `padding 8px 14px`, radio 8 | borde `#5B8FF2 → #fff → #2F6FED` |
| Botón azul (Historias) | `#0056F6`, 20 px, 500, `padding 8px 20px`, radio 8 | `#2F6FED` |
| «Integración simple» | fondo `#0E0F11`; tarjeta activa `#000`, borde `#2D2D2D`, radio 10, sombra `#1E2025 0 0 6.8px 1px`, `padding 36px 18px 50px`; las otras `#0E0F11`, `padding 18px 18px 36px`, apagadas | igual |
| «Historias» | fondo `#FAFAFA`, tarjeta blanca radio 8.8 | igual |
| Preguntas | fondo `#000`, tarjetas con borde `#788191`, radio 8, 421 × 480 | igual |
| Cierre | `linear-gradient(#0056F6, #020C22 86.16%)` | con `#2F6FED` |
| Línea de las piezas | 1 px azul a la izquierda del texto | `#2F6FED` |

## Contenedores y espacios (1440)

- **Barra:** 72 px, contenido de x = 72 a 1368. A 390, 64 px.
- **Hero:** el h1 a 80 px de la barra; texto en una columna de ~630; imagen a la derecha (en MaKo, el gráfico del mes en
  una tarjeta blanca). A 390, el h1 también a 80 px.
- **Cifras:** el h2 de 960 centrado a ~180 px del borde; tres tarjetas de 421 × 500 con 16 px entre ellas, a ~300 px del
  h2. A 390, una por renglón, 358 × 416, `padding` 20.
- **Conexiones locales:** el encabezado centrado; cada pieza es el texto (con su línea azul) a la izquierda y una captura de
  858 × 700 mostrada a 817 de ancho a la derecha (x = 551).
- **Integración simple:** el texto a la izquierda y las tarjetas de la pila a la derecha.
- **Historias:** el encabezado centrado y una tarjeta de 664 × 494 (en el carrusel); el botón azul abajo.
- **Preguntas:** `padding` 96; cuatro tarjetas de 421 × 480 en fila. A 390, apiladas, 358 × 135.
- **Pie:** logo a la izquierda y las columnas de links; el © abajo a la derecha (a 390, una sola columna y el © a la
  izquierda).

## Animaciones (CSS en MaKo)

- Hero: el texto y el gráfico entran subiendo 20 px con `opacity` (`.9s cubic-bezier(.16,1,.3,1)`).
- La pila: al pasar el mouse, la tarjeta se enciende y las demás se apagan (en Rebill avanza con el scroll).
- Tarjetas de cifras y capturas suben 4–6 px al pasar; las flechas de los botones se corren 3 px.
- Preguntas: la tarjeta abierta (`<details>`) se ensancha.
- `prefers-reduced-motion: reduce` apaga todo.

## Lo que no se copió

La franja de logos de clientes, «Hablar con un experto», los íconos de cada pieza, las capturas de código del SDK y la API,
los puntos del carrusel de historias, «Respaldado por», los íconos de redes y el selector de idioma: no tienen contenido de
MaKo. Sus fotos de fondo de las tarjetas son un brillo azul. Sus cifras, sus historias y sus tarifas no van (las cifras son
números contados del código: ver la cabecera de `cobranza.ts`).
