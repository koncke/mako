// =============================================================================
// Sales Email — el registro de construcción del área
// =============================================================================
// Alcance: los emails que VENDEN — el copy que le escribe al lead para que
// avance, distinto de `/email` (Operate), que es la bandeja de todos los días.
// La tab `/sales-email` todavía es un ComingSoon; lo que ya existe y funciona es
// el escritor: MaKo redacta asunto, preheader y cuerpo en la voz del negocio,
// dentro del compositor de `/email` y del generador de nutrición.
//
// La pregunta que el área no tiene contestada, y por eso importa el registro:
// **qué hace esta tab que el compositor de /email no haga ya**. Hoy la capacidad
// existe entera en otro lado; lo que falta no es un modelo, es una decisión.
//
// De dónde salió esto: el `pedido` es textual, del turno del dueño en
// docs/chats/chat-redise-o-por-partes-88457d97.md (la hora del chat viene en UTC
// y acá está pasada a -03:00, que es la zona de los commits); el índice de
// sesiones, en docs/chats.md; las trampas del canal, en
// docs/hallazgos-comunicacion.md; fecha, hora, sha y tamaño, de `git log`.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'MaKo escribe el copy', detalle: 'Asunto, preheader y cuerpo en la voz del negocio · el cliente revisa, edita y aprueba · nunca agrega ni quita pasos', estado: 'hecha' },
  { titulo: 'La metodología, no la intuición', detalle: '7 frameworks de copywriting curados con embeddings · antes el generador operaba solo con un swipe', estado: 'hecha' },
  { titulo: 'La secuencia sabe parar', detalle: 'Desenlace: qué cuenta como logrado, a qué etapa mueve, a los cuántos días se da por fallida y a dónde sigue', estado: 'hecha' },
  { titulo: 'El prompt sale del negocio del cliente', detalle: 'Perfil + voz destilada + funnel REALES, editable desde /configuraciones, con bloque PROHIBIDO INVENTAR', estado: 'hecha' },
  { titulo: 'La tab /sales-email', detalle: 'ComingSoon con guard de rol · falta decidir qué la separa del compositor de /email, que ya hace el trabajo', estado: 'cola' },
  { titulo: 'Quién firma y a dónde vuelve', detalle: 'Remitente, replyTo y la dirección del cuerpo tienen que coincidir · y el dominio manda antes de poder recibir', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  // ── julio: el escritor ─────────────────────────────────────────────────────
  {
    fecha: '9 jul', hora: '21:58', chat: 'Email Marketing y WhatsApp no oficial', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo escribe el email de venta y vos lo aprobás',
    puntos: [
      'La decisión de producto que sostiene toda la tab: **el cliente no arma 30 mensajes**. MaKo escribe el copy de cada secuencia con la voz destilada del negocio + la metodología + los ejemplos swipe + el perfil, y él revisa, edita y aprueba. Es el mismo bucle de «un canal propone, una persona confirma» que después se volvió regla de la casa.',
      '⚠️ **Reescribe SOLO el texto.** `generarSecuencia` respeta la estructura del template —canal, orden, tiempos, proveedor, plantilla— y hace merge sobre los pasos originales: nunca agrega, nunca quita, nunca deja un cuerpo vacío. Sin ese candado, pedirle copy nuevo a un modelo te reescribe la máquina de envío entera.',
      '⚠️ **Los datos exactos NO los transporta el modelo.** Los `[tu link de agenda]` / `[tu link de pago]` y las variables `{{...}}` quedan literales a propósito; lo único que el modelo completa es lo que puede saber del negocio. Es la misma regla que después costó un link de borrador que resolvía a otro borrador real.',
      'Y los ejemplos swipe entran envueltos como **contenido no confiable**, con regla anti-inyección: son textos de terceros pegados por el cliente adentro de un prompt.',
    ],
    commits: [
      { sha: 'df261a22', msg: 'feat(nutricion): F3.2 + F3.4 — MaKo escribe la nutrición y vos la aprobás', lineas: 455, archivos: 5 },
    ],
    archivos: [
      'lib/nutricion-generator.ts — el escritor, con los prompts nutri.gen.* editables en /configuraciones',
      'app/_components/NutricionGenerar.tsx — la cola de revisión: leer, editar, aprobar',
    ],
  },
  {
    fecha: '31 jul', hora: '11:23', chat: 'Chat Agent: onboarding, nutrición y datos de Mauricio', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El generador dejó de escribir con un solo framework en la cabeza',
    puntos: [
      '**El copy salía parecido siempre, y la causa no era el prompt: era la biblioteca.** El generador operaba con un único método de referencia sembrado en el RAG. Se sembró la metodología curada completa —7 frameworks con embeddings— y recién ahí el mismo prompt empezó a producir estructuras distintas según la etapa. Cuando una salida de IA se repite, mirá qué le estás dando de comer antes que cómo se lo pedís.',
      'Modo **«MaKo escribe todas»** con cola encadenada (aprobar y seguir), priorizando las secuencias que todavía tienen texto de relleno. El banner de arranque aparece cuando el copy sigue con `[placeholders]`: un email a medias no se distingue de uno terminado mirando la lista.',
      'La glosa de la cohorte se volvió dinámica: el paso ya no dice «etapa actual» en abstracto, dice la etapa REAL del funnel de ese cliente. Un email de venta escrito sin saber en qué etapa está el lead es un email genérico con otro nombre.',
    ],
    commits: [
      { sha: '9fcdf5a4', msg: 'feat: MaKo escribe TODA la nutrición + cerebro completo (tareas #46/#5)', lineas: 150, archivos: 5 },
    ],
  },
  {
    fecha: '2 ago', hora: '19:53', chat: 'Chat Agent: onboarding, nutrición y datos de Mauricio', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Una secuencia de venta no sabía parar',
    puntos: [
      '**El agujero que nadie veía porque no daba error:** una secuencia seguía mandando pasos hasta quedarse sin pasos. No había forma de decir dónde termina, así que «reactivación» y «seguimiento» tampoco podían encadenarse. El desenlace define qué cuenta como logrado (responde / agenda / paga), **a qué etapa se mueve el lead**, a los cuántos días se da por fallida y a dónde va entonces — y mover de etapa es justamente lo que engancha una secuencia con la siguiente.',
      'El objetivo dejó de preguntarse a secas. `lib/etapas-contexto.ts` describe al lead de las 14 etapas —qué le pasó, qué recuerda, qué temperatura tiene— y de ahí el objetivo **se cae solo**, sugerido con su porqué: alguien que no agendó hace cuatro meses no se trata igual que alguien que faltó ayer. Es «preguntar hechos, no acciones» aplicado al email de venta.',
      '⚠️ **La trampa del round-trip:** los cuatro campos nuevos entraron en UN commit y con test, porque `parseEstrategia` reconstruye el objeto campo por campo antes de guardar — **un campo que el parser no nombra se pierde EN SILENCIO en el viaje de ida**. Ya había pasado sumando campos en dos tandas.',
    ],
    commits: [
      { sha: '4a302d60', msg: 'feat(chat-agent): el wizard de secuencia se rehace sobre el shell del onboarding', lineas: 678, archivos: 9 },
    ],
  },

  // ── agosto: la tab, y el negocio de quién ──────────────────────────────────
  {
    fecha: '7 ago', hora: '03:21', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Nace la ruta, en el bloque «conversar»',
    pedido: '1. Cambiar "Create" por "Sales Machine". Y las tabs dentro serán "Landing Generator" - "VSL Generator" - "Lead Magnet Generator" - separación - "Chatbot" - "Sales Email" - "Newsletters" - separación - "Closing Script" - "Sales Roleplay"\n2. Te dejo todos los iconos, asegurate de que esten del mismo tamaño que el resto.',
    puntos: [
      'La tab entra en **conversar** (Chatbot · Sales Email · Newsletters): lo que le habla al lead una vez que entró. El orden de los tres bloques es el embudo —capturar, conversar, cerrar—, no una estética.',
      'Sale como `ComingSoon` con el chip «pronto», con la regla escrita en el commit: **no hay backend y prometer un canal que no existe es peor que no tenerlo**.',
      '⚠️ **Lo que quedó sin decidir y sigue abierto:** el copy de venta ya se escribe entero en el compositor de `/email` y en el generador de nutrición. Mientras no haya una respuesta a «qué hace esta tab que aquello no haga», construirla es garantizar dos lugares para lo mismo — y el que se quede viejo va a ser el que menos se use.',
      '⚠️ **Y el punto ciego del registro:** el `vive[]` declaraba solo `page.tsx` + `nav.ts`. Como `nav.ts` lo toca cualquier cambio del sidebar, el Change History automático de esta tab mostraba doce commits de la barra de admin y **ninguno** de un email. Un área con historial ajeno se lee como un área tranquila. Corregido: ahora apunta también al escritor.',
    ],
    commits: [
      { sha: 'a56135f0', msg: 'Rediseño · Sales Machine y los 14 íconos del set', lineas: 176, archivos: 13 },
    ],
    archivos: [
      'app/sales-email/page.tsx — el ComingSoon con `requireRolWs`',
      'app/_components/nav.ts:223 — la fila del sidebar, con `comingSoon: true`',
    ],
  },
  {
    fecha: '10 ago', hora: '23:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El compositor escribía para el negocio de otro, en todos los workspaces',
    puntos: [
      '**El system prompt decía, literal, «escribiendo para Mauricio Bustos (Negocio que Escala™)» y ordenaba usar SU Calendly** — hardcodeado para todos los workspaces. No fallaba: contestaba, y contestaba bien redactado. Cualquier cliente que apretara «que lo escriba MaKo» recibía copy del negocio de otro con el link de agenda de otro.',
      '**Por qué es el modo de falla más caro que tiene esta tab:** un email mal escrito se ve mal y se corrige; un email bien escrito sobre el negocio equivocado se ve perfecto. La única señal era leerlo con atención sabiendo qué negocio era.',
      'Ahora el prompt se arma con **perfil + voz destilada + funnel reales del workspace** (el molde de `nutricion-generator`), es editable desde `/configuraciones`, y lleva un bloque **PROHIBIDO INVENTAR**: sin link en el contexto escribe `[LINK DE AGENDA]` en vez de improvisar uno, y el dialecto sale de la voz del negocio, nunca por default.',
      'La regla que queda para cualquier writer nuevo de esta familia: **un prompt con un nombre propio adentro es un prompt de un solo inquilino**. Con un solo cliente configurado no se puede saber si lo leés del lugar correcto — probalo mentalmente con dos.',
    ],
    commits: [
      { sha: '97f98ba8', msg: 'El paso de Productos por fin cierra, y /email deja de escribir para Mauricio', lineas: 268, archivos: 13 },
    ],
    archivos: ['app/api/email/generar/route.ts — el escritor del compositor, hoy la implementación real de «sales email»'],
  },
  {
    fecha: '16 ago', hora: '19:04', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Las tres direcciones que tienen que coincidir, y la casilla que no existe',
    puntos: [
      'No es un commit de esta tab —salió arreglando el mail de acceso—, pero define el terreno donde va a caer el primer email de venta que se mande desde acá, así que queda anotado: **quién firma, a dónde vuelve un «Responder» (`replyTo`) y a dónde el cuerpo le dice a la persona que escriba son TRES cosas**, y un mail que viene de una dirección, se responde a otra y en el texto manda a una tercera es un mail que nadie contesta.',
      '⚠️ **El MX no prueba que la casilla exista, y se usó el MX como evidencia.** Los MX del dominio son de **reenvío**: entregan alias por alias y solo los que están dados de alta a mano en el panel, y la API no expone esas reglas. O sea que el dominio puede **mandar** perfecto y no **recibir** nada, sin ningún síntoma. Un email de venta que pide respuesta y cae en un buzón inexistente se ve, del lado de acá, exactamente igual que uno que nadie contestó.',
      'El corolario para el copy: un mail de una marca que el destinatario no conoce, sobre algo que no pidió, **lo más razonable que puede hacer es tratarlo como spam**. Por eso el nombre del negocio va sí o sí en el cuerpo, con un test que falla si alguna llamada sale sin él.',
    ],
    commits: [
      { sha: '954db59b', msg: 'El contacto de ayuda es MaKo, y la dirección de MaKo es UNA sola', lineas: 145, archivos: 7 },
    ],
    archivos: ['docs/hallazgos-comunicacion.md — el detalle del circuito de reenvío y qué quedó sin confirmar'],
  },
];
