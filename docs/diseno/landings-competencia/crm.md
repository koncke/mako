# /vsl/crm — los valores medidos de su referencia

**Referencia:** la portada de GoHighLevel — https://www.gohighlevel.com/
**Medido:** 11/11/2026 y otra vez el **14/11/2026** (noche), con Chromium (Playwright) a 1440 × 900 y a 390 × 844: `getComputedStyle` y
`getBoundingClientRect` sobre los elementos reales, los hovers antes / a los 120 ms / a los 820 ms, `getAnimations()` en cada paso de un
scroll lento, los contadores cada 40 ms, y su CSS propio y sus scripts, que vienen DENTRO del HTML (`curl`), junto con el payload de
Nuxt (la configuración de cada elemento). El relevo con capturas y videos: carpeta de notas de la sesión, `referencias-landings/crm/`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/crm.tsx`. **Contenido:** `app/vsl/_competencia/crm.ts`.

⚠️ La página cambió entre el 11 y el 14/11: el hero es una imagen que abre un video (ya no un video), los contadores son otros cuatro y
suben solos, cada pestaña trae su lista de herramientas y su video, y «What's included» es una tabla. Se mide cada vez.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo (titulares, textos, botones, pie) | Poppins (subida por ellos como «customhl-…-Poppins Bold/SemiBold/Medium/Regular/ExtraBold») | 400, 500, 600, 700, 800 | Poppins, 400, 500, 600 y 700 (`public/vsl-assets/fuentes/poppins/`); el 800 del botón de la franja cae al 700 |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Barra | `#03101C` | igual |
| Degradado del hero (0deg) | transparente 11.84 % → `#7DD2FF` 27.88 % → `#0095E5` 36.97 % → `#04519E` 47.01 % → `#01264C` 56.81 % → `#01162A` 69.88 % → `#03101D` 76.79 % | los tres azules de marca pasan a `#A9C4F8`, `#2F6FED`, `#1F57C8`; los noche quedan |
| Botón del hero | `linear-gradient(91deg, #0CCAFF 1.1%, #FFF 105.74%)`, letra `#021221`, cuadrito `#000` | `#8FB3FA → #FFF` (un azul claro de MaKo: la letra oscura se lee), igual el resto |
| Píldora del hero | borde `#8DE1FF`, fondo `rgba(250,250,250,.07)`, el rayo cian | borde y rayo `#8FB3FA` |
| Títulos | `linear-gradient(90deg, #03101D 0.13%, #958D8D 109.5%)` con `background-clip: text`; sobre oscuro `#FFF → #958D8D` | igual |
| Pestañas (`::before`) | `linear-gradient(89deg, <color> -17.03%, #FFF 119.64%)`, borde 1 px, `0 0 30px` al 60 %; `#FFD000`, `#2896FB`, `#17D94B`, `#6FCDFF`, `#FFEEA3` | `#F2B01E`, `#2F6FED`, `#17D94B`, `#6FCDFF`, `#FFEEA3` |
| Botón oscuro | `#011D38` | igual |
| Caja «What's included» | `radial-gradient(98.6% 67.41% at -6.16% -45.46%, #FFF 36.98%, #C3EAFF 50.43%, #0095E5 65.68%, #04519E 76.55%, #01264C 88.57%, #03101D 100%)` | los azules de MaKo |
| Franja fija | `#178AF6`; botón `#FFB902`, letra `#0D3056` | `#2F6FED`; botón `#F2B01E`, letra `#0D3056` |
| Ventana del video | fondo `rgba(12,202,255,.4)` | `rgba(47,111,237,.4)` |
| Popup de salida | fondo `rgba(0,0,0,.5)`, botón `#0B87F6` | igual el fondo; botón `#2F6FED` |
| Banda de casos | `#03101D` | igual |
| Integraciones | fondo `#F9FBFC`, título `#0D3056` | igual |

## Medidas (1440 · 390)

- **Hero:** `padding: 10px 0 230px` (10 10 200 a 390); fila de 612 a 50 px de arriba (`10px 0 10px 5px`), dos mitades: el texto en
  523 px desde x = 140 (`10px 60px 10px 135px`), centrado en vertical; la imagen de 713 × 572 (660 / 530) desde x = 728 hasta el
  borde, con las esquinas izquierdas de 10. Píldora 279 × 40 (14/18,2 500, `10px 20px 10px 40px`, radio 75; a 390 12/15,6 y 7 px);
  h1 48/57,6 700 (25/30 a 390) 20 px debajo; bajada 16/20,8 20 px debajo; botón 277 × 45 a 40 px (`10px 20px`, radio 10). A 390 la
  imagen va debajo, 350 × 281.
- **Contadores:** 161 px por encima del final del hero; tarjetas de 269 × ~124 con 25 de separación, radio 15, `2rem 1rem`, fondo
  blanco al 31 %, `box-shadow: 0 0 5.08px rgba(0,0,0,.25)`; número 30/36 700, rótulo 14 en mayúsculas (11 a 390, en 2 × 2).
- **Ciclo:** título 40/52 en 565 px (30/39 a 390) a 50 px de arriba; bajada 16/20,8 `#575757` 10 px debajo; pestañas 140 × 41 a 40 px
  (`7px 20px`, gris al 53 %, borde `rgba(212,212,212,.38)`, radio 5, 20 px entre ellas; a 390 en dos columnas y la quinta al medio);
  panel 40 px debajo: 1170 × 571, `#F6F6F6`, borde 1 px `rgba(201,201,201,.23)`, radio 25, `20px 40px`, dos columnas iguales (544):
  ícono 50 × 50; título 30/39 700 10 px debajo; texto 16/20,8 20 px debajo; lista a 25 px, dos columnas de 14/21 `#575757` con el
  tilde negro (7 px hasta el texto); botón oscuro 264 × 59 a 35 px; el video de 519 × 345 al medio de la otra columna (`10px 5px 10px 20px`).
  A 390: `20px 10px`, una columna, el video debajo del botón (348 × 231).
- **Principios:** caja 1170, radio 50, borde 1 px `rgba(201,201,201,.6)`, `60px 40px`; título 30/39 600 blanco en 1038 px a 21 px;
  columnas a 54 px: 267 px de texto en x = 206, 586 y 967 con una raya entre ellas; título 16/20,8 600 en mayúsculas con el tilde, texto
  15/19,5. A 390: `20px 10px`, título 22/28,6, las columnas una debajo de la otra.
- **«What's included»:** caja con el degradado radial, radio 25; título 40/52 con el degradado claro; la tabla clara de radio 20
  (Features · Replaces · Other tools · HighLevel); botón blanco 264 × 59 con borde `#011D38`.
- **Testimonios:** banda `#03101D`, `20px 0 300px`; título 40/52 con el degradado claro a 50 px; cuatro tarjetas (borde de 1 px con
  `linear-gradient(transparente, rgba(135,136,138,.58))`, adentro `linear-gradient(transparente, #000)`, borde 1 px `rgba(255,255,255,.2)`,
  radio 20, `30px`, las comillas, la cita 15/24 blanca, la foto de 60 con borde 2 px `#E5E7EB`, el nombre 14 600). A 390 carrusel.
- **«Built to make things easier»:** 1170 × 347, radio 25, `40px 0 0 40px`, montada 320 px sobre el final de la banda oscura; título
  40/52 700 `#03101D`; texto 16/20,8; botón oscuro.
- **Integraciones:** `padding: 10px 0`; título 28/36,4 700 `#0D3056` a 35 px; la cinta de logos de 50 px 36 px debajo.
- **Franja fija:** 100 de alto (130 a 390); título 22/28,6 600 blanco; botón 277 × 60 a 75 px, radio 10, `8px 40px`, 15 px 800 + 13 px 600,
  `box-shadow: 0 10px 15px -10px rgba(0,0,0,.43)`.
- **Ventana del video:** 720 × 405 a 90 px de arriba, centrada (360 × 203 a 84 px en el teléfono); la × de 28 en `right: -10px; top: -10px`.

## Botones y movimiento

- Botones de la barra (`glow-button`): `transition: all .3s cubic-bezier(0.4, 0, 0.2, 1)`; al pasar el mouse `translateY(-2px)` y
  `box-shadow: rgba(30,185,230,.19) 0 20px 25px -5px, rgba(30,185,230,.19) 0 10px 10px -5px` (en MaKo con el azul).
- Botón del hero (`btn-gradient`): al pasar el mouse SÓLO `box-shadow: 0 0 20px 5px #ffffff91`.
- Botón oscuro y blanco (`btn-hover`, `btn-hover2`): `box-shadow: 0 0 10px 2px #6bb2ff78` y el brillo `::after` (70 % de ancho, sesgado
  -20deg) que va de `left: -80%` a `120%` en `.6s ease`.
- Pestañas: el `::before` de `opacity: 0` a 1 en `.4s ease` (al pasar el mouse y la elegida). Cambian sin animación.
- Tarjetas de testimonios: `translateY(-2px)` y la sombra a `0 8px 25px rgba(0,0,0,.15)`.
- Contadores: 2 s, ease-out cuártico, al verse a la mitad, una vez.
- Franja fija: `scrollY > alto del hero / 2` → `position: fixed; top: 0`, la opacidad en `.5s ease`.
- Testimonios a 390: avanzan cada 3 s, `transform .3s ease`, se frenan con el mouse; puntos de 10 px.
- Cinta de logos: 40 px por segundo, `linear`, máscara 5 % / 95 %, se frena con el mouse.
- Popup de salida: cuando el mouse sale por arriba (1 s después de cargar), una vez.

## Lo que no se copia

Su logo, sus capturas de producto, sus premios, sus contadores de uso, sus testimonios y sus fotos, sus precios (y la columna de precios
de su tabla), «Join the movement», su app («even on the go»), el robot, su globo del chat y el formulario de su popup de salida.
