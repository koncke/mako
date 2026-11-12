# /vsl/funnel — los valores medidos de su referencia

**Referencia:** la portada de Hyros — https://hyros.com/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (la página es de Framer, con su CSS propio en clases `ncl-`, `hc-`, `hw2-`, `st2-`, `hfh-`, `pd-`, `bx-`).
**Diseño copiado en:** `app/vsl/_competencia/disenos/funnel.tsx`. **Contenido:** `app/vsl/_competencia/funnel.ts`.

⚠️ La página de Hyros cambió desde que se leyó su orden (el 11/11 a la mañana): hoy es hero → «Tracking $5B+ in ad spend
for:» → «How it works» → «Brands that add Hyros see» → «All / All / None» → «When we say any feature» → «Pick your business
model» → «What could you build with the Hyros MCP?» → la caja de la garantía → pie. El orden de `funnel.ts` sigue calzando.

## Fuentes

| Uso | Lo que se dibuja | En MaKo |
|---|---|---|
| Todo | `font-family` computado: **`sans-serif`** (su CSS nombra P22 Mackinac, Inter Tight e Inter, pero gana una regla `body,input,…{font-family:sans-serif}` y ninguna de las tres se aplica). En una Mac es Helvetica; en Windows, Arial | `Helvetica, Arial, sans-serif`: lo mismo que se ve en su página, sin bajar nada |

## Colores

| Qué | Hyros | En MaKo |
|---|---|---|
| Fondo de la página | crema `#FAF9F5` | igual |
| Hero, pasos-tarjetas, ventanas | blanco `#FFFFFF`, filete `rgba(31,30,29,.11)` | igual |
| Texto | `#1F1E1D`; secundario `#55534E`; rótulos `#8B8984` | igual |
| Su violeta (cajas resaltadas, píldoras, números, la banda) | `#5150F6` | azul `#2F6FED` |
| Tinte del violeta (píldora, fondo de «How it works») | `#EEEEFB` | `#EAF0FD` |
| Violetas claros sobre la banda | `#CFCEFF`, `#D3D2FF`; flecha del botón `#A5A4FA` | `#C9DAFB`, `#CFDDFB`; flecha `#9DBBF7` |
| Punto de la píldora «How it works» | violeta | dorado `#F2B01E` |
| Botón principal | negro `#1F1E1D`, texto blanco | igual |
| Botón secundario | arena `#EAE8E0`, texto `rgba(31,30,29,.9)` | igual |
| Cajas de «When we say any feature» | `#FBFAF6`, borde `#9A988F`; la última `#5150F6` con borde `#3E3DD6` | igual; la última `#2F6FED` con borde `#1F57C8` |
| Filas de la banda | `rgba(255,255,255,.09)`, borde `rgba(255,255,255,.3)` | igual |

## Contenedor, espacios y escala (1440)

| Qué | Valor |
|---|---|
| Contenedor | 1180 px (desde x = 130), con `padding 0 32px` en la barra, las secciones y el pie (contenido desde x = 162); el hero usa los 1180 enteros |
| Barra | 56 px; links 12 px `rgba(31,30,29,.78)` con 20 de separación; «Login» 12.5 px, `padding 7px 11px`, borde 1 px `rgba(31,30,29,.16)`, radio 6; «Book Demo» 12.5 px, `padding 8px 11px`, negro, radio 6 |
| Hero | blanco, filete arriba, `padding 72px 32px 84px`; texto de 516 px a la izquierda, ventana de 608 × 580 en x = 702, centrados en alto |
| Píldora | 12.5/16.25 500, `letter-spacing 0.125px`, `padding 7px 13px`, radio 999 |
| H1 | 46/48.3 400, `letter-spacing -0.46px`, a 17 px de la píldora; el segundo renglón en una caja: blanco sobre el violeta, `padding .03em .24em .09em`, radio .2em, `inline-block` sin cortar |
| Bajada | 18/27.9 400 `#55534E`, a 20 px del título |
| Botones | a 27 px; 15.5 px, `padding 15px 22px`, radio 7, separados 12; flechas de 12 px |
| Cita | 13/20.8 `#1F1E1D` + el autor en `#8B8984`, a 18 px de los botones |
| Ventana de la app | radio 14, borde 1 px, sombra `rgba(31,30,29,.45) 0 30px 60px -36px`; barra de 36 (puntos + título 11.5 px `#5E5D59` centrado); pie de 41 (`padding 12px 18px 14px`, 12.5 px `#55534E` con la segunda frase en violeta) |
| «Tracking $5B+ in ad spend for:» | 13 px `#55534E` centrado; fichas 13 px `rgba(31,30,29,.75)`, blancas, `padding 9px 15px`, radio 10, borde 1 px, separadas 8; la última en violeta |
| «How it works» | `#EEEEFB` (con un dibujo de ondas), `padding 88px 32px 96px`; píldora blanca 11 px, `letter-spacing 1.54px`, mayúsculas, `padding 7px 14px 7px 10px`; H2 58/63.8 400, `letter-spacing -1.16px`, con su caja; bajada 18/27 en 560 px |
| Tarjetas de pasos | tres de 348 × 358 (x = 170, 546, 922: 28 de separación), radio 22, borde 1 px, sombra `rgba(31,30,29,.12) 0 24px 60px`; escena de 172 px arriba (`#EEEEFB`); número 30 px violeta; título 23/27.6 400; texto 15/23.25 `#55534E`; aire de 29 px a los lados |
| «Brands that add Hyros see» | crema, `padding 96px 32px 0`; ícono de 96 × 72; H2 56/61.6 500, `letter-spacing -0.672px`, a 22 px; bajada 17/27.2 en 560 px |
| Ventana de cifras | 980 × 244 en x = 230, radio 12, sombra `rgba(31,30,29,.05) 0 10px 30px`; barra de 35 (`#FCFBF8`); cuatro columnas de ≈ 245 con filete entre ellas; rótulo 10.5 px `letter-spacing 1.05px` `#8B8984`; valor 38/39.9 400 (la segunda en violeta); curva; leyenda 12.5 px; pie de 39 (`#FCFBF8`) |
| «All / All / None» | `padding 96px 32px 72px`; «All» 96/86.4 en violeta; texto 34/40.12 |
| «When we say any feature» | `padding 40px 32px 104px`; píldora 10.5 px `letter-spacing 1.47px`, borde `#9A988F`, radio 8; cajas 38/39.9 500, `padding 8px 18px 10px`, radio 8, separadas 7; el cubo a la derecha (≈ 640 × 600) |
| «Pick your business model» | violeta, `padding 92px 32px 100px`; rótulo 10.5 px `letter-spacing 1.47px`; H2 44/48.4 500 (el resto en violeta claro); filas de 658 × 92, radio 16, `padding 15px 18px 15px 20px`, separadas 12: número 11 px, ícono blanco de 60 × 60 radio 12, título 23/26.45 500, texto 14/20.3, botón «Show me how» redondo |
| Pie | filete arriba, `padding 40px 32px 36px`; columna del logo (lema 13.5/20.25 `#55534E` + insignias) y cuatro columnas de 176 (x = 476, 685, 893, 1102); títulos 12.5 px `#1F1E1D`; links 13/26 `#55534E`; base con filete y 18 px de aire |

## A 390 px

| Qué | Valor |
|---|---|
| Barra | 50 px, el logo y la hamburguesa |
| Hero | `padding 0 20px`; píldora 12/15.6; H1 31.88/33.47; bajada 16/24; **la ventana va debajo del texto** y los botones a todo el ancho, apilados, debajo de la ventana |
| Fichas | 12.5 px, `padding 8px 12px`, en dos renglones |
| «How it works» | H2 38/41.8; tarjetas a todo el ancho (304 px de texto); título 21/25.2 |
| Cifras | H2 36/39.6; bajada 15.5/24.8; la ventana en 2 × 2; valor 30/31.5 |
| Cajas | 30/31.5, `padding 6px 14px 8px` |
| Banda | rótulo y título centrados; H2 30/33; filas con el ícono, título 19/21.85 y texto 12.5/18.1, y la flecha en un círculo |
| Pie | dos columnas; links 13.5/26.3 |

## Lo que en MaKo es distinto, y por qué

- **La barra**: sin sus menús; «Todas las funcionalidades» (a /vsl) con la forma de su «Login» y el botón de la llamada con la de
  su «Book Demo».
- **El hero**: la píldora lleva la etiqueta del hero (no su «+15–20 %»); el segundo botón baja a «Cómo funciona»; sin la cita de
  Tony Robbins; la ventana lleva el video de la landing (el mini-VSL de Funnels) con el nombre de la función en la barra y los
  dos renglones del hero en su pie, sin la barra oscura de su agente.
- **«Tracking $5B+ in ad spend for:»** es el caso de Mauricio: la misma línea y fichas (él con su video, y sus tres meses).
- **Las tarjetas de pasos** van sin la escena ilustrada de arriba (son pantallas de su producto).
- **La ventana de cifras** lleva lo que MaKo le avisa a Meta, evento por evento (el nombre del evento en el rótulo, qué pasó en
  el valor y cuándo en la leyenda), sin números, curvas ni el pie de la garantía.
- **Sin** «All / All / None», el bloque del MCP ni la caja de la garantía.
- **«When we say any feature»**: los renglones en cajas son el título de la fila; debajo, sus dos partes; a la derecha, el
  gráfico del recorrido con la bajada en la nota de «All powered by». En lugar del cubo, su cara de arriba: las fichas de lo que
  junta MaKo en la misma grilla isométrica, con la estrella de MaKo en la baldosa del centro.
- **La banda de modelos de negocio** son los tipos de funnel del CRM, sin «Show me how».
- **El pie** lleva el lema y el aviso de derechos del pie de /vsl, y una columna «Funciones de MaKo» con el resto de las
  landings en cuatro columnas de 176 px.
