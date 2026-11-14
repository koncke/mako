# /vsl/script — los valores medidos de su referencia

**Referencia:** la portada de Gethookd — https://www.gethookd.ai/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales, los `::before`/`::after` del hero, de la tarjeta «Ask your AI», de las viñetas y de la banda
del final, sus `@keyframes` y sus reglas `:hover` / `[open]`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/script.tsx`. **Contenido:** `app/vsl/_competencia/script.ts`.

## Fuente

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo | «GetHookd»: es **Inter 4.001 variable con eje óptico** (`opsz` 14–32, `wght` 100–900) renombrada; el archivo que sirven (`/font/UcCo3FwrK3iLTcviYwY.woff2`) es byte a byte el de Google Fonts | 400, 540, 600, 650, 700, 750, 800, 820, 850 | el mismo archivo, `public/vsl-assets/fuentes/inter/inter-latin-opsz-var.woff2` (un solo variable cubre todos los pesos; `font-optical-sizing` automático, como en la referencia) |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Fondo | `#FFFFFF` | igual |
| Tinta de títulos | `#061523` (rgb 6 21 35); oscuro de la banda `#0B1A27` | igual |
| Texto secundario | `#52616E` (lede, tarjetas), `#5F6D7A` (cabezas), `#354351` (bajada del hero), `#2B3A47` (viñetas) | igual |
| Marca | `#3352FF` (botones, rótulos, viñetas, números) | `#2F6FED`; el hover `#1F57C8` |
| Tintes de la marca | `#EDF0FF` / `#EEF1FF` (chip, ícono), `#F5F7FF` + filete `#CCD4FF` (banda final), `#D3DAF7` (línea punteada), `#9FB0FF` (segunda línea del cierre), `#4D5DF7` (botón del cierre) | `#EAF1FE`, `#F4F7FE` + `#C9D9FB`, `#CFDDF9`, `#9DBDF6`, `#2F6FED` |
| Degradado del titular | `linear-gradient(100deg, #3352FF 0%, #6F5CFF 20%, #00B3FF 40%, #6F5CFF 60%, #3352FF 80%, #3352FF 100%)`, `background-size: 250% 100%`, animación `hlFlow` 3 s lineal (de 0 % a −250 %) | `#2F6FED`, `#6E8FF8`, `#00B3FF`; la misma animación |
| Filetes | `#EEF0F2` (barra), `#E2E6EA` (tira, pie, preguntas), `#DCE2E7` (tarjeta Ask, caja del chat), `#E0E5EA` / `#E3E8EC` (tarjetas) | igual |
| Banda de preguntas | `#F7F9FA`, filetes `#E7EBEE` | igual |
| Cierre | `#0B1A27`; `::before` viñeta `radial-gradient(rgba(11,26,39,.72) 0, rgba(11,26,39,.55) 38%, rgba(11,26,39,.15) 75%)` sobre dos tiras de anuncios al 42 % | el fondo igual; en vez de las tiras de anuncios (de otros), una grilla tenue enmascarada |

## Contenedor y espacios (1440)

- **Contenedor:** 1240 px centrado (x = 100). Hero: copia de 1392 px con 24 de margen. Tarjeta Ask: 1120 px (x = 160).
- **Barra:** 82 px (81 + filete de 1 px `#EEF0F2`), fondo `rgba(255,255,255,.98)`. Logo 144 × 37. Links al centro con
  34 px de separación, 15 px / 650 / 21 px, `#6F7781`. «Login» 16 px / 650. Botón: 232 × 50, radio 9, padding 0 19, 14 px /
  800, sombra `0 10px 24px rgba(51,82,255,.18)`, flecha de 15 px con 10 de separación; hover `translateY(-1px)` y azul oscuro.
- **Hero** (`section.hero`): padding 76 / 72. `::before`: grilla de líneas de 1 px `rgba(51,82,255,.055)` cada 76 px,
  enmascarada con `radial-gradient(78% 62% at 50% 34%, #000 30%, transparent 78%)`. `::after`: halo de 1180 × 780 centrado,
  arriba (top −197), `radial-gradient(rgba(51,82,255,.13), rgba(120,92,255,.07) 42%, transparent 70%)`.
  - Píldora de prueba social (40 px, radio 999, 11.5 px / 700): **no va** (son sus clientes).
  - Rótulo: 17 px / 800, `letter-spacing −0.085px`, azul, centrado; 12 px hasta el titular.
  - Titular: 63.36 px / 600 / interlínea 63.36 / `letter-spacing −3.8px` (−0.06 em), dos líneas.
  - Bajada: 24.768 px / 540 / 34.68, máx. 850, `#354351`, 20 px abajo del titular.
  - Botón: 265 × 52, padding 0 23, 16 px / 800, separación 11; 28 px abajo.
  - Chips: 41 px de alto, padding 8 15 8 9, radio 13, fondo `rgba(255,255,255,.7)`, borde `rgba(16,38,64,.08)`, separación 8;
    ícono en cuadro de 23 px radio 8 `#EEF1FF`; texto 13.5 px / 600 `#5B6B7B` con la cifra en 800 `#101F2E`. Hover: borde
    `rgba(51,82,255,.22)` y `translateY(-1px)`.
  - Tira «Trusted by teams at»: padding 30 / 34, filete de abajo `#E2E6EA`. Rótulo 12 px / 700 / `letter-spacing 1.92px`
    (0.16 em), mayúsculas, `#5F6D7A`. Logos de 24–34 px de alto al 50 % de opacidad, separación 60, carrusel de 48 s.
- **Tarjeta «Ask your AI»** (`section.agent-showcase`): 52 px abajo de la tira, 1120 × 820, padding 56 / 56 / 38, radio 26,
  borde `#DCE2E7`, sombra `0 24px 80px rgba(6,21,35,.12)`, fondo blanco con grilla de 90 px `rgba(51,82,255,.055)`;
  `::before` halo `radial-gradient(circle, rgba(51,82,255,.09), transparent 70%)`.
  - Cabeza: grilla `1fr 274px`, separación 40, alineada abajo. Rótulo «[ AI AGENT ACCESS ]» 11 px / 820 / `letter-spacing
    1.1px`; insignia 9 px. Titular 70 px / 700 / 68.6 / `letter-spacing −3.85px`. Texto 17 px / 400 / 25.84, máx. 660,
    `#52616E`. Botón gris 274 × 48, radio 12, `#F2F4F6`, 14 px / 800 `#1D2B37`; hover `#E9EDF0`.
  - Demo (820 de ancho, 112 abajo de la cabeza): fila de tarjetas de 137 × 178 (radio 14, borde `#E3E7EB`, sombra
    `0 14px 34px rgba(6,21,35,.13)`) que entran con `opacity 0 → 1` y `scale(.9) translateY(26px) → none` en 0.42 s
    `cubic-bezier(.2,.75,.2,1)`. Caja del chat 820 × 104, radio 20, padding 18 18 18 20, separación 12, sombra
    `0 18px 38px rgba(6,21,35,.1)`; chip `#EDF0FF` radio 999 padding 8 10, 11 px / 850 `#2945E4`; texto 17 px; cursor de
    2 × 18 que parpadea (0.72 s); botón redondo de 44 con sombra `0 8px 20px rgba(51,82,255,.25)`.
  - «Works with your AI» (12 px / 700 y cinco círculos de 42): **no va** (MaKo no se conecta a esas IA).
- **Bandas** (`section.band`): padding 96 / 96. Rótulo 11 px / 850 / `letter-spacing 1.54px` (0.14 em), azul, mayúsculas;
  12 px hasta el h2. H2 56 px / 700 / 57.12 / `letter-spacing −2.8px` (−0.05 em), máx. 900. Lede 18 px / 400 / 28.44, máx.
  720, 16 px abajo del h2; 44 px hasta lo que sigue.
- **«Two ways to run it»** (`div.sx`): grilla `592px 56px 592px`, 24 px entre filas, 0 entre columnas.
  - Cabezas: radio 18, padding 30 / 28, borde `#E0E5EA`, sombra `0 12px 32px rgba(6,21,35,.06)`. Rótulo 10.5 px / 850 /
    `letter-spacing 1.365px`; h3 26 px / 700 / `letter-spacing −0.91px` (14 px abajo); texto 16 px / 24.8 `#5F6D7A` (10 px);
    lista 18 px abajo, cada renglón 15.5 px / 23.25 `#2B3A47`, padding izquierdo 24, 11 px entre renglones, viñeta = `::before`
    de 12 × 6 con borde izquierdo y de abajo de 2 px azul, rotada −45°. Insignias de plan: **no van**.
  - «OR»: círculo de 44, borde `#DFE4EA`, sombra `0 8px 22px rgba(6,21,35,.1)`, 11 px / 850.
  - Tarjetas de las columnas: radio 18, borde `#E3E8EC`, sombra `0 10px 30px rgba(11,26,39,.06)`; imagen de 590 × 364
    (fondo `#0F1C27`, un video de su app sobre una onda azul); texto con padding 18 / 20 / 20: rótulo 10.5 px / 850 /
    `letter-spacing 1.47px` con el número en un cuadro azul de 24 px radio 8 (12 px / 850 blanco), h4 21 px / 700 / 24.78 /
    `letter-spacing −0.63px` (10 px abajo), texto 16 px / 24 `#52616E`.
  - Entre columnas, una línea punteada de 2 px `#D3DAF7`.
  - Banda del final: 45 px abajo, fondo `#F5F7FF`, borde `#CCD4FF`, radio 18, padding 24 / 26; texto 19 px / 750 / 26.6 /
    `letter-spacing −0.38px` máx. 660; dos líneas de 2 × 44 px (`linear-gradient(transparent, azul)`) que bajan de cada
    columna. El botón como el del hero.
- **Preguntas** (`section.band.alt`): grilla `480px 690px`, separación 70. Rótulo «[ F.A.Q ]» y h2 de 56 px a la izquierda,
  con «Can't find the answer…» 16 px / 25.6 y el link en 750 azul. Acordeones (`details`): filete `#E2E6EA`; `summary`
  padding 22 / 0, 18 px / 700 / `letter-spacing −0.36px` `#0B1A27`, chevron de 16; hover azul; abierto, el chevron gira 180°
  y se pone azul (0.25 s). Respuesta 16 px / 26.56 `#52616E`, padding derecho 40.
- **Cierre** (`section.closer`): padding 120 / 196, `#0B1A27`. H2 60 px / 700 / 61.2 / `letter-spacing −3px` blanco,
  centrado, máx. 860, con la última frase en `#9FB0FF`. Texto 19 px / 29.45 `#B7C3CE`, máx. 620. Botón 288 × 56, radio 12,
  padding 18 / 30, 17 px / 700, `#4D5DF7`, sombra `0 0 0 6px rgba(77,93,247,.18), 0 18px 40px rgba(77,93,247,.35)`.
  Letra chica 13 px (la prueba gratis): **no va**.
- **Pie** (`footer`): filete arriba `#E2E6EA`, padding 56 / 34. Arriba, grilla `571px 295px 295px` separación 40: logo
  150 × 39 y frase 19 px / 500 / 28.5 máx. 460 (31 px abajo); columnas con título 14 px / 500 `#687886` y links 18 px / 500 /
  25.2 `#061523`, 14 px entre links. En medio (64 px abajo), «More from GetHookd» a lo ancho. Abajo, filete y padding 26;
  links 15 px / 500. Hover de links: azul.

## Teléfono (390)

- Márgenes de 14 px. Barra de 70: logo 104 × 27, botón 155 × 40 (padding 0 9, 10 px / 800) y hamburguesa.
- Hero: padding 55 / 48. Rótulo 15 px / 800 / 21, máx. 320. Titular 34 px / 600 / 35.02 / `letter-spacing −1.87px`. Bajada
  18 px / 540 / 26.1. Botón a lo ancho (máx. 360), 52 de alto. Chips de 33 px, padding 6 11 6 7, radio 11, separación 6.
- Tira: padding 34. Tarjeta Ask: 370 de ancho (10 de margen), radio 19; cabeza en una columna con 18 de separación; titular
  42 px / 41.16 / `letter-spacing −2.31px`; texto 15 px / 22.8; botón gris de 42; caja del chat con padding 14.
- Bandas: padding 64; h2 34 px / 34.68 / `letter-spacing −1.7px`.
- «Two ways»: las dos cabezas siguen lado a lado (176 cada una, 10 de separación), padding 18 / 16, h3 18 px / 20.7, texto
  13.5 px / 19.575, sin la lista; el «OR» de 34 entre las dos. Las tarjetas pasan a una columna (362), imagen de 222, con una
  etiqueta arriba a la izquierda («In the app» en `rgba(11,26,39,.84)`, «With your AI agent» en azul al 94 %, 9.5 px / 850,
  radio 7); texto con padding 14 / 16 / 16, h4 19 px / 22.42. La banda del final en columna, padding 22 / 20.
- Preguntas en una columna (26 de separación). Cierre: h2 34 px / 34.68. Pie en una columna (34 de separación), links 17 px.

## Lo que quedó distinto, y por qué

- Sin la píldora de prueba social del hero, el hero arranca 58 px más arriba.
- La tira de logos lleva el caso de Mauricio: su nombre y el titular en el rótulo, y sus tres meses en el lugar de los logos
  (estáticos: tres no llenan una cinta). El video del caso no tiene lugar en esa tira.
- Sin la fila «Works with your AI», la tarjeta de la demo mide lo que piden sus filas (mínimo 590, como la suya).
- (14/11) Las tarjetas de la columna de la app son grabaciones de MaKo puestas como una ventana sobre el fondo azul (la suya
  trae el fondo dentro del video); el paso 1 es la conexión dibujada (Meta → MaKo), no un video.

## Segunda mirada (14/11/2026, noche): lo que se mueve, medido

Relevo con Chromium a 1440 × 900 y 390 × 844 (scroll con la rueda de 90 px cada 110 ms, `getAnimations()` en cada paso,
`MutationObserver` e `IntersectionObserver` espiados, la demo leída cada 250 ms durante 30 s, hovers en una página limpia).
Capturas, videos y scripts: notas de la sesión, `referencias-landings/script/`. **Su CSS y sus scripts vienen DENTRO del HTML**
(`curl` lo trae, Cloudflare no frena): los tiempos de abajo son los de su código, y el navegador los confirmó.

- **La página es la variante D de una prueba A/B** (`<html data-ab-arm="variant_d">`, `abTestId: "variant_d_starter_plan"`): su
  barra y su pie sólo se muestran con ese atributo. La estructura es la del 11/11.
- **La demo de «Ask your AI» (`[data-agent-interface]`)**: cuatro escenas — «Show me trending wellness ads» (cinco anuncios),
  «Find brands scaling on Meta this week» (tres marcas con su curva), «What's working for Avera Hair Care right now?» (gancho,
  formato y ángulo) y «Turn this ad into 3 new statics» (tres anuncios). Escribe a 18 ms por letra (12 el espacio, 55 la coma)
  después de 260 ms; 120 ms después de la última letra las tarjetas entran de a una cada 115 ms (opacidad y `translateY(26px)
  scale(.9)` → nada, 0,42 s `cubic-bezier(.2,.75,.2,1)`); 2,86 s después salen al revés cada 70 ms, a los 90 ms el texto se
  apaga (`opacity 0`, `translateY(5px)`, 0,22 s) y a los 470 ms empieza la siguiente: **≈4,2 s por escena**. Corre sólo con el 25 %
  a la vista; la flecha (44 px) pasa a la siguiente. Con «menos movimiento», la escena quieta y entera.
- **Las `.rv`**: `opacity 0` y `translateY(26px)` → nada en 0,7 s `cubic-bezier(.2,.7,.2,1)`, con 0,09 / 0,18 / 0,27 s de demora
  (`d1`/`d2`/`d3`), al entrar con umbral 0,18 y `rootMargin: 0 0 -8% 0`. 32 en la página: rótulos, titulares, bajadas, las
  cabezas, el «or», cada tarjeta, la banda del final y las preguntas.
- **«Two ways to run it»**: cada tarjeta de la app trae su video (`muted loop playsinline preload="none"`, 17,9 / 31,2 / 49 / 13,5 /
  29,2 s, 1280 de ancho; el paso 1 14 s y el 2 29,4 s; el 3 no es video). Se calientan 600 px antes de llegar y corre SÓLO el que
  más se ve de cada columna (≥ 35 %): en la computadora dos a la vez (uno por columna), en el teléfono uno. El paso 2 queda
  `position: sticky; top: 88px` mientras pasan Brand Spy, Shops y Boards (filas 3 a 5). Cuando las cabezas salen por arriba aparece
  la barra de cada columna (`sticky; top: 16px`, 52 px, `opacity 0 → 1` y `translateY(-10px) → 0` en 0,28 s; sólo desde 861 px).
  El paso 3 (`.sx-chat`, blanco con grilla de 36 px) corre un ciclo de 9 s sólo con el 35 % a la vista: quieto con el resultado
  (0–30 %), se borra (34 %), se escribe en `steps(34)` (37–62 %), la flecha se aprieta a `scale(.84)` (65 %) y caen las tres
  tarjetas, cada una 0,35 s después de la otra (76 %).
- **Lo que corre siempre**: el degradado del titular (3 s), la cinta de logos (48 s, se frena con el mouse), el cursor (0,72 s) y,
  en el cierre, dos cintas de anuncios de 150 px de alto (60 s y 75 s al revés) al 42 % debajo de la viñeta.
- **Hovers** (estilo calculado a los 120 y 900 ms): botones a `#2945E4` y `translateY(-1px)`; chips con el borde al 22 % de azul y
  `-1px`; «Learn more» a `#E9EDF0` y `-1px`; la flecha de la demo igual que los botones; preguntas a azul (el chevrón queda gris
  `#8A949D` y se pone azul sólo abierta); links del pie a azul. **Las tarjetas (las cabezas y las de las columnas) NO tienen
  hover**: la copia de antes subían 2 px y se sacó.

### Lo que va en su lugar en MaKo

- Demo: «¿Qué anuncios tiene activos Alex Hormozi?» (cinco de sus 14 activos con los días de Spy), «¿A dónde manda sus anuncios?»
  (los tres destinos de «A dónde mandan»), «¿Qué le funciona en sus videos cortos?» (lo que dice «¿Qué formatos le funcionan?»:
  Storytime 14,6×, su gancho, Tutorial 0,6×) y «Replica su reel con mi oferta» (el guion real de Copywriting). Datos de
  `C:/dev/bancos-portada/banco-spy-gurus/hormozi-funnel.json` con `lib/spy-detalle.ts`.
- Columna de la app: «Anuncio ganador» y «Hooks y retención» (las hojas, grabadas con los datos de ejemplo de su plantilla), los
  anuncios de Hormozi en Spy, su gancho, y su reel replicado. Cada grabación va como una ventana sobre el fondo azul, como las suyas.
- Paso 3: el pedido «Replica su reel con mi oferta» y las tres partes del guion (gancho, historia, llamado), con su ciclo de 9 s.
- Cierre: las dos cintas con anuncios de Hormozi que guardó Spy (`public/vsl-assets/script/anuncio-<id>.jpg`).
- No van: «Works with your AI», las insignias de plan, «Find the store…», los precios, la píldora de prueba social, la letra chica.
