# /vsl/crm — los valores medidos de su referencia

**Referencia:** la portada de GoHighLevel — https://www.gohighlevel.com/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (también los `::before` de las pestañas y los estados `:hover` de los botones).
**Diseño copiado en:** `app/vsl/_competencia/disenos/crm.tsx`. **Contenido:** `app/vsl/_competencia/crm.ts`.

⚠️ Sus imágenes y sus fuentes subidas vienen de `images.leadconnectorhq.com` y `assets.cdn.filesafe.space`, que el proxy de
la nube no deja pasar (403): se midieron sus CAJAS (tamaño y lugar), no lo que muestran. El fondo de la caja de principios es
una de esas imágenes: el texto encima es blanco, así que en MaKo va el azul noche de su hero (no está medido).

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo (titulares, textos, botones, pie) | Poppins (subida por ellos como «customhl-…-Poppins Bold/SemiBold/Medium/Regular/ExtraBold») | 400, 500, 600, 700, 800 | Poppins de Google Fonts, 400, 600 y 700 (`public/vsl-assets/fuentes/poppins/`); el 500 cae al 400 |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Barra | `#03101C` | igual |
| Degradado del hero (0deg) | transparente 11.84 % → `#7DD2FF` 27.88 % → `#0095E5` 36.97 % → `#04519E` 47.01 % → `#01264C` 56.81 % → `#01162A` 69.88 % → `#03101D` 76.79 % | los tres azules de marca pasan a `#A9C4F8`, `#2F6FED`, `#1F57C8`; los noche quedan |
| Botón de la barra | `#1FB9E6`, texto `#021221` | `#2F6FED`, texto blanco |
| Botón del hero | `linear-gradient(91deg, #0CCAFF 1.1%, #FFF 105.74%)`, texto `#021221`, cuadrito `#021221` | `#2F6FED → #FFF`, igual el resto |
| Pill del hero | borde `#8DE1FF`, fondo `rgba(250,250,250,.07)` | igual, con la estrella dorada en el lugar de su ícono |
| Títulos | `linear-gradient(90deg, #03101D 0.13%, #958D8D 109.5%)` con `background-clip: text`; sobre oscuro `#FFF → #958D8D` | igual |
| Textos secundarios | `#575757` | igual |
| Cajas grises | `#F6F6F6` | igual |
| Pestaña activa (`::before`) | `linear-gradient(89deg, <color> -17.03%, #FFF 119.64%)`, borde 1 px `<color>`, `box-shadow: 0 0 30px <color> 60 %`; colores `#FFD000`, `#2896FB`, `#17D94B`, `#6FCDFF`, `#FFEEA3` | `#F2B01E`, `#2F6FED`, `#17D94B`, `#6FCDFF`, `#FFEEA3` |
| Botón oscuro | `#011D38` | igual |
| Caja «What's included» | `radial-gradient(98.6% 67.41% at -6.16% -45.46%, #FFF 36.98%, #C3EAFF 50.43%, #0095E5 65.68%, #04519E 76.55%, #01264C 88.57%, #03101D 100%)` | el mismo dibujo en px (1154 × 232 en -72 -156, para que no crezca con la caja), azules de MaKo |
| Banda de casos | `#03101D` | igual |
| Banda clara de abajo | `#F9FBFC` | igual |
| Pie | `#07223D`, texto blanco | igual |

## Contenedores y espacios (1440)

- **Contenedor:** cajas de 1170 px (x = 135); textos y contadores en 1150 px (x = 145).
- **Barra:** 146 px de alto (fondo `#03101C`); logo 180 × 40 en x = 145, y = 50. Botones de 40 px, radio 10, Poppins 14 px 600:
  «Login» `padding: 10px 32px`, fondo `rgba(255,255,255,.04)`, borde 1 px `rgba(255,255,255,.19)`; «Start 14-day trial»
  `padding: 10px 20px`. 20 px entre los dos. A 390 la barra mide 102 px y no tiene botones.
- **Hero:** `padding: 10px 0 230px`; fila a 40 px, de 612 px de alto. Columna de texto de x = 140 a 663 (523 px,
  `padding: 10px 60px 10px 135px`), centrada en vertical; la imagen va de x = 728 al borde derecho (713 × 572).
  - Pill: `padding: 10px 20px 10px 40px`, radio 75, Poppins 14/18,2 px 500 blanco; 20 px debajo.
  - Titular: Poppins 48/57,6 px 700 blanco, 20 px debajo. A 390: 32/38,4, centrado.
  - Bajada: 16/20,8 px 400 blanco. A 390 centrada.
  - Botón: 38 px de alto, radio 10, `padding: 10px 20px`, 15 px 600, `margin: 20px 0`, con un cuadrito de 24 px a la derecha.
- **Contadores:** 160 px por encima del final del hero; tarjetas de 269 × 124, `gap: 25px`, `padding: 32px 16px`, radio 15,
  fondo `rgba(255,255,255,.31)`, `box-shadow: 0 0 5.08px rgba(0,0,0,.25)`. Número 30/36 px 700 con el degradado; rótulo
  14 px 400 `#03101C`, en mayúsculas, 8 px debajo. A 390: 2 × 2, 180 × 68, radio 4, `padding: 6px`, rótulo 11 px.
- **«We're in the business…»:** título 30/39 px 700 con degradado, centrado (85 px debajo de los contadores); bajada 15 px
  `#575757`; caja de premios `#F6F6F6` radio 20. A 390 el título va a 28/36,4.
- **«Your all-in-one solution…»:** sección `padding: 20px 0`; título 40/52 px 700 con degradado en 565 px; bajada 16/20,8
  `#575757`, 10 px debajo; pestañas 40 px debajo: 140 × 34, radio 5, fondo `rgba(237,237,237,.53)`, borde 1 px
  `rgba(212,212,212,.38)`, 14 px 600 `#03101D`, 20 px entre ellas, `transition: .4s` (al pasar el mouse se prende el
  `::before` del color de la pestaña). Panel 40 px debajo: 1170 × 543, `#F6F6F6`, borde 1 px `rgba(201,201,201,.23)`, radio 25,
  `padding: 20px 40px`; ícono 50 × 50, título 30/39 px 700 con degradado (20 px debajo), texto 16/20,8 `#575757`, lista 14/21,
  botón oscuro; video a la derecha desde x = 740 (519 px). A 390: pestañas en dos columnas, el panel `padding: 20px 10px`.
- **Principios:** caja de 1170 × 438, radio 50, borde 1 px `rgba(201,201,201,.6)`, `padding: 60px 40px`, fondo de imagen.
  Título 30/39 px 600 blanco centrado (21 px debajo del borde), columnas de 267 px en x = 206, 586, 967 (30 px debajo):
  título 16/20,8 px 600 en mayúsculas, texto 15/19,5 px 400 blanco. A 390: radio 50, `padding: 20px 10px`, título 22/28,6.
- **«What's included»:** caja de 1170 × 344, radio 25, `padding: 40px 20px 60px`; título 40/52 con el degradado claro; una
  imagen de 894 px; botón blanco con borde 1 px `#011D38`. A 390 el título va a 30/39.
- **Casos («Discover More Success Stories!»):** banda `#03101D`, `padding: 20px 0 300px`; título 40/52 con el degradado claro,
  50 px abajo del borde; tarjetas de 265 × 270 (30 px entre ellas) a 90 px: un borde de 1 px hecho con
  `linear-gradient(transparente, rgba(135,136,138,.58))`, adentro `linear-gradient(transparente, #000)`, borde 1 px
  `rgba(255,255,255,.2)`, radio 20, `padding: 30px`, `box-shadow: 0 4px 6px rgba(0,0,0,.1)`, `transition: transform .2s, box-shadow .2s`.
  Cita 15/24 px blanco; foto de 60 px con borde 2 px `#E5E7EB`; nombre 14 px 600. A 390 es un carrusel de una tarjeta.
- **Caja del cierre («Built to make things easier»):** 1170 × 340, radio 25, `padding: 40px 0 0 40px`, montada 300 px sobre el
  final de la banda oscura; título 40/52 px 700, texto 16/20,8, botón oscuro; imagen a la derecha. A 390 el título sigue en 40.
- **Pie:** `#07223D`, `padding: 32px 20px 0`; columnas en x = 150, 471, 770, 1059; título 17/22,1 px 400 en mayúsculas; links
  15 px cada 29 px; raya blanca de 2 px; © 13/16,9 px centrado; links legales 13 px separados con «|». A 390 las columnas van
  una debajo de la otra.

## Botones y movimiento

- Botones de la barra y del hero (`glow-button`): `transition: .3s cubic-bezier(0.4, 0, 0.2, 1)`; al pasar el mouse
  `translateY(-2px)` y `box-shadow: rgba(30,185,230,.19) 0 20px 25px -5px, rgba(30,185,230,.19) 0 10px 10px -5px` (en MaKo con el azul).
- Botón oscuro (`btn-hover`): `#011D38`, borde igual, radio 10, `padding: 16px 40px`, 52 px de alto, 15 px 500; al pasar el mouse
  `box-shadow: rgba(107,178,255,.47) 0 0 10px 2px` y un brillo `::after` (`linear-gradient(120deg, transparente, rgba(255,255,255,.65), transparente)`, sesgado).
- Pestañas: el `::before` pasa de `opacity: 0` a 1 en `.4s`.

## Lo que no se copia

Su logo, sus capturas de producto, sus premios, sus contadores de uso, sus testimonios y sus fotos, sus precios, «Join the
movement», su app («even on the go»), la banda de logos de integraciones y la franja fija de abajo («14 DAY FREE TRIAL»).
