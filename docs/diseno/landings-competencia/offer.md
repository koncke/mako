# /vsl/offer — los valores medidos de su referencia

**Referencia:** «The Offer Creation Formula + Atlas AI Tool», de Done For You — https://go.doneforyou.com/offer-formula
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales. Es una página de GoHighLevel (LeadConnector). **Medido otra vez el 14/11/2026** (la página cambió: ahora
se titula «Atlas: The Offer Architect»), con video, hovers y `getAnimations()` en cada paso del scroll: el relevo con capturas está
en la carpeta de notas de la sesión, `referencias-landings/offer/relevo.md`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/offer.tsx`. **Contenido:** `app/vsl/_competencia/offer.ts`.

⚠️ Sus imágenes (logo, miniatura del video, paquete, cajas de producto, sellos) vienen de `images.leadconnectorhq.com`, que el
proxy de la nube no deja pasar: se midieron sus CAJAS (tamaño y lugar), no lo que muestran. Ninguna se copia.

## Fuentes

| Uso | Familia | Pesos que usa | En MaKo |
|---|---|---|---|
| Titulares, botones, links de la barra | Roboto | 500, 700, 900 y 900 itálica | la misma (Google Fonts, variable 400–900 + 900 itálica) |
| Textos, cejilla, títulos de tarjeta | Raleway | 400, 500, 700, 900 | la misma (variable 400–900) |
| El link a mano del hero («Get Instant Access >>») | Caveat | 700 | la misma |
| Un renglón de su tarjeta de precio | Montserrat 15 px | 400 | Raleway (no se carga una cuarta familia) |

Las fuentes viven en `public/vsl-assets/fuentes/{roboto,raleway,caveat}/`.

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Fondo del hero | `#000` | igual |
| Fondo de la sección de la tarjeta | `#F0F2F5` | igual |
| Bandas oscuras | `#4B4B4B` | igual |
| Tarjetas de la grilla | `#161716` | igual |
| Cejilla del hero | `#FFE831` (su amarillo) | dorado `#F2B01E` |
| Franjas del cupón | `#FEDA48` | (no van) |
| Bordes de las tarjetas | 1 px `#FEDA48` | 1 px dorado `#F2B01E` |
| Botones | `#F7D053`, texto negro | azul `#2F6FED`, texto blanco |
| Franja sobre el video y titular de la tarjeta blanca | violeta `#302254` | (la franja no va) titular en `#1F57C8` |
| Texto de la tarjeta de precio | `#161616` (títulos), `#000` | igual |
| Meta de las tarjetas («INSTANT ACCESS») | `#C9D8E0` | (no va) |

## Contenedores y espacios (1440)

- **Barra:** blanca, 90 px + 2 px abajo (14/11; antes 75); contenido de 1100 px (logo de 248 × 65 en x = 170, links hasta x = 1270). Links Roboto 20 px 400,
  `padding: 5px 21px`, negro; al pasar el cursor cambian el fondo con `transition: .3s` (blanco sobre blanco: no se ve).
  A 390: 68 + 2 px, el logo centrado, sin links. En producción la tapa la barra del sitio.
- **Hero:** negro, `padding: 20px 0 10px`.
  - Cejilla: 971 px de ancho centrada, `padding: 5px`, Raleway 33/33 px 900, `letter-spacing: -1px`, negro, centrada.
    A 390: 370 px, 17/17 px.
  - Titular: 25 px debajo, 1120 px, Roboto 45/45 px 900 itálica, -1 px, blanco, centrado. A 390: 32/32 px.
  - Bajada: 10 px debajo, Raleway 25/32,5 px 700, `text-transform: capitalize`, blanco, centrada. (En MaKo sin
    capitalize: en español no se escribe cada palabra con mayúscula.)
  - Fila: 25 px debajo, de x = 160 a 1290; columna izquierda 730 px, 40 px de separación, tarjeta de 360 px.
  - Izquierda: franja violeta 730 × 31 (Roboto 21/21 900, radio 5 5 0 0), 10 px, video 730 × 411 (16:9), 30 px, párrafo Raleway
    22/28,6 400 blanco y el link a mano Caveat 60/60 px blanco, 40 px debajo. A 390 el párrafo y el link no se muestran.
  - Tarjeta: blanca, radio 5 px, sombra `0 1px 5px rgba(0,0,0,.2)`, `padding: 0 15px 10px`, estirada al alto de la fila. Arriba,
    la imagen del producto 328 × 185 a 6 px (14/11; a 390 no se muestra). Títulos Roboto 22/22 px 900, -1 px, `#161616`; texto
    15/15 px; botón 307 × 63. En MaKo la tarjeta NO se estira (sin su precio, sus estrellas ni su sello quedaba media tarjeta en blanco).
- **Tarjeta blanca:** sección `#F0F2F5` con `padding: 20px 0 10px`; tarjeta de 1140 px, 20 px de margen arriba, `padding: 25px`,
  borde 1 px `rgba(219,219,219,.7)`, radio 5 px, sombra `0 1px 3px rgba(0,0,0,.05)`.
  - Titular Roboto 50/50 px 900, -1 px, `#302254`, centrado. A 390: 32/32 px.
  - Párrafos Raleway 22/28,6 px 500, negro, separados por un párrafo vacío (28,6 px).
  - Lista «Without…»: `padding-left: 33px`, cada renglón `padding-left: 11px`, Raleway 22/44 px 400, con un tilde verde
    (Font Awesome check-circle `#37CA37`, ≈ 20 px) como marcador. Un párrafo de cierre 30 px debajo.
  - A 390: tarjeta de 370 px con `padding: 25px 10px`.
- **Banda «Here's Everything You're Getting»:** `#4B4B4B`, `padding: 20px 0 40px`.
  - Franja del cupón 1130 × 49 (Raleway 22 px 500), titular Roboto 56/67,2 px **500** blanco, subtítulo Roboto 42/50,4 px 500,
    10 px más abajo la imagen de 900 × 550 (14/11: una CAPTURA DE SU APP con notas a mano en rojo; a 390 no se muestra), 30 px
    más abajo el párrafo Raleway 22/28,6 px 500 blanco centrado y, 45 px más abajo, la grilla.
  - Grilla: 3 columnas de 263 px, 30 px entre columnas y entre filas (849 px en total, centrada).
  - Tarjeta: `#161716`, borde 1 px amarillo, radio 4 px, `padding: 10px 5px`; imagen 200 × 250 a 11 px del borde; título
    Raleway 22/28,6 px 700 blanco; texto Raleway 16/20,8 px 500 blanco; meta Raleway 14/21 px `#C9D8E0`.
  - Botón a lo ancho: 1130 × 58, `#F7D053`, Roboto 24 px 700, -1 px; subtítulo 14 px. 55 px debajo de la grilla.
  - A 390: titular 32/38,4 px, tarjetas de 370 px apiladas SIN separación (`padding: 10px 0`), botón de 370 px.
- **Sección de su garantía:** blanca, `padding: 40px 0 20px`; sello 100 × 100; titular 50 px debajo, Roboto 36/36 px 900,
  -1 px, negro, 749 px; columna de texto 749 px a 36 px, Raleway 22/28,6 px 500, sombra `0 1px 3px rgba(0,0,0,.05)`.
  A 390: titular 28/28 px, columna de 370 px.
- **Banda final:** `#4B4B4B`, `padding: 20px 0 40px`; franja del cupón; titular Roboto 42/50,4 px 500, -1 px, blanco;
  botón 312 × 58. A 390: titular 32/38,4 px.
- **Pie:** la página no tiene.

## Botones

`background: #F7D053`, sin radio, sin sombra, `padding: 5px 25px`, 307 × 63 (14/11; el 11/11 medía 58 de alto); texto principal Roboto 24 px 700,
`letter-spacing: -1px`, en mayúsculas con «➧»; subtítulo 14 px 400. `transition: all`, sin cambio al pasar el cursor.

## Animaciones

Ninguna de entrada ni al pasar el cursor (medido con `hover()` sobre los botones y los links, y con `getAnimations()` en cada paso
del scroll). Lo único que se mueve es su VSL (14/11): arranca solo y sin sonido y, cuando sale por arriba de la pantalla, sigue en
una ventanita `fixed` de 280 × 158 a 3 px de la esquina de abajo a la derecha, que entra con `fadeInUp` (1 s, de `translate3d(0,
100%, 0)` y opacidad 0), con su × 160 px más arriba. En MaKo es lo mismo con la grabación real de Offer (`<script data-visor>`).
