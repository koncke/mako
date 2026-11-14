# /vsl/dashboard — los valores medidos de su referencia

**Referencia:** la portada de Reportei en español — https://reportei.com/es/
**Medido:** 11/11/2026 y otra vez el **14/11/2026** con Chromium (Playwright) a 1440 × 900 y a 390 × 844: `getComputedStyle` y
`getBoundingClientRect` sobre los elementos reales, capturas por sección, video del scroll lento con una parada en cada sección,
`getAnimations()` en cada paso, MutationObserver, IntersectionObserver, los estilos de 106 elementos antes y 80/700 ms después del
hover y un clic en cada pestaña. Scripts y capturas: carpeta de notas de la sesión, `referencias-landings/dashboard/` (`relevo.md`).
**Diseño copiado en:** `app/vsl/_competencia/disenos/dashboard.tsx`. **Contenido:** `app/vsl/_competencia/dashboard.ts`. **Pantallas:**
banco `C:/dev/bancos-portada/banco-dashboard-landing/` (los números del negocio de ejemplo, en su `ejemplo.ts`).

## ⚠️ Lo que cambió desde el 11/11

- Entre las tarjetas y los testimonios hay secciones nuevas o que no se habían medido: la **caja celeste** «Más de 10.000 empresas…»
  (muro de logos de clientes en dos filas que corren y un video de YouTube), **«Conoce la herramienta»** (siete pestañas con la captura
  de cada función, visible a 1440 y escondida a 1024 o menos), los **precios** (un iframe con la promoción «Cyber Month»), **Flux** y
  **Sync**.
- Las siete tarjetas pastel llevan captura (las tres altas también) y son LINKS enteros, con «Quiero saber más →».
- La primera tarjeta («Informe») se dibuja ROTA en su sitio a 1440 y a 390 (557 × 58, con la captura afuera): se copió como su gemela
  «Overview» (texto a la izquierda, captura pegada abajo a la derecha).

## Lo que se mueve (exacto)

- Su hero es una IMAGEN quieta (`hero-mkp-esp.png`, 660 × 583): cuatro capturas cada 2 s, idénticas.
- El muro de logos: `.rpt-client-track` con `rpt-client-scroll` (`translateX(-50%)`), 48 s lineal, la segunda fila al revés en 55 s;
  las filas con `mask-image` (transparente → negro al 3 % y al 97 %); se frena con el mouse encima o con la casilla «Pausar logos».
- El video de la caja: YouTube con `autoplay=1`, mudo y en bucle (`data-settings` de Elementor), 1080 × 608 dentro de un borde blanco
  de 12 px. A 390 la caja no lo muestra.
- Sus premios: un carrusel Swiper (5 por vista, cada 6 s, con puntos). No va (MaKo no tiene premios).
- La barra se achica al bajar (200 ms): la tapa la barra del sitio.
- Ninguna aparición al bajar: Elementor no tiene `_animation` en esta página.

## Hovers (antes → después, medidos)

| Qué | Cambio | Tiempo |
|---|---|---|
| Botones verdes | `#13BD49` → `#41D771` (se ACLARAN) | 0,3 s |
| Tarjetas pastel | el fondo baja un escalón: verde `#EEFBF2`→`#DFF7E6`, celeste `#EDF9FF`→`#DBF4FF`, naranja `#FFF2EE`→`#FFEBE5`, gris `#F4F6FA`→`#E9EEF5`, lila `#F6F1FA`→`#EDE5F6`, azul `#F0F7FF`→`#E5F0FF`, ámbar `#FFF8EC`→`#FEF3DD`. NO suben (el `transform` está en la transición y no cambia) | 0,3 s |
| Botones de Studio y MCP | `#0757C9` → `#034399` y un aro `3px #C3D9FA` a 3 px | 0,2 s lineal |
| Íconos de la franja | opacidad 1 → 0,9 | 0,3 s |
| Pestañas | fondo gris claro | — |
| Píldora de GetApp | la letra `#2F64E0` → `#1876F2` | 0,3 s |
| Links del pie | opacidad 1 → 0,7 | 0,2 s |

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares, rótulos y títulos de tarjeta | Quicksand (Google Fonts, OFL) | 700 | la misma, `public/vsl-assets/fuentes/quicksand/quicksand-latin-700.woff2` |
| Texto, botones, links, pie | Inter (Google Fonts, OFL) | 400–800 | la misma, variable: `public/vsl-assets/fuentes/inter/inter-latin-var.woff2` |

## Colores

| Qué | Reportei | En MaKo |
|---|---|---|
| Titulares | `#0054C2` | azul oscuro `#1F57C8` |
| Palabras resaltadas | verde `#13BD49` (sobre blanco), `#54E279` (sobre la banda azul) | dorado `#F2B01E` |
| Botones verdes | `#13BD49` → `#41D771` | azul `#2F6FED` → `#5A8DF2` |
| Texto / párrafos / rótulo gris | `#212B30` / `#455A64` / `#78909C` | igual |
| Píldora | fondo `#EAF4FF`, letra `#2F64E0` | igual, letra `#2F6FED` |
| Caja celeste | `#F1F7FD`, radio 24; baldosas blancas con borde `#E7EDF3` | igual |
| Tarjetas pastel | rótulos `#0A9B38`, `#0D8DC7`, `#D14D24`, `#00449D`, `#954CDC`, `#0054C2`, `#CD820A`; títulos `#0A782D`, `#0A6E9B`, `#A33C1C`, `#00449D`, `#6E35A7`, `#003375`, `#A06508`; fondos en la tabla de hovers | igual |
| «Quiero saber más» | `#849287` 16 px 700 | igual |
| Studio · MCP | `#F4F8FF` borde `#DCE6F4` · `#EEFBF2` borde `#D8EFDF`; marca y títulos `#0757C9` | iguales; marca y títulos `#1F57C8` |
| Banda azul | `#0054C2`, título blanco, texto `#BAD2F1`, íconos en círculos `#ECF0F1` | `#1F57C8`, el resto igual |
| «Conoce la herramienta» | sección `#F9FAFB`; caja blanca con borde 2 px `#ECF0F1`; pestaña elegida `#E3EEFC` con letra `#2F64E0` 700 | igual, letra `#2F6FED` |
| Testimonios | `#2F64E0`, empresa `rgba(255,255,255,.45)` | `#2F6FED`, el resto igual |

## Medidas a 1440 (contenedor de 1200 desde x = 120)

| Qué | Valor |
|---|---|
| Hero | 100 px arriba; columna de texto de 504 px: H1 Quicksand 40/52 −0,2 (156 de alto), 24 px, párrafos Inter 17/22,1 500, 24, píldora 16/21,6 500 `8px 12px` radio 12, 24, la línea en negrita Inter 18/23,4 800 `#0054C2`, 40, el botón Inter 18/21,6 500 `13px 18px` radio 12 (48 de alto). Imagen 660 × 583 en x = 660, 24 px más arriba que el H1 |
| Franja | 212 px; rótulo Inter 14/18,2 800 mayúsculas `#78909C` de 328 px a x = 122; íconos de 24 |
| Caja celeste | 1200 × 1204, `padding 64px 48px 40px`, `gap 20px`; título Quicksand 24/33,6 700 `#212B30` centrado (703 px) con las palabras azules; dos filas de baldosas de 174 × 90 (`padding 18px`, radio 14, borde 1 px) cada 194 px, filas cada 108 (gap 18), con 12 px de aire arriba y abajo; «Pausar logos» Inter 14/21,6 `6px 12px` radio 8 borde `#DCE6F0`; el video 1104 × 632 (borde blanco de 12, radio 12, sombra `0 5px 16px rgba(5,15,36,.18)`) 31 px debajo; el botón 36 px debajo |
| Sección de tarjetas | 120 px arriba; H2 Quicksand 32/41,6 centrado en 792 px; tarjetas cada 40 px |
| Tarjeta ancha con la captura a la izquierda («Dashboard», «Reportei AI») | 1200 × 330/318, `padding 0 40px`, gap 79; captura 507–519 × 277–290 pegada abajo, 40 px debajo del borde; texto desde x = 739 |
| Tarjeta ancha con el texto a la izquierda («Overview»; la «Informe» rota) | 1200 × 305, `padding 0 40px 0 80px`, gap 20; texto desde x = 200 (≈400 px); captura 614 × 264 pegada abajo a la derecha |
| Tarjetas altas | tres de 373 × 535, `padding 40px 40px 0`, gap 24; captura de 293–313 px pegada abajo |
| Texto de tarjeta | ícono 31 × 32 + 16 + rótulo Quicksand 18/23,4 700; 24–28 px; título Quicksand 24/28,8 700; 25 px; «Quiero saber más» Inter 16/21,6 700 con su flecha de 24 |
| Studio y MCP | `padding 32px 0 56px`, dos columnas de 588 con gap 24; tarjeta `padding 32px`, radio 20, borde 1 px; marca (ícono 32 + Inter 18 700, gap 12) a 20 del título; título Quicksand 28/35 700 `margin 0 0 16px`; texto Inter 17/25,5 `margin 0 0 24px`; botón Inter 18/25,2 600 `12px 20px` radio 12, abajo de todo |
| Banda azul | 542 px; título Quicksand 32/38,4 en 316 px desde x = 130, 110 px arriba; 20 px; texto Inter 16/20,8 500 en 376 px; íconos de 48 en círculos cada 64 desde x = 606 (10 por fila, la última centrada) |
| «Conoce la herramienta» | `#F9FAFB`; H2 Quicksand 28/36,4 700 `#212B30`; 20 px; caja de pestañas de 1344 px (32 más que el contenedor de cada lado), borde 2 px, radio 16, `padding 12px`; pestaña `11px 19px` radio 12, ícono 24 + Inter 16/21,6; 16 px; la captura 1260 × 709 (con su ventana de navegador dibujada) a 10 px; párrafo Inter 18/23,4 `#455A64` 20 px debajo; botón 26 px debajo |
| Testimonios | `padding 62px 0`; 880 px; título Quicksand 20/24; link Inter 20/26 700 subrayado 20 px debajo; columnas 64 px debajo (logo 160, cita Inter 18/21,6 500, foto 53–60 + nombre Inter 18 700 + empresa 16/19,2 500) |

## A 390 px

| Qué | Valor |
|---|---|
| Hero | 64 px arriba, aire de 24; H1 Quicksand 32/41,6; **la imagen va entre el título y el texto, a todo el ancho** (390 × 344); texto 16/20,8; píldora a todo el ancho; la línea 16/20,8 800; botón Inter 16 |
| Franja | `margin 40px 24px 24px`; rótulo 15/19,5 arriba, íconos debajo |
| Caja celeste | a todo el ancho y sin radio, `padding 64px 24px`; título Quicksand 20/28; baldosas de 140 × 78 (`padding 14px`), filas con gap 12; **sin el video** |
| Tarjetas | `padding 0 24px`; H2 24/31,2 alineado a la izquierda, 80 px arriba; cada tarjeta `padding 24px 24px 0`, rótulo 16/20,8, título 20/24, la captura abajo a todo el ancho; separación 24 |
| Studio y MCP | `padding 20px 0 36px`, una columna con gap 20; tarjeta `padding 24px`; título 26/32,5 |
| Banda azul | `padding 0 24px`, 80 px arriba; título 32/38,4 y texto 16/20,8, los íconos debajo |
| «Conoce la herramienta» | escondida (`elementor-hidden-tablet elementor-hidden-mobile`); la muestra `.rpt-demo-revealed` cuando se toca un link a `#rpt-demo-…`, con las pestañas en una fila que se desliza (`overflow-x: auto`, `nowrap`) a 1024 px o menos |
| Testimonios | título 18,24/21,9; columnas apiladas, foto de 64 centrada |

## Lo que en MaKo es distinto, y por qué

- **Su hero** es una imagen quieta de su informe de Google Ads con dos tarjetas que flotan (el «Costo» con su límite y un mensaje de
  WhatsApp). Aquí: la hoja Marketing grabada con la cámara sobre sus números (`hero.webm`), en la misma tarjeta blanca sobre el mismo
  fondo celeste, y la tarjeta que flota es la meta del trimestre de General (`meta.webp`, la misma pieza de la tarjeta «Control», como
  en Reportei). Su mensaje de WhatsApp (el informe programado) no va: MaKo no manda informes programados.
- **La caja celeste:** su título y su muro de logos de clientes no son de MaKo; corren los tableros listos (las plantillas de «Nueva
  hoja», contadas del código) y su video es «¿Qué vas a crear hoy?» grabado (`nueva-hoja.webm`).
- **Sus siete tarjetas:** «Automatización de informes» y «Línea de tiempo» no existen en MaKo → «Compartir» (el link de
  `CompartirInforme`) y «Lo que vence» (la lista de General). Cada una lleva la foto de la pieza real.
- **Studio y MCP** → las hojas de análisis y la API de MaKo, con el botón para empezar.
- **«Conoce la herramienta»:** cuatro pestañas (General, Marketing, Comercial, Closing) con la entrada de cada hoja grabada.
- **Sin** sus premios, sus precios con la promoción, Flux, Sync ni el texto de SEO con su dibujo.
- **Los testimonios:** el caso de Mauricio (los tres meses donde van los logos, su historia donde van las citas, su video redondo).
- **La barra y el pie** copiados los tapan la barra y el pie del sitio (`BARRA_PROPIA`, `PieGlobal`).
