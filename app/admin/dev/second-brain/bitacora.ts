// =============================================================================
// Second Brain — el registro de construcción del área
// =============================================================================
// Alcance: el grafo de lo que MaKo entendió del negocio del cliente (el mapa, su
// física, el buscador, el filtro y el panel del nodo), el vault que lo baja como
// carpetas + archivos .md con enlaces [[wiki]], y el botón que le conecta Claude.
// Vive en: app/second-brain/*, lib/cerebro-*.ts, lib/vault*.ts,
// lib/buscar-cerebro.ts, app/api/second-brain/*, scripts/medir|probar-grafo.mjs.
//
// De dónde salió esto: los `pedido` son textuales y salen citados de los mensajes
// de commit —en este repo son largos y explican el porqué—; las trampas, las
// mediciones y lo que quedó sin hacer, de docs/hallazgos-second-brain.md (69
// entradas, es el documento más denso del repo); fecha, hora, sha y tamaño, de
// `git log` / `git show --shortstat` sobre esas rutas.
//
// ⚠️ El `chat` figura como «—» en casi todo agosto: el índice de docs/chats.md
// corta el 8/8 y estas sesiones no llegaron a entrar. No se inventa un título.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El mapa del negocio', detalle: 'Un nodo por cada cosa que MaKo entendió, con de dónde salió · d3-force en el SERVIDOR, física viva en el cliente · las 12 métricas de scripts/medir-grafo.mjs en verde', estado: 'hecha' },
  { titulo: 'La jerarquía de tres niveles', detalle: 'Cinco carpetas madre (Negocio · Oferta · Mercado · Mensaje · Funnel) que gobiernan el zoom, el ZIP y la grilla — sin volver a ser un árbol', estado: 'hecha' },
  { titulo: 'El lienzo protagonista y oscuro', detalle: 'Alto por viewport, encuadre calculado en el cliente, sin caja ni contenedor · data-tema="oscuro" redefiniendo tokens, no reglas', estado: 'hecha' },
  { titulo: 'Buscar y filtrar el mapa', detalle: 'Tres modos en la misma barra (nombre · campos · con MaKo) y un filtro que combina carpeta × sección × autoría, atenuando en vez de desmontar', estado: 'hecha' },
  { titulo: 'Bajarse el cerebro', detalle: 'ZIP con carpetas numeradas, un .md por nodo, frontmatter con la procedencia y enlaces [[wiki]] que abren en Obsidian · respeta lo que estás viendo', estado: 'hecha' },
  { titulo: 'Conectar tu Claude', detalle: 'Se fue del Second Brain el 17/10 (el Centro conecta a Claude por defecto); el token se sigue acuñando en /integraciones · falta publicar plugin/ como marketplace público', estado: 'sigue' },
  { titulo: 'La pantalla del grafo, otra vez (feedback del 17/10)', detalle: 'Sólo el grafo, siempre en oscuro, con «Second Brain» arriba · los controles adentro del lienzo · al tocar un nodo nada aparece abajo: la barra lateral nueva', estado: 'hecha' },
  { titulo: 'Reconstruir cómo nacen los nodos (punto 13)', detalle: 'Offer, funnels, leads, OKR/KPI y chats como nodos con su tipo y su fecha · el nodo que viaja · la capa «Construcción» del super admin · la vista local para los chats (−72/−89 % de tokens, medido) · falta que el turno de MaKo la use', estado: 'sigue' },
  { titulo: 'La cobertura de los datos', detalle: 'construirCerebro() hace 21 lecturas sobre ~70 tablas, y el brief entra por CUATRO listas hardcodeadas mientras getSchema() lee el esquema vivo', estado: 'sigue' },
  { titulo: 'El aire vacío y el layout que se recalcula', detalle: 'El bbox es cuadrado y el lienzo apaisado: 56-67% del ancho sin usar · local graph (barato) vs layout elíptico (le cambia el mapa a todos) · la huella no la consume nadie', estado: 'cola' },
  { titulo: 'Que el cerebro CONCLUYA', detalle: 'Hoy dibuja lo que el cliente cargó; todavía no conecta señales de otras tabs ni saca conclusiones propias', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: el área nace en la navegación ──────────────────────────────────
  {
    fecha: '6 ago', hora: '16:02', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Second Brain entra a la nav como el hero de Analyze, y todavía no tiene grafo',
    puntos: [
      'La tab nace **vacía a propósito**: muestra el mismo hub de once tabs del onboarding, que es literalmente el contenido del que el cerebro se alimenta. El grafo se decidió aparte, y esa separación es la que después permitió diseñarlo sin negociar con el wizard.',
      'Competitor Spy salió de los Analysts en la misma pasada, con el criterio que ordena la familia entera: **los otros seis analizan un activo PROPIO** (una oferta, un anuncio, una landing) y ése vigila lo que hacen los demás.',
    ],
    commits: [{ sha: '4e8380f4', msg: 'Rediseño · la barra deja de perder dónde estabas parado', lineas: 454, archivos: 13 }],
  },

  // ── agosto: el grafo ───────────────────────────────────────────────────────
  {
    fecha: '8 ago', hora: '13:07', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El segundo cerebro se ve: un nodo por cada cosa que MaKo entendió',
    puntos: [
      '**No es el grafo de `/api/admin/graph`.** Ése es graphify sobre el código fuente del repo (4,1 MB, 4.440 nodos que son archivos .ts): enseñarle a un cliente la ingeniería interna en el momento en que esperaba ver su negocio es el opuesto exacto del efecto buscado. La tarea #609 pedía eso por una confusión de una reunión y quedó reescrita.',
      '**El color dice QUIÉN, no qué.** Lo dedujo MaKo / lo escribiste vos / todavía no existe, y la procedencia es real: sale de `computeEffective`, que ya sabía si un campo vino de un documento o si el usuario lo escribió encima.',
      '**Tres reglas de RESTA** para que no sea un plato de fideos, y son las que hoy sostienen la legibilidad: un atributo no es un nodo (el copy y los rasgos van al hover); el catálogo de MaKo no es del cliente (de los 14 formatos entran los que ESTE negocio usa); y una razón y una celda de la matriz son la MISMA fila — pintarlas dos veces son 9 nodos inventados.',
      '⚠️ **Un componente cliente que importa un módulo con `server-only` rompe el build y `tsc` da VERDE**: el bundler sigue el módulo entero, no lo que se usa de él, así que importar solo tipos no alcanza. De ahí el par `cerebro-modelo` (puro) / `cerebro-grafo` (constructor). Volvió a morder dos veces más en el área.',
      'Las etapas del funnel quedaron AFUERA a propósito: `route.ts` sembraba `FUNNEL_TEMPLATES[0]` para todos, y mostrarle dos etapas de Reunión a alguien que eligió carrito, **en la única pantalla cuyo argumento es «esto es tuyo»**, es peor que no mostrar nada.',
    ],
    commits: [{ sha: 'ae656fa6', msg: 'El segundo cerebro se ve: el grafo del negocio, en /second-brain', lineas: 1343, archivos: 6 }],
    archivos: [
      'lib/cerebro-modelo.ts — la forma de un nodo. PURO, sin server-only: es lo que puede importar el cliente',
      'lib/cerebro-grafo.ts — qué nodos hay y de dónde salen (21 lecturas)',
      'lib/cerebro-layout.ts — dónde va cada uno (d3-force, en el servidor)',
    ],
  },
  {
    fecha: '8 ago', hora: '14:02', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: '«No se parece en NADA a Obsidian», y el problema no era el dibujo',
    pedido: 'No se parece en NADA a Obsidian',
    puntos: [
      '**El diagnóstico obvio era el equivocado, y es lo que más vale del área.** Lo que faltaba no era el motor de dibujo: eran los DATOS. `cerebro-grafo.ts` emitía una arista entrante por nodo —39 nodos, 38 aristas, todo colgando de la raíz—, o sea un ÁRBOL. Los racimos de Obsidian emergen de enlaces LATERALES; **sobre un árbol, ninguna simulación de fuerzas da una nube: da un diente de león.** Por eso el primer cambio no tocó el componente.',
      'Las aristas que faltaban ya estaban en los datos y se tiraban: el id del formato real que guarda una celda de la matriz se concatenaba al TEXTO del detalle en vez de dibujarse, y los seis planos del panorama apuntaban todos a la raíz.',
      '**Las dos objeciones al force layout eran falsas**, y costaron una versión entera. «Tiembla para siempre»: no, el loop corta en `alphaMin` y acá ni se enciende el timer (`.stop()` + `tick()` a mano). «Es aleatorio»: no en d3 v3+, el único azar es `jiggle` con un LCG de semilla fija. La tercera, «d3 muta lo que le pasás», SÍ es cierta y es la regla del módulo: copias planas desechables de nodos **y aristas**.',
      '⚠️ **d3 siembra por ÍNDICE del array** (filotaxis): insertar un dato en el medio le cambia el mapa a todo el mundo sin que nada avise. Se siembra por hash del id. Y el orden del array cambia el orden de acumulación en el quadtree —la suma de floats no es asociativa—: 0,5 px de desvío entre dos corridas del MISMO grafo.',
      'Segunda pasada, con el CSS y el `app.js` reales de Obsidian bajados y leídos: **agrupar por área con anclas ERA el radial otra vez** (diez imanes en un anillo, 11 de 36 sectores vacíos) — el racimo tiene que salir de la TOPOLOGÍA, metiendo el área como NODO. Y el color estaba al revés: teníamos 37 de 42 nodos dorados, o sea el color diciendo «esto es lo normal».',
      '**«Se ve parecido» no es verificable**, y dos veces seguidas el dibujo pareció bien y estaba mal. De ahí `scripts/medir-grafo.mjs`, versionado, con 12 métricas y sus umbrales. Ojo: dos umbrales se escribieron AL REVÉS la primera vez.',
    ],
    commits: [
      { sha: 'b6d146ab', msg: 'El grafo ahora se parece a Obsidian, y el problema no era el dibujo', lineas: 1363, archivos: 10 },
      { sha: 'edcd95fb', msg: 'El grafo, con la receta real de Obsidian: monocromo, sin anclas y sin asterisco', lineas: 788, archivos: 8 },
    ],
    archivos: [
      'scripts/medir-grafo.mjs — las 12 métricas. Correlo ANTES de tocar el grafo',
      'docs/hallazgos-second-brain.md §«Un árbol no se dibuja como una red» — la autopsia completa',
    ],
  },
  {
    fecha: '8 ago', hora: '16:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El mapa se siente vivo, y MIRARLO cazó tres bugs que el HTML escondía',
    puntos: [
      '**Medir el HTML no es VER.** `medir-grafo.mjs` lee el render y por eso es ciego a todo lo que pasa después del primer pintado. Con Playwright ejercitando hover, arrastre, paneo y zoom aparecieron tres bugs reales, los tres invisibles en el DOM: los nodos **no flotaban** (recorrido medido: 0,03 px), el arrastre **no movía nada** (0 px) y al soltar los nodos **no volvían a su casa** (quedaban a 128 px).',
      '⚠️ **Dos animaciones que tocan `transform` en el MISMO elemento se pisan y la segunda gana.** Ésa era la flotación de 0,03 px. Es la misma regla de cascada por la que la flotación ya vivía separada de la posición, un nivel más adentro — y volvió a pagarse en la bienvenida del onboarding una semana después.',
      '⚠️ **`forceCollide` NO está escalada por alpha, y `forceLink` sí.** La colisión del cliente usaba el radio 60 del servidor, así que consideraba que en su propia casa los nodos estaban mal puestos, los empujaba para siempre y le ganaba al resorte —que se desvanece— sin que nada fallara. El radio del cliente sale ahora del nodo DIBUJADO más 8 de aire.',
      '**La física del cliente es OTRA receta, no las fuerzas del servidor repuestas.** Despertarlas con el patrón canónico de d3 (`alphaTarget(.3).restart()`) mueve el mapa 58 px de mediana **sin que nadie toque nada**: un layout parado en `alphaMin` no está en equilibrio, sigue cayendo 300 veces más lento. Dos fuerzas y nada más: colisión y un resorte a SU CASA.',
      '⚠️ **`setPointerCapture` retargetea todos los eventos siguientes al elemento que capturó** —incluido el `click`—, así que el `onClick` del `<circle>` no disparó nunca. Y la captura sobre el `<svg>` es correcta y necesaria (sin ella el paneo se corta). **Cualquier `onClick` de un hijo del elemento que captura es código muerto**: el clic se resuelve en el `pointerup`, con umbral de 5 px.',
      '**Una flotación chica no se lee como flotar, se lee como que el texto tiembla.** Con 2 px el desplazamiento es sub-pixel y el navegador re-rasteriza la tipografía en cada frame. Se subió a 8,5 px **y** se agregó `will-change: transform`: sin lo segundo mejora pero no limpia.',
      '**Y la razón por la que toda la animación terminó en un solo bucle rAF:** una arista es un `<line>` con cuatro coordenadas y **no tiene forma de enterarse** de que el `transform` de un grupo movió sus puntas. Con la flotación en CSS, los nodos se movían perfecto y las líneas quedaban colgadas en el aire. No había parche: o el mismo bucle que mueve los nodos recalcula los extremos, o las líneas no acompañan.',
    ],
    commits: [
      { sha: '086f1456', msg: 'El grafo se siente vivo: flota, entra con pop, reacciona y se deja arrastrar', lineas: 684, archivos: 4 },
      { sha: '67dfbe9f', msg: 'Ahora puedo VER el grafo, y ver cazó tres bugs que el HTML escondía', lineas: 221, archivos: 3 },
      { sha: 'ef7a7f90', msg: 'Color por área, entrada desde afuera, flotación de verdad, y el clic que volvió', lineas: 221, archivos: 6 },
      { sha: 'd7860175', msg: 'Las líneas ahora acompañan: la animación pasa de CSS a un solo bucle de dibujo', lineas: 130, archivos: 2 },
    ],
    archivos: [
      'app/second-brain/fisica.ts — la simulación del cliente, cargada con import() al primer arrastre',
      'scripts/probar-grafo.mjs — Playwright contra el dev server: hover, arrastre, paneo y zoom',
      '⚠️ La paleta --grafo-* es NUEVA por una razón medida: sobre #14161B los tokens semánticos de la app quedan POR DEBAJO del gris base de un nodo, o sea que un nodo «marcado» se vería MENOS importante que uno sin marcar',
    ],
  },

  // ── agosto: el vault ───────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '02:00', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El cerebro se puede bajar, y el export encontró un bug del grafo',
    pedido: 'trabajalo como carpetas y archivos',
    puntos: [
      '**El veredicto, que era la pregunta de fondo del pedido:** carpetas y archivos se hacen como PROYECCIÓN (el árbol navega) y MATERIALIZACIÓN (el ZIP se lo lleva), **nunca** como cambio de almacenamiento. La cicatriz que lo decide ya estaba pagada acá: el panorama es el único dato del second brain guardado como markdown, y es el único que perdió el 83% de su contenido sin que nada avisara.',
      '**Y la distinción que destraba «la info que ponés es muy limitada»: no es un problema de almacenamiento, es de COBERTURA.** `construirCerebro()` hace ~21 lecturas y el sistema tiene ~70 tablas por workspace; cambiar el motor de guardado suma cero archivos. De ahí la separación que antes no existía: el GRAFO dibuja identidad y se queda chico y legible, el ÁRBOL navega todo, el ZIP se lleva el árbol.',
      '⚠️ **El ZIP salía con dos archivos de menos y sin ninguna excepción, y eso era un bug del GRAFO.** `canonPlano` mapea sinónimos al mismo nombre para que las aristas laterales encuentren destino, pero dos secciones distintas del panorama caían en el mismo canónico: **dos nodos con el mismo id**. Eso no rompe el parser — rompe todo lo que indexa por id (las keys de React, el Map de posiciones, el destino de las aristas) y en silencio. El detector fue un ZIP con dos archivos de menos.',
      '**Un enlace `[[wiki]]` roto es peor que ninguno:** solo se enlazan nodos que SON un archivo (la raíz es el README, el área es la carpeta) y con el nombre YA desambiguado — cuando dos nodos se llaman igual, el segundo es «Oferta 2» y un `[[Oferta]]` resolvía **a un archivo real pero equivocado**, que es el mismo modo de falla del link de un borrador que este repo ya pagó.',
      '⚠️ **`forceCollide` cachea los radios en su `initialize()`**, no los evalúa por tick: el ternario del accessor se resolvió para siempre con `agarrado` en null, así que el radio de arrastre (380) **nunca se aplicó una sola vez**. El diagnóstico obvio —«la colisión es muy blanda»— era el equivocado. Se recalcula llamando a `.radius()` al agarrar y al soltar, que es el único gancho público que vuelve a correr `initialize()`.',
      'El copy se alineó al patrón de la casa: la ACCIÓN es Exportar/Importar y el botón que dispara la descarga, ya adentro del modal, es «Descargar ↓». «Bajar ↓» chocaba de frente con «Bajar a tierra ↓» de /conocimiento, **que no descarga nada**.',
    ],
    commits: [
      { sha: 'a1c5b766', msg: 'El segundo cerebro se puede bajar: carpetas, archivos .md y enlaces [[wiki]]', lineas: 351, archivos: 7 },
      { sha: 'd1cc8b1d', msg: 'Arreglar el solape al arrastrar un nodo del grafo', lineas: 189, archivos: 4 },
      { sha: '9d910792', msg: 'Second Brain: el copy, contra el patrón que la app ya tenía', lineas: 74, archivos: 5 },
    ],
    archivos: [
      'lib/vault-modelo.ts — la proyección PURA (sin server-only, para que un test la pueda importar)',
      'lib/vault.ts — la puerta que la reexporta y arma el ZIP',
      'scripts/probar-solape.mjs — mide el hueco mínimo entre bordes al arrastrar',
    ],
  },
  {
    fecha: '9 ago', hora: '03:07', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El grafo pasa a ser el protagonista, y el lienzo crecía justo donde no entraba',
    puntos: [
      '**El problema no era que el lienzo fuera chico: era `aspect-ratio: 4/3` con `height:auto`.** El ALTO se derivaba del ANCHO, así que el grafo crecía justo en el monitor donde más espacio hay — 1444×1083 sobre un viewport de 900, o sea el tercio de arriba. Ahora el alto sale del viewport y el ancho se toma todo.',
      '⚠️ **Ese cambio SOLO habría empeorado las cosas.** El encuadre que manda el servidor es cuadrado y entraba con `xMidYMid meet`, o sea por el lado chico: en un lienzo apaisado eso desperdicia el 60% del ancho. **Bajar el lienzo y arreglar el encuadre son un solo cambio**, y el encuadre pasó a calcularse en el cliente contra la caja medida.',
      'La columna fija de 300 px se fue —se comía el 20% del ancho para un párrafo de ayuda— y la leyenda de diez colores también: las tarjetas de abajo ya llevaban el mismo punto y el mismo nombre, o sea que **YA eran la leyenda**, y encima filtraban.',
      'Se borró «Quedan N áreas sin construir» (contaba mal: incluía la raíz, decía 11 de 10) y «las dedujo de tus documentos y tus cuentas conectadas», que era **falso**: ninguna de las lecturas de `construirCerebro()` es una cuenta conectada. En la pantalla que promete «esto es tuyo», un dato inventado cuesta más que un hueco.',
      '⚠️ **El `server-only` volvió a morder con el mismo disfraz:** `AUTORIA_TEXTO` vivía en `vault.ts` y `Grafo` es cliente. El typecheck daba verde y la página devolvía **500**.',
    ],
    commits: [{ sha: 'aee9bc6c', msg: 'Second Brain: el grafo pasa a ser el protagonista de la pantalla', lineas: 824, archivos: 6 }],
  },
  {
    fecha: '9 ago', hora: '09:43', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El funnel entra al grafo, y para eso hubo que arreglar de dónde sale el funnel',
    puntos: [
      'El funnel no podía dibujarse mientras fuera `FUNNEL_TEMPLATES[0]` para todos: **en la pantalla cuyo argumento es «esto es tuyo», mostrar el pipeline de otro es peor que no mostrar nada.** Así que el arreglo del canal declarado y la entrada del funnel al mapa van en el mismo commit (el detalle del funnel, en la bitácora de Onboarding).',
      '**No entran las 17 etapas: entran 13.** Fuera las tres salidas fijas (catálogo igual para todos, no dicen nada del negocio) y «Nutrición - Manual», que `generateFunnel` coloca sin emitir una sola transición y sería el único nodo huérfano del mapa.',
      '⚠️ **Las transiciones vienen DUPLICADAS por par** (ida y vuelta entre los mismos dos nodos) y `unir()` no deduplica: eso metía dos resortes en `forceLink`, dibujaba dos líneas encima, inflaba la densidad medida y hacía que el panel contara dos veces al mismo vecino. Se funden por par no ordenado.',
      '**El nodo de área NO se lleva las etapas de nutrición**, y la excepción está medida: colgarle las 13 le lleva el grado a 22 y el hub pasa a 5,5x contra un umbral de 4,5x. Con la excepción, 3,5x. El racimo del funnel ya lo hace su propia cadena.',
      '🚨 **`scripts/medir-grafo.mjs` se había quedado CIEGO y no lo dijo.** Su parser pedía `<circle cx cy>` y desde que la posición se mudó al `<g transform>` devolvía 0 nodos y NaN en todo, **sin fallar**. Un verificador que contesta «todo bien» sobre una entrada vacía es peor que no tenerlo — y justo en el archivo cuya razón de existir es que «se ve parecido» no alcanza. Ahora sale con error explícito.',
      '**Y una corrección al propio documento del área:** decía que persistir el layout era prerrequisito del funnel. Medido: `layoutCerebro` tarda 112 ms con 50 nodos y 141 con 58 — el funnel cuesta ~30 ms y no cruza ningún umbral. Un prerrequisito que nadie midió es una tarea inventada.',
      'El editor del funnel al final de la página DUPLICABA el alto (1346 → 2692 px). Se monta solo al abrirlo, y **no se esconde con CSS**: trae su propio autoguardado, y tenerlo vivo detrás de un `display:none` es la clase de cosa que guarda sin que nadie lo mire.',
    ],
    commits: [
      { sha: '42fd13ba', msg: 'El funnel sale del canal que el cliente declaró, y entra al grafo', lineas: 673, archivos: 8 },
      { sha: 'ee5acb43', msg: 'El funnel va plegado, y «ajustar la vista» al lado de «pantalla completa»', lineas: 39, archivos: 2 },
    ],
  },
  {
    fecha: '9 ago', hora: '11:07', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El lienzo se puede usar: etiquetas legibles, vuelo de cámara y un detalle que no tira campos',
    pedido: 'si hay algo clickeable se tiene que notar en el diseño',
    puntos: [
      '⚠️ **Las etiquetas se dibujaban a 4,32 px constantes y el zoom no las agrandaba.** El CSS decía `font-size: calc(12px / var(--k,1))`, pero el `<g>` se escala DOS veces (el zoom del paneo y la escala del viewBox), así que el `/k` se cancelaba. Eso rompía justo la mitad que importa: **acercarse es el único mecanismo con el que Obsidian hace legible un racimo denso.** Y arreglar el tamaño SOLO deja la pantalla peor —aparecen 17 pares de etiquetas pisadas que la ilegibilidad tapaba—, así que el descarte por colisión va en el mismo commit.',
      '⚠️ **El centro de lo visible NO es «encuadre.x + medio ancho visible»** cuando el viewBox entra con `xMidYMid meet`: se escala por el lado corto y se centra en el largo. `ajustar()` lo hacía bien e `irA` no, así que **el buscador venía «centrando» nodos y dejándolos 317 px corridos** desde antes de que existiera el vuelo de cámara.',
      '**El detalle del nodo era pobre por el MODELO, no por el copy.** «Los textos están muy pobres» → `NodoCerebro.detalle` era UN string plano y todos los productores lo armaban con `.join(\' · \')`: con un solo campo, cada uno tenía que elegir entre **tirar datos** o escribir un renglón corrido ilegible, y eligieron tirar. El Norte tenía quince campos y mostraba UNO. Ahora son tres campos con tres trabajos: `detalle`, `datos` y `cuerpo`.',
      '⚠️ **Dos trampas de popover que invalidan los patrones de la casa adentro del lienzo:** con la Fullscreen API, todo lo que esté fuera del subárbol en pantalla completa deja de pintarse —incluido un portal a `document.body`—, y el marco lleva `overflow:hidden`, que mata el popover absolute. No sirve ninguno de los dos por defecto: de ahí el `portalTo` del Dropdown.',
      '⚠️ **El `?ws=` NO viaja solo en el `src` de un iframe**: el parche de la app pisa `window.fetch` y un iframe no pasa por ahí. Sin pegarlo a mano, el super admin mirando a un cliente recibe un 404 «Archivo no encontrado» sobre un archivo que existe.',
      '**El contador era mudo:** «58 datos · 47 de MaKo · 11 tuyos» decía exactamente las tres preguntas que uno le hace al mapa y no se podía hacer nada con ellas. Ahora los mismos números SON el filtro. Y filtrar **atenúa, nunca desmonta**: el mapa tiene que seguir siendo el mismo mapa con una parte encendida, o se pierde la referencia de dónde estaba cada cosa.',
      'El botón de conectar Claude vive acá **porque el segundo cerebro es literalmente lo que la skill le lleva**: el lugar donde alguien entiende para qué conectar su agente es mirando el mapa de lo que MaKo sabe de él. El tutorial se EXTRAJO a un componente compartido con /integraciones, no se copió — tiene adentro un texto legal versionado.',
    ],
    commits: [
      { sha: '416db3c4', msg: 'Las etiquetas del grafo se dibujaban a 4,32 px y el zoom no las agrandaba', lineas: 57, archivos: 1 },
      { sha: 'd570da56', msg: 'Vuelo de cámara al nodo, y el centrado estaba mal desde antes', lineas: 81, archivos: 1 },
      { sha: '1a21e288', msg: 'El panel del grafo se puede usar: previsualizar el documento y ver qué es clickeable', lineas: 119, archivos: 3 },
      { sha: '54395340', msg: 'Los controles del lienzo: dos desplegables y la búsqueda del plan', lineas: 192, archivos: 2 },
      { sha: 'b8c6b906', msg: 'El detalle de cada nodo dejaba campos afuera, y la causa era el modelo', lineas: 143, archivos: 4 },
      { sha: '9ae1c51d', msg: 'Conectar a Claude desde el segundo cerebro, y la cosecha', lineas: 618, archivos: 5 },
    ],
    archivos: [
      'lib/buscar-cerebro.ts · lib/cerebro-filtro.ts — el matcheo sale de `coincide` (lib/buscar-tareas.ts), el mismo del tablero: escribir una segunda búsqueda daba dos que se comportan distinto en la misma app',
      'app/_components/TutorialAgente.tsx — los cuatro pasos, compartidos con /integraciones',
    ],
  },
  {
    fecha: '9 ago', hora: '19:35', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La jerarquía de tres niveles, y el panel que «estaba mal diseñado» estaba roto',
    pedido: 'al escribir algo recién ahí sale la búsqueda por IA',
    puntos: [
      '**Tres de los cinco nombres propuestos para las carpetas madre no entraron, y no por gusto: «CRM», «Closing» y «Ads» son PANTALLAS DEL PRODUCTO, no cosas que MaKo entendió del negocio.** Saldrían vacías en los cuatro workspaces vivos, y una carpeta de nivel 1 vacía es lo primero que ve el cliente al abrir el ZIP. Quedan cinco que forman una frase: este NEGOCIO vende esta OFERTA a este MERCADO diciéndole este MENSAJE por este FUNNEL. **La regla: el nombre de una carpeta tiene que sobrevivir a un rediseño de MaKo** — si mañana la tab «CRM» se llama «Ventas», los datos del cliente no cambiaron.',
      '🚨 **El mapa NO vuelve a ser un árbol, y va comentado al lado del código para que no se intente.** Medido: el árbol puro de tres niveles rompe CUATRO de las seis métricas en los cuatro workspaces y parte el grafo en 12-14 islas. La jerarquía gobierna el ZOOM, el EXPORT y la grilla; el dibujo conserva sus aristas laterales. Y los padres nunca se cuelgan de la raíz —eso lleva el hub a 5,1x—: **el padre se cuelga de sus HIJOS.**',
      '⚠️ **«Está MUY mal diseñado el detail de cada nodo» no era un problema de diseño: era un selector abierto.** `.cbg svg { width: 100% }` estaba escrito para el lienzo y matcheaba TODOS los svg de adentro, incluidas las flechas de 13×13 del panel — y un `width:100%` de una hoja de estilos le gana al atributo `width="13"`, porque los atributos de presentación tienen la especificidad más baja que existe. Medido: la flecha computaba **270 px**, dejaba el texto en cero y el panel pasaba de 510 a 1463 px de scroll. **Un selector de dos partes adentro de un componente que contiene íconos es un selector abierto: el lienzo se NOMBRA con una clase.**',
      '**El filtro no parecía filtrar porque no tocaba las aristas.** Con «los escribiste vos» puesto se atenuaban 47 de 67 nodos… y las 119 líneas y las 49 etiquetas seguían a opacidad plena: se apagaban los puntos y quedaba intacta la telaraña, que es el 70% de la tinta. Ahora hay UN predicado y tres consumidores (nodo, arista con sus DOS puntas, etiqueta).',
      '**Desaparecer exige desmontar, pero DESPUÉS de la animación:** `opacity: 0` en SVG cuesta lo mismo que dibujarlo, ya medido en este documento. Y el temporizador se cancela si el nodo vuelve a entrar, así desfiltrar a mitad de camino lo devuelve en vez de dejarlo colgado.',
      '**La búsqueda con MaKo devuelve IDS y se filtran contra los ids reales antes de usarlos.** El prompt le pide que no invente, pero «una regla en un prompt no es una regla» y un id inventado daría un resultado que no existe sin que la pantalla pudiera notarlo. El orden lo pone el modelo y se respeta: reordenar por grado tiraría lo único que se le pidió.',
      '**La carpeta madre no ofrece acción, a propósito:** agrupa varias áreas y no tiene destino único — un botón ahí diría «Completar Norte» estando parado en «Negocio». Nunca se promete un botón que no lleva a donde dice.',
    ],
    commits: [
      { sha: '87a1000b', msg: 'El botón de Claude con su logo, y el modal igual al de integraciones', lineas: 183, archivos: 4 },
      { sha: '428f045c', msg: 'La jerarquía de tres niveles: cinco carpetas madre que gobiernan el zoom y el ZIP', lineas: 178, archivos: 6 },
      { sha: '9a11d3e1', msg: 'El panel no estaba mal diseñado: estaba roto por un selector abierto', lineas: 79, archivos: 1 },
      { sha: '1a8daa1c', msg: 'Filtrar hace desaparecer los nodos, y las etiquetas siguen la jerarquía', lineas: 66, archivos: 1 },
      { sha: '5f493350', msg: 'Toda área se completa desde el mapa, y la cosecha', lineas: 120, archivos: 3 },
      { sha: '42725eb8', msg: 'La barra de búsqueda del mapa, portada de la del tablero', lineas: 503, archivos: 5 },
    ],
    archivos: [
      'app/second-brain/BuscadorCerebro.tsx — tres modos en la misma barra; el ✦ aparece solo con algo escrito',
      'app/api/second-brain/buscar — la búsqueda semántica; el detalle entra ENTERO (60-120 nodos, no 500 tareas)',
    ],
  },
  {
    fecha: '10 ago', hora: '11:23', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El mapa navega, la columna edita, y el lienzo se vuelve oscuro',
    puntos: [
      '**Las once tarjetas de abajo se fueron enteras: eran una segunda navegación compitiendo con el mapa** —el mismo diagnóstico que ya había echado a las once tabs— y encima causaban un bug de scroll (su `onMouseEnter` prendía un estado en el padre y eso volvía a disparar el `scrollIntoView`). El detalle dejó de seguir al cursor: cruzar el mapa con el mouse cambiaba la columna entera cinco veces por segundo.',
      '**Una pantalla oscura se hace redefiniendo TOKENS, no reglas.** `data-tema="oscuro"` en `<html>` da vuelta los 40 usos de `var(--surface)` / `var(--ink)` / `var(--faint)` repartidos en tres archivos. Y resulta que el oscuro no era una variante nueva: **las once `--grafo-*` traían escrito desde que se crearon que son «una paleta que solo vive adentro del lienzo OSCURO»**, calibradas contra #14161B — sobre el blanco de la ronda anterior daban 1,5:1, sobre el fondo nuevo entre 7,8:1 y 9,8:1.',
      '⚠️ **Las relaciones se invierten:** la arista ENCENDIDA era más oscura que la apagada, así que sobre fondo oscuro la telaraña apagada pasaba a ser lo más brillante de la pantalla. Es el tipo de cosa que el scope de tokens no resuelve solo.',
      '**El estado vacío del filtro era inalcanzable porque la raíz siempre pasa:** el mínimo era 1 y el mensaje no se veía nunca. Un estado que no se puede alcanzar no está probado, está escrito.',
      '⚠️ **La animación de salida tenía un frame de más y salían TODOS.** `saliendo` se calculaba en un `useEffect`, o sea DESPUÉS de pintar: los nodos que se iban desaparecían de golpe, reaparecían y recién ahí se desvanecían. Y el efecto metía a todos los nodos invisibles, no a los que **acababan** de dejar de serlo, así que con el filtro puesto cualquier tecla remontaba los ~50 escondidos. Se calcula durante el render (el patrón de React para estado derivado).',
      '**El filtro pasa a recortar sus categorías entre sí:** con una carpeta elegida, «Sección» ofrece solo las de esa carpeta. Sin eso el menú ofrecía combinaciones que dan cero —son ramas distintas del árbol y el filtro es AND— y el usuario se enteraba recién cuando el mapa quedaba vacío. Y se fueron los chips: eran una segunda manera de borrar un filtro al lado de la primera.',
      '⚠️ Va **contra** la dirección estética elegida (§12: «navegación oscura estable, área operativa CLARA») y queda escrito en `globals.css` para que no se lea como un descuido. La defensa contra el antipatrón «cripto o casino» es que el dorado sigue reservado a una sola cosa: MaKo. Por eso la fila elegida dejó de pintarse de dorado — ahí significaba «esto elegiste», que no es lo que el dorado dice en esta app.',
    ],
    commits: [
      { sha: '3d8a6961', msg: 'second-brain: el mapa navega, la columna edita, y el filtro es uno solo', lineas: 1052, archivos: 9 },
      { sha: 'c6bc4845', msg: 'second-brain: el mapa oscuro sin contenedor, el filtro del tablero, y el nodo que abre su sección', lineas: 938, archivos: 9 },
      { sha: '16e79583', msg: 'second-brain: la salida de los nodos, el filtro cruzado, el tirador y el ciclo click/desclic', lineas: 358, archivos: 2 },
    ],
    archivos: [
      'app/second-brain/FiltroMapa.tsx — drill-down por categoría, multi-selección y recorte cruzado',
      'app/second-brain/VistaCerebro.tsx — el header vive acá: los dos botones dependen de lo que el mapa muestra',
      '⚠️ El tirador tiene tope y el que manda es el MÍNIMO DEL MAPA (460 px): el layout se calcula en el servidor sobre un encuadre cuadrado, así que un lienzo de 200 px no se achica — se vuelve ilegible',
    ],
  },
  {
    fecha: '10 ago', hora: '15:19', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La integración con Claude nunca funcionó en producción, y el logo estaba cambiado',
    puntos: [
      '🚨 **`/api/agente/*` no estaba en la lista de rutas públicas: `proxy.ts` cortaba con 401 ANTES de que la ruta mirara el bearer.** Una clienta instaló la skill y su propio Claude Code diagnosticó «puede ser que el endpoint necesite un header adicional, o que el token sea de otro entorno» — ninguna de las dos. **Vivió meses así porque en local `gateConfigurado()` es false y el middleware hace no-op**: todo el desarrollo pasó por el único camino que no la ejercitaba.',
      '**La pista, y vale para cualquier ruta con auth propia: pegarle con una credencial inválida y leer el TEXTO del 401.** «no autenticado» lo contesta el middleware (la ruta ni corrió); «token inválido o revocado» lo contesta la ruta. Los dos son 401 y desde afuera se ven iguales.',
      '⚠️ **Y el segundo bug del mismo día: `NEXT_PUBLIC_BASE_URL ?? \'\'`, una variable que no existe en ningún lado.** La skill salía con `BASE=` vacío. El mismo nombre fantasma estaba en `/api/agente/hook`, pero ahí caía al origin del request —lo correcto—, **así que el error estaba en los dos lados y solo uno dolía.**',
      '**Claude y Anthropic son dos marcas y estaban cambiadas.** La «A\\» es el logotipo de la EMPRESA y la ráfaga de once radios es la marca del PRODUCTO. El tile de una integración lleva la marca de con QUÉ te conectás: con la API key es Anthropic, con la skill es Claude. Y el escudo del Perro Guardián lo dibujaba **un `if` escondido adentro del renderer de íconos** que pisaba el catálogo: un `if` por clave adentro de un renderer es justo lo que hace que una fuente única deje de serlo.',
      '**El exportador no sabía nada del filtro:** se podía dejar el mapa en 15 datos y bajar 52. Se manda el RESULTADO (la lista de ids) y no los criterios — **reimplementar el predicado del otro lado es cómo divergen dos ideas de «qué se ve»**. Y sin filtro el modal no pregunta nada, porque las dos respuestas darían el mismo ZIP.',
      '**El plugin público se destrabó con algo construido para otra cosa:** el hook de telemetría no embebe el token, lo lee de `~/.mako-token`, así que la skill genérica hace lo mismo y queda publicable. Antes de escribir, el generador **busca el patrón de una credencial** y se niega si encuentra algo: un token en un repo público queda en el historial de git para siempre y rotarlo no lo borra.',
      '⚠️ **Con las etiquetas clicables aparece un daño que el test de solape no cubría:** una etiqueta encima del punto de OTRO nodo le roba el click y abre un dato que nadie quiso abrir. Ahora se descarta también contra los círculos. Y `pointer-events: visiblePainted`, nunca `all`: con `all`, un nombre largo es un rectángulo invisible que tapa a sus vecinos — no se ve en pantalla, se ve en los clicks que caen mal.',
    ],
    commits: [
      { sha: 'bc900daa', msg: 'Claude (no Anthropic), y el exportado que baja lo que estás viendo', lineas: 435, archivos: 16 },
      { sha: '4465e37f', msg: 'La integración con Claude nunca funcionó en producción: el proxy la cortaba', lineas: 294, archivos: 9 },
      { sha: 'da749122', msg: 'El plugin público de MaKo, y los títulos del mapa clicables', lineas: 664, archivos: 9 },
    ],
    archivos: [
      'lib/rutas-publicas.ts — la lista salió de proxy.ts para que un test la pueda importar; el test es de dos filos (que las tres del bearer estén, y que /token y /hook NO)',
      '⚠️ Falta publicar `plugin/` como marketplace: no hay `gh` en este entorno. Los comandos quedaron en docs/hallazgos-infra.md',
    ],
  },
  {
    fecha: '16 ago', hora: '22:54', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La forma del cerebro se reusa en la bienvenida, y la lección era vieja',
    pedido: 'Que como están armados los nodos, sea como hoy se arman… tipo cerebro, no como un árbol',
    puntos: [
      'El mapa de la bienvenida del onboarding dibujaba anillos concéntricos calculados con trigonometría: **eso ES un árbol radial, y se nota**. La corrección no fue cambiar de motor — lo dice el propio `lib/cerebro-layout.ts`: «sobre un árbol ninguna simulación da la nube de Obsidian». **Se puede pasar la ficción por d3-force y seguir obteniendo un diente de león, porque el layout no puede inventar una forma que los datos no tienen.** Es exactamente el hallazgo del 8 de agosto, cobrado de vuelta ocho días después en otra pantalla.',
      'La ficción **no se toca** (regla del dueño: el cliente nuevo no tiene datos y mostrarle su cerebro real es mostrarle el negocio de otro). Lo que ahora es real es la FORMA: `lib/bienvenida-cerebro.ts` se mide con los **mismos cuatro umbrales** que `cerebro-grafo.ts` corrió sobre cuatro workspaces reales — densidad 2,21 (umbral 1,5), hojas 3% (≤30%), hub 2,0x (≤4,5x), clustering 0,403 (≥0,15).',
      '**La primera versión daba 33% de hojas y 0,097 de clustering: mejor que un árbol y todavía no una nube. Lo dijo el test; a ojo eso no se ve.** Es la misma razón por la que existe `medir-grafo.mjs`.',
      '⚠️ **Queda sin cablear:** `page.tsx` del onboarding corre `layoutCerebro` y baja el resultado por el wizard, pero la Bienvenida todavía monta el Grafo real. Vive en `lib/bienvenida-cerebro.ts` (escrito, con test, sin call-site).',
    ],
    commits: [{ sha: '810ec670', msg: 'El mapa de la portada ya es una nube medida, no un árbol dibujado', lineas: 320, archivos: 2 }],
  },
  {
    fecha: '16 oct', hora: '09:50', chat: 'Centro de Operaciones', sesion: 'local_428051c1-0369-4df2-ae6b-bcb42f63b64b', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Second Brain es un chat: la pieza única, y el Mapa sólo para el admin',
    pedido: 'Termina con todo, faltan mis pedidos del Second Brain',
    puntos: [
      'La etapa 2 de docs/diseno-mako-ai-native.md, primera tanda: /second-brain es el chat con MaKo con la cara del Centro de Operaciones.',
      'La barra: «Nuevo chat», el jefe «Second Brain» y sus sub-chats, que son las conversaciones del teléfono (sin migrar nada).',
      'El chat es de todos los que tienen MaKo (closer y setter incluidos); el Mapa, del admin de la tab, calculado sólo cuando se pide.',
      'La conversación corre en el turno de siempre por /api/mako/chat, con la tarjeta que se confirma y el micrófono de la casa.',
    ],
    archivos: [
      'app/second-brain/ChatSecondBrain.tsx — la pantalla',
      'app/api/mako/chat/route.ts — la ruta (la puerta de MaKo)',
      'app/_chat/HiloMako.tsx, TarjetaAccion.tsx, chat.css — las piezas',
      'lib/chat-mako-reglas.ts — el jefe y sus sub-chats',
    ],
  },
  {
    fecha: '16 oct', hora: '10:30', chat: 'Centro de Operaciones', sesion: 'local_428051c1-0369-4df2-ae6b-bcb42f63b64b', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: '«Pregúntale a MaKo» es el Second Brain: la barra, las redirecciones y «Antes»',
    puntos: [
      'La entrada de la barra se llama «Second Brain» y lleva a /second-brain; la clave sigue siendo mako (de ella cuelgan el teléfono, la bandeja e Inbox).',
      '/mako y /mako-doer redirigen; sus chats quedan en «Antes», de sólo lectura, con la regla de quién ve qué que tenía /mako.',
      'La API de MaKo suma listar_chats_mako y hilo_chat_mako: MaKo puede leer otro chat de la misma persona.',
    ],
    archivos: [
      'app/_components/nav.ts, Sidebar.tsx — la entrada',
      'lib/chat-mako-indice.ts — «Antes» y los chats de la persona',
      'lib/api-mako/areas/mako.def.ts, mako.run.ts — las dos lecturas',
    ],
  },
  {
    fecha: '16 oct', hora: '14:40', chat: 'Centro de Operaciones', sesion: 'local_428051c1-0369-4df2-ae6b-bcb42f63b64b', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los adjuntos del chat se guardan en el Archivero',
    puntos: [
      'La caja del Second Brain suma el «+», pegar y arrastrar: fotos y PDF. Al recargar vuelven, en la computadora y en el teléfono.',
      'El PDF que manda el admin también queda en El Archivero, y el chip dice cómo quedó. Lo de un lead (el Analyst del CRM) no va.',
      'La API de MaKo suma lo_que_hizo_chat_mako y renombrar_chat_mako. Del riel, el grupo de WhatsApp y el muñeco de cada chat está la parte de servidor.',
    ],
    archivos: [
      'lib/chat-mako-bloques.ts, chat-mako-adjuntos.ts — los adjuntos',
      'supabase/migrations/0305_chart_chats_bloques.sql — la columna',
      'app/_chat/ArchivosHilo.tsx — la miniatura y la ficha',
    ],
  },
  {
    fecha: '16 oct', hora: '11:40', chat: 'Centro de Operaciones', sesion: 'local_428051c1-0369-4df2-ae6b-bcb42f63b64b', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Second Brain del teléfono es el chat con MaKo, con el Mapa aparte',
    puntos: [
      '/m/second-brain abre el chat con MaKo; el admin tiene «Mapa» arriba de la hoja «Tus chats», y el closer y el setter no.',
      'El mapa de antes vive en /m/second-brain/mapa (en la computadora, /second-brain?panel=mapa).',
      'En More hay una sola fila «Second Brain» por persona; /m/mako redirige.',
    ],
    archivos: [
      'app/m/second-brain/page.tsx, mapa/page.tsx — el chat y el Mapa',
      'lib/movil-rutas.ts — las filas y las rutas',
      'app/m/mako/ChatMako.tsx — la fila «Mapa» en la hoja',
    ],
  },
  {
    fecha: '17 oct', hora: '04:00', chat: 'Centro de Operaciones', sesion: 'local_aac76313-d8b5-4b86-85f4-e579e4f33304', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Desde el Second Brain le escribes a tus chats de Claude Code',
    pedido: 'quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el Second Brain, terminemos de configurar eso así ya comenzamos',
    puntos: [
      'En /second-brain, la barra suma «Claude Code»: el Cerebro y cada jefe con sus sub-chats. Elegir uno abre su conversación con la caja firmada.',
      'En el teléfono, los mismos chats van debajo de los de MaKo en «Tus chats», y cada uno abre su conversación en una hoja.',
      'Es el mismo Centro, no una copia: el motor y las piezas se comparten con /admin/operaciones. Sólo lo ve Martín, con su segundo factor.',
    ],
    archivos: [
      'app/admin/operaciones/useCentro.ts, PiezasCentro.tsx, datos.ts — el motor, las piezas y la lectura guardada',
      'app/second-brain/ChatSecondBrain.tsx — la sección «Claude Code»',
      'app/m/second-brain/SecondBrainCentroM.tsx — el teléfono',
    ],
  },
  {
    fecha: '17 oct', hora: '04:45', chat: 'Centro de Operaciones', sesion: 'local_aac76313-d8b5-4b86-85f4-e579e4f33304', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo te deja el link a la pantalla de lo que pediste',
    pedido: 'que el chat le deje ahí el link para ir a donde corresponde',
    puntos: [
      'Debajo de la respuesta de MaKo en el Second Brain van los «Ir a …» de lo que pediste y se hace en otra pantalla.',
      'MaKo contesta el mensaje entero, como siempre: el link se suma y no demora la respuesta.',
    ],
    archivos: [
      'app/second-brain/ChatSecondBrain.tsx — el pedido a /api/mako/pedidos, en paralelo',
      'lib/chat-mako-reglas.ts — de qué respuesta se cuelga (colgarIrA)',
      'app/_chat/HiloMako.tsx — los chips',
    ],
  },
  {
    fecha: '17 oct', hora: '05:20', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Second Brain sólo dibuja el grafo, en oscuro, y el detalle va en la barra lateral',
    pedido: 'El Second Brain no cambia jamás de chat: sólo dibuja el grafo. El grafo va SIEMPRE en modo oscuro. Al tocar un nodo NO aparece nada abajo, jamás: para eso está la barra lateral del grafo.',
    puntos: [
      'Arriba dice «Second Brain» y «Todo lo que MaKo sabe de tu negocio.». Se fueron el título «Mapa» y «Conectar a Claude».',
      'La búsqueda va a la izquierda con «Filtrar» pegado; «Exportar», arriba a la derecha adentro del grafo; el zoom, abajo a la izquierda.',
      'Al tocar un punto, la barra lateral dice qué es, quién lo puso, sus datos y con qué se conecta, agrupado por área. «Editar» abre el área en una caja encima, nunca debajo.',
      'En el teléfono, el grafo es una caja oscura con el mismo título, y la hoja de un dato dice lo mismo que la barra lateral.',
    ],
    archivos: [
      'app/second-brain/VistaCerebro.tsx — la cabecera y el oscuro',
      'app/second-brain/Grafo.tsx — los controles y la barra lateral',
      'app/second-brain/AreasHub.tsx — el editor de un área, en una caja',
      'lib/cerebro-areas.ts — el tipo de un nodo y el agrupado por área (los usa también el teléfono)',
      'tests/second-brain-grafo.test.ts',
    ],
    revisar: '/admin/operaciones?panel=mapa',
  },
  {
    fecha: '17 oct', hora: '06:10', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El grafo suma lo que el negocio tiene hoy, y lo nuevo entra viajando',
    pedido: 'RECONSTRUIR AL 100% la lógica de agregar nodos, con todo lo que hay hoy. Cada vez que se agrega un nodo, una animación sutil de un nodo que viaja dentro de la tab.',
    puntos: [
      'Entran tus ofertas de Offer con sus productos y su lead magnet, todos tus funnels, tus leads (un punto con sus números, y cuántos hay en cada etapa), tus objetivos y KPIs, y tus chats de Offer y con MaKo.',
      'Cada punto dice qué es y cuándo entró. Lo que se edita en otra pantalla lleva un botón «Abrir en Offer» o «Abrir en el CRM».',
      'Lo nuevo desde tu última visita entra viajando desde el borde hasta su lugar, de a uno. La barra lateral suma «Lo último».',
      'Con la pestaña abierta, el grafo se actualiza solo cada 3 minutos; lo que ya estaba se desliza a su lugar nuevo.',
    ],
    archivos: [
      'lib/cerebro-vivo.ts — lo vivo del negocio, como nodos (puro)',
      'lib/cerebro-grafo.ts — sus lecturas y la huella del contenido',
      'app/api/second-brain/cerebro/route.ts — el grafo vivo',
      'app/second-brain/Grafo.tsx — el viaje, el deslizamiento y «Lo último»',
      'tests/second-brain-vivo.test.ts',
    ],
    revisar: '/admin/operaciones?panel=mapa',
  },
  {
    fecha: '17 oct', hora: '07:10', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La construcción de MaKo es la segunda capa del grafo, y /admin/dev lleva ahí',
    pedido: 'Para el SUPER ADMIN suma además la CONSTRUCCIÓN DE MAKO: las áreas, los chats, las bitácoras, los hitos. Había otro grafo de eso que hay que DEPRECAR al 100%.',
    puntos: [
      'Arriba a la derecha del Second Brain, sólo para ti, «Negocio · Construcción». La construcción muestra cada área con su bitácora, sus últimos hitos y los chats jefe que trabajan en ella.',
      'Se ve qué chat trabaja en qué área y qué áreas comparten código. Cada punto lleva a su bitácora o a su «Revisar».',
      'La vista vieja de /admin/dev se borró: ahora lleva a esta capa. Las páginas de cada área siguen.',
      'En el teléfono, el mismo selector y la construcción en listas.',
    ],
    archivos: [
      'lib/cerebro-construccion.ts — el grafo de la construcción (puro)',
      'lib/cerebro-construccion-datos.ts — lo lee del registro de /admin/dev',
      'lib/cerebro-modelo.ts — la taxonomía de un grafo',
      'app/second-brain/VistaCerebro.tsx — el selector de capa',
      'app/m/second-brain/ConstruccionM.tsx — el teléfono',
      'tests/second-brain-construccion.test.ts',
    ],
    revisar: '/admin/operaciones?panel=mapa&capa=construccion',
  },
  {
    fecha: '17 oct', hora: '08:10', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los chats traen del Second Brain sólo lo que necesitan: un 72-89 % menos de tokens',
    pedido: 'MUY IMPORTANTE: que sirva para los CHATS. El grafo modulariza los datos del negocio para AHORRAR TOKENS: un chat (MaKo o un jefe) trae sólo los nodos que le hacen falta y no todo el contexto.',
    puntos: [
      'Un chat pide primero el índice de tu negocio (unos 300 tokens) y después sólo los datos que nombra su pregunta, con sus vecinos.',
      'Medido en dos negocios reales: 118-190 tokens por pregunta, contra 459-678 del grafo entero y 1.105-1.606 del Second Brain en archivos.',
      'Está en la API de MaKo para MaKo y para los chats de Claude Code, y no gasta IA.',
      'Falta que el chat de MaKo lo use en cada mensaje en vez del contexto entero: es el paso siguiente.',
    ],
    archivos: [
      'lib/cerebro-recuperar.ts — el índice y la vista local (puro)',
      'lib/api-mako/areas/negocio.def.ts, negocio.run.ts — indice_segundo_cerebro y recuperar_del_segundo_cerebro',
      'scripts/medir-recuperacion.ts — la medición, de sólo lectura',
      'tests/second-brain-recuperar.test.ts',
    ],
  },
  {
    fecha: '17 oct', hora: '11:00', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Pegar una transcripción larga ya no rompe el chat: va como documento y se guarda sola',
    pedido: 'Pegar una transcripción larga en el chat del Second Brain rompe la pantalla. Un texto pegado de más de 1.000 caracteres se ve como un documento adjunto, como en Claude. Lo que se pega queda guardado solo en el Second Brain.',
    puntos: [
      'Un texto pegado de más de 1.000 caracteres no entra a la caja: queda como una ficha «Texto pegado» y en el chat se ve como un documento que se abre.',
      'Lo escrito muy largo se pliega con «Ver todo». Antes, una transcripción de 400 renglones ocupaba 24.474 px de alto.',
      'Lo que pegas se guarda solo en El Archivero, entero, y MaKo le saca los datos como a cualquier documento.',
      'Igual en la computadora y en el teléfono.',
    ],
    archivos: [
      'lib/chat-pegado.ts — las reglas (marcar, partir, cortar sin romper)',
      'app/_chat/PegadoHilo.tsx — la tarjeta y la burbuja plegada',
      'lib/chat-mako-adjuntos.ts → archivarPegadosDelChat — El Archivero',
      'tests/chat-pegado.test.ts',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '20 oct', hora: '22:26', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: el botón que abre el grafo se llama «Second Brain», no «Mapa»',
    revisar: '/second-brain?ws=21',
    pedido: 'no debería llamarse mapa, debería llamarse second brain',
    puntos: [
      'En el Ops Center de un negocio, el botón de arriba que abre el grafo dice «Second Brain». En el teléfono, la fila de «Tus chats» también.',
      '**Cómo se prueba:** /second-brain?ws=21, el botón de arriba; en el teléfono, «Tus chats» → «Second Brain». En producción desde el run 165.',
    ],
    commits: [
      { sha: 'cf255c7f', msg: 'El botón que abre el grafo se llama «Second Brain», no «Mapa» (computadora y teléfono)', lineas: 31, archivos: 3 },
    ],
    archivos: [
      'app/second-brain/ChatSecondBrain.tsx — el botón de la computadora',
      'app/m/mako/ChatMako.tsx — la fila del teléfono',
      'tests/second-brain-ops-center-nombre.test.ts',
    ],
  },
  {
    fecha: '20 oct', hora: '22:15', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El Second Brain es UN cerebro: una raíz y todo colgado de ella, nunca dos',
    pedido: 'El Second Brain de SuperAdmin ya te había pedido que no se dividiera en 2... En ningún caso jamás los cerebros se deben dividir en 2',
    puntos: [
      'Tu negocio y la construcción de MaKo salen de la misma raíz y se acomodan juntos, en una sola nube. Antes eran dos nubes, una al lado de la otra.',
      'Vale para todos los negocios: el de MaKo tenía 3 pedazos sueltos y el del Cliente de Prueba, 2. Ahora todo cuelga de la raíz.',
      'Para mirar sólo una parte (negocio, construcción, ventas, marketing) está el filtro.',
      'En el teléfono se fue el «Negocio · Construcción»: una foto y un grafo, el mismo de la computadora.',
    ],
    archivos: [
      'lib/cerebro-union.ts — una raíz: el puente y los racimos sueltos (`puentesARaiz`)',
      'lib/cerebro-union-servidor.ts — la física de todo junto, en el servidor',
      'lib/second-brain-opera.ts — el cerebro que se dibuja, para la pantalla, el teléfono y el grafo vivo',
      'lib/cerebro-grafo.ts, lib/cerebro-construccion.ts — cada cerebro, de una pieza',
      'app/m/second-brain/SecondBrainM.tsx — el teléfono sin el selector',
      'tests/second-brain-un-cerebro.test.ts',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '20 oct', hora: '23:20', chat: 'Second Brain', sesion: 'local_26ff7b73-b712-4726-9882-89617840bf7c', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un cliente del Second Brain abre su ficha, no la lista del CRM',
    pedido: 'lib/cerebro-vivo.ts arma «/crm?lead=<id>», pero /crm no lee ese parámetro: el link abre la lista y no la ficha.',
    puntos: [
      'Tocar un cliente en el Second Brain y abrirlo lleva a su ficha del CRM.',
      'Se revisaron todos los links del Second Brain: era el único roto. Un test mira cada uno contra la pantalla que abre.',
    ],
    archivos: [
      'lib/cerebro-vivo.ts — el link del cliente',
      'tests/second-brain-links.test.ts — cada link contra su destino',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '23 oct', hora: '10:30', chat: 'Chats de las tabs', sesion: 'local_60dde796-c69c-4cab-a626-b7770594e354', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las charlas con MaKo de cada tab, en el grafo',
    pedido: 'Martín, 17/10: «todo siempre guardarse en chats en el Ops Center e ir guardándose en el grafo del Second Brain». El Ops Center ya las listaba; el grafo sólo sumaba las de Offer y las de la estrella.',
    puntos: [
      'Cada tab donde la persona habló con MaKo es un nodo del grafo («MaKo en CRM», «MaKo en Automations»), con cuántas charlas tiene y las últimas.',
      'Se cuelga de lo que esas charlas tocan: el funnel de las del CRM, el cliente o los leads de una ficha.',
      'Muestra exactamente lo que esa persona ve en su Ops Center: un closer no ve en el grafo charlas que su Ops Center le esconde.',
      'Falta mirarlo en pantalla.',
    ],
    archivos: [
      'lib/cerebro-chats-tabs.ts — de qué tab y de qué entidad es cada charla',
      'lib/cerebro-chats.ts — las mismas lecturas que la lista del Ops Center',
      'lib/cerebro-vivo.ts — un nodo por tab, colgado de su entidad',
      'tests/cerebro-chats-tabs.test.ts',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '23 oct', hora: '19:40', chat: 'Cerebro', sesion: 'local_3c82c204-8262-460c-9fca-b164e2053c9a', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El Second Brain: entrar en el acto y un chat con MaKo a la derecha',
    pedido: '1. Cuando apreto "Second Brain" primero se va al chat de "Cerebro" y luego de unos segundos ahí recién entra al second brain, eso está muy mal... 3. Y quiero que Second Brain, la sidebar que tiene a la derecha sea reemplazada por un chat con MaKo, que tenga la criatura de MaKo... Que se guarde el historial claro, pero que si no hay nada que MaKo mande el mensaje "Hola NOMBRE. Este es tu Second Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?"',
    puntos: [
      'Llegó por el Cerebro con una captura de /second-brain?chat=40&ticketera=tickets, y lo tomó el chat «Ops Center».',
    ],
  },
  {
    fecha: '23 oct', hora: '19:39', chat: 'Ops Center', sesion: 'local_090698fe-36a3-4aab-ab7c-9c08a3639065', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tocar «Second Brain» cambia la vista en el acto',
    puntos: [
      'Hacia el grafo se ve el loader de MaKo hasta que llega; hacia un chat se ve el chat ya. Antes se veía el Cerebro unos 3 s.',
      'Un link a la página pelada (el ícono del Ops Center en la barra de la app) vuelve a la entrada, no al último chat.',
      'Falta mirarlo en pantalla, en producción.',
    ],
    commits: [{ sha: 'a5deec11', msg: 'Second Brain: el clic cambia la vista en el acto, con el loader del grafo, y la vista sale de la URL', lineas: 75, archivos: 4 }],
    archivos: [
      'app/second-brain/ChatSecondBrain.tsx — `yendo` y `verMapa`; la URL pelada vuelve a la entrada',
      'tests/ops-center-navegacion.test.ts — test 4',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '23 oct', hora: '19:52', chat: 'Ops Center', sesion: 'local_090698fe-36a3-4aab-ab7c-9c08a3639065', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La columna derecha del grafo es un chat con MaKo',
    puntos: [
      'El mismo chat del Ops Center, con la estrella; su propia conversación por persona y negocio, que el Ops Center lista como «Second Brain».',
      'Vacío, MaKo saluda con el nombre de quien mira y ofrece tres preguntas: lo último, el Norte y lo que le falta saber.',
      'Lo de la barra de antes: el conteo en la cabecera; el detalle de un punto, encima del chat; las áreas, en «Filtrar».',
      'Falta mirarlo en pantalla, en producción (computadora y teléfono).',
    ],
    commits: [{ sha: 'c733a2be', msg: 'Second Brain: la columna derecha del grafo es un chat con MaKo, con su propio hilo y el saludo de MaKo', lineas: 535, archivos: 13 }],
    archivos: [
      'app/second-brain/ChatDelSecondBrain.tsx — el chat de la columna',
      'app/second-brain/Grafo.tsx — `lateral` y el detalle encima',
      'lib/chat-mako-reglas.ts — TAB_SECOND_BRAIN, el saludo y el origen',
      'lib/mako-turno-app.ts — sesionDeTab',
      'tests/second-brain-chat-mako.test.ts',
    ],
    revisar: '/second-brain?panel=mapa',
  },
  {
    fecha: '25 oct', hora: '01:08', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El recolector del Second Brain: data de todos lados, para todos los negocios',
    pedido: 'Quiero que implementes en el Second Brain un "recolector de información" de TODOS lados... Quiero data de todo en el Second Brain... De las llamadas que ya tenemos la transcripción de Fathom, de la data de métricas de Meta... De los mensajes de WhatsApp, de absolutamente todo. Porque eso sí será un "Second Brain". Esto para todos los ws',
    puntos: [
      'Del 24/10 ~03:00; el diseño, en docs/diseno-second-brain-recolector.md. Lo pasó el Cerebro el 25/10 («implementalo de punta a punta»).',
    ],
    revisar: '/second-brain?panel=mapa',
  },
  {
    fecha: '25 oct', hora: '01:08', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Second Brain aprende solo de tu WhatsApp, y te dice de qué aprendió',
    puntos: [
      'Cada hora, MaKo lee las conversaciones de WhatsApp con los leads de cada negocio que lo prendió, anota los hechos importantes de cada una (qué quiere, qué objetó, qué se acordó) y los suma a su Second Brain. Al responder, el chat los usa y dice de qué conversación salieron.',
      'Para tus clientes arranca APAGADO (gasta su IA: lo prende cada uno en «Aprende solo»); en tu negocio, prendido. Usa la IA de cada negocio: el que no conectó la suya no corre. Sólo lee: nunca manda ni contesta nada. No lee grupos ni chats sin un lead (tu WhatsApp personal no entra).',
      'En el Mapa del Second Brain, arriba a la derecha, «Aprende solo»: de qué fuente aprende, cuándo fue la última vez, cuánto entró, lo último que aprendió y un botón para apagarlo.',
      'Antes de subirlo hay que aplicar la migración 0333 en producción (la aplica el Cerebro). Sin ella el recolector no corre ni gasta nada.',
      'Lo que sigue del diseño: las métricas de Meta y las llamadas de Fathom (con la cuenta de cada negocio).',
    ],
    commits: [
      { sha: 'c00e56f27', msg: 'Second Brain: el recolector aprende solo del WhatsApp de cada negocio, con su IA y su procedencia', lineas: 1108, archivos: 15 },
    ],
    archivos: [
      'lib/recolector.ts — la vuelta por negocio: qué lee, qué guarda y la marca',
      'lib/recolector-reglas.ts — qué conversaciones, el pedido a la IA, la respuesta y la procedencia',
      'app/api/cron/second-brain-recolector/route.ts — el cron, cada hora',
      'app/second-brain/AprendeSolo.tsx — «Aprende solo» en el Mapa',
      'supabase/migrations/0333_second_brain_recolectado.sql — el libro (ANTES del deploy)',
      'tests/second-brain-recolector*.test.ts — las reglas y la vuelta simulada; 10 roturas, cada una cae',
    ],
    revisar: '/second-brain?panel=mapa',
  },
  {
    fecha: '26 oct', hora: '01:50', chat: 'Cerebro', sesion: 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que MaKo sea realmente inteligente y recomiende en todos lados, sin cuota',
    pedido: 'Lo que mas me interesa que trabajes durante toda la noche es que MaKo sea realmente inteligente... Y comience a dar recomendaciones en todos lados, en el Ops Center, cuando uno esta haciendo una automatización, al crear una offer, landing, MaKo en WhatsApp (que no funciona muy bien, no guarda contexto), o lo que sea realmente, donde sea que haya un mako... Pero estas recomendaciones y MaKo "pensando" deben ser reales, no le presetees que cada ratito debe de hacer recomendaciones basura para cumplir con su "cuota", tiene que ser posta inteligente... Revisa como lo hacen otras apps o skills, revisa como lo harias tu mismo si te digo que seas mi asesor de marketing... Aprovecha realmente el Second Brain... Revisa si el second brain realmente esta guardando todo el contexto de absolutamente todo, todo el tiempo, para que justamente esto nos sirva...',
    puntos: [
      'Lo pasó el Cerebro al chat «MaKo recomienda» (cuenta 5), con la auditoría del Second Brain, la investigación, el motor y las pantallas.',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '26 oct', hora: '02:59', chat: 'MaKo recomienda', sesion: 'local_4f26fc4d-a57e-4238-ae44-ec63106b0d7e', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo recomienda sólo con un dato de tu negocio, y si no tiene nada que decir, se calla',
    puntos: [
      'Cada recomendación sale de algo que MaKo midió en tu negocio: cuánto tardas en contestar a un lead nuevo, cuánta gente espera respuesta, cuántos faltan a las llamadas, por qué pierdes ventas, qué automatización falla o nadie contesta, qué página no convierte y qué objeción repite la gente y tu oferta no contesta.',
      'Te dice qué hacer, qué cambia y el porqué con el número. Si nada pasa su umbral, no aparece nada: no hay cuota.',
      'Aprende: «No aplica» no vuelve, «Ahora no» vuelve en 14 días si sigue siendo cierto, y lo que aceptas lo mide a los 10 días (si sigue igual, te lo dice).',
      'Aparece en el Cerebro del Ops Center, en el chat de Automations, en Offer y en el Web Generator, plegada en el bloque de preguntas; por WhatsApp, cuando le preguntas «¿qué me recomiendas?». «Hacerlo» no ejecuta nada: te lleva a la pantalla o te deja el pedido escrito.',
      'La auditoría: el Second Brain dibuja mucho y recuerda casi nada (a la memoria sólo entra WhatsApp, y en los clientes viene apagado). Todo en docs/diseno-mako-recomienda.md.',
      'Falta medirlo con los datos de producción: el permiso de lectura lo tiene que dar Martín.',
    ],
    commits: [
      { sha: '88d16d29d', msg: 'MaKo recomienda: un motor que sólo habla con un dato del negocio, y lo muestra donde hay un MaKo', lineas: 2052, archivos: 20 },
    ],
    archivos: [
      'lib/recomendaciones-reglas.ts — cuándo existe una recomendación, cómo se calla y cómo aprende',
      'lib/recomendaciones-senales.ts — lo que se mide, con sus umbrales',
      'lib/recomendaciones.ts — la lectura del negocio, la memoria y la redacción con su IA',
      'app/_chat/RecomendacionesDeMako.tsx — el bloque de preguntas en cada pantalla',
      'app/api/mako/recomendaciones/route.ts — la ruta (del admin)',
      'lib/api-mako/areas/mako.def.ts — que_recomienda_mako y decidir_recomendacion',
      'tests/mako-recomienda-*.test.ts — reglas, señales, superficies y el turno; 26 roturas, cada una cae',
    ],
    revisar: '/second-brain',
  },
  {
    fecha: '28 oct', hora: '03:10', chat: 'MaKo inteligente: recomendaciones reales y Second Brain', sesion: 'local_4f7b9970-b8ae-47b8-973e-8de7c91ec28d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: toda caja de chat de MaKo adjunta y arrastra cualquier documento, y MaKo lo lee',
    pedido: 'Leila (ticket #16): «No me deja adjuntar un documento ni por arrastrar, ni por adjuntar». Martín, el mismo día: «revisa que todos los chats acepten todos los formatos».',
    puntos: [
      'El «+» y arrastrar toman Word, Excel, PowerPoint, PDF, texto, CSV, imágenes y audio en todas las cajas de chat de MaKo, también las que antes decían «Este chat no recibe archivos» (Media Buyer, Dashboard, los editores, Soporte).',
      'Lo que la pantalla no toma por sí misma, la caja lo sube y MaKo lo LEE al mandar, con la IA del negocio: sale con el mensaje como un documento con su nombre.',
      'En un editor con tope de texto, lo leído entra hasta el tope y la caja dice cuánto quedó afuera. Lo que no se pudo leer avisa con «Reportar a Soporte».',
      'Chats (lo que se le manda a un lead) sigue mandando el archivo tal cual, sin leerlo.',
      '**Cómo se prueba:** en /second-brain y en /video-editor, arrastrar un .docx y un .pdf a la caja y mandar. En producción desde 5b114031c.',
    ],
    commits: [
      { sha: '73a762f00', msg: 'Toda caja de chat de MaKo adjunta y arrastra todos los formatos, y MaKo los lee (ticket #16 de Leila)', lineas: 546, archivos: 11 },
      { sha: 'a8e392f70', msg: 'La caja de chat: el aviso de lo adjuntado que no se pudo leer lleva «Reportar a Soporte», y los tests fijan la forma nueva', lineas: 18, archivos: 7 },
      { sha: '4450d71b5', msg: 'La revisión del Cerebro sobre 34b0687f0: los tres medios de «no existe» con su test rojo-verde, el tope de los editores y los bajos', lineas: 315, archivos: 18 },
    ],
    archivos: [
      'app/_chat/CajaChat.tsx — la caja única adjunta sola y toma lo arrastrado',
      'app/_chat/adjuntos-que-se-leen.ts · juntar-adjuntos.ts — qué va a la pantalla y qué se lee, con el tope',
      'app/api/chat/leer-archivo/route.ts — lo lee con la IA del negocio',
      'tests/chat-formatos.test.ts · chat-adjuntos-revision.test.ts — recorren todas las cajas',
    ],
    revisar: '/second-brain',
    tickets: [16],
  },
  {
    fecha: '28 oct', hora: '11:30', chat: 'MaKo inteligente: recomendaciones reales y Second Brain', sesion: 'local_4f7b9970-b8ae-47b8-973e-8de7c91ec28d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo sabe qué hace cada una de sus funciones, y lo saca del Second Brain sin gastar de más',
    pedido: 'Te pido que el Second Brain de SuperAdmin tenga conocimiento de todas las funcionalidades, para que yo le pueda escribir y no haga cualquier cosa... (Supongo que todos los chats ya extraen data del second brain, si no lo hacen está mal... y que sea eficiente justamente, por eso tenemos tipo grafo, sin gastar tantos tokens...)',
    puntos: [
      'Un catálogo de las 20 funciones de MaKo: qué hace cada una, qué no hace todavía, qué app reemplaza (Chats a respond.io, Video Editor a CapCut, Image Editor a Canva, Web Generator a Gamma) y cómo le dice la gente.',
      'En tu Second Brain es una capa nueva, «Lo que hace MaKo». Un chat trae sólo la función que nombra la pregunta: «qué no hace la bandeja» trae Chats y nada más.',
      'Las herramientas del Second Brain ya no rearman el mapa entero en cada pregunta: lo leen sin dibujarlo y lo guardan unos minutos.',
      'Lo que sigue: que el Web Generator y el chat de MaKo lo traigan solos antes de contestar.',
    ],
    archivos: [
      'lib/funciones-mako.ts — el catálogo (una tab nueva suma su entrada en el mismo commit)',
      'lib/cerebro-funciones.ts — la capa del grafo',
      'lib/cerebro-para-chat.ts — el único grafo que lee un chat',
      'tests/funciones-mako.test.ts · tests/cerebro-funciones.test.ts — 11 roturas, cada una cae',
    ],
    revisar: '/second-brain',
  },
  // ── 3 nov: los tickets #46, #47 y #48 de Leila — MaKo negaba lo que SÍ tiene, o no sabía dónde vive en la pantalla ──
  // La causa de los tres es la del #45: la palabra de la persona no era la del nombre de la herramienta, y no viajaba al
  // turno (las familias de lib/mako-intencion-app.ts). Los puntos los lee la clienta en el aviso: en su idioma, sin lo interno.
  {
    fecha: '3 nov', hora: '01:48', chat: 'Tickets de Leila', sesion: 'local_3b2dd04b-d715-4586-8ad1-9b59a7f4343c', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo ya te propone cambiar el precio de tu oferta o de un producto, en vez de decirte que no puede',
    puntos: [
      'Le pedías a MaKo pasar el precio de pesos a dólares y te contestaba que desde el chat no podía. Sí puede: te propone el cambio de la oferta o del producto y te deja un link para confirmarlo.',
      'Y te dice dónde corregirlo tú: en el Second Brain, «La oferta» → «El brief».',
      '**Cómo se prueba:** en el Ops Center, «quiero pasar el precio de mi oferta a dólares».',
    ],
    archivos: [
      'lib/mako-intencion-app.ts — la familia `precio-oferta`',
      'tests/mako-no-puedo-falsos.test.ts — el 14',
    ],
    revisar: '/second-brain',
    tickets: [46],
  },
  {
    fecha: '3 nov', hora: '01:48', chat: 'Tickets de Leila', sesion: 'local_3b2dd04b-d715-4586-8ad1-9b59a7f4343c', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo te arma una secuencia nueva con su disparador por etiqueta',
    puntos: [
      'Le pediste que el WhatsApp del diagnóstico disparara una secuencia y te dijo que sólo podía activar o pausar las que ya existen. Sí puede crearla: la arma con su disparador (por ejemplo, cuando se le agrega una etiqueta al lead) y nace en pausa, sin escribirle a nadie hasta que la actives.',
      '**Cómo se prueba:** en el Ops Center, «créame una secuencia que arranque cuando se agrega la etiqueta diagnóstico».',
    ],
    archivos: [
      'lib/mako-intencion-app.ts — la familia `crear-secuencia`',
      'lib/api-mako/areas/chatbot.def.ts — crear_automatizacion_con_ia dice «secuencia», «disparador» y «etiqueta»',
      'tests/mako-no-puedo-falsos.test.ts — el 15',
    ],
    revisar: '/automations',
    tickets: [47],
  },
  {
    fecha: '3 nov', hora: '01:48', chat: 'Tickets de Leila', sesion: 'local_3b2dd04b-d715-4586-8ad1-9b59a7f4343c', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo sabe en qué pantalla se corrige cada dato de tu negocio',
    puntos: [
      'Preguntaste dónde actualizar tus datos y MaKo no lo sabía. Ahora te lo dice con el nombre que ves: en el Second Brain, «La oferta» → «El brief» para el precio, qué incluye y el horario; «La oferta» → «La oferta» para tus ofertas; y «Productos» para el catálogo con su precio. Con el link que te abre esa pantalla.',
      '**Cómo se prueba:** en el Ops Center, «¿dónde actualizo mis datos?».',
    ],
    archivos: [
      'lib/secciones-negocio.ts — `DATOS_DEL_NEGOCIO`, `lugarDato`, `rutaDato`',
      'lib/mako-capacidades.ts — la capacidad datos-negocio',
      'lib/api-mako/areas/negocio.run.ts · crm.run.ts — ver_perfil_negocio, listar_ofertas y listar_productos dicen dónde se edita',
      'tests/mako-no-puedo-falsos.test.ts — el 16 y el 17',
    ],
    revisar: '/second-brain',
    tickets: [48],
  },
  {
    fecha: '3 nov', hora: '04:30', chat: 'Second Brain: documentos desde el chat (#44)', sesion: 'local_d010fa87-9186-469e-83de-d431a71f64d8', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: le pegas o adjuntas un documento en el chat y MaKo lo suma al Second Brain',
    pedido: 'Código Inmobiliario (ticket #44): «te cargo un documento con toda la información que necesitas saber de mi negocio, analízalo e incorpóralo al second brain». MaKo le contestó que no tenía una herramienta que escribiera ahí.',
    puntos: [
      'Nueva tarjeta «Sumar un documento al Second Brain»: MaKo guarda el documento en El Archivero, saca lo que va en tu perfil y te lo muestra antes de que digas que sí. Lo que editaste a mano no se toca.',
      'Con tu propio Claude en la computadora, lo lee tu Claude: la tarjeta muestra cada dato que va a tu perfil.',
      'Si el chat cortó el documento por largo, la tarjeta lo dice y te pide el resto como otro documento. El mismo documento dos veces no se guarda dos veces.',
      'MaKo entiende el pedido aunque venga con el documento pegado: antes lo leía como una lista de ideas y no traía ninguna herramienta.',
      '**Cómo se prueba:** en /second-brain, pegar un documento largo con «súmalo al second brain» y confirmar la tarjeta; el documento aparece en El Archivero.',
    ],
    commits: [
      { sha: '27a0e7565', msg: 'La ingesta de El Archivero sale de su ruta a lib/archivero-ingesta.ts', lineas: 341, archivos: 6 },
      { sha: 'b97ff33c6', msg: 'Ticket #44: MaKo suma al Second Brain un documento pegado en el chat', lineas: 347, archivos: 13 },
    ],
    archivos: [
      'lib/archivero-ingesta.ts — la ingesta de El Archivero, la misma para su pantalla y para la API',
      'lib/api-mako/areas/negocio.def.ts · negocio.run.ts — sumar_documento_second_brain',
      'lib/chat-pegado.ts — documentoDelChat y pedidoDelMensaje',
      'lib/mako-intencion-app.ts — la familia documento-al-cerebro',
      'tests/sumar-documento-second-brain.test.ts — 8 roturas, cada una cae',
    ],
    revisar: '/second-brain',
    tickets: [44],
  },
  {
    fecha: '3 nov', hora: '20:20', chat: 'Tickets de clientes', sesion: 'local_d010fa87-9186-469e-83de-d431a71f64d8', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo te prende «Aprende solo» desde el chat',
    puntos: [
      'Le pediste activar «Aprende solo» y te contestó que no existía. Sí existe: ahora te lo prende desde el chat, con tu «sí», y también lo apaga.',
      'Y sabe dónde está: en el Second Brain, en la cabecera del Mapa.',
      'Con «Aprende solo» prendido, MaKo aprende de tus conversaciones de WhatsApp con leads. No manda ningún mensaje.',
      '**Cómo se prueba:** en el Ops Center, «activa Aprende solo».',
    ],
    archivos: [
      'lib/mako-capacidades.ts — la capacidad aprende-solo',
      'lib/mako-intencion-app.ts — la familia aprende-solo',
      'lib/api-mako/areas/mako.def.ts · mako.run.ts — cambiar_aprende_solo',
      'tests/aprende-solo-en-el-chat.test.ts — en un negocio que no es la plataforma; 6 roturas, cada una cae',
    ],
    revisar: '/second-brain',
    tickets: [45],
  },
];
