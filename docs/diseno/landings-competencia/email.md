# /vsl/email — los valores medidos de su referencia

**Referencia:** la portada de beehiiv — https://www.beehiiv.com/
**Medido:** 11/11/2026 y otra vez el 14/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 844 (ventana chica, sin `isMobile`):
scroll lento con la rueda grabado en video, `getAnimations()` en cada paso, `MutationObserver` e `IntersectionObserver` espiados desde
el arranque, los hovers (estilo calculado antes y después), el «+» de cada tarjeta leído cada 60 ms y `getComputedStyle` de cada
texto y caja; su CSS bajado con `curl` (los `@keyframes` y las transiciones, tal cual). Relevo con capturas y scripts: carpeta de
notas de la sesión, `referencias-landings/email/` (`relevo.md`).
**Diseño copiado en:** `app/vsl/_competencia/disenos/email.tsx`. **Contenido:** `app/vsl/_competencia/email.ts`. **Pantallas:** banco
`C:/dev/bancos-portada/banco-email-landing` (`build.mjs`, `fotos.mjs`, `recortar.py` + `imagenes.json`) → `public/vsl-assets/email/`.

⚠️ **beehiiv sirve dos portadas** (una prueba A/B por la cookie `eid44_homepage_variant`): `control` («Stand out in the inbox», «No
code. No limits.», paneles de color) y `variant_1` («Everything you need to turn attention into growth», tarjetas por producto). Un
`curl` sin cookie recibió `variant_1`; el Chromium del relevo, `control`. Se copia **`variant_1`** (la del orden de `email.ts`); para
medirla, la cookie `eid44_homepage_variant=variant_1` (y `eid44_homepage_variant_amp_eval_cache=1`) antes de abrir la página.

## Lo que se mueve (medido el 14/11)

| Qué | Cómo | En MaKo |
|---|---|---|
| Las dos imágenes del hero | `hero-fade-blur-newsletter` / `-products`: 9,05 s, `cubic-bezier(.33,1,.68,1)`, 3,4 s de espera, infinito. La que se va: opacidad 0, `blur(14px)`, baja 48 px; la que llega: desde `blur(6px)` y 24 px. Cada una se ve ~3,4 s y el cruce dura ~0,75 s | igual, cuadros clave copiados; dos collages de pantallas REALES de Email (modo oscuro de la app) |
| Cinta «Trusted by the world's top publishers…» | 85 s por vuelta, logos de sus clientes | no va (sus clientes) |
| Tarjetas por producto | el «+» (o tocar la tarjeta): cara ↔ cara de atrás con opacidad en ,35 s `cubic-bezier(.65,0,.35,1)`. Si la tocada es la angosta, las dos de la fila se cambian el ancho (`data-flex` 1 ↔ 2, `flex-grow` en ,35 s). La × lo deshace igual. En el teléfono NO se dan vuelta (el «+» está `invisible`) | igual, con radios por fila y `:has()`, sin JavaScript |
| Cintas de «Trusted by names you know» | dos filas (100 s por vuelta, sentidos opuestos) de tarjetas de 308 × 425 (foto o logo + cifra), se FRENAN con el mouse encima; fondo de cada tarjeta en ,15 s | no van (sus clientes y sus cifras) |
| Carrusel de citas | 25 citas con flechas (borde blanco al 20 % → 40 % al pasar el mouse), `fadeIn` ,3 s; NO avanza solo | una sola cita (el caso de Mauricio), sin flechas |
| Cifras («The numbers tell the story») | quietas (no cuentan) | no van |
| Preguntas | la respuesta aparece DE GOLPE (el alto salta en el primer cuadro: su `transition-[max-height]` no se usa); la flecha gira 180° en ,3 s `cubic-bezier(.4,0,.2,1)`; pueden quedar varias abiertas | igual, `<details>` sin script |
| Botón flotante «Trial Premium Features» | `fixed` abajo, de su producto | no va |
| Nada más | ninguna aparición al bajar | — |

## Hovers (estilo calculado antes / después)

- **El botón de capas** (todos): `scale(1.02)`; la cara `translate(-18px,-18px)`, la capa clara `(-12px,-12px)`, la otra `(-6px,-6px)`;
  `transform .125s ease-out`. En el teléfono, sin efecto.
- **El «+»**: `scale(1.05)` en ,3 s. **«Get started free →»**: la flecha `translateX(4px)` en ,3 s.
- Links de su barra: fondo blanco al 10 %; «Sign up for free» se invierte (fondo `#060419`, letra blanca). (La barra copiada la tapa la
  del sitio en producción.)
- «See all customer stories» y las flechas del carrusel: de su contenido, no van.

## Fuentes

| Uso | Su fuente | En MaKo |
|---|---|---|
| Titulares (mayúsculas) | Clash Grotesk Bold (Fontshare) | **Archivo** variable en 900 y al 88 % de ancho (`public/vsl-assets/fuentes/archivo/`) |
| Texto, botones, pie | Satoshi (Fontshare) | **Figtree** variable (`public/vsl-assets/fuentes/figtree/`) |

## Colores

| Qué | beehiiv | En MaKo |
|---|---|---|
| Fondo, barra y pie | `#060419` | igual |
| Tarjetas, cita | `#0D0B28`; filete `rgba(255,255,255,.06)` | igual |
| Cara de atrás / recuadros / «+» y × | `#141230` / `#1C1940` | igual |
| Texto | blanco; párrafos `#F7F5FF`; frase de atrás y recuadros `#DDDCE8`; cargos `#C4C2D6`; nota `#B8B8C8` | igual |
| Botones | índigo `#2F39BA` | azul `#2F6FED` |
| Capas del botón | `#FFC8EB` (arriba) y `#F092DD`, filete `#0B0D2A` | `#FBE3A6` y `#F6CB63`, el mismo filete |
| Acento (rótulos, renglón en degradado, «+», links de las tarjetas) | `#FF5EC4`; degradado `#FFDCFF → #FF5EC4` | dorado `#F2B01E`; degradado `#FDF0CC → #F2B01E` |
| Íconos de los recuadros | lavanda | celeste `#9DB8FF` |
| Fondo de cada tarjeta | imagen «mesh»: navy arriba (`#0B0A1F`), azul pizarra abajo a la izquierda (`#444C94`), malva en una esquina | degradados CSS con el mismo navy, el azul de MaKo y un toque de dorado |
| Caja del cierre | imagen de luz índigo (`#1B0D6E` al centro, casi negro en los bordes); borde `rgba(47,57,186,.5)` | degradado radial con el azul de MaKo (`#123084` → `#070A22`); borde opaco `#1E3D8A` |

## Medidas (1440)

| Qué | Valor |
|---|---|
| Contenedor | 1184 px desde x = 128 (32 por debajo de 1280; 20 en el teléfono) |
| Hero | `padding 96px 0`; columnas de 576 con 32; H1 60/60 (458 px de ancho con su letra); bajada 20/28 500 en 512, a 16; botones 50 de alto a 24; nota 14/20 `#B8B8C8` a 16; imagen de 634 × 447 centrada en la columna (se sale 29 px por lado) sobre su mancha de 634 × 475 desenfocada (`blur-3xl`, escala 1,1–1,25) y su cuadrícula de fondo |
| Cabecera de sección | rótulo 14/20 500; a 8 px el H2 48/48 (569 px); a la derecha (557 px) el texto 20/28 500 y a 24 el botón (18/28 700, 46 de alto) |
| Tarjetas | a 64 px; filas de 608 (`--pcs-row-max-h: 38rem`) con 24 de separación: 2 + 1, 1 + 2, 2 + 1 (773 y 387); radio 12; cara: 24 de aire, título 24/32 700, texto 18/28 500 a 8, link 18/28 500 a 8, «+» de 44 radio 8 arriba a la derecha; la captura empieza ~180 px abajo, corrida (en la de 773, ~70 px a la derecha) y cortada por la tarjeta |
| Cara de atrás | `#141230`; × de 44 a 20 px de la esquina; `padding 48px 32px 32px`, 40 entre partes; título 24/28 700 y frase 18/26 500 en 420 px; el botón a la derecha, abajo; seis recuadros en 3 × 2 (`auto-rows-fr`), 12 de separación, `#1C1940` radio 12, `20px 16px`, ícono 24 y a 16 el título 14/20 700 y el texto 14/20 500 |
| «Trusted by names you know» | centrado: rótulo; H2 a 8; texto 20/28 en 770 a 12; botón a 24 |
| La cita | caja de 1184 × 520, `padding 80px 64px`, borde `#4E4E6C`, radio 8; cita 30/36 500 en 755; foto redonda de 48 a 32; nombre 16/24 700; cargo 18/28 500 `#C4C2D6`; su brillo de 1206 × 711 abajo |
| Integraciones | H2 48/48 en 576 y su texto 20/28; botón a la derecha; imagen de 1184 × 237 a 64 (dos filas de logos de 64) |
| Preguntas | H2 en 352 (4 de 12 columnas); preguntas en 768 desde x = 544; filete de 2 px `#4E4E6C`, `24px 16px`, pregunta 20/28 600, flecha de 20 (trazo `#B8B8C8`, 2 px); respuesta 20/28 500 con 24 abajo |
| Caja del cierre | sección `64px 0`; 1184 × 312, radio 12; H2 48/48 centrado; botón a 24 |

## A 390 px

| Qué | Valor |
|---|---|
| Hero | 40 arriba; H1 42/44; bajada 20/28 a 8; botones a todo el ancho de 46 (16/24), separados 16; nota a 16; la imagen (350 × 247) a 32 |
| Secciones | `padding 40px 0`, 20 a los lados; H2 36/40; texto 18/28 a 24; botón de 42 (16/24) |
| Tarjetas | una por renglón, 16 de separación; título 20/28, texto y link 16/24; el «+» invisible; la captura a 40 del texto, `padding-left: 24px` y 24 abajo, pegada al borde derecho (324 de ancho) |
| Preguntas | igual que a 1440 (20/28, `24px 16px`) |
| Caja del cierre | 350 × 276; H2 36/40; botón a todo el ancho (300 × 42) |

## Lo que en MaKo es distinto, y por qué

- **El titular del hero** no es el suyo traducido desde la revisión del 14/11 («Títulos que cumplen lo que promete el sitio»).
- **Las dos imágenes del hero** son collages de paneles REALES de Email en el modo oscuro de la app (como las suyas, tres paneles
  superpuestos): la secuencia «Vio tu VSL y no agendó» con la lista y las tasas; y los envíos con los segmentos y «¿Enviar a 312 leads
  ahora?». Negocio inventado: «Cierre Consultivo».
- **Las seis tarjetas** son las partes de Email (Secuencias, Envíos, Escribe con MaKo, Tu dominio, Mide, Cuida tu envío), con la
  pantalla real en el modo claro (como las suyas) y, atrás, seis recuadros cada una. Los disparadores y los segmentos se llaman como en
  la app (`TRIGGERS`, `SEGMENTOS`; el test los busca en `lib/email-marketing.ts`). El link de cada tarjeta es el botón de MaKo.
- **Sin** la cinta de logos, las estrellas, las cintas de clientes, los planes, las flechas y el «Read the story» de las citas, las
  cifras, el botón flotante ni el segundo botón del hero: son sus clientes, sus contadores, sus precios y su producto.
- **Integraciones**: en vez de su imagen de logos, cinco fichas de lo que dispara una secuencia (sin texto debajo del título).
- **Con el sol y la luna en claro**, las tarjetas, la cita y la caja del cierre quedan oscuras (`data-tema-fijo`: fondos de degradado
  con letra encima, que el script lleva al modo y deja la letra blanca); el resto pasa a claro.
