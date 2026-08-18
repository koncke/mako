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
  { titulo: 'La tab /lead-magnet-generator', detalle: 'ComingSoon con guard de rol · el nombre promete PRODUCIR el entregable, y hoy solo se DEFINE en el onboarding', estado: 'cola' },
  { titulo: 'El lead magnet baja de la oferta', detalle: 'Decidido en el modelo de 4 entidades: es de la OFERTA, no del producto · hoy sigue siendo un blob singleton por workspace', estado: 'cola' },
  { titulo: 'Producir el artefacto', detalle: 'El PDF / planilla / checklist que el lead recibe de verdad · no existe: hoy el `enlace` lo pega el cliente a mano', estado: 'cola' },
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
];
