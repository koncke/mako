# /vsl/email — los valores medidos de su referencia

**Referencia:** la portada de beehiiv — https://www.beehiiv.com/
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales, más las reglas de sus hojas de estilo (`document.styleSheets`) para el botón y las tarjetas.
**Diseño copiado en:** `app/vsl/_competencia/disenos/email.tsx`. **Contenido:** `app/vsl/_competencia/email.ts`.

⚠️ beehiiv sirve **dos portadas distintas** según la visita (una prueba A/B): una con «Stand out in the inbox», «No code. No
limits.» y paneles de producto de color; la otra con «Everything you need to turn attention into growth» y tarjetas por
producto. Se copió la segunda, que es la del orden de `email.ts`. La herramienta de comparación puede fotografiar
cualquiera de las dos: las tiras finales de esta landing se armaron contra una foto de la segunda.
⚠️ Sus imágenes (media.beehiiv.com) no se pueden bajar desde aquí: el proxy las rechaza. Por eso sus fotos, capturas y fondos
de tarjeta salen vacíos en las fotos de la referencia, y sus colores no se midieron.

## Fuentes

| Uso | Su fuente | En MaKo |
|---|---|---|
| Titulares (mayúsculas) | Clash Grotesk Bold (Fontshare, no está en Google Fonts) | **Archivo** variable (OFL) en 900 y al 88 % de ancho: `public/vsl-assets/fuentes/archivo/archivo-latin-wdth-wght.woff2` (con los ejes de peso y de ancho) |
| Texto, botones, pie | Satoshi (Fontshare) 400–700 | **Figtree** variable (OFL): `public/vsl-assets/fuentes/figtree/figtree-latin.woff2` |

## Colores

| Qué | beehiiv | En MaKo |
|---|---|---|
| Fondo de toda la página, barra y pie | `#060419` | igual |
| Tarjetas, caja de la cita y del cierre | `#0D0B28`; filete `rgba(255,255,255,.06)` | igual |
| Recuadros chicos dentro de una tarjeta | `#1C1940` | igual |
| Texto | `#FFFFFF`; párrafos `#F7F5FF`; secundarios `#DDDCE8`, `#C4C2D6`; links del pie `#9393A9`; nota del hero `#B8B8C8` | igual |
| Botones (su color de marca) | índigo `#2F39BA` | azul `#2F6FED` |
| Capas del botón | `#FFC8EB` y `#F092DD`, filete `#0B0D2A` | dorado claro `#FBE3A6` y dorado `#F2B01E`, el mismo filete |
| Rótulos, renglón en degradado del titular, brillo de la cita (su rosa) | `#FF5EC4`; degradado `#FFDCFF → #FF5EC4` | dorado `#F2B01E`; degradado `#FDF0CC → #F2B01E` |
| Filete de la barra | `rgba(255,255,255,.12)` | igual |
| Filete de las preguntas | 2 px `#4E4E6C` | igual |
| Borde de la cita | 1 px `#4E4E6C`; fondo `#0D0B28` + `linear-gradient(-11.046deg, rgba(78,78,108,0) 66.952%, rgba(152,152,210,.04) 99.472%)` | igual |
| Borde de la caja del cierre | `rgba(47,57,186,.5)` | `rgba(47,111,237,.5)` |

## Contenedor, espacios y escala (1440)

| Qué | Valor |
|---|---|
| Contenedor | 1184 px desde x = 128 (128 a los lados; 32 por debajo de 1280; 20 en el teléfono) |
| Barra | 77 px (`padding 20px 128px`), pegada arriba; links 14/20 600 `#DDDCE8`; «Get a demo» 14/20 600 con borde 1 px `rgba(255,255,255,.2)`, radio 6, `padding 8px 12px`; «Sign up for free» blanco con texto `#060419`; 12 px entre los dos |
| Hero | `padding 96px 0`; dos columnas de 576 con 32 de separación; la imagen de 634 × 475 centrada en la derecha (se sale 29 px por lado), centrada en alto con el texto |
| H1 | 60/60 700 mayúsculas; el último renglón con el degradado recortado al texto |
| Bajada | 20/28 500 `#F7F5FF` en 512 px, a 16 del título |
| Estrellas y «4.9/5 from 28,479 customers» | 16/24, a 18 de la bajada (no va) |
| Botones del hero | 18/28 700, alto 50, radio 6, separados 16; nota 14/20 `#B8B8C8` a 16 |
| El botón (todos) | cara `padding 8px 24px`, radio 6, borde 1 px; dos capas detrás (`inset: 1px`, radio 6, borde `#0B0D2A`); al pasar el mouse: el botón `scale(1.02)`, la cara `translate(-18px,-18px)`, la capa clara `(-12px,-12px)`, la otra `(-6px,-6px)`, todo en `transform .125s ease-out` |
| Secciones | `padding 96px 0` |
| Cabecera de sección | rótulo 14/20 500 de color; a 8 px el H2 48/48 700 mayúsculas (569 px); a la derecha (557 px, desde x = 755) el texto 20/28 500 y a 24 px el botón, alineados abajo |
| Tarjetas por producto | a 64 px de la cabecera; filas de 2 a 1 (773 + 387) y de 1 a 2, con 24 de separación en los dos sentidos; 608 de alto; radio 12, filete 1 px, `overflow: hidden`; `padding 24px`; título 24/32 700; texto 18/28 500 `#F7F5FF` a 8 px; «Get started free →» 18/28 500 de color; un «+» de 44 × 44 `#1C1940` radio 8 arriba a la derecha; la captura desde x + 85 / y + 155 (740 × 574), cortada por la tarjeta |
| Recuadros de la cara de atrás | 228 × 194, `#1C1940`, radio 12, `padding 20px 16px`, 12 de separación; título 14/20 500 blanco, texto 14/20 500 `#DDDCE8` |
| «Trusted by names you know» | todo centrado: rótulo; H2 48/48 a 8 px; texto 20/28 en 770 px a 12; botón a 24 |
| La cita | caja de 1184 × 520, `padding 80px 64px`, radio 8, contenido centrado; cita 30/36 500 en 755 px; a 32 px la foto redonda de 48 (borde 1 px `rgba(255,255,255,.12)`); a 12 el nombre 16/24 700 y el cargo 18/28 500 `#C4C2D6`; «Read the story» 18/28 700 con borde blanco y radio 9999 a 24; el brillo: una elipse de su rosa al 30 %, `feGaussianBlur` de 125, en un SVG de 1206 × 711 que empieza 223 px abajo del borde de la caja |
| «Powerful integrations» | H2 48/48 en 576 px (dos renglones); texto 20/28 a 16; botón a la derecha; imagen de 1184 × 237 a 64 px |
| «Have a question?» | H2 48/48 en 352 px a la izquierda; las preguntas en 768 px desde x = 544; cada una con filete de 2 px arriba, `padding 24px 16px`, pregunta 20/28 600 y la flecha de 20 px que gira 180° (`transform .3s cubic-bezier(.4,0,.2,1)`); respuesta 20/28 500 `#F7F5FF` con `padding 0 16px 24px` |
| Caja del cierre | sección `padding 64px 0`; caja de 1184 × 312, radio 12; H2 48/48 centrado a 97 px del borde; botón a 24 |
| Pie | filete arriba, `padding 64px 0`; columna izquierda de 384 (16/24 700 + el formulario); cinco columnas de links desde x = 624 con 40 de separación: títulos 14/20 700 blancos, links 14/20 500 `#9393A9` cada 32 px; filete abajo con 48 de aire; renglón de links legales a 32 y el isotipo de 32 px a la derecha; © 14/20 500 `#C4C2D6` a 16 |

## A 390 px

| Qué | Valor |
|---|---|
| Barra | 57 px, `padding 10px 16px`; el logo, «Sign up» blanco (14/14 600, `padding 8px 12px`) y la hamburguesa |
| Hero | 40 px arriba; H1 42/44; bajada 20/28 a 8 px; botones a todo el ancho (46 de alto), separados 16; nota a 16; la imagen (350 × 263) a 32 debajo |
| Secciones | `padding 40px 0`, 20 px a los lados |
| Cabeceras | rótulo 14/20; H2 36/40; texto 18/28 a 24; botón 16/24 700 de 42 de alto |
| Tarjetas por producto | una columna (348 + filete), 16–18 de separación; título 20/28; texto 16/24; la captura de 324 px pegada al borde derecho |
| Cita | caja de 350 × 480, `padding 40px 20px`; cita 18/28; nombre y cargo 16/24 |
| Integraciones | H2 36/40; botón a todo el ancho; imagen de 350 × 70 |
| Preguntas | H2 36/40 arriba; las preguntas a todo el ancho, igual que a 1440 |
| Caja del cierre | 350 × 276, `padding 64px 24px`; H2 36/40; botón a todo el ancho |
| Pie | los links en dos columnas a 16 px del borde; después los legales, el © y, al final, el bloque del newsletter |

## Lo que en MaKo es distinto, y por qué

- **La barra**: sin sus menús; «Todas las funcionalidades» (a /vsl) con la forma de su «Get a demo» y el botón de la llamada
  con la de su «Sign up for free».
- **El hero**: sin las estrellas y «4.9/5 from 28,479 customers» (contador suyo) ni el segundo botón (MaKo tiene una sola
  llamada a la acción). La nota de abajo lleva los dos renglones del hero. Su imagen (pantallas de su producto) es el gráfico de
  la landing, en una tarjeta blanca de 634 de ancho (el mismo recuadro). El titular dice «Con tu CRM.» en el renglón en
  degradado para quedar, como el suyo, en cuatro renglones a 1440 y a 390.
- **Sin** la franja de logos de sus clientes, sus planes con precio, las tarjetas con fotos y cifras de sus clientes ni «The
  numbers tell the story».
- **Las tarjetas por producto**: la primera fila son las secuencias (la tarjeta grande lleva el gráfico donde va su captura,
  con su mismo corrimiento; la chica, los disparadores en los recuadros de su cara de atrás); las dos filas siguientes, las
  cuatro piezas de Email, sin captura, por eso son más bajas. Sin el «+», sin «Get started free →» y sin sus fondos de imagen
  (no se pudieron leer).
- **La cita** es la de Mauricio (su historia), con su video en la foto redonda; sin «Read the story» ni las flechas del
  carrusel. El brillo de abajo va en dorado.
- **Integraciones**: su imagen de logos son las fichas de lo que dispara una secuencia (cinco tarjetas con el logo en un
  recuadro blanco). El bloque no tiene texto debajo del título.
- **La caja del cierre** lleva sólo el botón de la llamada (su «What are you waiting for?» es texto suyo).
- **El pie**: el lema de /vsl en el lugar de «Get beehiiv updates…», sin el formulario, los links legales ni los de redes; una
  columna «Funciones de MaKo» con el resto de las landings en cuatro columnas, y la estrella de MaKo donde va su isotipo.
