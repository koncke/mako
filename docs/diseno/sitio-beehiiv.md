# El sitio de MaKo (/vsl/sitio y /vsl/comparaciones): los valores medidos de beehiiv

**Referencias:** la portada de beehiiv — https://www.beehiiv.com/ — con su barra, sus menús «Product» y «Solutions» abiertos y su
pie; y su página de comparaciones — https://www.beehiiv.com/comparisons.
**Medido:** 12/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 844, `getComputedStyle` y `getBoundingClientRect` sobre
los elementos reales (los menús, abiertos con el mouse encima).
**Diseño copiado en:** `app/vsl/_sitio/` (`estilos.ts` lleva estos números; `datos.ts`, lo que dice). Las páginas:
`app/vsl/sitio/page.tsx` y `app/vsl/comparaciones/page.tsx`, las dos de vista previa (`robots: { index: false }`).

⚠️ beehiiv sirve **dos portadas distintas** (una prueba A/B), y la versión del teléfono sigue a la que tocó: una con «Stand out in
the inbox», «No code. No limits.» y secciones de producto sueltas con un marco de color; la otra con «Everything you need to turn
attention into growth» y tarjetas por producto. Se copió la segunda, a 1440 **y a 390** (la primera es otra página: copiar su
versión de teléfono sobre la de computadora de la segunda era mezclar dos páginas). Para fotografiarla hay que reintentar hasta que
toque la segunda (se reconoce por su titular).
⚠️ Sus imágenes (media.beehiiv.com) no se pueden bajar desde aquí: el proxy las rechaza, y en las fotos de la referencia salen
vacías algunas capturas y fotos de clientes.

## Fuentes

| Uso | Su fuente | En MaKo |
|---|---|---|
| Titulares (mayúsculas) | Clash Grotesk Bold (Fontshare, licencia propia; no está en Google Fonts) | **Archivo** variable (OFL) en 900 y al 88 % de ancho: `public/vsl-assets/fuentes/archivo/archivo-latin-wdth-wght.woff2` |
| Texto, botones, menús, pie | Satoshi 400–700 (Fontshare) | **Figtree** variable (OFL): `public/vsl-assets/fuentes/figtree/figtree-latin.woff2` |

Las dos ya estaban en el repo: las usa la landing de Email (`docs/diseno/landings-competencia/email.md`), que copió la misma
referencia.

## Colores

| Qué | beehiiv | En MaKo |
|---|---|---|
| Fondo de la página, la barra y el pie | `#060419` | igual |
| Tarjetas, menú abierto, caja del cierre | `#0D0B28`; filete `rgba(255,255,255,.06)` | igual |
| Recuadros chicos («+», historias del menú) | `#1C1940` | igual |
| Cuadro del ícono de los menús | `#141230` | igual |
| Texto | `#FFFFFF`; párrafos `#F7F5FF`; links de la barra `#DDDCE8`; `#C4C2D6`; rótulos del menú y links del pie `#9393A9`; nota del hero `#B8B8C8` | igual |
| Filetes de la barra y de las pantallas | `rgba(255,255,255,.12)` | igual |
| Color de marca (botones, tabla, «Compare →») | índigo `#2F39BA` (hover `#3843D0`) | azul `#2F6FED` (hover `#1F57C8`) |
| Acento (rótulos, titular en degradado, íconos, números, links de las tarjetas) | rosa `#FF5EC4` | dorado `#F2B01E` |
| Capas del botón | rosas claros | dorado claro `#FBE3A6` y dorado `#F2B01E` |
| Degradado del último renglón del titular | rosa claro → rosa | `#FDF0CC` → `#F2B01E` |
| Números de los clientes | lavanda `#B3B8F0` | azul claro `#9DBBF8` |
| Brillo de las tarjetas | violeta arriba a la derecha (≈ `rgb(80,57,111)`), azul abajo a la izquierda (≈ `rgb(70,76,148)`) | el azul de MaKo al 30 % y al 36 % |
| Fondo de comparaciones (hero y grilla) | lavanda `#D7D9F6` con trama de puntos | tinte del azul `#D5E2FB` con la misma trama |
| Tabla de comparaciones | caja blanca, filete 2 px `#060419`; grupos sobre lavanda al 50 %; filas con filete `#CECFD4` | igual, con el tinte azul |

## El contenedor y las secciones

- Contenedor de 1440 con 128 a los lados (contenido de 1184). A 390: 20 a los lados.
- Secciones: 96 arriba y abajo (a 390: 40).
- Rótulo de sección 14/20 500 del color de acento; titular 48/48 en mayúsculas a 8 px (a 390: 36/40); texto 20/28 500 (a 390: 18/28).
- Cabecera de sección en dos columnas (569 y 557), alineadas abajo; a la derecha el texto y, a 24, el botón.

## Botones

| Botón | Valores |
|---|---|
| Principal | cara del color de marca, radio 6, 8 × 24 (el del hero, 10 × 24: 50 de alto), 18/28 700; debajo dos capas (claro y acento, filete `#0B0D2A`) que al pasar el mouse se separan −6 / −12 / −18 px en 0,125 s; el botón crece a 1,02 |
| De borde (hero) | fondo `#131125`, filete `#FCFCFD` |
| Secundario («Find the best plan for you») | 8 × 24, radio 8, fondo `#100E22`, filete blanco al 20 %, 18/28 700 |
| En la barra | 14/20 600, 7 × 12, radio 6, filete blanco al 20 %; el lleno, blanco con texto `#060419` |

## La barra

- 77 px de alto (botones de 36 con 20 arriba y abajo), pegada arriba, fondo `#060419`, filete blanco al 12 %.
- El logo a la izquierda; los links a 40, separados 4: 14/20 600 `#DDDCE8`, 8 × 12, radio 6; el que tiene su menú abierto lleva
  un velo blanco al 10 % y pasa a blanco.
- A la derecha: «Log in» (link), «Get a demo» (de borde) y «Sign up for free» (lleno).
- Clara (en comparaciones): fondo blanco, filete `#060419` al 12 %, links `#060419`, el botón lleno del color de marca.

## Los menús abiertos (1440)

| | Valores |
|---|---|
| Panel | a todo el ancho, debajo de la barra, `#0D0B28` con filete abajo; el contenido en 1200; 40 arriba y 44 abajo; entra en 0,32 s (opacidad y 8 px de desplazamiento) |
| «Product», arriba | cuatro grandes en cuatro columnas, 48 de separación: cuadro de 40 `#141230` radio 4 con el ícono de 20 del acento; título 15/20 700 y bajada 15/20 500, 12 entre ícono y texto; velo blanco al 10 % y radio 8 al pasar el mouse |
| «Product», abajo | filete al 6 % con 40 de aire; cinco columnas (en MaKo, cuatro: las familias); rótulo 12/16 700 en mayúsculas `#9393A9` espaciado .08 em; links 16/20 500 blancos de 32 de alto, hover azul claro con velo |
| «Solutions» | tres columnas: «For publishers» (362), «For advertisers & partners», y «Featured stories» con filete a la izquierda y 40 de aire: tarjetas `#1C1940` radio 8 con su imagen de 66 × 44 y título y bajada 15/20 |

## El menú del teléfono (390)

- Barra de 57: el logo, el botón lleno y la hamburguesa.
- Abierto: a pantalla completa, renglones de 61 con filete al 6 % (16/24 500) y la flecha de los que abren algo; abajo, fijos,
  «Log in», «Get a demo» y «Sign up for free»; arriba, sólo el logo y la cruz.
- Un menú abre su lista entrando a un submenú con «Back» (con JavaScript). En MaKo se despliega en su renglón (`<details>`),
  con los mismos grandes y las mismas columnas; los links de 42 de alto.

## La portada (1440)

| Sección | Valores |
|---|---|
| Hero | 96 arriba y abajo; dos columnas de 576 con 32; titular 60/60 en mayúsculas con el último renglón en degradado; bajada 20/28 en 512; los dos botones de 50 separados 12; la nota 14/20 `#B8B8C8`; la imagen: tres pantallas oscuras superpuestas (`#0D0B28`, filete al 12 %, radio 8, título 15/20 600 con su filete) fundidas abajo y con un brillo violeta detrás |
| Tira de logos | rótulo 14/20 700 en mayúsculas espaciado 1,12 px; a 24, la fila que se desliza (85 s, sin fin) con los bordes fundidos |
| «Everything you need…» | filas de 2 a 1 y de 1 a 2, 24 de separación, 606 de alto; tarjetas `#0D0B28` con filete al 6 %, radio 12, 24 de aire y su brillo; título 24/32 700, texto 18/28 500, link 18/28 500 del acento; el «+» de 44 `#1C1940` radio 6 arriba a la derecha; la captura corrida y cortada por la tarjeta |
| «Trusted by names you know» | rótulo, titular centrado, texto y botón; una marquesina de tarjetas de 306 × 424 (fotos con el nombre abajo y cifras `#0D0B28` radio 12 con el número 64/68 lavanda) |
| «Build your way» | rótulo, titular, texto y el botón secundario; tarjetas blancas de 284 (radio 12, 24 × 20 × 20, 16 entre piezas): nombre 24/32 700, bajada 14/20 `#4E4E6C`, precio 48/48 700, botón de 46 (de borde o lleno), filete `#D6D6E0`, lista 14/20; la recomendada, con anillo del acento y su chip |
| «The numbers tell the story» | titular centrado; cuatro tarjetas de 281 con 20, `#0D0B28`, filete al 6 %, radio 8, 32 × 28; el número 64/66 en mayúsculas del acento y, 64 más abajo, su renglón 18/28 |
| «Powerful integrations» | titular de 576 con su texto a 16, el botón a la derecha; a 64, una imagen de 1184 × 185 con dos filas de logos de ~68 que se cortan en los bordes |
| «Have a question?» | el titular en 352; las preguntas en 768 desde x = 544, 24 × 16, título 20/28 600, filete de 2 px `#4E4E6C` |
| «What are you waiting for?» | 64 arriba y abajo; caja de 1184 × 312, `#0D0B28`, filete del color de marca al 50 %, radio 12, con su brillo; titular y botón centrados |
| Pie | filete arriba y 64 de aire; a la izquierda el texto (16/24 700); a la derecha las columnas (título 14/20 700, links 14/20 500 `#9393A9` cada 32 px, 40 entre columnas); filete con 48 de aire; los legales 14/20, su isotipo a la derecha y el © |

## La portada (390)

- Hero en una columna: titular 42/44, bajada 20/28, los botones a todo el ancho y separados 16, la imagen achicada.
- Las tarjetas una debajo de otra (16 entre ellas): 24 × 24 de aire, título 20/28, texto y link 16/24, la captura cortada por el
  borde derecho, sin el «+».
- Clientes: una fila de tarjetas de 220 × 300 cortada en el borde (en MaKo, se corre con el dedo).
- Planes: las mismas tarjetas blancas, una debajo de otra.
- Números: una columna; el número 42/44.

## Comparaciones (1440)

| Sección | Valores |
|---|---|
| Barra y pie | claros (fondo blanco y `#FCFCFD`) |
| Hero | lavanda con trama de puntos (1 px cada 12), 144 de aire; el logo de 160 en su marco (filete punteado, cuadro blanco de 134 con filete de 3 px del color de marca, el isotipo en 108); titular 64/66 en mayúsculas; texto 24/32 en 768; botón con flecha, a 24 |
| «Compare pricing and features» | fondo `#F3F4F6`, 80 de aire; titular 48/48, texto 24/32 a 24; la caja blanca de filete 2 px `#060419` y radio 10, a 64; cabecera de 154 con el nombre de cada columna y su botón; encabezados de grupo 20/28 600 sobre el tinte al 50 %; filas de 57 con filete `#CECFD4`; primera columna de 288 sobre un tinte claro; el tilde en un círculo de 32 |
| «beehiiv vs the others» | lavanda, 160 de aire; titular 48/48; a 40, grilla de tres tarjetas de 368 con 40: cara blanca de filete 2 px negro, radio 8, 32 de aire, título 24/32 600 y «Compare →» 20/28 500 del color de marca a 32; debajo, dos capas que se separan al pasar el mouse |

A 390: una columna; la tabla con las columnas angostas (beehiiv pasa de columna con flechas; con tres columnas no hace falta).

## Lo que no se copió, y por qué

- **Sus logos, fotos, capturas y textos**: nunca. Los de MaKo salen de su código (`app/vsl/_sitio/datos.ts`).
- **Sus estrellas y «4.9/5 from 28,479 customers»**, sus logos de clientes, la marquesina de clientes y la caja con la cita: MaKo
  tiene un solo caso publicado (el de Mauricio, `CASO`), que va con el diseño de esas tarjetas, sin marquesina.
- **«All plans include», la regla de suscriptores y el selector anual** de los planes: el precio de MaKo no depende de eso.
- **La columna de anunciantes** del menú «Solutions»: MaKo no tiene anunciantes; queda su hueco.
- **Los precios de otras apps** en la tabla de comparaciones: la tabla dice qué app se usa hoy para cada trabajo y qué función de
  MaKo lo hace, sin afirmar nada de las otras.
