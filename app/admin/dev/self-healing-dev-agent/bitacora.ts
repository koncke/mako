// =============================================================================
// Self-Healing Dev Agent — el registro de construcción del área
// =============================================================================
// Alcance: JUSTAMENTE el agente que esta sección viene a alimentar. Todavía no
// existe como agente, pero sí existe todo lo que tiene que comer: el mapa de las
// 122 áreas del producto (`app/admin/dev/`), el Roadmap derivado del tablero, el
// Change History derivado de git, y la primera pieza que YA corre sola — el bot
// que lee los commits de main y propone cerrar las tareas que ya están hechas
// (`lib/cerrar-por-commits.ts` + el cron).
//
// De dónde salió esto: fecha, hora, sha y tamaño de cada commit salen de
// `git log` sobre las rutas del área; los pedidos son textuales, citados en los
// propios mensajes de commit; el nombre del chat se resolvió por fecha contra
// docs/chats.md; la cuenta, del trailer `Claude-Cuenta:` (donde no hay trailer y
// es anterior al 8 de agosto, es claude1). Las trampas del área están además en
// docs/hallazgos-plan.md (§Señales y auto-cierre), docs/hallazgos-infra.md
// (§Código construido que ninguna página monta) y docs/hallazgos-ui.md (§la
// sidebar JAMÁS se scrollea · §una tab que existe y no se ve).
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

const CH_DOS = 'Dos cuentas de Claude en paralelo';
const CH_PROD = 'Múltiples productos y funnels (#374)';
const CH_CS = 'Customer Success: mapeo y roadmap';

export const PARTES: Parte[] = [
  { titulo: 'El relevamiento del producto', detalle: '208 piezas leídas contra el código · las familias son las de nav.ts, no se inventó ninguna división', estado: 'hecha' },
  { titulo: 'Las 122 áreas con sus dos paneles', detalle: 'Roadmap derivado del tablero · Change History derivado de git · nada escrito de antemano', estado: 'hecha' },
  { titulo: 'La puerta: el mapa de /admin/dev', detalle: 'Montado sobre BarraPreview, la barra de verdad · un dibujo de la pieza no sirve para revisar la pieza', estado: 'hecha' },
  { titulo: 'El bot que propone cerrar por commits', detalle: 'Cron de Vercel + API de GitHub · PROPONE, nunca cierra: un commit es interpretación, no una señal', estado: 'hecha' },
  { titulo: 'Las guardas del registro', detalle: 'tests/dev-areas.test.ts: toda ruta de vive[] existe, toda bitácora tiene fila en el sidebar y sus dos paneles llenos', estado: 'hecha' },
  { titulo: 'Las bitácoras escritas a mano', detalle: 'Lo único que guarda el pedido TEXTUAL del dueño, que ningún commit contiene · 9 áreas de 122', estado: 'sigue' },
  { titulo: 'El vive[] que cubra dónde cae el trabajo', detalle: 'El test caza la ruta inventada, no la OMITIDA · un área con public/ y scripts/ afuera se ve tranquila y no lo está', estado: 'sigue' },
  { titulo: 'El cierre automático sobre el tablero del dueño', detalle: 'El bot lee plan_tareas y el motor de señales experimento_tareas: no se cruzan nunca', estado: 'cola' },
  { titulo: 'El agente que desarrolla y debuguea', detalle: 'Para esto se construyó todo lo de arriba · todavía no existe una sola línea', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: la primera pieza que corre sola ────────────────────────────────
  {
    fecha: '6 ago', hora: '13:30', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El bot que lee los commits: PROPONE, nunca cierra',
    puntos: [
      '**La decisión que ordena todo.** El autocompletado por señales sí cierra solo y está bien: «¿hay filas en la tabla de leads?» es un hecho y no admite lectura. Un commit es **interpretación** — uno que dice «arreglo del buscador» puede ser el de esta tarea o el de otra tab. Por eso esto escribe en el canal `cerrar` (mig 0119): borrador en /plan/revisar, el dueño confirma de a una y tiene el botón «está a medias». Cerrar por interpretación es cómo una tarea a medias desaparece del tablero sin que nadie se entere.',
      'Contesta la pregunta original del dueño —«¿Debo tener mi PC encendida todo el tiempo con Claude abierto?»— con un no: corre en un cron de Vercel y le pregunta a la API de GitHub. `git log` no servía porque **en Vercel no hay repo**, y un hook local volvía a atar todo a la máquina de Martín, que es justo lo que se quería evitar.',
      '⚠️ **`OWNER_WS` otra vez.** `credWs(GITHUB_TOKEN, OWNER_WS)` hacía que el bot dijera «no hay GITHUB_TOKEN cargado» con el token cargado y **visible en pantalla**: el 1 es el workspace de un cliente, y el tablero de desarrollo vive en el del super-admin. De ahí nació `wsSuperAdmin()`, que lo resuelve por capa en vez de escribir un 9 a mano en dos archivos distintos.',
      '⚠️ **El bug que se ve funcionando.** El desplegable de /integraciones guardaba `GITHUB_REPO` como credencial y el bot leía `process.env.GITHUB_REPO`: elegir otro repo no cambiaba absolutamente nada. Pasó desapercibido porque el default acertaba justo el repo correcto — el peor tipo de bug, el que anda.',
      'Y las dos fallas de IA de la primera corrida real, que después se volvieron regla del producto: `chatCheapCascade` no lee el registro de modelos, así que arrancaba por **Groq (8.000 tokens/minuto) con un prompt de 62.792** y terminaba atendido por el modelo más chico que quedara en pie — no fallaba, **contestaba mal**; y `maxTokens: 3000` cortaba el JSON al medio. Hoy la cascada MIDE el prompt antes de elegir proveedor, así que ningún caller tiene que acordarse de nada.',
      '⚠️ **Lo que quedó abierto:** los dos motores de auto-cierre trabajan sobre tablas distintas y no se cruzan nunca — el bot lee solo `plan_tareas` y `autocompletarPorSenales` solo `experimento_tareas`. Y el tope de 600 de una sola página en `cerrar-por-commits.ts:86` es un techo deliberado **sin cartel**: si la tabla crece, corta en silencio.',
    ],
    commits: [
      { sha: '42673b7f', msg: 'El bot que lee los commits y propone cerrar lo que ya está hecho', lineas: 335, archivos: 7 },
      { sha: '3e79d434', msg: 'El bot de commits corre: Gemini fijo, techo de salida y el ws que manda', lineas: 60, archivos: 3 },
      { sha: '036bf31a', msg: 'El repositorio que elegís en el desplegable ahora se usa', lineas: 39, archivos: 2 },
      { sha: 'd78078c3', msg: 'La cascada barata mide el prompt antes de elegir a quién preguntarle', lineas: 79, archivos: 3 },
    ],
    archivos: [
      'lib/cerrar-por-commits.ts — el prompt, las guardas y la propuesta; el porqué de «propone, no cierra» está arriba del archivo',
      'lib/github-commits.ts — la lectura de commits por API, con el repo resuelto desde la credencial',
      'app/api/cron/cerrar-por-commits/route.ts — la corrida (registrada en vercel.json)',
      '⚠️ docs/hallazgos-plan.md §Señales y auto-cierre — los dos motores que no se cruzan',
    ],
  },

  // ── agosto: el relevamiento ────────────────────────────────────────────────
  {
    fecha: '8 ago', hora: '17:25', chat: CH_DOS, cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Las 208 piezas relevadas contra el código, y lo que apareció de refilón',
    puntos: [
      'El insumo de todo lo demás: cada tab, cada vista interna y cada agente con su estado REAL y los archivos donde vive. Las familias son las de `nav.ts` (Operate · Analyze · Sales Machine · Content Machine) más MaKo y Admin & Platform: **no se inventó ninguna división**, porque una taxonomía propia habría dejado el mapa desalineado del producto el primer día.',
      'La disciplina que hizo el relevamiento utilizable: **ninguna pieza «por construir» sale de la nada** — cada una cita el `comingSoon`, la tarea del plan o el comentario del código de donde viene. 162 funcionan, 16 parciales, 30 por construir.',
      '⚠️ **El seed de `PlanBoard.tsx` es un archivo HISTÓRICO, y un agente que lo grepea lo lee como documentación.** El hallazgo «más caro» de la corrida —«el board vive en localStorage con el Repo en no-op»— salía del `detalle` de la tarea #177, o sea de la descripción de un problema **ya arreglado**; cincuenta líneas más abajo el Repo real llama a `/api/plan-board`. La regla: una afirmación sobre el estado del sistema no sale de una cadena de texto, ni aunque esté adentro de un `.tsx`.',
      '**El hallazgo que no se estaba buscando:** hay features terminadas —con migración, API y UI propias— que ninguna página monta. `EtiquetasWhatsAppPanel` y `TelefonosPanel` (mig 0065) tienen backend completo y `grep -rl` devuelve **una sola línea: su propia definición**. Ese es el patrón barato para cazarlas, y es parte de la razón por la que este mapa existe.',
    ],
    commits: [
      { sha: '74d40781', msg: 'Mapa de /admin/dev: las 208 piezas relevadas contra el código', lineas: 731, archivos: 1 },
      { sha: 'e3063fc3', msg: 'Cosecha del barrido: 121 áreas, y dos trampas que costaron caro', lineas: 272, archivos: 3 },
    ],
    archivos: [
      'docs/dev-tabs-mapa.md — el relevamiento crudo de las 208 piezas',
      'docs/dev-areas.mjs — la estructura consolidada, que es lo que después se volvió areas.ts',
    ],
  },

  // ── agosto: el registro ────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '01:33', chat: CH_DOS, cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las 122 áreas, con el Roadmap y el Change History DERIVADOS',
    puntos: [
      '**Para qué existe.** Los desplegables de /admin/dev alimentan a dos agentes que se van a construir encima —el que marca tareas completadas solo y el que desarrolla y debuguea—, así que **un área que falta no es un renglón menos: es un punto ciego**. De 6 áreas a 122, cubriendo los 68 proyectos del tablero y las 438 tareas abiertas sin dejar ninguna afuera.',
      '**Lo que NO se escribió a mano, a propósito.** El ROADMAP sale del plan (cada área declara sus `proyectos` y la pantalla lee las tareas abiertas) y el CHANGE HISTORY sale de git (`scripts/gen-dev-historial.mjs` corre `git log` sobre las rutas de `vive` y deja `_historial.generado.ts`). Era la única forma de que 122 registros no fueran 122 mentiras: un roadmap a mano se queda viejo el martes, y —como ya decía el archivo viejo— «uno inventado de antemano es peor que ninguno».',
      'La bitácora a mano **manda donde existe** y el historial generado va abajo. No es redundancia: la bitácora tiene el **pedido textual del dueño**, que ningún mensaje de commit contiene.',
      '**La guarda, desde el día uno:** `tests/dev-areas.test.ts` chequea contra el DISCO que exista cada ruta de `vive`. Cazó **30 al primer intento** —anotaciones pegadas al path, globs sin resolver, expansiones `{a,b}` partidas al medio— que ningún compilador ve y que habrían mandado al próximo agente a leer un archivo inexistente.',
      '⚠️ **`grep -c` cuenta LÍNEAS, no ocurrencias.** El comentario del archivo decía 121 porque el conteo salió de un `grep -c` sobre el patrón del slug; la pantalla siempre dijo 122 porque pinta `AREAS.length`. La UI nunca estuvo mal: estaba mal la forma de contar, y quedó escrito en el propio comentario para que no se repita.',
    ],
    commits: [
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2524, archivos: 5 },
      { sha: '4d296676', msg: '/admin/dev ya tiene puerta: el mapa de las 121 áreas', lineas: 498, archivos: 7 },
      { sha: '992ea38d', msg: 'Son 122 áreas, no 121: grep -c cuenta líneas, no ocurrencias', lineas: 7, archivos: 1 },
    ],
    archivos: [
      'app/admin/dev/areas.ts — el catálogo: slug, familia, grupo, estado, alcance, vive[] y proyectos[]',
      'app/admin/dev/roadmap.ts — las tareas abiertas del plan, una sola consulta para las 122, cacheada 30s',
      'app/admin/dev/_historial.generado.ts — los commits por área; se regenera, no se edita',
      'tests/dev-areas.test.ts — la red contra el disco',
    ],
  },
  {
    fecha: '9 ago', hora: '01:57', chat: CH_DOS, cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un workspace equivocado no da error: da cero filas, y la pantalla miente entera',
    puntos: [
      '⚠️ **Las 122 áreas se pintaban «Cerrado» con cero tareas.** La causa fue escribir `runWithWorkspace(OWNER_WS)` de memoria: el board `/plan` no vive ahí, es el roadmap del **super-admin** y vive en el workspace de él. Y lo peor es **cómo falla**: un workspace equivocado no tira error, devuelve cero filas. La pantalla se veía perfecta y mentía en las 122 filas a la vez.',
      'La respuesta no fue arreglar la línea sino **exportar `enPlan`** (lib/plan-board.ts) en vez de que cada consumidor rearme la expresión: la regla es de una sola línea, y justamente por eso da confianza copiarla mal.',
      '⚠️ **El gemelo, encontrado al verificar:** el índice y la ficha de un área resolvían **distinto workspace en el mismo request y con la misma sesión** (null vs 9). `null` cae a `OWNER_WS`, la consulta devuelve cero sin ningún error, y vuelve la misma pantalla perfecta y falsa. Ahora el workspace viene por parámetro desde la sesión que la página ya validó, en vez de resolverse del ambiente.',
      '**Y un área entera se perdió en el refactor:** `areaDe(pricing)` devolvía null porque su entrada no sobrevivió a la reescritura de `areas.ts` — la baja típica de dos sesiones tocando el mismo archivo, con las propias notas del refactor dándola por existente. Da 404 en pantalla y verde en el compilador.',
      'De ahí salieron las sub-tabs por URL (`?tab=`), por dos motivos que no son estéticos: mandar el link de UN panel en vez de «entrá y clickeá la segunda pestaña», y **poder verificarlo desde afuera** — con la pane del navegador oculta un clic sintético no llega al `onClick` de React, así que sin URL el panel no se puede abrir para revisarlo.',
    ],
    commits: [
      { sha: '92f9b5f5', msg: 'El Roadmap leía el workspace equivocado y no fallaba: devolvía vacío', lineas: 19, archivos: 2 },
      { sha: '9af57984', msg: 'El área pricing se había perdido en el refactor de las 121 áreas', lineas: 26, archivos: 3 },
    ],
  },
  {
    fecha: '9 ago', hora: '02:36', chat: CH_DOS, cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El mapa no se dibuja PARECIDO a la barra: monta la barra',
    puntos: [
      'Pedido textual, dos veces: «utiliza el mismo diseño que vamos a utilizar en la sidebar», y después más claro: «REPLICA el mismo diseño de la sidebar, no es tan difícil… Y solo UNA sidebar».',
      '**Tres intentos, y los dos primeros fallaron por lo mismo.** El primero fue una lista con franjas de color (no se parecía en nada); el segundo copió los tokens a mano y quedó peor: ocho cajas oscuras en grilla, o sea **ocho barras al lado de la barra real**. La respuesta ya estaba escrita en el repo desde antes, arriba de `BarraPreview`: «un catálogo que muestra un dibujo de la pieza en vez de la pieza no sirve para revisar nada». El componente existía para exactamente esto y no se usó.',
      '**Y no es una cuestión estética:** esta pantalla existe para DECIDIR cómo se va a ver Dev en la barra. Dibujada de otra forma, lo que se aprueba acá no es lo que después aparece allá. Por eso `filaStyle` pasó a exportarse en vez de copiarse, y la geometría se verificó **midiendo el DOM** contra una fila de la barra de verdad (gap 11px, radio 8px, la clase `.mk-navrow`, que es de donde salen el hover y el foco).',
      'Los sub-desplegables salieron gratis: son `grupos`, el mecanismo que la barra ya tenía para una colección que abre al costado — el mismo que dos días después resolvió el desborde de la propia familia Dev.',
      'Lo único que NO es la barra: allá es una columna de 244px y acá son varias. **122 áreas en una sola columna son 5.500px de scroll.**',
    ],
    commits: [
      { sha: '5a052ed2', msg: 'El mapa de Dev se dibuja con la barra, no parecido a la barra', lineas: 324, archivos: 3 },
      { sha: '5a377be2', msg: 'UNA barra, y es la barra: /admin/dev monta BarraPreview', lineas: 619, archivos: 7 },
    ],
    archivos: [
      'app/admin/dev/MapaAreas.tsx — el mapa, montado sobre BarraPreview',
      'app/admin/dev/nav-dev.ts — las familias de Dev que se le pasan',
    ],
  },

  // ── agosto: las guardas del registro ───────────────────────────────────────
  {
    fecha: '11 ago', hora: '00:17', chat: CH_PROD, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tres cosas que destapó escribir el registro de otra área',
    puntos: [
      '⚠️ **El Roadmap era el único panel que NO pasaba por `texto()`**, así que los backticks y los asteriscos dobles del `detalle` se leían literales — el semáforo mostraba el nombre de una función con las comillas invertidas a la vista. Estaba así en las **siete** áreas. Un helper que existe y no se usa es la forma barata de que el formato divirja.',
      '⚠️ **El test de las bitácoras tenía su propia lista de seis slugs y ya estaba viejo:** `pricing` tenía registro desde hacía días y no figuraba, así que renombrar ESE slug no rompía nada y el test pasaba en verde igual. Ahora la lista sale de `REGISTROS_SLUGS`, que es el mismo objeto que la pantalla consume. Una lista paralela de lo mismo se queda vieja sola.',
      '**Test nuevo: una bitácora con un solo panel lleno falla.** Un registro a medias pinta el estado vacío del otro y se lee como «acá no pasó nada», cuando lo que pasó es que se olvidó — que es exactamente lo contrario de lo que el registro viene a resolver.',
      'Y la ficha de dos áreas se reescribió al escribirlas: el `alcance` de `areas.ts` es lo primero que lee quien va a tocar el área, así que uno que describe la pantalla en vez del modelo manda a buscar al lugar equivocado.',
    ],
    commits: [{ sha: '7b58d8bf', msg: 'Products & Offers tiene su registro, y el Roadmap por fin lee su propio formato', lineas: 186, archivos: 5 }],
  },
  {
    fecha: '11 ago', hora: '01:20', chat: CH_PROD, cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Una tab que existe y no se ve no da ningún síntoma',
    puntos: [
      '«No veo la tab en la sidebar» — y tenía razón. El bloque de registros de Dev en `app/_components/nav.ts` es una lista **escrita a mano**, y la bitácora nueva no estaba: el área existía, la página funcionaba, y no había forma de llegar salvo tecleando la URL.',
      '**Y no era una: `pricing` estaba igual desde hacía días.** Ese es el modo de falla que importa — no rompe, no loguea, no aparece en el typecheck y no lo caza ningún test porque *nada* pasa. Solo se descubre cuando una persona la busca, y si nadie la busca el trabajo queda enterrado.',
      '**Por qué la lista no se deriva de `registros.ts`** (que es la fuente de quién tiene bitácora): `registros.ts` importa las bitácoras enteras —~1.500 líneas de prosa— y `nav.ts` lo consume el Sidebar, que es cliente. Meter todo eso al bundle de cada página para armar ocho links no vale la pena. Entonces son dos listas de lo mismo, y **la razón justifica la copia, no la falta de guarda**: `tests/dev-areas.test.ts` cruza `REGISTROS_SLUGS` contra `ADMIN_NAV` y dice exactamente qué fila falta y dónde agregarla.',
    ],
    commits: [{ sha: 'c5acb160', msg: 'Una tab que existe y no se ve: Products & Offers y Pricing entran al sidebar', lineas: 35, archivos: 2 }],
    archivos: [
      'app/_components/nav.ts — el bloque de registros de ADMIN_FAMILIAS (la lista a mano)',
      'app/admin/dev/registros.ts — REGISTROS_SLUGS, la otra mitad del cruce',
    ],
  },
  {
    fecha: '11 ago', hora: '01:45', chat: CH_PROD, cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La barra fea no era el problema: era el testigo',
    puntos: [
      'Pedido: «La sidebar se ve horrible con esa barra de scroll, y dentro de la tab que creaste también.»',
      '⚠️ **El diagnóstico obvio era el equivocado.** La primera reacción fue arreglar **la barra** —adelgazarla y teñirla con `.mk-scroll-oscuro`— y el problema siguió exactamente igual. Lo roto era otra cosa: la familia Dev pasó de 10 a 13 filas en 24 horas (Products & Offers, Pricing, Customer Success) y era la única familia larga que NO usaba el mecanismo de colecciones que el resto de la barra ya tenía. Con un `NavGrupo` «Registros», **Dev: 13 filas → 5**, y los 13 destinos siguen alcanzables.',
      '⚠️ **Por qué se volvió a violar una regla ESCRITA** («La sidebar se puede scrollear, eso NO debe ser posible NUNCA», del dueño, 1/7/2026): era inencontrable por el método que manda AGENTS.md — su línea «Vive en:» apuntaba a `lib/nav.ts`, un archivo que **no existe desde el rediseño**, así que grepear la ruta real no devolvía nada. Éste es el caso testigo de la regla nueva: una ruta muerta no rompe nada, y por eso es cara.',
      '**La página del área apilaba CINCO paneles** bajo una sola tab (Trampa, Roadmap, Roadmap del plan, Change History y Commits): con un registro real eso son cuatro pantallas de scroll para llegar a los commits. Se partió en dos tabs, y **el corte es por PREGUNTA, no por longitud** — «¿qué falta?» (Roadmap) y «¿qué pasó?» (Historial) son dos preguntas distintas y nadie las hace a la vez. Partir por largo da tabs arbitrarias que después nadie sabe dónde buscar.',
      '⚠️ **El `?tab=` estaba roto en los DOS extremos:** se leía con `useSearchParams` —el hook que /admin/ui desaconseja por escrito, porque el boundary se saltea el render del servidor— y el `onCambio` era un `setTab` pelado, así que la URL nunca se actualizaba y **el link que copiabas no era la tab que estabas viendo**.',
      'Dos trampas de medición que valen para cualquier barra: **el rail PLEGADO desborda ~14px ANTES que el expandido** (la fila colapsada es más alta) y el rail es el estado por defecto, así que medir con la barra abierta subestima el problema; y el flyout heredaba el fallo —`overflow: hidden` sin `maxHeight`—, con lo cual mover filas ahí sin tocarlo solo mudaba el corte silencioso de la columna al desplegable.',
    ],
    commits: [
      { sha: '9204fc7f', msg: 'La barra de scroll deja de gritar, y el registro se parte en dos preguntas', lineas: 106, archivos: 4 },
      { sha: 'a999b6ec', msg: 'La sidebar no scrollea: era tu regla y la había roto yo', lineas: 202, archivos: 7 },
    ],
    archivos: [
      'app/admin/dev/[area]/RegistroArea.tsx — las dos tabs, con la tab leída en el server y escrita con router.replace',
      'docs/hallazgos-ui.md §«Regla: la sidebar JAMÁS se scrollea» — el caso completo con las mediciones',
    ],
  },

  // ── agosto: el roadmap se ordena ───────────────────────────────────────────
  {
    fecha: '11 ago', hora: '02:00', chat: CH_CS, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un `proyectos` que no matchea deja el Roadmap vacío SIN FALLAR',
    puntos: [
      '⚠️ El área declaraba un proyecto («Feature: CS Analyst») que **no existe en el tablero**, y el real («Feature: Customer Success», 3 tareas) tampoco estaba en el catálogo de ruteo. Resultado: el Roadmap salía vacío sin ningún error y el Perro no podía rutearle nada — o sea, un área que se lee como «no tiene trabajo pendiente» cuando lo que pasa es que nadie los puede juntar. Mismo agujero en Landing Analyst y YouTube Analyst.',
      '**El guard de tests hizo su trabajo en la misma corrida:** un área con bitácora y sin fila en el sidebar rompe `dev-areas.test.ts`. Es la primera vez que la guarda escrita horas antes atajó el bug que venía a atajar.',
      'Y quedó el criterio para renombrar un slug: la ruta vieja **redirige, no da 404** — los links de /admin/dev ya circulan por chat.',
    ],
    commits: [{ sha: '22869011', msg: 'Customer Success tiene tab propia, y el proyecto huérfano vuelve al catálogo', lineas: 1611, archivos: 10 }],
  },
  {
    fecha: '11 ago', hora: '10:52', chat: CH_CS, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un área tiene UN roadmap, y el objetivo no es el camino',
    puntos: [
      'Pedido textual: «No entiendo porque hay 2 tabs de roadmap… Y no se entiende, ¿que tenemos que hacer primero?… si dentro de los 5 pasos está uno que el cliente se vea el curso, no puede estar como paso posterior el crear la plataforma… diferencia el gran objetivo de las cosas que tenemos que hacer para llegar a ello.»',
      '**Eran TRES, no dos:** las `partes` de la bitácora, el panel propio del área y `RoadmapDelPlan`, apilados en la misma pantalla, y **ninguno contestaba «¿qué primero?»**. Ahora un roadmap propio **REEMPLAZA** al genérico en vez de sumarse (`roadmapPropioDe` en paneles.tsx) y se hace cargo de mostrar las tareas del plan adentro de cada paso; las PARTES quedan como espejo del contador «N de M», y está documentado que son espejo.',
      '⚠️ **El error de fondo era de categorías:** estaban mezclados el OBJETIVO (cómo va a funcionar la cosa) y el CAMINO (lo que hay que construir para que pueda correr). Mezclados producen el absurdo que marcó el dueño: el paso 1 aparecía **antes** que la fase que construye la plataforma donde ese paso vive. El paso 1 del objetivo es el ÚLTIMO en poder correr. Por eso el objetivo va aparte y SIN estado: no es trabajo, es el destino.',
      '**Y las tareas del plan van adentro de la fase que las reclama** (`tareasDelCamino` en roadmap.ts), incluso las de otros proyectos, cruzadas POR TÍTULO. Dos guardas ahí: si el título no matchea **no se inventa número** —uno aproximado manda a la tarjeta de otra tarea—, y las que ninguna fase reclama se muestran igual, para que la pantalla no diga «esto es todo» cuando no lo es.',
    ],
    commits: [{ sha: '3a3575d5', msg: 'Un área tiene UN roadmap, y el objetivo no es el camino', lineas: 1210, archivos: 9 }],
    archivos: [
      'app/admin/dev/paneles.tsx — roadmapPropioDe: quién reemplaza al panel genérico',
      'app/admin/dev/roadmap.ts — tareasDelCamino y el cruce por título',
    ],
  },

  // ── agosto: la cosecha, y el punto ciego que la tapaba ─────────────────────
  {
    fecha: '17 ago', hora: '20:39', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Los 33 hitos que faltaban, y el punto ciego que los tapaba',
    puntos: [
      'Se cruzó el `git log` de cada área contra su `bitacora.ts`: **33 tandas de trabajo se habían hecho sin dejar hito**, en 8 de las 9 áreas con registro. Solo `products-offers` estaba al día. Fechas, horas y commits salen de git; el chat, del índice de sesiones por fecha; la cuenta, del trailer `Claude-Cuenta`.',
      '⚠️ **EL PUNTO CIEGO, que es el hallazgo del área.** Ese cruce solo miró las 9 áreas que YA tenían bitácora, así que **declaró tranquilas a las otras 113**. Medido después: **29 áreas con 8 o más commits en 10 días y CERO registro, 696 commits en total.** Un barrido que solo mira donde ya hay luz confirma que ahí hay luz.',
      '⚠️ **Y el segundo piso del mismo problema:** la más movida es Conocimientos/CURSOS con **68 commits**, y su área figuraba con **11** porque su `vive[]` lista cinco archivos de `app/conocimientos/` y omite `public/cono-tx`, `public/cono-ugc` y los scripts del pipeline. El `vive[]` no es documentación: es el **filtro con el que el generador cuenta la historia de un área**. Uno incompleto no da error — da un área que se ve tranquila.',
      '**La regla nueva de AGENTS.md sale de acá:** una ruta escrita a mano que apunta a la nada no rompe nada, y por eso es cara. `tests/dev-areas.test.ts` chequea que cada ruta de `vive[]` **exista**; lo que NO puede chequear es la **omisión**, y ese es el agujero que sigue abierto. El otro caso medido el mismo día es la regla de la sidebar, que se violó teniendo su hallazgo escrito porque su «Vive en:» apuntaba a `lib/nav.ts`.',
      'En esta misma corrida se escribió este registro y se **amplió el `vive[]` del área**, que declaraba dos rutas y dejaba afuera el cron, el cliente de GitHub, el generador del historial, el test que lo cuida y los dos documentos del relevamiento.',
    ],
    commits: [{ sha: '5e45e545', msg: 'Los 33 hitos que faltaban, y el punto ciego que los tapaba', lineas: 585, archivos: 9 }],
    archivos: [
      'scripts/gen-dev-historial.mjs — corre git log sobre el vive[] de cada área',
      'app/admin/dev/areas.ts — el vive[] es el filtro, no una nota al pie',
      '⚠️ Sin hacer: el test no puede cazar una ruta OMITIDA. Hoy la única red es acordarse.',
    ],
  },
];
