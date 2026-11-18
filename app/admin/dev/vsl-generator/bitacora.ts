// =============================================================================
// VSL Generator — el registro de construcción del área
// =============================================================================
// Alcance: escribir el guion de un VSL largo (20 a 45 minutos). Hoy la pantalla
// es un `<ComingSoon />` y no hay lib propia ni API — pero el área NO está en
// cero: el cimiento (el catálogo de estructuras de VSL largo) se escribió el 5
// de agosto, y desde entonces lo que se movió fue el nombre, la ruta y el
// enganche con el resto de la app.
// Vive en: app/vsl-generator/, app/vsl-writer/ (redirect), lib/vsl-estructuras.ts,
// app/_components/nav.ts.
//
// De dónde salió esto: el `pedido` es textual, de la sesión «Cerrar VSL Analyst
// y VSL Generator» (docs/chats.md → docs/chats/chat-vsl-analyst-y-generator-
// tareas-pendientes-e491f6d6.md); fecha, hora, sha y tamaño de cada commit, de
// `git log` sobre esas rutas; el estado declarado del área, de app/admin/dev/areas.ts.
//
// ⚠️ Ojo con las horas: la transcripción de la sesión está en otro huso que los
// commits (-03). Acá la hora de un hito con commits sale SIEMPRE del commit; la
// del hito de tipo `prompt`, del sello de la transcripción.
//
// NO es un changelog. Va el motivo, la trampa, y lo que quedó SIN hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Las estructuras de VSL largo', detalle: '5 estructuras de 20 a 45 min con guía bloque por bloque y minutaje · las 7 de guion-estructuras.ts son de anuncio de 30-90 s y no sirven acá', estado: 'hecha' },
  { titulo: 'El nombre coincide con la ruta', detalle: '/vsl-writer → /vsl-generator, con el path viejo redirigiendo porque está escrito en tareas del plan y en mensajes que MaKo ya mandó', estado: 'hecha' },
  { titulo: 'El motor: lib/vsl-writer.ts', detalle: 'NO se escribe (18/11): lo hace el Copywriter desde el 28-29/10 (plantillas VSL con estas estructuras, el chat «Editar» y la API) · y desde el 18/11 una VSL de más de ~13 min sale con su duración, escrita por secciones (lib/copywriter/por-secciones.ts) · falta medirlo con un modelo de verdad, y la API todavía escribe hasta el tope de un pedido', estado: 'sigue' },
  { titulo: 'La ruta y los borradores', detalle: 'Un VSL es una página del Copywriter (su guardado, su feature copywriter-ia con su costo y su API): no hace falta /api/vsl-generator ni una tabla de borradores aparte', estado: 'hecha' },
  { titulo: 'La pantalla', detalle: '/vsl-generator y /vsl-writer llevan a las plantillas de VSL del Copywriter (18/11, como /youtube-writer) · falta sacar la fila de «Coming soon» del menú (nav.ts, jefe Sidebar) · el onboarding de 3 etapas ya no es regla (01/11: ningún wizard tapa una tab)', estado: 'sigue' },
  { titulo: 'El loop Analyst → Generator', detalle: 'El Analyst detecta el bloque donde se cae la curva, el Generator reescribe ESE bloque, se mide la variante · es el único diferencial real de la dupla', estado: 'cola' },
  { titulo: 'Estructuras editables desde /admin/guiones', detalle: 'Como las de ads · hoy el catálogo es código y solo lo puede tocar quien commitea', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '5 ago', hora: '20:30', chat: 'Cerrar VSL Analyst y VSL Generator', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Terminar completamente» las dos features, con la reunión al día siguiente',
    pedido: 'Revisa el plan... Mañana tengo reunión con Mauricio y quiero terminar completamente la funcionalidad de VSL Analyst y VSL Generator, para ello hay muchas tareas pendientes, revisalo.\n\nSi, carga todo al plan y comencemos a desarrollar todo, si llegamos bien, sino, no importa.',
    puntos: [
      '**Las «muchas tareas pendientes» no existían.** De 37 proyectos del tablero, ninguno era VSL Analyst ni VSL Generator; lo único relacionado eran 3 tareas sueltas sin puntuar, y las 12 que traían «VSL» en el título eran de la **landing propia** (grabar el VSL de MaKo, YouTube), no del producto. Cuando alguien dice «revisá las pendientes», la primera respuesta útil puede ser que el registro está vacío.',
      '**Y la causa de que estuviera vacío es estructural:** el catálogo CERRADO de `lib/plan-proyectos-catalogo.ts` no tenía entrada para ninguna de las dos, así que cualquier tarea nueva que el Perro ruteara caía en «Vender MaKo: Landing y VSL» — que es el marketing propio, no la funcionalidad. Un área sin fila en el catálogo no queda sin tareas: queda con las tareas **mezcladas en la carpeta de otro**, que es peor porque no se nota.',
      'De ahí salió la lista real: **9 tareas para el Generator** (catálogo de estructuras de VSL largo, editables desde /admin/guiones, `lib/vsl-writer.ts` con el compositor de brief, el `{{jsonShape}}` por bloques, los 4 prompts en el registry, model-registry + ia-labels, la ruta y la tabla de borradores, la pantalla con su onboarding, y el loop con el Analyst).',
      'La decisión de alcance que se tomó en el mismo turno y sigue vigente: **las fases 2-4 de la tarea #204 —stock, gráficos, avatar— no entran.** «Prometer un editor de video mañana es lo único de esta lista que no podés sostener.» El Generator escribe el guion; producir el video es otro negocio.',
      'Lo que se construyó ese día fue el **cimiento**: `lib/vsl-estructuras.ts`, cinco estructuras reales de 20 a 45 minutos con guía bloque por bloque y minutaje (Respuesta directa · Clase gratuita · Contrarian · Diagnóstico · Historia del fundador). Las siete de `guion-estructuras.ts` (PAS, AIDA, BAB, 4P) son de anuncio de 30 a 90 segundos y **no sirven**: un VSL necesita bloques que en un ad no existen —mecanismo único, prueba, objeciones, garantía—.',
      '⚠️ **Las etiquetas de los bloques son contrato DOBLE**: las lee el parser de la UI y las lee el VSL Analyst, que ancla cada bloque a un tramo de la curva de retención. Por eso el normalizador **descarta lo inválido en vez de guardarlo roto**, y hay tests que lo fijan. Si alguien renombra una etiqueta «para que se lea mejor», rompe el enganche del loop entero.',
    ],
    commits: [
      { sha: '9d9d0f46', msg: 'La curva del VSL: el player nunca dijo la duracion (+ lib/vsl-estructuras.ts, arrancando el VSL Writer)', lineas: 826, archivos: 8 },
    ],
    archivos: [
      'lib/vsl-estructuras.ts — las 5 estructuras de VSL largo; es lo único del Generator que ya existe',
      'tests/vsl-estructuras.test.ts — fija las etiquetas, que son contrato con el parser Y con el Analyst',
    ],
  },

  {
    fecha: '6 ago', hora: '16:02', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El nombre pasa a coincidir con la ruta: /vsl-writer muere como URL, no como key',
    puntos: [
      'Pedido del dueño dentro del rediseño de la barra: «Luego vienen "Landing Generator" y "VSL Generator", **siempre los nombres deben coincidir con la ruta**». Así que `/vsl-writer` pasó a `/vsl-generator`.',
      '⚠️ **La key de nav NO se renombró, y está bien así.** Sigue siendo `vsl-writer` porque está **escrita en la base**: el estado del onboarding por tab y las capas la guardan como texto. Renombrarla habría reabierto la tab a todos los que ya la tenían cerrada. El comentario que lo explica vive arriba de `app/vsl-generator/page.tsx`, que es donde alguien lo va a buscar.',
      'Y la ruta vieja quedó como **redirect**, no borrada: el path anterior está escrito en tareas del plan, en mensajes que MaKo ya mandó y en marcadores del navegador — lugares que no se pueden editar de golpe.',
    ],
    commits: [
      { sha: '4e8380f4', msg: 'Rediseño · la barra deja de perder dónde estabas parado', lineas: 307, archivos: 13 },
    ],
  },

  {
    fecha: '8 ago', hora: '18:58', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El área queda declarada «por-construir», y con eso hereda un punto ciego',
    puntos: [
      'Siete agentes barrieron la superficie del producto y de ahí salieron las 121 áreas de /admin/dev. VSL Generator entró declarada `por-construir`, con su alcance escrito contra el código real: ComingSoon puro, sin lib ni API.',
      '**El CHANGE HISTORY de cada área no se escribe: sale de `git log` sobre las rutas de su `vive[]`** (`scripts/gen-dev-historial.mjs` → `_historial.generado.ts`). Eso es lo que lo mantiene honesto, y también lo que lo vuelve frágil: un `vive[]` corto no da un área con poca historia, da un área **invisible**. El precedente medido es Conocimientos, que veía 11 commits de 68.',
      '⚠️ **Acá pasó exactamente eso:** el `vive[]` declaraba tres archivos —la page, el redirect y `nav.ts`— y dejaba afuera `lib/vsl-estructuras.ts`, que es lo ÚNICO que el área tiene construido. El propio alcance del catálogo lo dice al revés («existe pero lo consume el Landing Analyst, no esto») cuando el commit que lo creó dice, textual, «arrancando el VSL Writer». Se corrigió el 17/08 sumándolo al `vive[]` junto con su test.',
      '`tests/dev-areas.test.ts` chequea contra el disco que cada ruta exista y cazó 30 rutas plausibles pero inexistentes. **Lo que no puede chequear es la omisión**: una ruta que falta no da error, da un punto ciego.',
    ],
    commits: [
      { sha: '74d40781', msg: 'Mapa de /admin/dev: las 208 piezas relevadas contra el código', lineas: 731, archivos: 1 },
      { sha: 'e3063fc3', msg: 'Cosecha del barrido: 121 áreas, y dos trampas que costaron caro', lineas: 272, archivos: 3 },
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
    ],
  },

  {
    fecha: '16 ago', hora: '10:47', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El redirect de la ruta vieja perdía la pestaña del cliente',
    puntos: [
      '`app/vsl-writer/page.tsx` hacía `redirect(\'/vsl-generator\')` con la ruta pelada, así que **abrir un link viejo mientras mirabas a un cliente te sacaba del cliente**. Ahora pasa por `rutaConWs` (`lib/workspace.ts`), como los otros 25 redirects internos que se barrieron ese día.',
      'Es un módulo que todavía no hace nada y aun así tenía una forma de fallar que no se parece a un bug: **no hay error ni pantalla rota, hay una cuenta distinta**. Se reporta como «algo está pasando».',
      '⚠️ La regla que queda para cuando esta tab se construya: **hay CUATRO formas de navegar** y las cuatro tienen que llevar el `?ws=` — `app/_ui/Link` para los links, el parche de `WsFetch` para `/api`, `rutaConWs` para un `redirect()` del server y `conWs(destino, useWs())` para un `window.location.href`. En ese mismo barrido se dio la regla por cerrada contando tres, y la cuarta quedó viva justo en el panel que solo se dibuja mirando a otro cliente.',
    ],
    commits: [
      { sha: '897ce26e', msg: 'Un redirect es navegación: los 26 que perdían el ?ws= de la pestaña', lineas: 126, archivos: 26 },
    ],
  },

  {
    fecha: '18 nov', hora: '01:20', chat: 'Lo que falta construir', sesion: 'cli_f48f3c88-a96a-5f72-9e4b-57d3461c2c45', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Seguir con todos los pendientes (entre ellos, el VSL Generator completo)',
    pedido: 'continúes con absolutamente todos los pendientes',
    puntos: [
      'El pendiente era el F93 de la lista verificada del 17/11 (docs/pendientes-verificados-17-11.md): el plan de agosto entero — motor, ruta y borradores, pantalla, el loop con el Analyst y las estructuras editables.',
    ],
  },

  {
    fecha: '18 nov', hora: '01:28', chat: 'Lo que falta construir', sesion: 'cli_f48f3c88-a96a-5f72-9e4b-57d3461c2c45', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El motor de agosto ya existe con otro nombre: un VSL se escribe en el Copywriter',
    puntos: [
      '**Refutado antes de escribir una línea.** El encargo era `lib/vsl-writer.ts` (compositor de brief, `{{jsonShape}}` por bloques, prompts), `/api/vsl-generator` con su tabla de borradores y una operación de la API. Las cuatro cosas ya las hace el Copywriter desde el 28-29/10: las plantillas de «Nueva» del grupo VSL salen de `lib/vsl-estructuras.ts` (`vsls` en lib/copywriter/plantillas.ts), MaKo las escribe desde el chat de la página (lib/copywriter/ia.ts, con la voz del negocio, el largo por duración, las cifras sin fuente y el voseo vigilados) y la API las crea y las escribe (`listar_plantillas_copywriter`, `crear_documento_copywriter` con `plantillaId`, `editar_documento_copywriter`, `replicar_link_o_texto_copywriter` con tipo `vsl`).',
      '**Escribir el motor de agosto hoy sería una segunda implementación de «escribir un VSL»**, con su propio guardado y sin ninguna de esas guardas. AGENTS.md lo dice para este caso exacto: lo que se agrega va al módulo que ya existe, no al lado. Y la regla de Create (29/10) va en la misma dirección: lo que era una tab es una plantilla de «Nuevo …». La migración 0422 reservada para los borradores no se usó.',
      '**Y el contrato doble con el VSL Analyst ya lo cumple la página del Copywriter:** cada sección es un Título 2 con `attrs.seccion` = la etiqueta EXACTA (`tituloDeSeccion`, lib/copywriter/doc.ts), y `bloquesDelDoc` la lee. El loop Analyst → Generator, cuando se haga, se apoya en eso y en `corteDeSegundo` (lib/vsl-retencion.ts), no en una tabla nueva.',
      'Lo que SÍ se hizo: /vsl-generator lleva a las plantillas del Copywriter con las de VSL primero (`?nuevo=vsl`), como /youtube-writer desde el 28/10; /vsl-writer va directo, sin el doble salto; y «VSL Generator» y «guion de VSL» son alias del Copywriter en lib/funciones-mako.ts, para que MaKo no niegue que puede escribir un VSL.',
      '⚠️ **El hueco de verdad es el LARGO, y es del Copywriter.** Medido con las funciones de lib/copywriter/ia-reglas.ts: `objetivoDeDuracion` topea en 2.000 palabras (~13 minutos dichos), así que la «Clase gratuita · 42 min» (6.300 palabras) se da por buena desde 1.500 (10 min) y avisa recién debajo de 1.200. Las cinco estructuras de acá son de 20 a 40 minutos: ninguna sale entera, y por encima de 1.200 palabras no lo dice nadie. Va al chat del Copywriter (escribir una pieza larga sección por sección).',
      'Siguen en cola, sin tocar: los ejemplos de las tres VSL que no salen en la galería (docs/plantillas-reales/copywriter.md, «Sin hacer»), el loop con el Analyst y las estructuras de VSL editables desde /admin/guiones (hoy entran a la biblioteca con `conVsl`, sin override).',
    ],
    archivos: [
      'app/vsl-generator/destino.ts — a dónde lleva la ruta y por qué no hay un motor propio',
      'app/vsl-generator/page.tsx y app/vsl-writer/page.tsx — las dos rutas van al Copywriter (o al «Coming soon» si no lo puede usar)',
      'tests/vsl-generator-destino.test.ts — el destino, el tipo, las plantillas de VSL a la vista y sus secciones por etiqueta',
    ],
    revisar: '/vsl-generator',
  },

  {
    fecha: '18 nov', hora: '02:00', chat: 'Lo que falta construir', sesion: 'cli_f48f3c88-a96a-5f72-9e4b-57d3461c2c45', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Una VSL larga sale con su duración: el Copywriter la escribe por secciones',
    puntos: [
      'El hueco que quedó del F93: «Editar» del Copywriter escribe la pieza en UN pedido y en un pedido entran 2.000 palabras (~13 minutos dichos). La «Clase gratuita · 42 min» pide 6.300, salía con 2.000 como mucho, se daba por buena desde 1.500 y el aviso callaba arriba de 1.200.',
      '**Ahora:** con la pantalla, una pieza más larga de lo que entra en un pedido toma la primera pasada como BORRADOR y alarga sus secciones cortas (debajo del 75 % de lo suyo) en tandas de hasta 2.000 palabras, una llamada por tanda, en orden (lib/copywriter/por-secciones.ts). El largo de cada sección sale de la GUÍA de su estructura (los minutos de cada bloque de lib/vsl-estructuras.ts), escalado a la duración de la página; lo que vuelve reemplaza la sección del borrador en su lugar, sólo si es más largo.',
      '**Lo que no cambió, a propósito:** el tope de 2.000 palabras POR PEDIDO (`PALABRAS_POR_PEDIDO`, ia-reglas.ts) sigue: es lo que entra en una respuesta y lo que cuesta una llamada. Lo que cambió es que una pieza pueden ser varias. No se toca una sección que el borrador no escribió (puede ser de la persona), y la API de MaKo no lo prende (corta a 60 s por HTTP).',
      '**N llamadas = N cobros:** cada tanda es una llamada que el medidor reserva y cobra aparte; la clase de 42 minutos son unas 6 (el borrador y 5 tandas). Lo dice la fila de `copywriter-ia` en lib/mako-tokens-costos.ts, y un test la ata a la misma cuenta. Sin tiempo para otra tanda (60 s antes del corte de la ruta), con una falla del proveedor o sin MaKo Tokens, corta ahí: lo escrito queda en la propuesta y el aviso dice qué secciones alargar (y, sin saldo, el texto del medidor).',
      'El aviso de duración de esa pieza mide contra su largo REAL y nombra las secciones cortas («pídele a MaKo que alargue «Clave dos» y «Clave tres»»); el de una pieza que entra en un pedido sigue como estaba.',
      '⚠️ Sin medir con un modelo de verdad: el test ejecuta el armado con un modelo de mentira. Cuánto tarda cada tanda con el Gemini de un negocio (y si las 6 entran en los 300 s de la ruta) se ve en producción; si no entran, el aviso nombra lo que faltó.',
    ],
    archivos: [
      'lib/copywriter/por-secciones.ts — el presupuesto por sección, las tandas, el reemplazo en su lugar y el aviso',
      'lib/copywriter/ia.ts — «Editar» con las tandas después del borrador (sólo con `porSecciones`)',
      'tests/copywriter-por-secciones.test.ts — el armado con un modelo de mentira, probado rompiéndolo',
    ],
    revisar: '/copywriter?nuevo=vsl',
  },
];
