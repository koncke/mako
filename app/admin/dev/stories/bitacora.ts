// =============================================================================
// Stories — el registro de construcción del área
// =============================================================================
// Alcance: la tab /stories de Content Machine · Instagram. Arma el DÍA de
// stories completo: una sola idea, el objetivo del día (conexión / venta /
// interacción), el storyboard frame por frame con su indicación de producción,
// y el envío de cada frame como borrador a /instagram.
// Vive en: app/stories/ (page, StoriesApp, Storyboard, actions, objetivos,
// OnboardingStories) sobre el motor compartido lib/ig-writer.ts +
// lib/ig-formatos.ts + lib/ig-contenido.ts.
//
// De dónde salió esto: los mensajes de commit —que en este repo explican el
// porqué— sobre las rutas del área; las trampas y lo que quedó SIN hacer, de
// docs/hallazgos-comunicacion.md § «Los writers de contenido IG (Reels /
// Carousels / Stories)» y § «KEY_PASOS_COMPARTIDOS»; el índice de sesiones, de
// docs/chats.md (que llega hasta el 8/8: por eso los hitos de mediados de
// agosto van con «—», no se inventa un chat).
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La ruta y su lugar en el sidebar', detalle: 'Content Machine · Instagram · Stories · nació con el chip «pronto», que es lo honesto cuando no hay backend', estado: 'hecha' },
  { titulo: 'La metodología, destilada de los cursos', detalle: 'METODOLOGIA_STORY en lib/ig-formatos.ts, citando curso por curso · una idea por día · el arco gancho → contexto → moraleja → CTA', estado: 'hecha' },
  { titulo: 'El motor compartido con Reels y Carousels', detalle: 'lib/ig-writer.ts (generarPieza + saneo por formato) · la tab compone el pedido, no reimplementa el writer', estado: 'hecha' },
  { titulo: 'El objetivo del día, con verificación determinista', detalle: 'conexión / venta / interacción · si el objetivo exige empujar al DM, la pieza sin CTA ni palabra clave se RECHAZA', estado: 'hecha' },
  { titulo: 'El puente a publicación', detalle: 'Un borrador de contenido_posts POR FRAME · el guion viaja en notas de producción · la media se sube y se programa en /instagram', estado: 'hecha' },
  { titulo: 'Onboarding de tab (Conectar → Contexto → Ensayo)', detalle: '`conectar` sale del estado vivo de Instagram; la primera secuencia generada ES el ensayo · falta unificar el criterio del paso con carousels', estado: 'sigue' },
  { titulo: 'Historial durable de piezas', detalle: 'Hoy la secuencia vive en memoria de la página y la pantalla lo DICE · una tabla propia es migración coordinada, no subir el tope de app_settings', estado: 'cola' },
  { titulo: 'Prompts editables desde /configuraciones', detalle: 'Los del writer son constantes locales en lib/ig-writer.ts con TODO puesto · van con la skill add-editable-prompt', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: el lugar antes que la cosa ─────────────────────────────────────
  {
    fecha: '7 ago', hora: '02:31', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Nace la ruta, y nace vacía a propósito',
    puntos: [
      'Content Machine dejó de ser un ítem de «Create» para ser **sección propia**: no es una herramienta, es un taller con una sección por canal y cada canal con sus formatos. Instagram quedó con Reels, Carousels y Stories.',
      'Las ocho rutas nuevas salieron **con el chip «pronto»**, sin backend. La regla que quedó escrita ahí: *prometer lo que no existe es peor que no tenerlo*. Es lo que después permitió construir la tab sin renegociar dónde iba ni cómo se llamaba.',
      'El nombre de la ruta es igual al de la tab (`/stories`), que es lo que hace que un link viejo siga significando lo mismo cuando la tab se llena.',
    ],
    commits: [
      { sha: '72984b8f', msg: 'Rediseño · el hover roto, Content Machine como sección y tus tres íconos', lineas: 202, archivos: 12 },
    ],
  },
  {
    fecha: '9 ago', hora: '01:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El área entra al registro, con un punto ciego adentro',
    puntos: [
      'Stories pasó a ser una de las 121 áreas de `/admin/dev`, con su Roadmap derivado del plan (`proyectos: [\'Feature: Stories\']`) y su Change History derivado de `git log` sobre el `vive[]`. Ninguno de los dos se escribe a mano a propósito: «un roadmap a mano se queda viejo el martes».',
      '⚠️ **Y acá está la trampa que se pagó después.** El `vive[]` del área eran dos rutas: `app/stories/page.tsx` (que entonces era un ComingSoon de 8 líneas) y `app/_components/nav.ts`, que lo toca **todo el mundo**. Resultado medido en `_historial.generado.ts`: los 12 commits que el área muestra como su historia son de la barra de admin, del sistema de diseño y de /admin/docs — **ninguno es de Stories**. Un Change History lleno de commits ajenos no se lee como vacío: se lee como si el área estuviera trabajada.',
      'La regla de AGENTS.md que sale de esto —«una ruta que apunta a la nada no rompe nada, y por eso es cara»— vale igual para la ruta que **falta**: el test `tests/dev-areas.test.ts` chequea contra el disco que cada ruta exista, pero **no puede chequear la omisión**.',
    ],
    commits: [
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
    ],
    archivos: [
      'app/admin/dev/areas.ts — la entrada del área; el `vive[]` se amplió el 17/8 con los seis archivos reales de la tab y el motor compartido',
      'app/admin/dev/_historial.generado.ts:764 — los 12 commits ajenos que el área mostraba como su historia',
    ],
  },
  {
    fecha: '12 ago', hora: '13:09', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Dónde va una tarea de Stories, y dónde NO',
    puntos: [
      'Se cerró el borde del área en el catálogo del plan: **«Content Machine» es la ESTRATEGIA del contenido** (la escalera, los pilares, la materia prima) y Stories es **un formato**, con proyecto propio. Sin esa capa arriba, «definir la escalera de contenidos» caía en un formato por parecido de palabra.',
      'La regla ejecutable que quedó: **una FAMILIA del sidebar no puede ser un proyecto inventado por el modelo**. Que «Content Machine» sí exista como proyecto es legítimo porque está en el catálogo, y `puedeSerProyectoNuevo()` consulta el catálogo **antes** que la lista de familias — ese orden es toda la regla.',
      'Importa para este registro porque el Roadmap del área se lee del proyecto: si una tarea de la secuencia diaria se rutea a la caja que agrupa a los seis formatos, el roadmap de Stories queda vacío sin que falte trabajo.',
    ],
    commits: [
      { sha: '5efa59db', msg: '«Content Machine» es un proyecto de verdad, y los otros cuatro se fueron', lineas: 207, archivos: 3 },
    ],
  },

  // ── agosto: la tab de verdad ───────────────────────────────────────────────
  {
    fecha: '15 ago', hora: '10:44', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab deja de ser una promesa: el día de stories completo',
    puntos: [
      '**La metodología es un dato del repo, no del modelo.** `METODOLOGIA_STORY` (lib/ig-formatos.ts) está destilada de las transcripciones de los cursos de `public/cono-tx` **citando curso por curso**, para poder auditarla: las stories no atraen, CALIENTAN y VENDEN (~80% venta contra 20% en el feed); una sola idea por día aunque sean 50 frames; el bloque se sube junto; cambiar de formato en cada frame. Un prompt que inventa metodología no se puede discutir con el dueño; uno que cita, sí.',
      '**El objetivo del día viaja DENTRO del pedido, y por eso hay segunda capa.** `generarPieza(ws, formato, pedido)` no tiene parámetro de directivas: todo lo que no es el system entra como contenido **no confiable** (anti-inyección), incluido el objetivo. Así que el texto lo pide y `generarSecuenciaAction` lo **verifica en determinista**: si el objetivo es venta o interacción y la pieza vuelve sin CTA ni palabra clave, se rechaza con el motivo — nunca se inventa un frame de cierre. Es la regla de la casa aplicada: rechazar deja la deuda del reintento, no la tapa un fallback.',
      '**El límite técnico se dice, no se promete.** Por API de Meta **no salen stickers, encuestas ni links**: el frame que los necesita se marca como paso manual, y esa marca viaja en las notas de producción del borrador. Prometer automático lo que se hace a mano es la forma barata de que el cliente descubra el límite solo.',
      '**Un borrador POR FRAME, y secuencial a propósito.** Cada story es una pieza de media propia, así que `enviarSecuenciaAction` crea N filas en `contenido_posts` en orden y **no** con `Promise.all`: el orden de creación es el orden del día, y si algo falla se sabe exactamente cuántos entraron. Lo que llega del navegador se **re-sanea** en el server (strings coaccionadas, frames vacíos afuera, tope duro de 50).',
      '⚠️ **Lo que quedó vivo y se ve como éxito:** el saneo no topea frames y `enviarSecuenciaAction` **corta en 50 borradores en silencio** — el aviso de parciales solo aparece si un insert FALLA, no si el tope recorta. Y `generarPieza` corta el pedido a 4.000 caracteres, también en silencio (por eso los composers topean por campo).',
      '⚠️ **Sin tabla, sin historial.** No existe tabla genérica de piezas generadas: reels persiste en `app_settings` con tope 10, y **carousels y stories viven en memoria de la sesión de página** — y lo dicen en pantalla, que es lo honesto. Si el producto quiere historial durable, es UNA tabla con migración coordinada; nunca subir topes ni colonizar `landing_drafts` ni `contenido_posts`.',
    ],
    commits: [
      { sha: 'a3d0ffb0', msg: 'Content Machine IG (Reels/Carousels/Stories) + onboarding Zernio-first', lineas: 3613, archivos: 29 },
    ],
    archivos: [
      'lib/ig-formatos.ts — LA fuente única: límites de Zernio + metodología citada. Sin `server-only` a propósito (la UI muestra los límites y los tests la importan)',
      'lib/ig-writer.ts — el motor compartido (`generarPieza`, saneo por formato). Sus prompts todavía son constantes locales: no son editables desde /configuraciones',
      'lib/ig-contenido.ts — `crearBorradorPublicacion`; NO es idempotente (doble click = dos borradores) y stories solo deshabilita el botón',
      'app/stories/objetivos.ts — el catálogo de los tres objetivos y cómo cada uno se redacta dentro del pedido',
      'app/stories/actions.ts — `ctxAdmin` fail-closed (agencia sin impersonar = ws null = error, nunca cae al dueño) + la verificación del empuje a DM',
      'app/stories/Storyboard.tsx — la única forma de leer una PiezaStory; la comparten el ensayo del onboarding y la vista principal',
    ],
  },
  {
    fecha: '16 ago', hora: '11:11', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Dos `<a href>` crudos del onboarding sacaban al dueño del cliente',
    puntos: [
      'El onboarding de la tab linkea al onboarding del negocio cuando el brief tiene huecos, y lo hacía con un `<a href="/onboarding">` pelado. Un `<a>` crudo **no lleva el `?ws=`**: al super admin mirando a un cliente lo depositaba en SU propio onboarding. La forma en que falla no se parece a un bug — te deja mirando otra cuenta.',
      '**Contar tres fue el error.** El barrido anterior había cerrado los 26 `redirect()` del server y dio la regla por cerrada; quedaban vivas las otras formas de navegar, y un `grep` de `redirect(\'/` no ve un `<a href>` ni un `window.location`. Desde este commit AGENTS.md enumera **las cuatro** en una tabla, justamente porque el modo de falla de esta regla es creer que ya se cerró.',
      'La regla para cualquier link de esta tab: `import Link from \'@/app/_ui/Link\'`, nunca `next/link` ni un `<a>` a mano. Ponerlo de más no cuesta nada — sin pestaña activa devuelve el mismo href de siempre.',
    ],
    commits: [
      { sha: '9adf2f7d', msg: 'La CUARTA forma de navegar: el RESET se sacaba a sí mismo de la vista', lineas: 108, archivos: 8 },
    ],
    archivos: [
      'app/stories/OnboardingStories.tsx:4 — el Link de la casa, con el porqué escrito arriba',
      'docs/hallazgos-comunicacion.md § «Los writers de contenido IG» — lo que quedó SIN hacer, con el archivo de cada cosa',
    ],
  },
];
