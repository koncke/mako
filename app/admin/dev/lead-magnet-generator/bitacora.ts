// =============================================================================
// Lead Magnet Generator — el registro de construcción del área
// =============================================================================
// Alcance: el LEAD MAGNET del negocio — el elemento tangible y concreto que se
// regala a cambio del contacto y que hace que la oferta se entienda rápido en un
// anuncio. La tab `/lead-magnet-generator` todavía es un ComingSoon; lo que ya
// existe y funciona es la DEFINICIÓN del lead magnet, que vive en el paso
// «Entregable» del onboarding (`lib/entregable.ts` + `EntregableView.tsx`).
//
// La distinción que ordena todo el área: **definirlo ya está hecho, producirlo
// no**. MaKo propone 1-3 candidatos desde el brief, el cliente edita o carga el
// suyo, y ese texto alimenta razones, ángulos, guiones y las secuencias de
// nutrición. Lo que la tab tiene que agregar es el ARTEFACTO: el PDF, la
// planilla, el checklist que el lead efectivamente recibe.
//
// De dónde salió esto: los `pedido` son textuales, de los turnos del dueño en
// docs/chats/chat-conocimientos-cursos-e8ba820e.md y
// docs/chats/chat-redise-o-por-partes-88457d97.md (las horas del chat vienen en
// UTC y acá están pasadas a -03:00, que es la zona de los commits); el índice de
// sesiones, en docs/chats.md; fecha, hora, sha y tamaño, de `git log` sobre
// `lib/entregable.ts`, `app/onboarding/EntregableView.tsx`,
// `app/api/onboarding/entregable/` y `app/lead-magnet-generator/`.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El entregable tangible', detalle: 'MaKo propone 1-3 candidatos desde el brief · tipo, qué es y una línea de FOMO · NO es el hook de un guion', estado: 'hecha' },
  { titulo: 'Preguntas adaptativas, de a una', detalle: 'La IA ve el historial y decide la siguiente · tope de 4 · si el dueño ya lo tiene, la pregunta le pide que lo suba', estado: 'hecha' },
  { titulo: 'El enlace del material', detalle: 'Dónde está lo que se le manda al lead · validado http(s) · sin esto la secuencia prometía algo que no tenía dónde estar', estado: 'hecha' },
  { titulo: 'La tab /lead-magnet-generator', detalle: 'Plantillas que crean la pieza en su herramienta (Copywriting o el Web Generator) · la lista viva es mako.entregable · sólo la plataforma por ahora', estado: 'hecha' },
  { titulo: 'Producir el artefacto', detalle: 'Guía, checklist, prompts y planilla nacen como página de Copywriting con su estructura; la clase grabada, como landing · el link público de solo lectura sale de la tab', estado: 'hecha' },
  { titulo: 'La página que lo pide', detalle: 'Una landing con formulario que entra al CRM y su página de gracias con el link del lead magnet, como borrador', estado: 'hecha' },
  { titulo: 'Quiz con diagnóstico', detalle: 'Un bloque del Web Generator: preguntas con puntos y un resultado por rango · el contacto entra al CRM con el resultado y las respuestas · el flujo copiado de SurveyJS', estado: 'hecha' },
  { titulo: 'MaKo propone el lead magnet', detalle: 'Desde la oferta del negocio y lo que hacen sus competidores en Competitors Spy, con la IA del negocio', estado: 'cola' },
  { titulo: 'El lead magnet baja de la oferta', detalle: 'Decidido en el modelo de 4 entidades: es de la OFERTA, no del producto · hoy sigue siendo un blob singleton por workspace', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── julio: el Entregable nace adentro del onboarding ───────────────────────
  {
    fecha: '28 jul', hora: '19:37', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«El Gancho» pasa a llamarse Entregable, y el usuario capaz ya lo tiene',
    pedido: '1. En "El Gancho" no me hizo preguntas... Tal vez el usuario ya tiene un elemento tangible claro para incorporarlo. Y sería bueno llamar a la sección "Entregable".',
    puntos: [
      'El renombre no es cosmético: **«gancho» arrastraba la idea de hook de guion**, y esto es otra cosa. Un lead magnet es una COSA —un dashboard, una planilla, un documento, una metodología con nombre—, no una promesa ni un sentimiento. La definición quedó escrita arriba de `lib/entregable.ts` y ese comentario es lo que impide que vuelva a colapsarse con el copy.',
      'La segunda mitad —«tal vez el usuario ya tiene uno»— es la regla del área entera y es la misma que gobierna el Archivero: **el cliente no redacta lo que ya tiene**. Preguntar antes de generar es más barato que generar y que él tenga que corregir.',
    ],
  },
  {
    fecha: '28 jul', hora: '20:23', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Entregable (ex-Gancho): tab propia, y la carga manual',
    puntos: [
      'El Entregable pasa a ser una tab del hub de onboarding con «+ Agregar el mío», y `lib/gancho.ts` desaparece. La cadena de abajo se repuntó de una: `angulos-formatos.ts` dejó de leer el módulo viejo y pasó a leer razones + entregable.',
      '⚠️ **La trampa que salió en la revisión adversarial del mismo commit:** el route guardaba con un `.filter(x => x.nombre)`, así que **vaciar el nombre de una tarjeta la borraba entera** —seleccionar todo para reescribirlo y hacer blur antes de tipear te comía el lead magnet, sin confirmación ni undo—. Se arregló para que no borre si la tarjeta tiene contenido. Es el mismo patrón que después volvió a aparecer en persona y razones.',
      'Quién consume esto, para saber qué se rompe si falla: `lib/razones.ts`, `lib/angulos-formatos.ts`, `lib/agente-contexto.ts` («El gancho») y `lib/cerebro-grafo.ts`. El lead magnet no es una ficha suelta — es contexto de cuatro features.',
    ],
    commits: [
      { sha: '1f6fa848', msg: 'Fábrica v3: Entregable, Razones=motivaciones, Matriz+pop-up, Persona, gating', lineas: 1079, archivos: 20 },
    ],
    archivos: [
      'lib/entregable.ts — la definición del lead magnet, sus prompts y la persistencia',
      'app/onboarding/EntregableView.tsx — el paso donde el cliente lo revisa o carga el suyo',
      'app/api/onboarding/entregable/route.ts — el endpoint del paso',
    ],
  },
  {
    fecha: '30 jul', hora: '18:36', chat: 'Conocimientos, Archivero y las 5 fases', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'De un lote fijo de preguntas a una conversación de a una',
    puntos: [
      'Dos reclamos del dueño en dos días, y los dos sobre lo mismo. El 29: «En "Tu entregable tangible" no debería existir el botón de cargar el mío, **siempre lo hace MaKo**. Pero MaKo debería hacerle preguntas por si tiene uno específico. Las preguntas pueden ser personalizadas a lo que ya sabe». El 30: «Le di al botón de generar entregable y **NO me hizo preguntas**... Eso está MAL, siempre debe preguntarme porque el usuario tal vez ya tenga algo».',
      '**El diagnóstico no era el prompt: era la forma del pedido.** Se pedían 2-3 preguntas de una sola vez, en un JSON anidado, y cada vez que el modelo fallaba ese anidado caía a un **fallback estático** que se veía exactamente igual que la pregunta buena — así que el paso preguntaba genéricamente y nadie podía distinguir el fallback del camino feliz. Ahora la IA ve el historial completo y decide **la siguiente** pregunta, o dice que ya alcanza. Tope de 4 y «← Atrás» para cambiar una respuesta.',
      'Si el dueño contesta que ya tiene algo concreto, **la propia pregunta cambia de tipo a `archivo`** y le pide que lo suba; si no sube nada, sigue en vez de trabarse. Es la carga manual convertida en una rama de la conversación, que es lo que pedía «siempre lo hace MaKo».',
      'Se sacó «Saltar» de este paso y de todos: cada pregunta tiene que traer una respuesta que siempre aplique.',
    ],
    commits: [
      { sha: '800c7dd8', msg: 'Onboarding: Archivero flujo un-solo-botón + Entregable con preguntas + Persona por IA', lineas: 255, archivos: 7 },
      { sha: 'e3c2a8be', msg: 'Onboarding: preguntas dinámicas de a una en Entregable/Avatares, sin "Saltar" en ningún lado', lineas: 373, archivos: 7 },
    ],
  },

  // ── agosto: el enlace, y la tab que todavía no existe ──────────────────────
  {
    fecha: '2 ago', hora: '19:53', chat: 'Chat Agent: onboarding, nutrición y datos de Mauricio', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Sin enlace, el lead magnet era una promesa: la secuencia entregaba texto',
    puntos: [
      'Armando el wizard de secuencias apareció el agujero: una secuencia podía **prometer que entrega el lead magnet y no tener dónde está**. Se le agregó `enlace` al tipo y el paso permite cargar uno nuevo sin salir (nombre + enlace), con el esquema validado http(s) — un link con otro esquema termina pegado en un mensaje que sale a un desconocido.',
      '⚠️ **La trampa que casi se lleva el campo entero:** `normalizarEntregable` reconstruye el objeto campo por campo y **descarta en silencio todo lo que no nombre**. Sumar `enlace` a la UI sin sumarlo al tipo hacía que el link se borrara solo en la siguiente escritura, sin error y sin rastro. La regla, que ya se había pagado antes con la estrategia de secuencia: **un campo que el parser no nombra se pierde en el viaje de ida**; el round-trip se testea o el campo no existe.',
      'Y el gate que evita el paso muerto: si la secuencia declara que **no** entrega nada, el paso del lead magnet no se pinta gris ni se explica — **no está**.',
    ],
    commits: [
      { sha: '4a302d60', msg: 'feat(chat-agent): el wizard de secuencia se rehace sobre el shell del onboarding', lineas: 678, archivos: 9 },
    ],
  },
  {
    fecha: '7 ago', hora: '03:21', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Nace la ruta, vacía a propósito',
    pedido: '1. Cambiar "Create" por "Sales Machine". Y las tabs dentro serán "Landing Generator" - "VSL Generator" - "Lead Magnet Generator" - separación - "Chatbot" - "Sales Email" - "Newsletters" - separación - "Closing Script" - "Sales Roleplay"\n2. Te dejo todos los iconos, asegurate de que esten del mismo tamaño que el resto.',
    puntos: [
      'La tab entra en el bloque **capturar** (Landing Generator · VSL Generator · Lead Magnet Generator), que es el orden del embudo y no un agrupamiento estético: los tres producen lo que se pone ANTES del contacto.',
      'Sale como `ComingSoon` con el chip «pronto» y con la regla escrita en el commit: **no hay backend y prometer un canal que no existe es peor que no tenerlo**. La ruta se llama igual que la tab, para que un link viejo no quede huérfano.',
      '⚠️ **Y acá empieza el punto ciego del área.** El `vive[]` declaraba solo `page.tsx` + `nav.ts`, y `nav.ts` lo toca cualquier cambio del sidebar: el Change History automático de la tab mostraba doce commits de la barra de admin y **cero** del lead magnet, que se estaba trabajando en `lib/entregable.ts`. Un área con historial ajeno se lee como un área tranquila. Corregido: el `vive[]` ahora apunta al Entregable.',
    ],
    commits: [
      { sha: 'a56135f0', msg: 'Rediseño · Sales Machine y los 14 íconos del set', lineas: 176, archivos: 13 },
    ],
    archivos: [
      'app/lead-magnet-generator/page.tsx — el ComingSoon con `requireRolWs`',
      'app/_components/nav.ts:218 — la fila del sidebar, con `comingSoon: true`',
    ],
  },
  {
    fecha: '10 ago', hora: '23:54', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El lead magnet es de la OFERTA, no del producto',
    puntos: [
      'Relevamiento de 15 agentes sobre «múltiples productos × múltiples funnels». La recomendación previa —que razones y lead magnet fueran **por producto**— quedó corregida con evidencia del propio repo: `lib/cerebro-modelo.ts` y `lib/cerebro-grafo.ts` ya lo declaran colgando de la **oferta**. Tiene sentido de negocio: dos funnels que venden el mismo producto con otra promesa y otro regalo son **dos ofertas**, y el lead magnet es justamente lo que cambia entre ellas.',
      '⚠️ **Lo que queda VIVO y declarado, no resuelto:** `lib/entregable.ts` guarda todo en un solo blob por workspace (`app_settings` con clave `mako.entregable`). Con dos ofertas, **el lead magnet de una se le sigue inyectando a los prompts de la otra** — razones, ángulos y guiones lo reciben sin saber de qué oferta es. La migración del blob a tabla está escrita como commit propio pendiente en `docs/modelo-oferta-producto-funnel.md`.',
      '⚠️ **Y una confusión que ya está en producción:** la señal `oferta-definida` de `lib/plan-senales.ts:104` se calcula con `haySetting("mako.entregable")` — o sea que **tener lead magnet se lee como tener oferta**. Son tres conceptos colapsados en un booleano; está cazado en `docs/hallazgos-plan.md`.',
    ],
    commits: [
      { sha: '307f4221', msg: 'El funnel es uno por construcción, y el catálogo de productos no lo usa nadie', lineas: 575, archivos: 5 },
      { sha: 'd0012701', msg: 'El modelo: cuatro entidades, y la oferta sube de nivel en vez de morir', lineas: 1190, archivos: 6 },
    ],
    archivos: [
      'docs/modelo-oferta-producto-funnel.md — el modelo que manda, con el lead magnet colgado de la oferta',
      'docs/productos-y-funnels-plan.md — el orden de trabajo de las 6 fases',
    ],
  },
  {
    fecha: '13 ago', hora: '19:48', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El error que sí sabía distinguir «no hay key» de «hay key y falló»',
    puntos: [
      'Una clienta con tres cuentas de Gemini veía «conectá tu API key» al lado de un panel que decía que le sobraba el 68 % del día. El paso del Entregable era **uno de los dos lugares que ya lo distinguían bien** (`docsIADisponible()`), y esa distinción se había aplicado **a mano**, caso por caso — por eso `generarRazones` y `angulos-formatos` habían quedado afuera.',
      '**La lección para todo lo que genera el lead magnet:** una corrección aplicada a mano en dos de cuatro call-sites no es una corrección, es una coincidencia. El texto se mudó entero a `lib/ia-mensajes.ts` y hay un test que falla si el literal vuelve a aparecer suelto en cualquier lado.',
      'Y el dato de fondo, que es el que pega en este paso: **la cuota de Gemini se agota POR CUENTA**. Tres keys no son un tanque de 750k, son tres de 250k que no se trasvasan, y la cascada apilaba todo en la primera. Generar el lead magnet sube documentos e imágenes, así que es de los pasos que más rápido queman una cuenta.',
    ],
    commits: [
      { sha: 'c3e583e6', msg: 'IA: la cuota se mide POR CUENTA, y el error dice qué contestó cada una', lineas: 611, archivos: 16 },
    ],
  },

  // ── noviembre: la tab deja de ser un ComingSoon ────────────────────────────
  {
    fecha: '29 oct', hora: '12:00', chat: 'Lead Magnet', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Plantillas con lo que ya existe: Notion con prompts, guía, checklist, quiz, clase grabada',
    pedido: 'me lo imagino como una o varias plantillas... compartir un Notion con prompts, una guía, un checklist; un quiz (preguntas que llevan a un diagnóstico)... con el Web Generator; si la landing no lo permite, que el editor permita agregar formularios, enviar emails, conectarlo con el CRM o las automatizaciones; una clase grabada o un curso, que ya está Classroom... pensá qué más, por ejemplo dashboards',
    puntos: [
      'Llegó por el Cerebro, el 6/11, como tarea de la nube (la hora del pedido no está: se dejó el mediodía). El pedido entero, con el «Cómo» del Cerebro, está en docs/relevo/nube-lead-magnets.md.',
    ],
  },
  {
    fecha: '6 nov', hora: '02:40', chat: 'Lead Magnet', sesion: 'cli_a7d6638b-0aff-5cb9-a16a-98377f9db136', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab: cinco plantillas que crean la pieza en su herramienta, su página y su link',
    puntos: [
      '**No hay editor nuevo.** Guía, checklist, prompts para copiar y planilla nacen como una página de Copywriting con sus secciones y la guía de cada una (nunca el ejemplo); la clase grabada, como una landing del Web Generator con un objetivo nuevo («Clase grabada»: se registran y la ven en seguida). La tab es `PantallaCrear`, como el resto de Create.',
      '**La lista de lead magnets es la que ya existía**, `mako.entregable`: la leen las automatizaciones (`{{negocio_lead_magnet_link}}` sale del PRIMERO), el grafo y los guiones. Cada fila suma dónde vive su pieza, su plantilla y su página de captura; se escribe por compare-and-set con la lectura estricta.',
      '**Lo que faltaba para captar, medido antes de escribir:** el formulario de una landing ya entra al CRM (Pixel → /api/track/optin → createLead) y la secuencia ya manda el link. Faltaban la página (se arma con el objetivo «lead-magnet» y su formulario apunta a la de gracias) y un link que abra la página sin cuenta: un recurso nuevo de `shares`, `lead-magnet`, de SOLO LECTURA, dibujado por el server sin TipTap.',
      '⚠️ **El link público no sale con la guía puesta**: si una sección todavía dice lo que la plantilla escribió, la tab dice cuáles cambiar. Una guía compartida es un lead magnet que promete y no entrega.',
      '⚠️ **Un bug viejo de paso:** «guardar» en el paso Entregable del onboarding reconstruía cada fila sin su `enlace`, así que editar el nombre borraba el link que recibían los leads. Se funde por id.',
      'Classroom y Dashboards quedan afuera de las plantillas: el acceso a Classroom es sólo para clientes que ya compraron (un lead no entra), y compartir un dashboard muestra los números del negocio. La clase grabada se arma como landing; la «planilla» reemplaza al dashboard. Las dos decisiones quedan para Martín en el relevo.',
      'Sólo la plataforma la ve por ahora (`adminOnly`, la puerta y `soloPlataforma` en la API): se abre a los clientes sacando las tres.',
    ],
    revisar: '/lead-magnet-generator',
    archivos: [
      'lib/lead-magnets/plantillas.ts — las cinco plantillas, con su ejemplo de un negocio ficticio',
      'lib/lead-magnets/server.ts — armar, la página de captura, el link público y el orden de la lista',
      'app/lead-magnet-generator/ — la tab (escritorio); app/m/lead-magnet-generator/ — el teléfono',
      'lib/api-mako/areas/leadmagnet.def.ts — las cinco operaciones de la API',
      'app/compartido/[token]/LeadMagnetCompartido.tsx — la página que abre el lead',
    ],
  },
  {
    fecha: '6 nov', hora: '03:35', chat: 'Lead Magnet', sesion: 'cli_a7d6638b-0aff-5cb9-a16a-98377f9db136', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El quiz con diagnóstico: un bloque del Web Generator y su objetivo de landing',
    puntos: [
      '**Un bloque más del Web Generator, «Quiz»**, no una herramienta nueva: preguntas de opción única con puntos, y el puntaje elige UN resultado por rango («desde N puntos»). Antes del resultado, un formulario de contacto que entra al CRM por el Pixel, con el resultado, el puntaje y las respuestas como datos del lead.',
      '**La regla del resultado vive en dos lugares** (el script de la página y el server) y un test los corre a los dos sobre miles de casos: probado rompiendo cada lado.',
      '⚠️ **El Pixel toma como CONTACTO todo campo cuyo `aria-label` diga «negocio», «tel» o «mail»**: con la pregunta ahí, «¿Cuánto factura tu negocio?» llegaba como la empresa del lead y «¿Tienes hotel…?» como su teléfono. Las respuestas van en una etiqueta, que el Pixel no mira para decidir eso.',
      'El flujo y las medidas, de SurveyJS (MIT): una pregunta por paso, la barra de 2 px, «Anterior / Siguiente», el contacto y la página final. Typeform no se abre desde la nube.',
      'Objetivo de landing «Quiz con diagnóstico», plantilla «Quiz» en la tab, y `configurar_quiz_landing` en la API de MaKo.',
    ],
    revisar: '/web-generator',
    archivos: [
      'lib/editor-landing/quiz.ts — el motor, la forma HTML y el script de la página',
      'app/web-generator/editor/nodos/QuizVista.tsx — el panel del editor',
      'lib/editor-landing/plantillas.ts — el objetivo «Quiz con diagnóstico»',
      'tests/quiz-landing.test.ts — el flujo en un DOM y el Pixel real',
    ],
  },
  {
    fecha: '6 nov', hora: '03:35', chat: 'Lead Magnet', sesion: 'cli_a7d6638b-0aff-5cb9-a16a-98377f9db136', cuenta: 'nube',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Dos revisiones de quien no escribió el código: diecinueve arreglos',
    puntos: [
      '**Una sola puerta para escribir la lista**, y la otra se borró: había cuatro escritores con un `setEntregables` suelto, y uno vaciaba la lista con la base caída.',
      '**Al primero no se le saca el link** (dejar de compartir, vaciarlo): las automatizaciones mandaban el mensaje sin él.',
      '**Revocar va después de sacar de la lista**, y si falla vuelve a su lugar. Una página de captura en la papelera ya no cuenta como publicada.',
      'La página de captura ya no promete un correo que nadie manda; cambiar el link lo cambia en su página de gracias; el teléfono tiene lo mismo que la computadora.',
      'El quiz: el foco va al paso nuevo, exportado sale la portada sola, y el editor dice qué botón no va a salir.',
      '⚠️ **Cuatro capturas «de la lista» eran la pantalla de «Nuevo»**: en Create la lista vive detrás de la «←». Comparar una captura con la de al lado antes de darla por mirada.',
    ],
    revisar: '/lead-magnet-generator',
    archivos: [
      'lib/lead-magnets/server.ts, lib/entregable.ts, lib/entregable-fundir.ts',
      'docs/hallazgos-lead-magnets.md — las dos revisiones',
    ],
  },
];
