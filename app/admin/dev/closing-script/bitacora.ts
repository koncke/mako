// =============================================================================
// Closing Script — el registro de construcción del área
// =============================================================================
// Alcance: el guion que usa el closer adentro de la llamada de cierre. Hoy es un
// <ComingSoon> de 8 líneas; su contraparte de ANÁLISIS (/closing, Closing Analyst)
// sí existe y funciona, así que el bucle natural es que ésta se alimente de aquélla.
// Vive en: app/closing-script/page.tsx, la fila de nav.ts, el proyecto del catálogo
// (lib/plan-proyectos-catalogo.ts) y las preguntas todavía sin contestar de
// docs/preguntas-para-llenar-proyectos.md.
//
// De dónde salió esto: el `pedido` del 7 de agosto es textual, del chat «Rediseño:
// sidebar y nueva navegación» (docs/chats.md); el resto salió de los mensajes de
// commit —que en este repo explican el porqué— más docs/dev-tabs-mapa.md (el
// relevamiento que le puso alcance), docs/hallazgos-plan.md (la frontera
// agente/feature y por qué el proyecto tiene que existir antes que la tarea) y
// app/admin/dev/pricing/modelo.ts (el precio, que está medido aunque la feature no
// exista). Fechas y horas, de `git log`.
//
// Un área «por construir» no es un área sin historia: es un área cuya historia son
// DECISIONES —cómo se llama, dónde va en el embudo, cuánto va a costar, quién la
// usa— y ninguna está en el código todavía. Eso es exactamente lo que se pierde si
// nadie lo escribe.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La tab en la barra', detalle: 'Sales Machine · bloque «cerrar», con Sales Roleplay · chip «pronto» · 8 líneas de ComingSoon', estado: 'hecha' },
  { titulo: 'El proyecto en el catálogo', detalle: 'Existe ANTES que la primera tarea, para que el ruteo no la mande a la vecina más parecida', estado: 'hecha' },
  { titulo: 'El precio, medido sin que exista', detalle: 'US$0,0196 por guion, tarifado con la media de llamadas reales · entra holgado en el cupo del Pro', estado: 'hecha' },
  { titulo: 'Las cuatro preguntas sin contestar', detalle: '¿guion o simulador primero? ¿uno solo o por producto? ¿quién lo usa? · el proyecto tiene CERO tareas', estado: 'sigue' },
  { titulo: 'El bucle con Closing Analyst', detalle: 'Las objeciones REALES que /closing ya detecta son la materia prima del guion. No hay una línea escrita', estado: 'cola' },
  { titulo: 'El guard del closer', detalle: 'La barra se la ofrece al closer y el server lo rebota. Hoy no se nota; el día que haya backend, sí', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 7 de agosto: nace como un nombre en una lista ───────────────────────────
  {
    fecha: '7 ago', hora: '03:21', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sales Machine, y Closing Script como el último bloque del embudo',
    pedido: '1. Cambiar "Create" por "Sales Machine". Y las tabs dentro serán "Landing Generator" - "VSL Generator" - "Lead Magnet Generator" - separación - "Chatbot" - "Sales Email" - "Newsletters" - separación - "Closing Script" - "Sales Roleplay"\n2. Te dejo todos los iconos, asegurate de que esten del mismo tamaño que el resto.',
    puntos: [
      'El área nace **sin alcance**: lo único que se decidió fue su LUGAR. Las tres separaciones del pedido no son estética, son las tres etapas del embudo —**capturar · conversar · cerrar**—, y Closing Script es la primera mitad del último bloque. Todo lo demás (qué devuelve, de dónde saca los datos, quién lo abre) sigue abierto hoy.',
      'El nombre queda en inglés como el resto del producto, y se entiende solo: dice qué es sin subtítulo. Eso importa más de lo que parece en un área que va a existir meses como chip «pronto» — el nombre es lo único que el cliente ve.',
    ],
  },
  {
    fecha: '7 ago', hora: '03:32', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab existe, y son ocho líneas',
    puntos: [
      'Trece rutas nuevas de una, todas con el nombre igual al path y **todas con el chip «pronto»**: el criterio escrito ese día es que *prometer un canal que no existe es peor que no tenerlo*. Por eso el stub no es una pantalla vacía: es una que dice que todavía no está.',
      '⚠️ **El guard nació desalineado con la barra, y hoy no se nota.** `app/_components/nav.ts:228` declara `rolesWs: [\'closer\']` —o sea, la barra le ofrece la tab al closer— y `app/closing-script/page.tsx:6` llama `requireRolWs([], { nav: \'closing-script\' })`, que con la lista vacía deja pasar **solo a admin** (`lib/tab-access.ts:111`). Un closer que la clickea termina redirigido a `/crm`. Con un ComingSoon adentro es invisible; el día que haya backend, la única persona para la que se construyó la feature va a ser la única que no puede entrar. El molde correcto está al lado: `app/closing/page.tsx:32` pasa `[\'closer\']`.',
      'La trampa de fondo, que vale para los trece stubs: **un guard escrito de más se hereda sin volver a mirarlo.** Quien complete la pantalla va a ver que ya tiene `requireRolWs` puesto y no va a sospechar del argumento vacío. Los otros dos con el mismo desfase son `/sales-roleplay` y `/chat-analyst`.',
    ],
    commits: [
      { sha: 'a56135f0', msg: 'Rediseño · Sales Machine y los 14 íconos del set', lineas: 176, archivos: 13 },
    ],
    archivos: [
      'app/closing-script/page.tsx — las 8 líneas: ComingSoon + el guard con la lista vacía',
      'app/_components/nav.ts:228 — la fila: ícono `closingscript`, `comingSoon: true`, `rolesWs: [\'closer\']`',
      'app/closing/page.tsx:32 — la contraparte que SÍ existe, y el guard bien escrito',
    ],
  },

  // ── 8 de agosto: el proyecto, y las preguntas que lo definirían ─────────────
  {
    fecha: '8 ago', hora: '14:46', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El proyecto existe antes que la primera tarea',
    puntos: [
      '**Un catálogo cerrado convierte «falta un proyecto» en un ruteo silenciosamente equivocado, no en un error.** El caso que lo destapó fue otro (una tarea de heatmaps que se fue a «Vender MaKo» porque no existía «Feature: Landing Analyst»), pero la conclusión gobierna a esta área: el proyecto tiene que estar en `lib/plan-proyectos-catalogo.ts` **antes** de que llegue su primera tarea, o la primera tarea de Closing Script cae en la vecina más parecida —Closing Analyst— y el avance de las dos se suma en la misma barra.',
      'Se completó contra `nav.ts` **incluidas las tabs en «coming soon»**, que es el único orden que funciona: las áreas que todavía no existen son justamente las que más tarea suelta generan.',
      'La frontera que dictó el dueño y deja a esta área del lado de las features: **si corre solo, es agente; si lo abrís y lo usás, es feature.** Closing Script va a usar IA y sigue siendo `Feature: ` — el prefijo `Agente: ` es para lo que tiene cron propio.',
    ],
    commits: [
      { sha: '7f17c4e6', msg: 'Catálogo: los 18 proyectos que faltaban y la familia «Agente: »', lineas: 3, archivos: 1 },
      { sha: 'ea5fc252', msg: 'El Perro escribe los proyectos con el molde, y el catálogo distingue los 8 agentes', lineas: 168, archivos: 3 },
    ],
    archivos: [
      'lib/plan-proyectos-catalogo.ts:128 — «Closing Script · 📜 · El guion de la llamada de cierre: estructura, objeciones y respuestas»',
      'docs/hallazgos-plan.md — «La frontera Agente / Feature» y por qué el proyecto va antes que la tarea',
    ],
  },
  {
    fecha: '8 ago', hora: '14:48', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El área no está trabada: está sin escribir. Y hay cuatro preguntas',
    puntos: [
      '24 de los 68 proyectos del tablero tenían 2 tareas o menos y **9 estaban en cero**. Closing Script es uno de los nueve, y el diagnóstico que quedó escrito es el que importa: *no es que no haya trabajo, es que ese trabajo todavía no está en ningún lado*. Un área en cero tareas se lee como «nadie la quiere» y casi siempre es «nadie la escribió».',
      'Las cuatro preguntas que la destraban, y están redactadas para que **la respuesta SEA la tarea** (una pregunta abierta produce una charla, no una tarjeta): ¿el guion primero o el simulador primero? ¿es uno solo para todos o cambia por producto / por tipo de lead? para el simulador, ¿contra qué practica — un cliente difícil genérico o uno armado con las objeciones reales que ya detectó el Analyst? ¿quién lo va a usar: vos, Mauricio, o los closers de los clientes?',
      'La tercera es la única que tiene una respuesta *técnica* ya disponible y ninguna decisión tomada: **Closing Analyst ya detecta las objeciones reales de las llamadas grabadas**. Un guion construido sobre esas objeciones y uno genérico son dos productos distintos, y la diferencia no cuesta código nuevo — cuesta decidir.',
      'El camino de entrada previsto no es el tablero: es un audio a MaKo por WhatsApp contestando un bloque, que el Perro rutea. Con una condición escrita: **decir el nombre del proyecto en el audio**, porque el ruteo es bueno pero no adivina, y «Closing» a secas cae en el Analyst.',
    ],
    commits: [
      { sha: '3497fefd', msg: 'Las preguntas para llenar los 24 proyectos flacos, y la cosecha del catálogo', lineas: 181, archivos: 2 },
    ],
    archivos: [
      'docs/preguntas-para-llenar-proyectos.md — bloque «📜 Closing Script · 🎭 Sales Roleplay», las cuatro preguntas',
    ],
  },

  // ── 8-9 de agosto: el alcance se releva, y el área entra a /admin/dev ───────
  {
    fecha: '9 ago', hora: '01:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El alcance salió de leer el código, no de imaginarlo — y el `vive[]` nació corto',
    puntos: [
      'El relevamiento de 208 piezas puso la regla que le dio alcance a esta área: **ninguna pieza «por construir» sale de la nada** — cada una cita el `comingSoon`, la tarea del plan o el comentario del código de donde viene. De ahí salió textual lo que hoy dice `areas.ts`: que la contraparte de análisis existe y funciona, y que **el bucle natural es que ésta se alimente de aquélla**. No es una idea nueva, es lo que el código ya permite.',
      'De 6 áreas a 121, y con una decisión que sostiene todo el registro: el Roadmap sale del plan y el Change History sale de `git log` sobre las rutas de `vive`, porque *un registro inventado de antemano es peor que ninguno*.',
      '⚠️ **Y ahí está la trampa que este archivo viene a tapar.** El `vive[]` de esta área eran dos rutas: el stub (que tiene **un** commit en toda su vida) y `app/_components/nav.ts` (que tiene **68**). Resultado medido: el Change History automático del área muestra 12 commits y **ninguno habla de Closing Script** — son la barra del super admin, `/admin/docs`, el sistema de diseño. Es el gemelo de la regla «una ruta que apunta a la nada»: una ruta que apunta a TODO tapa el área igual de bien, y encima parece llena. Se amplió el `vive[]` con el catálogo, las preguntas y el mapa de tabs; el precio vive en `app/admin/dev/pricing/modelo.ts`.',
    ],
    commits: [
      { sha: '74d40781', msg: 'Mapa de /admin/dev: las 208 piezas relevadas contra el código', lineas: 731, archivos: 1 },
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
    ],
    archivos: [
      'docs/dev-tabs-mapa.md:426 — la ficha relevada: ComingSoon, ícono `closingscript`, rolesWs [\'closer\']',
      'app/admin/dev/areas.ts — el alcance del área y su `vive[]`',
      'tests/dev-areas.test.ts — chequea que cada ruta de `vive[]` exista en disco; lo que NO puede chequear es la omisión',
    ],
  },

  // ── 9 de agosto: tarifado sin existir ──────────────────────────────────────
  {
    fecha: '9 ago', hora: '03:39', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Tarifado sin existir: US$0,0196 el guion',
    puntos: [
      'El costo de esta feature está **medido antes de que exista**, y no es una estimación a ojo: la tarifa salió de 2.249 llamadas reales, con el hallazgo de método que movió todos los números — **el estadístico correcto no es la mediana ni el p90, es la MEDIA**, porque la distribución de tokens de salida es asimétrica a la derecha (la media da 1,9x a 3x la mediana). Tarifar por mediana subcobra y la cola se come el margen; por p90 sobrecobra al 90 % de los usuarios.',
      '**La consecuencia para esta área es que NO bloquea nada.** Un guion de cierre es texto, y el texto dejó de importar: los US$0,0196 entran holgados en el cupo del Pro. Lo que tiene en espera al plan Growth son Image Generator y Video Generator, que también son ComingSoon pero **caros** — un reel medido son US$2,445. La regla que queda: un ComingSoon de texto se puede prometer dentro de un plan que ya existe; uno de medios define un plan entero.',
      '⚠️ **Y la trampa del inventario:** Closing Script figura en la lista `FUERA_DE_GRILLA.porConstruir` de `modelo.ts` justamente para que nadie la venda. La nota del mismo bloque avisa de las que son PEORES que un ComingSoon —las que figuran «listo» o «parcial» y se venderían sin querer—, que es el modo de falla que un área honestamente marcada «por construir» no tiene.',
    ],
    commits: [
      { sha: 'c4099abc', msg: 'pricing: paso 2 — el costo del producto completo', lineas: 183, archivos: 3 },
      { sha: 'e19a03e3', msg: 'pricing: la tarifa de MaKo Tokens, operación por operación', lineas: 207, archivos: 2 },
      { sha: '2f3d31e9', msg: 'pricing: la grilla de 4 columnas y el respaldo de los pasos 3 y 4', lineas: 265, archivos: 2 },
    ],
    archivos: [
      'app/admin/dev/pricing/modelo.ts — `ACCIONES_NUEVAS` (`closing-sc`, US$0,0196) y `FUERA_DE_GRILLA.porConstruir`',
      'app/admin/dev/pricing/bitacora.ts — el registro entero de cómo se llegó a esos números',
    ],
  },
];
