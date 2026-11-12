# /vsl/dashboard — los valores medidos de su referencia

**Referencia:** la portada de Reportei en español — https://reportei.com/es/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales.
**Diseño copiado en:** `app/vsl/_competencia/disenos/dashboard.tsx`. **Contenido:** `app/vsl/_competencia/dashboard.ts`.

⚠️ A 1440, con el idioma del navegador en es-MX, su barra se parte en dos renglones (el selector «Español» baja solo y la
barra mide 150 px). Se copió la barra de un renglón (10 px de aire + la fila de 70), que es como se ve con los ítems enteros.
⚠️ Su tarjeta «Informes» (la primera de las de colores) se dibuja a medio animar en las dos medidas (557 × 58 a 1440): se
tomaron los valores de su gemela «Dashboard», que está entera.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares, rótulos de tarjeta, títulos de tarjeta | Quicksand (Google Fonts, OFL) | 700 | la misma, `public/vsl-assets/fuentes/quicksand/quicksand-latin-700.woff2` |
| Texto, botones, links, pie | Inter (Google Fonts, OFL) | 400, 500, 600, 700, 800 | la misma, variable: `public/vsl-assets/fuentes/inter/inter-latin-var.woff2` |

## Colores

| Qué | Reportei | En MaKo |
|---|---|---|
| Fondo | `#FFFFFF` | igual |
| Texto | `#212B30`; párrafos `#455A64`; rótulo gris `#78909C` | igual |
| Titulares (su azul de marca) | `#0054C2` | azul oscuro de MaKo `#1F57C8` |
| Palabras resaltadas (su verde de marca) | `#13BD49` (sobre blanco), `#54E279` (sobre la banda azul) | dorado `#F2B01E` |
| Botón de la barra «Probar gratis» | `#2F64E0`, texto blanco | azul `#2F6FED` (hover `#1F57C8`) |
| Botón del hero y «Quiero probar gratis» | verde `#13BD49` | azul `#2F6FED` |
| «Entrar» | texto `#2F64E0` | «Todas las funcionalidades», texto `#2F6FED` |
| Píldora de GetApp | fondo `#EAF4FF`, texto `#2F64E0` | fondo igual, texto `#2F6FED` |
| Fondo de la captura del hero | `#E3EEFC` (dentro de la imagen) | igual |
| Filete de la tarjeta de la captura | verde `#13B74A`, 4 px | dorado `#F2B01E`, 4 px |
| Tarjeta verde «Informes» | fondo `#EEFBF2`, rótulo `#0A9B38`, título `#0A782D` | igual |
| Tarjeta celeste «Dashboard» | fondo `#EDF9FF`, rótulo `#0D8DC7`, título `#0A6E9B` | (no va: ver abajo) |
| Tarjeta naranja «Automatización» | fondo `#FFF2EE`, rótulo `#D14D24`, título `#A33C1C` | igual |
| Tarjeta gris «Control» | fondo `#F4F6FA`, rótulo y título `#00449D` | igual |
| Tarjeta lila «Línea de tiempo» | fondo `#F6F1FA`, rótulo `#954CDC`, título `#6E35A7` | igual |
| Tarjeta «Overview» | fondo `#F0F7FF`, rótulo `#0054C2`, título `#003375` | (no va) |
| Tarjeta «Reportei AI» | fondo `#FFF8EC`, rótulo `#CD820A`, título `#A06508` | (no va) |
| Tarjetas de borde fino (Studio, MCP) | `#F4F8FF` borde `#DCE6F4` · `#EEFBF2` borde `#D8EFDF`; títulos `#0757C9` | fondos y bordes iguales; títulos `#1F57C8` |
| Banda «Los indicadores de todos tus canales» | `#0054C2`, título blanco, texto `#BAD2F1` | `#1F57C8`, título blanco, texto `#BAD2F1` |
| Banda de testimonios | `#2F64E0`, texto blanco, cargo `rgba(255,255,255,.45)` | `#2F6FED`, el resto igual |
| Pie | `#F9FAFB`, texto `#212B30` | igual |

## Contenedor, espacios y escala (1440)

| Qué | Valor |
|---|---|
| Contenedor | 1200 px centrado (desde x = 120); pie 1160 px (desde x = 140) |
| Barra | 10 px de aire + fila de 70 (80 en total); logo a 10 px del borde del contenedor; «Entrar» y botón separados 19 px |
| Botón de la barra | Inter 18/21.4 700, `padding 13px 18px`, radio 12, 150 × 47; transición `0.2s linear` |
| Hero | `padding 100px 0 40px`; texto en una columna de 504 px con `gap 24px`; captura de 660 × 583 en x = 660, con `margin-top -24px` |
| H1 | Quicksand 40/52 700, `letter-spacing -0.2px` |
| Texto del hero | Inter 17/22.1 500; dos párrafos separados por un renglón |
| Píldora | Inter 16/21.6 500, `padding 8px 12px`, radio 12 |
| Botón del hero | Inter 18/21.6 500, `padding 13px 18px`, radio 12, alto 48 |
| Captura del hero | fondo celeste en x 710 → 1273 (radio ≈ 24); tarjeta blanca de x 756 → 1300 con filete de 4 px arriba, radio 8, sombra `0 5px 16px rgba(5,15,36,.18)` |
| Franja de integraciones | rótulo Inter 14/18.2 800 mayúsculas (328 px de ancho), centrado en alto con la grilla; íconos de 24 px cada 42 en horizontal (gap 18) y cada 44 en vertical (gap 20) |
| Sección de tarjetas | 120 px arriba; H2 Quicksand 32/41.6 700 centrado en 792 px |
| Tarjetas de colores | radio 24; separación 40 px en vertical y en horizontal |
| Tarjeta ancha | 1200 × 330, `padding 0 40px`; captura a la izquierda (507 × 290, pegada abajo), texto a la derecha desde x = 739 (365 px de ancho) |
| Tarjetas altas | tres de 373 px, `padding 40px 40px 0`, captura abajo |
| Rótulo de tarjeta | chip de 31 × 32 + 16 px + Quicksand 18/23.4 700; título Quicksand 24/28.8 700 a 24 px del rótulo |
| «Quiero saber más» | Inter 16/21.6 700 `#849287` con flecha |
| Tarjetas de borde fino | sección `padding 32px 0 56px`, grilla `588px 588px` con gap 24; tarjeta `padding 32px`, radio 20, borde 1 px; marca (ícono 32 + Inter 18 700, gap 12, 20 px abajo); título Quicksand 28/35 700; texto Inter 17/25.5 400; botón Inter 18/25.2 600, `padding 12px 20px`, radio 12 |
| Banda azul | 542 px de alto (≈ 110 arriba y abajo); título Quicksand 32/38.4 700 en 316 px desde x = 130; texto Inter 16/20.8 500 en 376 px; grilla de íconos de 48 px en círculos `#ECF0F1` cada 64 px, de x ≈ 606 a 1102 |
| Testimonios | `padding 62px 0`; 880 px de ancho; título Quicksand 20/24 700; link Inter 20/26 700 subrayado; tres columnas (logo de 160 × 51–80, cita Inter 18/21.6 500 a 35 px del logo, foto redonda de 64 + nombre Inter 18/21.6 700 + empresa Inter 16/19.2 500) |
| Pie | 60 px arriba; columna del logo (154 × 31) de 240 px y cuatro columnas de 206 px con 32 de separación; títulos Inter 18/23.4 600; links Inter 16/25.6 400 cada 31–32 px; base de 92 px con Inter 14/21 centrado |

## A 390 px

| Qué | Valor |
|---|---|
| Barra | 70 px; logo a 10 px del borde; «Probar gratis» pasa a ser un link azul Inter 18 y aparece la hamburguesa |
| Hero | 64 px arriba; aire de 24 a los lados; H1 Quicksand 32/41.6; **la captura va entre el título y el texto**, a todo el ancho (390 × 344); texto Inter 16/20.8 500; la píldora ocupa todo el ancho, centrada |
| Franja | rótulo Inter 15/19.5 800 arriba, íconos de 24 en una grilla de 8 por fila debajo |
| H2 de tarjetas | Quicksand 24/31.2, alineado a la izquierda |
| Tarjetas de colores | una columna de 342 px, `padding 24px 24px 0`, separación 24; rótulo Quicksand 16/20.8, título Quicksand 20/24; en la ancha, el texto arriba y la captura abajo |
| Tarjetas de borde fino | la sección va de x = 20 a 370; título Quicksand 26/32.5 |
| Banda azul | título Quicksand 32/38.4 y texto Inter 16/20.8 a 24 px del borde, la grilla debajo |
| Testimonios | título Quicksand 18.24/21.9; columnas apiladas (x = 20, 321–350 px), logo centrado, foto de 64 centrada |
| Pie | logo centrado arriba; columnas apiladas a 16 px del borde |

## Lo que en MaKo es distinto, y por qué

- **Su barra lleva seis links de sus productos**: MaKo no los tiene. Queda el logo, «Todas las funcionalidades» (a /vsl) en el
  lugar de «Entrar» y el botón de la llamada en el de «Probar gratis».
- **Sin insignia de GetApp ni «+10.000 clientes»**: la píldora celeste lleva la etiqueta del hero con la estrella de MaKo en el
  lugar del trofeo.
- **La captura del hero** es el gráfico de la landing (la retención del VSL, `FEATURE_VISUALS.dashboard.hero`) dentro de la misma
  tarjeta blanca sobre el mismo fondo celeste, sin las dos tarjetitas que flotan encima (son pantallas de su producto).
- **Sin la caja «Más de 10.000 empresas… usan Reportei»** (logos de clientes, video y botón).
- **Las tarjetas**: seis piezas de MaKo en la ancha (con el gráfico de ventas), las tres altas (sin captura) y las dos de
  borde fino (sin su botón). Sin «Quiero saber más». Sus tarjetas «Overview» y «Reportei AI» no van.
- **La banda azul** lleva el gráfico del embudo en lugar de su grilla de íconos de canales.
- **Los testimonios** son el caso de Mauricio: los tres meses en el lugar de los logos, su historia en el de las citas y su
  video, redondo, en el lugar de la foto. Sin «Todos los testimonios →»: va la línea «Sin cambiar la oferta…».
- **Sin** los sellos de Capterra y GetApp, «Conoce la herramienta», Flux, Sync ni el texto de SEO con su dibujo.
- **El pie** lleva una columna «Funciones de MaKo» con el resto de las landings en cuatro columnas de 206 px, y la base lleva la
  descripción de la landing en el lugar de su línea de SEO.
