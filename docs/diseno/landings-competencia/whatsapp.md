# /vsl/whatsapp — los valores medidos de su referencia

**Referencia:** la portada de Leadsales — https://leadsales.io/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (también los `::before` de la tabla, los estados `:hover` de los botones, los links y los videos, el
comportamiento de las pestañas de la galería y los anillos de la órbita del cierre).
**Diseño copiado en:** `app/vsl/_competencia/disenos/whatsapp.tsx`. **Contenido:** `app/vsl/_competencia/whatsapp.ts`.

⚠️ Las pestañas de su galería cambian la captura y la tarjeta que flota encima; el pie de la figura («De la interacción al
cierre…») no cambia. Su escenario tiene un título oculto, «Así funciona el CRM para WhatsApp de Leadsales»: en MaKo ese
título («Así funciona Chats») va visible en el pie de la figura.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo | DM Sans (la suya se llama «sans»: es DM Sans, leída con fontTools sobre su woff2) | 400, 500, 550, 600, 700 | DM Sans de Google Fonts (OFL), la variable latina (`public/vsl-assets/fuentes/dm-sans/dm-sans-latin-var.woff2`), que cubre todos |

## Colores

Su violeta de marca (#4145E3) pasa al azul de MaKo; sus tintes violetas y lilas, a la familia del azul de MaKo; sus rosas, a un
dorado claro (el dorado de MaKo al 60 % con blanco). Los neutros (tinta, grises, fondos casi blancos, el oscuro de testimonios y
el lila grisáceo del pie) quedan.

| Qué | Referencia | En MaKo |
|---|---|---|
| Tinta / gris del titular / gris del texto | `#202B37` / `#637083` / `#414E62` | igual |
| Links del pie / pie legal | `#586174` / `#626B7B` | igual |
| Rayas | `#E4E7EC` | igual |
| Botón | `#4145E3`, hover `#2125DF` con `box-shadow: rgba(13,15,97,.14) 0 4px 10px` | `#2F6FED`, hover `#1F57C8` |
| Botón de la barra | `#4941DF`, borde `#4640D8` | `#2F6FED` |
| Marino de los rótulos (temas de la tabla, etiquetas) | `#0D0F61` | `#12151B` (la tinta de MaKo) |
| Violeta de los degradados | `rgb(123,108,240)`, `rgb(139,108,240)`, `rgb(96,99,232)`, `rgb(137,139,241)` | `rgb(47,111,237)` (mismo alfa) |
| Lilas de los degradados | `rgb(199,199,250)`, `rgb(199,182,251)` | `rgb(201,218,251)` |
| Rosas de los degradados | `rgb(224,142,240)`, `rgb(240,180,245)` | `rgb(247,208,120)` |
| Azules de los degradados | `rgb(169,193,251)`, `rgb(125,162,247)`, `rgb(165,196,245)`, `rgb(150,175,250)`, `rgb(140,170,248)` | igual |
| Fondos lineales de las piezas | `#FBFAFF → #EFE9FF → #DCCFFF` y parecidos | `#FAFCFF → #EAF1FE → #CFDFFC` |
| Columna resaltada de la tabla | `linear-gradient(#F3F0FF, #E6E0FE)` | `linear-gradient(#EEF4FF, #DCE7FD)` |
| Panel del cierre | `linear-gradient(120deg, #F6F6FF, #E8E8FD)` | `linear-gradient(120deg, #F5F8FF, #E5EDFD)` |
| Recuadros de íconos | `linear-gradient(145deg, #F5F2FF, #E9E4FF)`, borde `#E4DFFC` | `#F4F8FF → #E3ECFE`, borde `#DCE7FC` |
| Tarjeta que flota (círculo del ícono) | `#E8F6EE` con un ✓ verde | `#FFF6DE` con la estrella dorada |
| Sección de testimonios | `#12141C`, segunda línea `#A2A7B6`, links `#C9C6FF` | igual (sin links) |
| Pie | `#F8F7FC`, raya `#E7E4EE`, raya de abajo `#E4E0EC` | igual |
| Firma gigante del pie | su logo como máscara sobre `linear-gradient(rgba(96,99,232,.26), rgba(96,99,232,.08) 70%, transparente)` | la palabra «MaKo» con el mismo degradado en azul |

Ruido: todas sus superficies llevan la misma textura, un SVG de 160 × 160 (`feTurbulence fractalNoise .9`, 3 octavas, dos
`feColorMatrix`), como primera capa del fondo con `background-size: 160px auto`. Se copió tal cual.

## Contenedores y espacios (1440)

- **Contenedor:** 1152 px (x = 144); a 390, 350 (x = 20).
- **Barra:** `position: sticky; top: 0`, `padding-top: 12px`; píldora de vidrio de 1200 × 68 (x = 120), radio 999,
  `padding: 0 10px 0 26px`, `linear-gradient(rgba(255,255,255,.8), rgba(255,255,255,.66))`, borde 1 px `rgba(255,255,255,.75)`,
  `box-shadow: rgba(255,255,255,.9) 0 1px 0 0 inset, rgba(32,43,55,.07) 0 0 0 1px, rgba(32,43,55,.3) 0 12px 32px -18px`,
  `backdrop-filter: blur(18px) saturate(1.7)`. Links 14/18,2 500 `#262B35`, `padding: 12px 13px`, radio 999, hover `#F4F3F8`;
  «Ingresar» 14/22,4; botón `padding: 11px 17px`, 14 px 550. A 390: píldora de 366 × 60 (x = 12) con el logo y el menú (44 × 44).
- **Hero:** `padding-top: 56px`; grilla de 459,64 + 634,77 con 57,6 px entre columnas; el texto centrado en vertical contra la
  galería. Insignias: píldora de 46 px con borde en degradado (`linear-gradient(110deg, #9CBCE8, #E3E5EC 24%, #E3E5EC 78%, #DCE9E2)`),
  `padding: 10px 18px`. Titular 45,36/48,99 700 `-1.8144px`, 20 px debajo; bajada 18,72/27,144 `-0.3744px` `#637083`, 16 px;
  botones 24 px más abajo: 52 px de alto, radio 999, `padding: 13px 20px`, 15/21 700, `box-shadow: rgba(13,15,97,.1) 0 2px 3px`.
  A 390: titular 32,76/35,38 `-1.31px`, bajada 18/26,1.
- **Galería:** 635 × 461, radio 24, `padding: 16px`, borde 1 px `rgba(255,255,255,.8)`, `box-shadow: rgba(255,255,255,.95) 0 1px 0 0
  inset, rgba(96,99,232,.07) 0 0 0 1px, rgba(32,43,55,.16) 0 18px 40px -16px`; fondo: ruido + `radial-gradient(38% 44% at 100% 0%,
  rgba(199,199,250,.6), …)`, `radial-gradient(40% 44% at 94% 64%, rgba(165,196,245,.45), …)`, `radial-gradient(40% 36% at 0% 100%,
  rgba(199,199,250,.4), …)`, `radial-gradient(80% 50% at 50% 100%, rgba(96,99,232,.14), …)`, `linear-gradient(#FFF, #FDFDFF 42%, #F5F6FD)`.
  - Canales: cuatro círculos de 40 px (blancos, borde `#E4E7EC`, `box-shadow: rgba(32,43,55,.45) 0 10px 22px -12px`), 8 px entre
    ellos, 18 px por encima del borde y a 32 px del borde derecho; ícono de 22 px.
  - Figura: 499 × 361 en x + 119, y + 17; blanca, borde 1 px `#E4E7EC`, radio 18, `padding: 6px 6px 0`, `box-shadow: rgba(32,43,55,.04)
    0 2px 4px, rgba(32,43,55,.08) 0 16px 40px`; captura de 485 × 303 (radio 12 12 0 0, fondo `#F8FAFC`); pie con raya arriba,
    `padding: 10px 14px`, 14/19,6 500 `#414E62`.
  - Tarjeta que flota: 252 px en x + 17, y + 57; blanca, borde `#E4E7EC`, radio 20, `padding: 22px`, `box-shadow: rgba(32,43,55,.28) 0 24px
    56px -24px, rgba(32,43,55,.06) 0 4px 12px`; círculo de 36 px, título 16/22,4 700, texto 12/16,8 `#414E62`.
  - Pestañas: barra de vidrio de 595 × 50 a 17 px del borde de abajo, radio 999, `padding: 4px`, `linear-gradient(rgba(255,255,255,.62),
    rgba(255,255,255,.34))`; cada pestaña de 40 px, `padding: 8px 13px 8px 10px`, 14/18,2 500, ícono de 18 px en violeta; la prendida
    `linear-gradient(#FFF, rgba(255,255,255,.86))` con `box-shadow: #FFF 0 1px 0 0 inset, rgba(32,43,55,.06) 0 0 0 1px,
    rgba(32,43,55,.4) 0 8px 18px -10px`; `transition: color .14s, background-color .14s, box-shadow .14s`. A 390 se corren de costado.
- **Tabla («Tu equipo necesita un CRM…»):** sección `padding: 128px 0` con raya abajo; título 44/51,04 600 `-1.54px` centrado en 960,
  la segunda línea en violeta. Marco 48 px debajo: 1152 × 420, radio 30, `padding: 12px 12px 12px 48px`, ruido +
  `radial-gradient(55% 75% at 100% 100%, rgba(199,199,250,.55), …)` + `radial-gradient(45% 60% at 0% 0%, rgba(255,255,255,.8), …)` +
  `linear-gradient(125deg, #F8F8FF, #F1F2FD)`. Tabla de 1090 con columnas de 273 / 392 / 425; la tercera resaltada con un `::before`
  de radio 18 (ruido + rosa .26 + violeta .2 + `linear-gradient(#F3F0FF, #E6E0FE)`). Encabezados 14/21,7 500 `#414E62`,
  `padding: 26px 32px 16px 0`. Filas de 110 px: tema 16/24,8 500 `#0D0F61` con su ícono en una caja de 34 × 34 radio 10
  (`rgba(255,255,255,.78)`, borde `rgba(96,99,232,.18)`); sin 17/26,35 `#414E62`; con 17/26,35 500 `#202B37`, `padding: 28px`; raya
  `rgba(32,43,55,.1)` (en la columna resaltada `rgba(255,255,255,.85)`). A 390: título 30/34,8; cada fila es una tarjeta con los
  rótulos «En chats sueltos» (13/20,15 500 `#414E62`) y «Con Leadsales» (en violeta) y la caja resaltada con radio 18 y 16 px de aire.
- **«Del primer mensaje al cierre de cada venta.»:** `padding: 128px 0`; título 44/47,52 700 `-1.54px` con la segunda línea en
  `#637083`, y a la derecha (abajo) el texto de 340 px 17/26,35 `#414E62`; grilla 64 px debajo, 560 + 560 con `gap: 72px 32px`. Cada
  pieza: composición de 560 × 373, radio 28, ruido + tres luces + un lineal (cuatro combinaciones distintas); la ventana del producto
  (radio 14, borde `rgba(32,43,55,.08)`, `box-shadow: rgba(32,43,55,.05) 0 2px 4px, rgba(32,43,55,.38) 0 24px 48px -24px`) en x + 34,
  y + 24; la píldora de vidrio (40 px, `padding: 10px 18px 10px 14px`, 15/18 500) abajo a la izquierda. Debajo, 24 px: etiqueta
  (13/17,55 500 `#0D0F61`, `padding: 6px 14px 6px 10px`, radio 999, borde `rgba(96,99,232,.18)`), título 28/32,2 700 `-0.84px`
  (15 px abajo), texto 16/24,8 `#414E62` (12 px abajo). A 390: una columna, composición de 350 × 241, título 22/25,3, texto 15/23,25.
- **«Todo lo que incluye…»:** `padding: 64px 0`; título en 804 px; lista 64 px debajo, tres columnas con `gap: 4px 32px`; cada renglón
  con raya arriba `#E4E7EC`, `padding: 16px 0`, recuadro de 36 × 36 radio 10, 14 px de aire; título 15/20,25 600 y texto 14/20,3
  `#414E62`. A 390: dos columnas, sólo los títulos (14/18,9), recuadro de 30.
- **Testimonios:** `#12141C`, `padding: 128px 0`; título 44 px blanco con la segunda línea `#A2A7B6`; grilla 64 px debajo, tres
  columnas de 363 con `gap: 48px 32px`; video cuadrado de 363, radio 18, que crece a `scale(1.03)` en `.26s` al pasar el mouse; cita
  18/27 blanca 16 px debajo; nombre 14 px 600 y cargo 14 px `#A2A7B6`. A 390: dos columnas de 168, radio 14, cita 14/21.
- **Preguntas:** `padding: 110px 0`, columnas de 489 + 598 con 65 px; título 46/49,68 `-1.61px`; link 14/21,7 500 violeta con su
  flecha, 23 px debajo. Cada pregunta con raya `#E4E7EC`, `padding: 22px 0`, resumen 16/23,2 500 con el «+» de 24 px `#637083`;
  respuesta 14/23,8 `#414E62`, 18 px abajo. A 390: una columna, 30/32,4.
- **Panel del cierre («Tu próximo paso»):** 1152 × 514, radio 24, `padding: 56px`, columnas de 549 + 449 con 40 px; ruido +
  `radial-gradient(60% 85% at 92% 88%, rgba(137,139,241,.4), …)` + `radial-gradient(45% 65% at 72% 0%, rgba(165,196,245,.35), …)` +
  `radial-gradient(55% 70% at 4% 6%, rgba(255,255,255,.85), …)` + `linear-gradient(120deg, #F6F6FF, #E8E8FD)`; botones de radio 8.
  Órbita de 400 × 400: anillos de r 166 y 112 con trazo 1,25 px `rgba(96,99,232,.38)`; centro de 136 × 84 radio 22 (borde `#DEDFF4`);
  íconos de 44 × 44 radio 16 girando (`rotate() translateY(r) rotate()`) en 28 s los de adentro y 40 s al revés los de afuera.
  A 390: `padding: 28px 24px`, botones a lo ancho, órbita de 300.
- **Pie:** `#F8F7FC`, raya arriba `#E7E4EE`, `padding: 72px 0 28px`; logo, «Contacto» 13/19,5 500 y el mail 14/21 `#586174`; seis
  columnas de 168,66 con `gap: 32px 28px`; título 15/21 500, links 14/21 `#586174` (hover violeta) con `padding: 5px 0` y 4 px entre
  ellos; raya `#E4E0EC` y abajo © y lo legal en 12 px; debajo, la firma de 1400 × 176. A 390: dos columnas.

## Movimiento

- Botones: `transition: background .16s, border-color .16s, box-shadow .16s`; al pasar el mouse, más oscuro y
  `box-shadow: rgba(13,15,97,.14) 0 4px 10px`.
- Links de la barra: fondo `#F4F3F8` al pasar el mouse. Links del pie y el link de texto: al violeta (en MaKo al azul).
- Videos de testimonios: `transform .26s`, `scale(1.03)`.
- Órbita del cierre: `@keyframes orbit` (28 s y 40 s al revés, con retrasos negativos para que arranquen repartidos).
- Con `prefers-reduced-motion`, nada se mueve.

## Lo que no se copia

Su logo y su nombre, sus insignias de Meta y WhatsApp, su prueba gratis, sus capturas, los números de su tarjeta («Envíos 1.000…»),
los logos de sus clientes, sus precios, sus testimonios y sus fotos, sus medios (Forbes, Shark Tank), el link a WhatsApp Business
API, la frase de su pie («Cada conversación, con un siguiente paso.») y su mail de contacto.
