# /vsl/seguimiento — los valores medidos de su referencia

**Referencia:** la portada de SetSmart en español — https://setsmart.io/es
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales, y sus clases (es Tailwind v4: `text-[2.1rem] md:text-[3rem]`, `py-20 sm:py-24`…), que dan los
valores de los dos anchos. Su CSS propio (`.demo-surface`, `.cf-corner`, `.cf-btn`, `.goji-btn`, `.nl-text`, `.hero-word`)
se leyó del `<style>` de la página.
**Diseño copiado en:** `app/vsl/_competencia/disenos/seguimiento.tsx`. **Contenido:** `app/vsl/_competencia/seguimiento.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Títulos, h3, el texto que sube en los botones, los títulos del pie | Fustat (Google Fonts, OFL) | 500, 600, 700 | la misma, variable (`public/vsl-assets/fuentes/fustat/`) |
| Cuerpo, barra, botones | Inter | 400, 500, 600 | la misma, variable (`public/vsl-assets/fuentes/inter/`) |
| Pastillas, numeración «01», terminal | DM Mono | 400 | la misma (`public/vsl-assets/fuentes/dm-mono/`) |

## Escala tipográfica

| Pieza | 1440 | 390 |
|---|---|---|
| h1 | Fustat 48 px / 1.1 (52.8 px), 600, −1.2 px (−0.025em), `#171717`, `max-width` 896, `text-wrap: balance` | 33.6 px / 36.96 px, −0.84 px |
| h2 | Fustat 36 px / 40 px, 600, −0.9 px | 30 px / 36 px, −0.75 px |
| h3 (tarjetas, pasos, línea) | Fustat 16 px / 24 px, 600, `mb` 6–8 px | igual |
| h3 de reseña | Fustat 14 px / 1.375, 600, `#18181b` | igual |
| «Hecho para…» sobre el h1 | Inter 14 px / 20 px, `#71717a` (la parte variable 500, `#18181b`), `mb` 24 | igual |
| Bajada del hero | Inter 16.8 px / 1.625 (27.3 px), `#737373`, `max-width` 570, `mt` 24 | igual |
| Bajada de sección | 18 px / 28 px `#737373` (tarjetas, línea); 16 px / 24 `#71717a` (pasos, terminal) | 18 px / 14 px |
| Texto de tarjeta | Inter 14 px / 1.625, `#737373` | igual |
| Texto de reseña | Inter 13 px / 1.625, `#3f3f46`; autor 12 px 500 `#18181b`, rol 11 px `#71717a` | igual |
| Barra | Inter 13 px / 19.5 px, `#737373`; número volado DM Mono 9 px `#a3a3a3` | se pliega en el botón de menú |
| Pregunta | Inter 15 px 500 `#18181b`; respuesta 14 px / 1.625 `#71717a` | igual |
| Pie | títulos Fustat 12 px 500, `uppercase`, `letter-spacing` 0.6 px, `#71717a`; links Inter 14 px `#a1a1aa` | igual |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Marca (palabras resaltadas del h1 y los h2, corchetes del botón del hero, cuadradito del botón de la barra, «›» de la terminal) | `oklch(79.5% 0.184 86.047)` (yellow-500, ≈ `#EAB300`) | `#2F6FED` |
| Punto ámbar de la línea | amber-400 | `#F2B01E` (el dorado, como detalle) |
| Texto principal / botones negros | `#171717` (neutral-900); hover `#262626` | igual |
| Grises | `#737373`, `#a3a3a3`, `#e5e5e5`, `#f5f5f5`, `#fafafa`; zinc `#18181b`, `#3f3f46`, `#71717a`, `#a1a1aa`, `#d4d4d8`, `#e4e4e7` | igual |
| Fondo de sección alterna | `#fafafa` | igual |
| Trama del hero y de las superficies de demo | `repeating-linear-gradient(±45deg, transparent 0 50px, #00000006 50px 51px)` sobre blanco / `#fafafa` | igual |
| Pastilla «La solución» | fondo `#ecfdf5`, borde `#a7f3d0`, texto `#059669`, cuadradito `#10b981` | igual |
| Interruptor | encendido `#10b981`, apagado rojo | igual |
| Terminal | fondo `#09090b`, borde `#27272a`, texto `#e4e4e7` / `#71717a`, ✓ `#34d399` | igual |
| Pie | `#18181b` | igual |

## Contenedores y espacios (1440)

- **Barra:** `position: fixed`, `padding: 20px 24px 0`; dentro, caja de 1392 × 60 (`max-width` 1440), `padding 12px 24px`,
  `rgba(255,255,255,.8)` con `backdrop-filter: blur(12px)`, grilla `1fr auto 1fr`. Logo a la izquierda (x = 48), links al
  centro con `gap` 24, a la derecha «Iniciar sesión» (`padding 8px 12px`, corchetes que aparecen al pasar) y el botón con
  corchetes `#171717` de 7 px: `padding 6px 16px 6px 6px`, cuadradito 24 × 24 de marca con la flecha, 13 px 500.
- **Hero:** contenedor 1200, `padding-top` 112 + 32 (el h1 en y = 188, x = 272, 896 × 158); botón dentro de una caja de
  `max-width` 448 con `padding` 12 y corchetes de 12 px; adentro, caja `border-radius` 12, borde `#e5e5e5`, y el botón
  `#171717` `padding 14px 24px`, 14 px 500 (422 × 48). Debajo, la fila de prueba social de `max-width` 448 (12 px).
- **Demo:** contenedor 1280 con `padding 0 24px`; marco con corchetes `#d4d4d8` y `padding` 8; caja blanca `border-radius` 4,
  borde `#e5e5e5`, **700 px** de alto. En MaKo: la superficie con trama y el visual de la landing al centro (680 px).
- **«Se integra con»:** 11 px 500 `uppercase` `#a3a3a3`; íconos 28 × 28 en gris al 50 % (`grayscale`), `gap` 20; `padding-bottom` 64.
- **Secciones:** `padding` 96 (La solución, reseñas, línea) u 80 (tarjetas, pasos, terminal, preguntas); 80 y 64 a 390.
  Contenedores: 672 (La solución), 1152 (reseñas, tarjetas), 1024 (línea, pasos), 896 / 672 (terminal), 768 (preguntas).
- **Título en corchetes:** caja `width: fit-content`, `padding 24px 40px` (20 a 390), corchetes 12 px `#d4d4d8`, `mb` 48–56.
- **Reseñas:** `columns: 3`, `gap` 20; cada una `padding` 20, borde `#e4e4e7`, **radio 4 px** (su clase `rounded-xl` está
  pisada por `.brand-square` a `.25rem`), `mb` 20, hover borde `#d4d4d8`. Avatar 32 px.
- **Tarjetas (seis):** grilla de 3 columnas con `gap` 20, anchos 2-1 / 1-2 / 2-1; tarjeta radio 4, borde `#e5e5e5`; arriba la
  superficie de demo (`min-height` 180, `padding` 24, trama, borde inferior `#f5f5f5`), abajo el texto con `padding` 24.
- **Línea:** el video 16:9 (radio 4, borde) y una grilla de 3 con `border-top` y un punto de 10 px en `-50 %`, `padding 24px
  40px 0 0`, `mt` 56; botón `#171717` `padding 10px 24px`, radio 8, 14 px 500, `mt` 48.
- **Pasos:** grilla de 3 con `gap` 32, `border-top #e4e4e7`, `padding-top` 28, número DM Mono 12 px `#a1a1aa` sobre la línea
  con fondo blanco.
- **Terminal:** `max-width` 672, radio 4, cabecera `padding 10px 16px` DM Mono 12 / 11 px, cuerpo `padding` 24, DM Mono 13 px
  / 1.625, renglones con `gap` 16, cursor 8 × 16 que late.
- **Preguntas:** filas con borde `#e4e4e7`, `padding` 20 0, chevron 16 px que gira.
- **Pie:** `padding 64px 0 48px`, contenedor 1024 (`padding` 16), grilla de 5 columnas con `gap` 48 (la marca ocupa 2);
  abajo, `padding-top` 32 con el © y los links legales 14 px `#71717a`.

## Animaciones (todas CSS en MaKo)

- h1: entra con `blur(8px)` → 0, `opacity` 0 → 1 y `translateY(.35em)` → 0, `.9s cubic-bezier(.16,1,.3,1)` (ellos, palabra
  por palabra con 70 ms de diferencia; en MaKo, el bloque entero: el titular viene armado con `<em>`).
- Bloques: suben 24 px con `opacity`, `1.6s cubic-bezier(.16,1,.3,1)` (ellos al entrar en pantalla, con JS; en MaKo, al cargar).
- Botones: el texto rueda hacia arriba y deja ver su copia (`.3s cubic-bezier(.4,0,.2,1)`), la flecha se corre 160 %, el
  botón de la barra se llena de negro de izquierda a derecha y sus corchetes se separan 3 px y toman el color de marca.
- `prefers-reduced-motion: reduce` apaga todo.

## Lo que no se copió

Su badge de Meta y su «Más de 500 coaches», las estrellas y la nota de Trustpilot, el asistente «Crea tu IA en solo unos
clics», la tabla contra el setter humano, la calculadora de ROI, la grilla «Funciona con tu stack», su cita suelta, las
«Estadísticas en vivo», el selector de idioma y los íconos sociales del pie: no tienen contenido de MaKo. El texto de
«Funciona en todos tus canales» bajo la tarjeta de «La solución» es suyo y no va.
