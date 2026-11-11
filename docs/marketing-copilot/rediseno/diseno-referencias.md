# Marketing CoPilot: en qué diseño basarse (referencias para la maqueta)

11/11/2026. Lo que pidió Martín sobre `maqueta-visual.html`:
- «No me gusta para nada el diseño. Puedes basarte en el diseño que tenemos de los dashboards».
- «Muchos textos y cosas muy pequeñas»; quiere algo minimalista y que se entienda fácil.
- La operación no se divide en un mapa con anuncios, Instagram y YouTube: cada canal tiene la suya. Y duda de que el mapa conceptual sea lo mejor.
- El botón para pasar del análisis a la acción es muy chico y no se entiende que el análisis no es el resultado final.

Este documento responde tres preguntas. No toca código de la app: es para armar la próxima maqueta.

---

## Resumen

1. **Diseño:** **Productividad (copia de Fernly)**, sola, sin mezclarla con otras hojas. Es la hoja con la letra más grande y la menor cantidad de piezas: números de 48 px, botones de 48 px y una sola tarjeta oscura que hace de ancla. Su 46 % hasta coincide con la nota de la oferta.
2. **La operación, por canal y con el mismo esqueleto de Fernly:**
   - **Anuncios:** tres columnas, En prueba · Ganadores · Retargeting, con las tarjetas del árbol (`aa-chica`) pero sin las ramas.
   - **Instagram:** la semana, con lo próximo que sale en grande y lo que viene después (la estructura de Murmura).
   - **YouTube:** el próximo video en grande y la lista de los últimos (la estructura de Pelago).
3. **Análisis → acción:** dos tarjetas grandes de fase arriba de las dos pantallas («Paso 1 de 2 · El análisis», «Paso 2 de 2 · La acción»), con la tarjeta KPI de Fernly. Al final del análisis va la tarjeta «Lo más quieto» de Fernly, convertida en «Ahora, la acción», con un botón a lo ancho.

---

## 1. ¿En qué dashboard basarse?

### Los 23 diseños de la casa, de un vistazo

Hay 23 hojas en `app/dashboard/disenos/Hoja*.tsx`. Cada una tiene su propio CSS (`*-css.ts`) y su maqueta en `docs/diseno/mockups-dashboard/<hoja>/`, con capturas en `captura/producto-*.png`. La regla de la casa (memoria «Dashboards: copia exacta una por una»): **cada hoja copia UNA referencia y nunca se arma con piezas de varias**. «Velocidad de llamada» se rechazó el 10/11 como «la más fea de todas» justamente por eso: un rejunte de tarjetas de tres diseños.

| Hoja (copia de) | Cómo se ve | ¿Sirve para CoPilot? |
|---|---|---|
| Focus (Pane) | Nace oscura. Anillos tipo reloj, barras azules y una lista con Urgente/Alta. Densa | No: letra chica y nace oscura |
| Mi día (Lumora) | Clara y pastel. Mes a la derecha, cuatro mosaicos de color, accesos con íconos | No: demasiadas piezas |
| General (Orvel) | Crema. US$12.480 grande, área verde, listas «Te necesita» y «Lo que vence» | Está pensada para plata |
| Operación (Moorly) | Celeste vidrio. Cuatro KPI con minigráficos y listas con pastillas | No: mucho texto chico |
| Marketing (Kestrel) | Blanca. Seis KPI chicos, tendencias y una **tabla de anuncios** | Sólo la tabla, como «Ver la tabla» |
| Anuncio ganador (Prism) | Azul noche y neón, muchos gráficos chicos | No: es la más densa |
| Instagram (Murmura) | Blanco y negro. **«Próxima publicación»** grande con cuenta regresiva y **«Después»** en grilla (Reel, Story, Post) | **Su estructura**, para la semana de Instagram |
| VSL y YouTube (Pelago) | Verde petróleo. Un número grande, los rayos de retención y **«Tus videos»** con miniaturas | **Su lista**, para YouTube |
| Automatizaciones (Noria) | Blanca y verde. Barras, «El recorrido» con pasos tildados y «Dónde falló» con «Revisar» | Parcial |
| **Productividad (Fernly)** | Gris claro y verde bosque. Cuatro KPI de 48 px (uno invertido), barras como píldoras, «Lo más quieto» con un botón a lo ancho, una lista con pastillas de estado y un medio arco de 54 px | **La elegida** |
| Servicio (Sunrow) | Blanca. Anillo de 88, calendario y prioridades | No: muchas piezas |
| Comercial (Selvar) | Blanca y azul. Barra apilada y KPI azul invertido | Parcial |
| Closing (Halden) | Verde petróleo, un 38 % grande y listas | No |
| Cobranza (Coffer) | Blanca y negra, barras negras | No |
| Chat Analyst (Parley) | Naranja óxido, barras grandes | No |
| Contenido e IA (Orrery) | Blanca y violeta, números monoespaciados | No |
| CS (Mender) | Verde salvia. Kanban por etapa con avatares y tres anillos | Parcial: el kanban |
| Curso (Vitrea) | Azul noche y mosaicos de áreas | No |
| **Landing (Corbel)** | **Monocroma: es la paleta de la app** (los mismos hex que `app/globals.css`). «Puntaje de la página **72 de 100**» en una tarjeta negra con medidor | **Segunda opción**: tiene el estilo de la app, pero números de 26 px y rótulos de 13 |
| Hooks (Ondra) | Blanca y naranja, tabla de guiones y embudo | No |
| Cold Calling (Corvane) | Blanca, línea naranja y mosaicos pastel | No |
| Velocidad (Tend) | Kanban de leads con «Llamar» | Parcial: el kanban |
| Inmobiliaria (Torque) | Proyectos con foto y «Ver interesados», y un kanban por etapa | Parcial |

### La recomendación: Fernly, sola

**Por qué Fernly:**
- Es justo lo que pide Martín: **pocas piezas y letra grande**. Título de 34, números de 48, títulos de tarjeta de 19 y botones de 48 de alto, mientras el KPI de la app (`--fs-kpi`) mide 26.
- Trae todas las piezas que necesitan las dos pantallas:
  - la tarjeta invertida: la nota de la oferta, o la fase en la que estás;
  - «Lo más quieto»: lo primero que hay que hacer, con su botón;
  - la lista con pastillas: los puntos a mejorar, y lo que MaKo hizo con «Deshacer»;
  - «Proyectos» con anillos: la máquina de contenido;
  - la tarjeta oscura con tres números grandes: tu ritmo;
  - el medio arco: la nota de 46 sobre 100.
- Ya está copiada y adaptada, con modo oscuro y teléfono (pasa a una columna a 700 px por `@container`).

**Por qué no Corbel:** tiene el medidor de 72 sobre 100 y la paleta exacta de la app, pero su letra es la que Martín llamó chica: números de 26 y rótulos de 13.

**Lo que no hay que hacer:** traer la tarjeta de Corbel o la de Murmura con su propio estilo. De Murmura y Pelago se toma **sólo la estructura**, y se dibuja con los tokens de Fernly.

**El color:** primero, Fernly tal cual, verde con Plus Jakarta Sans: copia exacta y después la adaptación. En la maqueta conviene un interruptor «Verde / Mono» con el bloque de más abajo, para que Martín elija mirando.

### Lo que hay que copiar

**Archivos:**
- `app/dashboard/disenos/productividad-css.ts`: la constante `CSS_PRODUCTIVIDAD` (líneas 25 a 253). Ya está toda dentro de `.frn` con el prefijo `frn-`, así que se pega tal cual en un `<style>` y no choca con el CSS de producción de la maqueta.
- `docs/diseno/mockups-dashboard/productividad-fernly/mako.html`: el HTML estático de la adaptación, para copiar el marcado.
- `fernly.js`, en la misma carpeta (5 KB): las entradas.
  - Títulos que suben con máscara (0,85 s).
  - Tarjetas que entran desde 36 px más abajo (70 ms de escalera).
  - Números que cuentan durante 1,3 s.
  - Al pasar el cursor, la tarjeta sube 4 px.
- `app/dashboard/disenos/HojaProductividad.tsx`, líneas 79 a 90: `pto()`, `arco()` y `Medio`, la cuenta del medio arco.
- Capturas para comparar: `productividad-fernly/captura/producto-1188.png` y `producto-390.png`.

**Tokens** (de `.frn`):

| Qué | Valor |
|---|---|
| Fondo, panel, tarjeta, línea | `--page #e9ebe9`, `--panel #f5f6f5`, `--card #fdfdfc`, `--hair #e3e7e4` |
| Texto | `--ink #131a15`, `--muted #646d67`, `--faint #6c756f` |
| Verde | `--g-950 #0d3a23`, `--g-800 #155a37`, `--g-700 #1d7347`, `--g-400 #5dbd8b`, `--g-100 #e3f2e9` |
| Estados | `--amber #98590a` / `--amber-bg #fdf3e2`, `--rose #c23b3b` / `--rose-bg #fdeceb` |
| Radios | tablero `--r-lg 26px`, tarjeta `--r-md 20px`, botón 24 (alto 48), chip 18 (alto 35), pastilla 6 |
| Sombra | `--shadow: 0 1px 2px #131a150a, 0 8px 24px -12px #131a151a`; la invertida, `0 14px 30px -16px #0d3a23b3` |
| Espacios | `--gap 16px` (12 en el teléfono); tarjeta `padding: 18px 20px`; tablero `22px 20px 16px` |
| Letra | `'Fernly Jakarta'` (Plus Jakarta Sans), base 14/1.45 |

**Tamaños de letra:**

| Pieza | Clase | Tamaño |
|---|---|---|
| Título de página | `.frn-head h1` | 34 / 600, `letter-spacing -1.19px` (30 en el teléfono) |
| Bajada | `.frn-head p` | 15, `--muted` |
| Título de tarjeta | `.frn-card__t` | 19 / 500 |
| Rótulo de KPI | `.frn-stat__t` | 18 / 500 |
| Número de KPI | `.frn-stat__n` | **48 / 600**, `-1.92px` (42 en el teléfono) |
| Línea bajo el número | `.frn-stat__s` | 13,5, `--muted` |
| Lo destacado | `.frn-rem__h` | 24 / 600, verde |
| Fila de lista | `.frn-tlist__txt b` / `span` | 15,5 / 12,5 |
| Número del medio arco | `.frn-gauge__c b` | 54 / 600 |

**Tarjeta KPI** (la invertida lleva `frn-stat--hero`; **una sola por fila**: es la regla de `docs/diseno-dashboards-codeandchill.md`, «de cuatro tarjetas iguales, UNA se invierte»):

```html
<article class="frn-card frn-stat frn-stat--hero" data-lift>
  <h2 class="frn-stat__t">Tu oferta</h2>
  <a href="#oferta" class="frn-arrow" aria-label="Ver tu oferta"><svg class="frn-i" viewBox="0 0 24 24"><path d="M7.5 16.5l9-9M9 7.5h7.5V15"/></svg></a>
  <p class="frn-stat__n frn-num">46<span style="font-size:.5em">/100</span></p>
  <p class="frn-stat__s">Se puede mejorar</p>
</article>
```

**Encabezado de sección** (título, más un chip a la derecha):

```html
<div class="frn-card__head"><h2 class="frn-card__t">Lo que hay que tocar</h2>
  <a class="frn-chip" href="#"><svg class="frn-i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>4 más</a></div>
```

**Lo primero** (`frn-rem`): para «Tu negocio» y para «Te toca».

```html
<section class="frn-card frn-rem"><h2 class="frn-card__t">Lo primero</h2>
  <p class="frn-rem__h">Tu oferta no dice para quién es</p>
  <p class="frn-rem__t">Es lo que más baja tu nota</p>
  <a class="frn-btn" href="#">Mejorar oferta</a></section>
```

**El medio arco con la nota de 46.** Con la cuenta de `pto()`, el punto del 46 % cae en (112,22; 23,80). El rayado va primero y el verde encima:

```html
<div class="frn-gauge"><svg viewBox="0 0 250 149">
  <defs><pattern id="raya" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fdfdfc"/><rect width="2" height="7" fill="#8d9a92"/></pattern></defs>
  <path d="M112.22 23.80 A102 102 0 0 1 227.00 125.00" fill="none" stroke="url(#raya)" stroke-width="46" stroke-linecap="round"/>
  <path class="frn-seg" d="M23.00 125.00 A102 102 0 0 1 112.22 23.80" fill="none" stroke="#1d7347" stroke-width="46" stroke-linecap="round" pathLength="100"/>
</svg><div class="frn-gauge__c"><b class="frn-num">46</b><span>de 100</span></div></div>
```

**El gráfico** (`frn-bars`): barras como píldoras de 58 px, con `--h` entre 0 y 1. La rayada (`frn-bar--hatch`) es lo que todavía no pasó. En CoPilot sirve para «publicaciones por semana»: las publicadas en verde y la semana que viene rayada.

**Trampas al copiar:**
- `.frn-pill` sólo tiene estilo dentro de `.frn-tlist`. Para usarla en otra parte, copia las cuatro reglas sin ese prefijo.
- `.frn-row` mide fijo 292 px. Con contenido real, ponle `height: auto`.
- El teléfono va por `@container frn`, no por `@media`: la maqueta tiene que envolver todo en `<div class="frn">`.

**Opcional: el bloque «Mono»**, con los mismos hex de la app y de Corbel. Va sobre `.frn.frn--mono`:

```css
.frn.frn--mono { --font: 'Urbanist', system-ui, sans-serif;
  --page:#efefed; --panel:#f5f5f3; --card:#fcfcfb; --hair:#11111117; --ink:#121212; --muted:#4f4f4c; --faint:#636360;
  --g-950:#121212; --g-800:#2b2b2b; --g-700:#3a3a38; --g-600:#4f4f4c; --g-400:#8e8e89; --g-100:#ececea;
  --hero-a:#2b2b2b; --hero-b:#121212; --hero-c:#1f1f1f; --hero-ink:#f6f6f4; --hero-hover:#8e8e89;
  --btn-a:#2b2b2b; --btn-ha:#3a3a38; --btn-b:#121212; --btn2-a:#2b2b2b; --btn2-ha:#3a3a38; --btn2-b:#121212; --deep:#121212; --swirl:#ffffff14; }
.frn--mono .frn-stat--hero { box-shadow: 0 14px 30px -16px #000a; } .frn--mono .frn-stat--hero::after { background: none; }
.frn--mono .frn-stat--hero .frn-stat__s { color: #c8c8c3; }
.frn--mono .frn-pill--ok { color: #22735c; background: #d5eee4; }   /* «Bien» sigue verde */
```

### Cómo queda «Tu negocio» con Fernly

- **Fila de KPI:**
  - la invertida: **Tu oferta, 46/100**;
  - las otras tres: **Tu web**, **Instagram**, **YouTube** o **Anuncios**, cada una con «N para mejorar» en grande;
  - la flecha ↗ de cada tarjeta abre su pestaña de detalle. Así las pestañas chicas pasan a ser tarjetas grandes.
- **Debajo:**
  - el medio arco de la oferta, con la leyenda Bien / Mejorar / Arreglar;
  - «Lo primero» (`frn-rem`), con «Mejorar oferta» a lo ancho;
  - «Por canal» (`frn-plist`), un anillo por canal.
- **Abajo:** «Lo que hay que tocar» (`frn-tlist`), cinco filas con su pastilla:
  - `--ok` Bien;
  - `--run` Mejorar;
  - `--wait` Arreglar;
  - una gris nueva para «Sin dato».
- **El detalle de cada canal** (miniaturas reales, el recorrido de la web, el chat de WhatsApp) sigue como en la maqueta vigente, pero dentro de `frn-card`.

---

## 2. Cómo representar la operación de cada canal

### Lo que hay en la casa y por qué no alcanza tal cual

- **El árbol de AdAmigo** (`app/ads-manager/Arbol.tsx` → `Ramas`; `aa.css`, líneas 54 a 101).
  - Tiene una pastilla, ramas en SVG, tres columnas (`aa-cols` con `--cols`) y tarjetas chicas (`aa-chica`). Cada tarjeta lleva arriba el nombre, una marca o un botón, el rótulo y la línea «antes → después» con su %.
  - Está pensado para **una orden que se reparte en muchos cambios**: las ramas son productos del CRM o cuentas. En un solo canal hay una sola raíz, así que las ramas no dicen nada. Son «el mapa conceptual» que no convence.
  - **Sus tarjetas y sus columnas sí sirven. Las ramas no.**
- **El árbol campaña → conjunto → anuncio:** es el vocabulario de Meta, tiene tres niveles y se rompe con muchas campañas (el caso de Mauricio, en la memoria de Marketing CoPilot). No sirve.
- **La tabla de Kestrel** (`HojaMarketing.tsx`, «Por anuncio · Por campaña»): sirve para los números, pero no para «Deshacer» ni para «Te toca». Puede ir como «Ver la tabla».
- **El Calendario** (`app/calendario`, `.gc`, una copia de Google Calendar): es para programar. Con cinco piezas por semana se ve vacío y pesa mucho para una maqueta.
- **La lista de decisiones** (`docs/marketing-copilot/07-semana-organico-1440.png`, y Madgicx en `docs/media-buyer/referencias/otras-apps/01-…`): una fila con un botón. Sirve para «Hice / Propongo», no para lo que está corriendo.

### El mismo esqueleto para los tres canales

Cada canal es una pestaña aparte, con todo lo suyo. Arriba van tres botones grandes, `frn-btn` de 48 px: el elegido en `--primary` y los otros en `--ghost`. Adentro, la grilla de Fernly (`frn-grid`: el centro más una columna de 266 px):

| Lugar en Fernly | En CoPilot |
|---|---|
| `frn-stats` (cuatro KPI) | **Los resultados.** La invertida es el que importa: costo por conversación en Anuncios, mensajes que trajo en Instagram, clics al link en YouTube. Sólo lo que Zernio confirma (`analisis/zernio.md`) |
| Centro, a todo el ancho (`frn-card`, `height: auto`) | **Lo que corre**: la pieza de cada canal (abajo) |
| Centro, debajo (`frn-tlist`) | **Lo que hice y lo que propongo.** Una fila por cambio: «Subí el presupuesto de Prueba B», y debajo «US$10 → US$15 al día · hoy». A la derecha, un chip «Deshacer» (`frn-chip`) o un botón «Aplicar» (`frn-btn` de 36). Las propuestas, primero |
| Derecha, arriba (`frn-rem`) | **Te toca**: UNA cosa («Graba 3 anuncios nuevos»), una línea de porqué y el botón a lo ancho («Ver los guiones»). Si hay más, un chip «→ 2 más» |
| Derecha (`frn-projects`, anillos) | **Tu máquina**: «Reels · 2 de 3 esta semana», «Historias · 5 de 7». Al tocar, los pasos con «Ir a» (el popup de hoy) |
| Derecha, abajo (`frn-tracker`, la oscura) | **Tu ritmo**: tres números grandes por semana («3 · 7 · 1», reels, historias y carrusel). En Anuncios: el presupuesto y cuántos anuncios salen de él (`lib/calculadora-presupuesto-ads.ts`). Es donde se pregunta el presupuesto |

### Anuncios: tres columnas, sin ramas

**En prueba · Ganadores · Retargeting.** Los nombres están por confirmar con Martín.

**Por qué:**
- Es la estructura de los cursos (`analisis/anuncios.md`, A9): una campaña de prueba siempre activa, la mitad del dinero para escalar, y el retargeting aparte.
- Lo que MaKo decide son pasos entre columnas: un anuncio que ganó pasa a Ganadores, uno cansado se renueva, uno que pierde se apaga. Por eso la decisión y su «Deshacer» van **en la tarjeta donde pasó**.
- Se lee de izquierda a derecha, como un flujo. Es el criterio que dio Mauricio para el Plan: «el espíritu del kanban es el flujo».

**La pieza:**
- Los `aa-cols` / `aa-col-cab` / `aa-chica` de `Arbol.tsx`, sin `aa-pildora` ni `aa-ramas`.
- Cada tarjeta lleva:
  - la miniatura real del anuncio en el logo;
  - el nombre;
  - un número, el costo por conversación, en verde o rojo contra el objetivo;
  - a lo sumo una cosa: la marca «+20 % · Deshacer», el botón «Aplicar» o «Cansado».
- Sin datos, cada columna muestra su `aa-chica-vacia`: «Aquí van tus 3 primeros anuncios».

**La tarjeta del árbol pintada con Fernly** (las variables `--aa-*` viven en `.aa`: el bloque va dentro de un `<div class="aa">` o se definen en `.frn`):

```css
.frn { --aa-borde: var(--hair); --aa-rama: transparent; }
.frn .aa-cols { --cols: 3; --hueco: 16px; row-gap: 12px; }
.frn .aa-col { gap: 12px; }
.frn .aa-col::before, .frn .aa-chica + .aa-chica::before, .frn .aa-col-cab + .aa-chica::before { display: none; }  /* sin ramas */
.frn .aa-col-cab { align-self: stretch; text-align: left; border: 0; background: none; padding: 0 4px; font-size: 15px; }
.frn .aa-chica { border: 0; border-radius: var(--r-md); background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); padding: 16px 18px; }
.frn .aa-chica-quien b { font-size: 16px; }
.frn .aa-chica-quien small, .frn .aa-chica .aa-chica-rotulo { font-size: 13px; text-transform: none; letter-spacing: 0; }
.frn .aa-chica .aa-chica-cambio { font-size: 15px; }
.frn .aa-chica-aplicar, .frn .aa-chica-marca { height: 34px; padding: 0 14px; border-radius: 17px; font-size: 14px; }
.frn .aa-chica-aplicar { background: linear-gradient(180deg, var(--btn-a), var(--btn-b)); }
@container frn (max-width: 700px) { .frn .aa-cols { --cols: 1; } }
```

### Instagram: la semana

**Lo próximo que sale**, en grande, y **Después** en una grilla de dos.

**Por qué:**
- En lo orgánico importa el ritmo: qué sale y cuándo, y qué está trabado porque espera a la persona.
- El estado va como pastilla en cada pieza:
  - `--run` Te toca grabar;
  - una neutra para La arma MaKo;
  - `--ok` Programada.
- Lo que MaKo hizo solo («Programé 3 reels», «Hice la portada») va en «Lo que hice», con «Deshacer».
- No va en calendario porque se ve vacío, ni en árbol porque lo orgánico no tiene jerarquía.

**La pieza:** la estructura de Murmura.
- Marcado: `app/dashboard/disenos/HojaInstagram.tsx`, líneas 214 a 240.
- Estilo: `instagram-css.ts`, líneas 162 a 168. Ítems de 68 px, radio 18, grilla de 2 con hueco de 8.
- Dibujada con los tokens de Fernly:

```css
.frn .frn-prox { display: grid; grid-template-columns: 132px 1fr; gap: 18px; margin-top: 15px; padding: 14px; border-radius: 20px; background: var(--deep); color: var(--hero-ink); }
.frn .frn-prox img { width: 132px; aspect-ratio: 9/16; border-radius: 14px; object-fit: cover; }
.frn .frn-prox__cuando { font-size: 34px; font-weight: 600; line-height: 1.1; letter-spacing: -1px; }  /* «Hoy, 18:00» */
.frn .frn-despues { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.frn .frn-despues li { display: flex; align-items: center; gap: 12px; height: 68px; padding: 8px; border-radius: 18px; box-shadow: inset 0 0 0 1px var(--hair); }
.frn .frn-despues img { width: 50px; height: 50px; border-radius: 12px; object-fit: cover; }
@container frn (max-width: 700px) { .frn .frn-despues { grid-template-columns: 1fr; } .frn .frn-prox { grid-template-columns: 96px 1fr; } }
```

### YouTube: el próximo video

**Es la misma pieza que Instagram**, porque el ritmo es uno por semana:
- **El próximo video** en grande: la miniatura en 16:9 de 220 px de ancho, el día de salida y sus pasos en una lista corta. Por ejemplo: Guion ✓ · **Grabar (te toca)** · Miniatura ✓, hecha por MaKo, con «Deshacer».
- **Tus últimos videos**: la lista «Tus videos» de Pelago (`HojaVsl.tsx`, línea 417, `pel-kiln`), con miniatura, título y «1.840 vistas · 24 % llega al final».

---

## 3. Que se entienda «análisis → acción»

### Lo que hay hoy en la app

Todo lo que existe es chico:
- `aa-tramos` (`aa.css`, líneas 210 a 216): pastillas de 12,5 px con número y estado (`hecho` / `ahora`).
- Los puntos del `WizardShell`.
- `planes-pasos`: barritas de 4 px.
- `ModosMako`, «Analizar · Editar»: un segmentado chico.
- `nor-steps`: los pasos de Noria, con tildes de 28 px.

El concepto ya está aceptado: cuando separó «Analizar» de «Editar», Martín dijo «una cosa es MaKo analiza y otra cosa es MaKo edita». **El problema es el tamaño, no la idea.** En la maqueta vigente, «Ponerlo en marcha» es un `mk-btn--md` al final de la fila de pestañas, y «← El análisis» es un botón chico.

### La propuesta

**1. Dos tarjetas de fase, arriba de las dos pantallas.**
- Son la tarjeta KPI de Fernly a 120 px de alto, con los estados de `aa-tramos`.
- La fase en la que estás es la invertida, `frn-stat--hero`.
- La otra es clara y lleva la flecha ↗. Tocarla cambia de pantalla, así que reemplaza a «Ponerlo en marcha» y a «← El análisis».
- La de la acción adelanta lo que viene, por ejemplo «3 cosas te tocan». Así se ve que el análisis no es el final.

```html
<nav class="frn-fases" aria-label="Las dos fases">
  <a class="frn-card frn-stat frn-stat--hero frn-fase" aria-current="step" href="#analisis">
    <h2 class="frn-stat__t">Paso 1 de 2</h2><p class="frn-stat__n">El análisis</p><p class="frn-stat__s">Lo que leí de tu negocio</p></a>
  <a class="frn-card frn-stat frn-fase" href="#accion">
    <h2 class="frn-stat__t">Paso 2 de 2</h2>
    <span class="frn-arrow"><svg class="frn-i" viewBox="0 0 24 24"><path d="M7.5 16.5l9-9M9 7.5h7.5V15"/></svg></span>
    <p class="frn-stat__n">La acción</p><p class="frn-stat__s">3 cosas te tocan</p></a>
</nav>
```

```css
.frn .frn-fases { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
.frn .frn-fase { height: 120px; }
.frn .frn-fase .frn-stat__t { font-size: 15px; color: var(--muted); }
.frn .frn-fase .frn-stat__n { margin-top: 6px; font-size: 30px; line-height: 34px; letter-spacing: -1px; }
.frn .frn-fase.frn-stat--hero .frn-stat__t { color: #b9e6cb; }
.frn .frn-fase[aria-disabled="true"] { background: repeating-linear-gradient(135deg, var(--hair) 0 2px, transparent 2px 8px), var(--card); color: var(--faint); pointer-events: none; }
@container frn (max-width: 700px) { .frn .frn-fases { gap: 10px; } .frn .frn-fase { height: 100px; } .frn .frn-fase .frn-stat__n { font-size: 22px; line-height: 26px; } }
```

**2. El encabezado de cada pantalla lo dice en una línea.**
- Título «Tu negocio», con la bajada «Esto es el análisis. Con esto armo la acción.»
- A la derecha, `frn-btn--primary` (48 px de alto, 173 de ancho mínimo): «Ponerlo en marcha →».

**3. El análisis cierra empujando a la acción.**
- Al pie de «Tu negocio» va una `frn-rem` a todo el ancho:
  - título verde de 24: «Ahora, la acción»;
  - una línea: «Lo que hago solo y lo que te toca»;
  - un botón a lo ancho de 54 px: «Ver la acción».
- Es la misma tarjeta que «Lo más quieto», que en Fernly ya funciona como «esto es lo siguiente».

**4. En el teléfono**, las dos fases quedan una al lado de la otra, a 100 px, y el botón del encabezado ocupa todo el ancho (`frn-head__acts .frn-btn { flex: 1 }`, que ya está en la copia).

---

## Lo que falta decidir (Martín)

- Verde (Fernly tal cual) o mono (la paleta de la app). En la maqueta, con un interruptor.
- Los nombres de las columnas de Anuncios: «En prueba · Ganadores · Retargeting».
- Si «Lo que hice» y «Lo que propongo» van en una sola lista (como acá) o en dos tarjetas.
