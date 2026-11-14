# /vsl/funnel — los valores medidos de su referencia

**Referencia:** la portada de Hyros — https://hyros.com/
**Medido:** 14/11/2026 (noche), con Chromium (Playwright) a 1440 × 900 y a 390 × 844: el hero quieto 60 s, el scroll con la rueda
y una parada de 7 s en cada sección, `getAnimations()` en cada paso, `MutationObserver` de `style`/`class`, `IntersectionObserver`
espiado y los hovers (estilo calculado antes y a los 700 ms). Y su componente leído: toda la página es UN componente de código de
Framer (`NewClConcepts.*.mjs`, 915 kB, con su CSS adentro) más `go.hyros.com/pop.js` (la píldora flotante). El relevo con
capturas: notas de la sesión, `referencias-landings/funnel/relevo.md`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/funnel.tsx`. **Contenido:** `app/vsl/_competencia/funnel.ts`.

⚠️ **La portada se publicó de nuevo el 14/11/2026 a las 13:52 UTC y cambió entera** (el HTML lo dice: «Published Nov 14, 2026»).
Lo que medía este documento el 11/11 (hero con su píldora «Tracking that grows ads», «How it works» en tres tarjetas, «When we
say any feature» en cajas) ya no existe. El orden de hoy: (aviso rojo de Black Friday) → barra → hero «Same ad spend. 15% more
sales.» → «Tracking $5B+ in ad spend for:» → «Brands that add Hyros see» → «Hyros Custom: Add ANY Feature To Your App In
Seconds.» → «All / All / None» → «See how Hyros Works. Pick your business model.» → «What Could You Build With Hyros Custom?» →
«Made Plug and Play With The Hyros App Store» → «What could you build with the Hyros MCP?» → la garantía → pie.

## Letra

| Uso | Hyros | En MaKo |
|---|---|---|
| Titulares | **P22 Mackinac 500** (la cargan de `go.hyros.com`; es paga). Su pila: `'P22 Mackinac', Georgia, serif` | **Georgia** 400 (lo que muestra su pila sin su letra; no se baja nada) |
| Texto | **Inter** 400/500/600 (Google Fonts) | Inter de `public/vsl-assets/fuentes/inter/` |
| Rótulos, URL, números chicos | **Geist Mono** 400/500 | Geist Mono (la de la app) |

## Colores

| Qué | Hyros | En MaKo |
|---|---|---|
| Fondo | crema `#FAF9F5` (la lámina, blanca) | igual |
| Texto | `#1F1E1D`; secundario `#55534E`; rótulos `#6B6963` / `#8B8984` | igual |
| Su violeta | `#5150F6` | azul `#2F6FED` |
| Tintes del violeta | `#EEEEFB` (panel, píldoras), `#E2E1FA`, `#A5A4FA`, `#C9C8FB` (la placa), `#CFCEFF`, `#D3D2FF`, `#7D7CFA`, `#3E3DD6` | `#EAF0FD`, `#DCE6FB`, `#9DBBF7`, `#C5D6FA`, `#CFDDFB`, `#D3E0FC`, `#6E9AF2`, `#1F57C8` |
| Filetes | `rgba(31,30,29,.11)` | **opaco** `#E2E0DA` (el sol y la luna borra los translúcidos) |
| Píldora flotante | `#141246`, hover `#1F1C7A` | `#0B1F4D`, hover `#12306F` |

## Lo que se mueve (exacto, de su componente)

- **La palabra del titular** (`te`): cada **2,4 s** se va (`opacity 0` y `translateY(8px)` en **,28 s** `ease`), a los 290 ms cambia y vuelve.
  Sus palabras: sales. / calls. / leads. / ROAS. (la página arrancó en «ROAS.»).
- **El panel del hero** (`Le`, `hseq`): seis escenas en una línea de tiempo de **56 s** (`s1a 1,3 · s1b 1,5 · s1c 1,5 · s1d 3 · s2a 1 ·
  s2b 1,9 · s2c 2,7 · s2d 3 · s3a 1,4 · s3b 1,9 · s3c 3 · s3d 3 · s4a 1,5 … s4g 3 · s5a 4,1 · s5b 2,4 · s5c 5,46 · s5d 3` s). Cada escena
  entra con `opacity` y `transform` (de `translateY(14px) scale(.985)`) en **,55 s** con **,18 s** de espera. En su fase «d» (los
  últimos 3 s) la ventana crece **`scale(1.14) translateY(-16px)`** desde abajo al centro (,9 s, `cubic-bezier(.2,.7,.2,1)`), lo de
  adentro baja a **,28** y el pie pasa de 12,5 a **15 px** con su segunda frase sobre el tinte (`padding 2px 7px`, ,7 s). Con «menos
  movimiento», queda quieta en la primera escena.
- **Lo que entra al bajar** (`Cn`): los `[data-rv]` reciben `is-seen` con un `IntersectionObserver` (`threshold 0`, `rootMargin 0 0 -8%`);
  lo que ya se ve al cargar entra enseguida. `hwIn` = de `opacity 0` y `translateY(12–16px)` a nada, `cubic-bezier(.2,.8,.2,1)`.
  - «Brands…»: la cabecera de a uno (,4 s, cada ,07 s), las líneas de la cota se abren (`scaleX`, ,5 s), la caja del título **se pinta
    de izquierda a derecha** (`background-size 0 → 100 %`, la letra pasa a blanco al 68 %, ,45 s con ,28 de espera), las cuatro
    esquinas del marco saltan (`scale(.4)`, ,28 s, cada ,05), las tarjetas de a una (,4 s, cada ,07) y la del medio **sube 10 px con
    una sombra de placa de 8 px** (`sxHero`, ,78 s).
  - «Hyros Custom»: el texto de a uno (,55 s, cada ,12) y la caja pintada (,55 s, ,5 de espera); el cubo cae **capa por capa** (`hsIn`
    desde -34 px, ,7 s, con esperas de 0, ,3, ,52, ,74, ,96 y 1,25 s), las ocho fichas cada ,09 s desde 1,6 s, la baldosa del centro
    cae desde -70 px con rebote (2,5 s) y las notas aparecen (2,85 y 3,1 s). A los **4,3 s** queda armado y desde los **5,6 s** cambia,
    cada **3,4 s**, una capa (sale en diagonal `translate(-64px,37px)` ,5 s y entra ,6 s) o una ficha (sube 46 px ,45 s y vuelve ,55 s).
  - La banda azul: el título sube 14 px (,4 s) y las filas **entran desde la derecha 64 px**, cada **70 ms** (,4 s).
  - La lámina: el papel cuadriculado aparece (1,4 s), el marco se **dibuja con `clip-path`** desde la esquina (1,1 s), las marcas de
    registro saltan (,05 / ,55 / 1 s), las reglas se descubren (,9 s), las esquinas del marco (,5–,74 s), la app sube 18 px (,6 s) y
    la tabla se **escribe sola** a 20 ms por letra con 560 ms entre filas (Queued → Typing → Live) cuando se ve el 55 %.
- **La píldora flotante** (`pop.js`): `fixed`, abajo al centro a 20 px, aparece (,28 s, sube 16 px) cuando el scroll pasa
  `max(320, 80 % del alto de la ventana)`.
- **Cero videos** (`<video>`: 0 en los dos anchos). Todo lo que parece video es HTML animado.

## Hovers (medidos)

| Qué | Cambio |
|---|---|
| Menús de la barra | se abren al pasar (opacidad 0 → 1, `translate(-50%,6px)` → 0, ,16 s); el chevrón gira 180° y se pone violeta |
| La píldora «Custom Builds» de la barra | `#EEEEFB` → `#E2E1FA` |
| Filas de la banda | `rgba(255,255,255,.09)` → `.18`, borde `.3` → `.7`, `translateX(5px)` (,25 s) |
| El botón partido de la lámina | sube 2 px, más sombra, el cuadro de la flecha 52 → 62 px y la flecha 3 px a la derecha |
| Links del pie | `#55534E` → `#1F1E1D` |
| **Sin cambio** | los botones del hero, de la sección del MCP y del cierre; las fichas de prueba; las tarjetas de cifras; las filas de «All / All / None» |

## Medidas (1440)

| Qué | Valor |
|---|---|
| Contenedor | 1180 px con `padding 0 32px` |
| Hero | grilla `500px 1fr`, 52 de separación, `padding 52px 32px 0`; texto centrado: titular 50/1,12 sin cortar, bajada 18/1,55 a 20 px, tarjeta de 336 (`#FCFBF8`, radio 16, `padding 18px`) con un botón negro y uno blanco de 15 px (`padding 13px 16px`, radio 7), cita 13 px |
| Panel | `min-height 600px`, radio 14, `#EEEEFB` con sus ondas al 9 % giradas -18°; la ventana de 480, radio 12, sombra `0 26px 60px -30px rgba(31,30,29,.4)`, su barra con tres puntos de 9 px y la dirección en Geist Mono 11,5 |
| Prueba | `padding 56px 32px 0`; la línea 13 px; fichas blancas de radio 10, `padding 9px 15px`, 13 px, separadas 8 |
| «Brands…» | `padding 92px 32px 48px`; la cota en mono 11 px; título `clamp(34px,4.3vw,58px)`/1,1; bajada 17/1,6 en 560; el marco de 1100 con esquinas de 18 px y 2 px; tarjetas de radio 14 (`padding 18px 18px 16px`) en cuatro columnas a 14 px; valor `clamp(32px,3.5vw,50px)` |
| «Hyros Custom» | `padding 40px 32px 104px`, grilla `1fr 1.85fr`; el texto pegado (`sticky`, top 96): píldora 13 px, título `clamp(28px,3.3vw,46px)`/1,12, texto 17/1,6 en 390; el cubo en SVG (`viewBox -36 0 936 740`, cajas de 320 × 320 en proyección isométrica, capas de 36 de alto) |
| «All / All / None» | `padding 96px 32px 72px`; filas `260px 1fr 150px` a 36, `padding 38px 0`; la palabra 96/,9, el resto 34/1,18, la etiqueta mono 11,5 |
| Banda | `padding 92px 32px 100px`, grilla `.82fr 1.18fr` a 64; título `clamp(34px,3.3vw,44px)`; filas `auto 60px 1fr auto`, radio 16, `padding 15px 18px 15px 20px`, a 12; la primera blanca con su cuadrícula y sombra |
| Lámina | `padding 112px 64px 76px`, el marco a 22 px del borde; título `clamp(34px,4.3vw,60px)`; grilla `1.18fr 1fr` a 56; la tabla con su encabezado de 1,5 px y filas `52px 1fr` |
| Cierre | panel `#F6F5F0`, radio 14, `padding 72px 32px 68px`, a 88 px de lo anterior; título 44/1,1 |
| Pie | `padding 40px 32px 36px`, grilla `1.6fr repeat(4,1fr)` a 32 |

## A 390 px (su corte es 760)

Hero en una columna (`padding 24px 20px 0`, gap 28): titular 40/1,1 (corta), bajada 16/1,5, la tarjeta a lo ancho, **el panel debajo**
(440 de alto, las escenas con 14 px de aire). Las cifras en una columna (valor 36 a la izquierda, texto a la derecha). El cubo es OTRO
(visto más de arriba, `viewBox 196 100 568 628`, sin las notas) y la nota va abajo como tarjeta. La banda: el título centrado 30 px,
las filas sin número y la flecha en un círculo de 36. La lámina: el marco a 12 px, sin la columna de letras, cuatro zonas.

## Lo que en MaKo es distinto, y por qué

- **Las escenas del hero** son grabaciones de la app real: la ficha del lead (de dónde vino y cuánto vio del VSL) y la hoja Marketing
  del Dashboard (lo que trae la pauta, el costo por agenda por anuncio, el ROAS cobrado). Cada una corre hasta su final y ahí la
  ventana crece y el pie resalta su segunda frase, como su fase «d».
- **La cifra de cada tarjeta** es el evento que MaKo le manda a Meta (Lead, Schedule, QualifiedLead, Purchase); su gráfico chico es el
  paso del embudo donde sale ese evento, no un número.
- **El cubo** lleva lo que MaKo mide en las capas y lo que conecta en las fichas; la baldosa del centro, la estrella de MaKo.
- **«All / All / None»** → «Todo / Todo / Nada».
- **La banda** son los cuatro funnels de la portada, cada uno a su mini landing; la primera fila, «Editar con MaKo», baja a la lámina.
- **La lámina** lleva la grabación real de «Editar con MaKo» y la tabla de lo que se le pidió.
- **No van:** el aviso de Black Friday, la cita de Tony Robbins, sus cifras, su App Store, su MCP, su garantía (el panel queda sin ella)
  y los menús de la barra (la barra copiada se oculta: va la del sitio).
