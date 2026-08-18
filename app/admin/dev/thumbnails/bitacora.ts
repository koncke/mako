// =============================================================================
// Thumbnails — el registro de construcción del área
// =============================================================================
// Alcance: la tab /thumbnails de Content Machine · YouTube — la miniatura del
// video: qué imagen y qué texto hacen que se cliquee. **Todavía no existe**: la
// ruta es un `ComingSoon` de 8 líneas y no hay backend.
//
// Este registro es corto a propósito, y eso es el dato: lo único que se decidió
// del área hasta hoy es DÓNDE vive y CUÁNTO va a costar. Lo primero salió del
// rediseño del sidebar; lo segundo, de las tres corridas de pricing del 9/8, que
// tarifaron el thumbnail antes de que nadie escribiera una línea del generador.
//
// De dónde salió: `git log` sobre app/thumbnails y las rutas que la nombran; los
// mensajes de commit de este repo, que explican el porqué; los números, de
// app/admin/dev/pricing/modelo.ts y docs/costos-ia-y-planes.md. El índice de
// sesiones (docs/chats.md) llega hasta el 8/8, así que los hitos posteriores van
// con «—»: no se inventa un chat.
//
// NO es un changelog. Va el motivo, la trampa y lo que quedó SIN hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La ruta y su lugar en el sidebar', detalle: 'Content Machine · YouTube · Thumbnails · con el chip «pronto» y sin backend, que es lo honesto', estado: 'hecha' },
  { titulo: 'El área en el registro de /admin/dev', detalle: 'Con su proyecto propio y su borde contra «Content Machine» (la estrategia) · el Change History todavía muestra commits ajenos', estado: 'hecha' },
  { titulo: 'La economía: cuánto cuesta y cuánto se cobra', detalle: 'US$0,068 las 2 variantes (barata US$0,030) · 160 MT · se cobra por INTENTO, no por pieza terminada', estado: 'hecha' },
  { titulo: 'El generador', detalle: 'Qué imagen y qué texto · hoy no existe: `ComingSoon` de 8 líneas, sin motor, sin prompt y sin pantalla', estado: 'cola' },
  { titulo: 'Medir el consumo real', detalle: 'Los 12 thumbnails/mes del plan Growth son un SUPUESTO (n=0 llamadas medidas) y nada impide que sean 40', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '7 ago', hora: '02:31', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Nace la ruta, vacía y avisada',
    puntos: [
      'Content Machine pasó a ser **sección propia** del sidebar, no un ítem de «Create»: es un taller con una sección por canal, y YouTube quedó con YouTube Writer y Thumbnails.',
      'Las ocho rutas nuevas salieron con el chip «pronto», y el porqué quedó escrito en el commit: **prometer lo que no existe es peor que no tenerlo**. Reservar el lugar y el nombre —`/thumbnails`, igual que la tab— es barato; llenar una pantalla de humo se paga cuando el cliente la abre.',
      'La marca de YouTube va simplificada a la grilla del set (línea, 24×24) en vez del logo oficial: a 17 px un logo con relleno propio se vuelve una mancha, y encima el color de una marca ajena no es ninguno de los cinco significados del sistema.',
    ],
    commits: [
      { sha: '72984b8f', msg: 'Rediseño · el hover roto, Content Machine como sección y tus tres íconos', lineas: 202, archivos: 12 },
    ],
    archivos: [
      'app/thumbnails/page.tsx — las 8 líneas: `requireRolWs([], { nav: \'thumbnails\' })` + `<ComingSoon>`. Es TODO el área hoy',
      'app/_components/nav.ts:271 — la entrada, con `comingSoon: true`',
    ],
  },
  {
    fecha: '9 ago', hora: '01:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El área entra al registro, y hereda un historial que no es suyo',
    puntos: [
      'Thumbnails pasó a ser una de las 121 áreas de `/admin/dev`. Ni el Roadmap ni el Change History se escriben a mano: el primero sale de las tareas abiertas del proyecto declarado, el segundo de `git log` sobre el `vive[]`. «Era la única forma de que 121 registros no fueran 121 mentiras».',
      '⚠️ **Pero un área sin código propio hereda el ruido de los archivos compartidos.** El `vive[]` es `app/thumbnails/page.tsx` (8 líneas, tocado UNA vez en su vida) y `app/_components/nav.ts`, que lo toca todo el mundo. Medido en `_historial.generado.ts:792`: los 12 commits que el área muestra como su historia son de la barra de admin, del sistema de diseño y de /admin/docs — **ninguno es de Thumbnails**. Un historial lleno de commits ajenos se lee como área trabajada, que es exactamente lo contrario de la verdad.',
      'La lección para cualquier área ComingSoon: **el Change History automático no sabe distinguir «no pasó nada» de «pasó en un archivo que comparte con otras 40 áreas»**. Cuando el área no tiene código propio, el registro escrito a mano es lo único que dice la verdad — que es por qué existe este archivo.',
    ],
    commits: [
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
    ],
    archivos: ['app/admin/dev/_historial.generado.ts:792 — los 12 commits ajenos que el área muestra como su historia'],
  },
  {
    fecha: '9 ago', hora: '03:39', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El thumbnail es de los caros, y todavía no existe',
    puntos: [
      'La corrida que costeó el producto completo puso a Thumbnails entre las **6 acciones de medios** de las 22 por construir, y ese es el hallazgo que gobierna el área: **las 16 acciones de texto suman US$0,23 y las 6 de medios US$3,22** — los medios son 14× el texto entero con seis acciones contra dieciséis.',
      'El número del thumbnail: **US$0,068 por 2 variantes** (US$0,030 en la capa barata), o sea el doble de una imagen suelta porque se generan dos para elegir. Es de los baratos de su grupo —un clip de 8 s son US$0,40 y un Reel de 15 s con 3 intentos US$2,45— pero está del lado que se multiplica solo.',
      '**La consecuencia de diseño, que es de planes y no de ingeniería:** los medios son el 90% del costo del plan Growth (US$24,58 de US$27,40) y el Growth se pasa del techo. Por eso nada de medios puede ser «feature incluida ✓»: tiene que ser una unidad medida y visible, «te quedan N». Thumbnails nace con esa restricción puesta, antes de tener una línea de código.',
    ],
    commits: [
      { sha: 'c4099abc', msg: 'pricing: paso 2 — el costo del producto completo', lineas: 183, archivos: 3 },
    ],
    archivos: [
      'app/admin/dev/pricing/modelo.ts:383 — `{ id: \'thumb\', familia: \'Content\', label: \'Thumbnail — 2 variantes\', usd: 0.068 }`',
      'docs/costos-ia-y-planes.md § «Lo que falta construir: 22 acciones nuevas que gastan»',
    ],
  },
  {
    fecha: '9 ago', hora: '09:55', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tarifa: 160 MT, por INTENTO, y un supuesto sin medir',
    puntos: [
      'Decisión del dueño: MaKo Tokens sí o sí, y cada operación con su precio. El thumbnail quedó en **160 MT** (1 MT = US$0,001), en el grupo Medios.',
      '**Se cobra por INTENTO, no por pieza terminada.** No es dureza comercial, es aritmética: en creativos nadie acierta al primero, y si los fallidos no descuentan, cada pieza cuesta 3× y la diferencia la paga la agencia. Vale para todo el grupo Medios, Thumbnails incluido.',
      '⚠️ **El número tiene `origen: \'publicado\'` y `n: 0` — cero llamadas medidas.** Es un precio de lista del proveedor multiplicado por dos variantes, no una observación. El hallazgo de método de esa misma corrida (el estadístico correcto es la **media**, no la mediana, porque la distribución de tokens es asimétrica a la derecha) salió de medir 2.249 llamadas reales; acá no hay ninguna que medir todavía.',
      '⚠️ **Y el supuesto que sostiene el margen del Growth es 12 thumbnails por mes, sin nada que lo impida.** Está escrito en `docs/costos-ia-y-planes.md`: «ninguno está medido». El día que el generador exista, el primer trabajo del área no es la calidad de la miniatura — es que el consumo quede medido y topeado.',
    ],
    commits: [
      { sha: 'e19a03e3', msg: 'pricing: la tarifa de MaKo Tokens, operación por operación', lineas: 207, archivos: 2 },
    ],
    archivos: ['app/admin/dev/pricing/modelo.ts:481 — la fila del thumbnail en la tarifa, con su `origen` y su `n`'],
  },
  {
    fecha: '12 ago', hora: '13:09', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Dónde va a caer una tarea de Thumbnails cuando la haya',
    puntos: [
      'El catálogo del plan separó **la ESTRATEGIA del contenido («Content Machine»: la escalera, los pilares, la materia prima) de los FORMATOS** —Reels, Carousels, Stories, Thumbnails, YouTube Writer, cada uno con su proyecto—. Sin esa capa arriba, las tareas de estrategia caían en un formato por parecido de palabra.',
      'La regla ejecutable: **una familia del sidebar no puede ser un proyecto inventado por el modelo**. Que «Content Machine» exista como proyecto es legítimo porque está en el catálogo, y `puedeSerProyectoNuevo()` consulta el catálogo **antes** que la lista de familias — ese orden es toda la regla.',
      'Importa acá porque el Roadmap de esta área se lee del proyecto declarado: mientras el generador no exista, **un roadmap vacío significa que nadie cargó trabajo, no que no haga falta**. Las dos lecturas se ven iguales en pantalla.',
    ],
    commits: [
      { sha: '5efa59db', msg: '«Content Machine» es un proyecto de verdad, y los otros cuatro se fueron', lineas: 207, archivos: 3 },
    ],
    archivos: ['lib/plan-proyectos-catalogo.ts:125 — la entrada «Thumbnails» del catálogo, con su `que`'],
  },
];
