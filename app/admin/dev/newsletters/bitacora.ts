// =============================================================================
// Newsletters — el registro de construcción del área
// =============================================================================
// Alcance: el envío recurrente a la lista. La tab `/newsletters` todavía es un
// ComingSoon; lo que ya existe y funciona es **todo lo de abajo**: broadcasts a
// segmentos sobre Resend, dominio por cliente, tracking de abiertos/clics/
// rebotes por webhook y baja con token. Una newsletter, mirada desde el código,
// es un broadcast que se repite y que se le manda a la lista entera.
//
// Por eso lo que falta no es el envío: es **la recurrencia, la lista propia y la
// reputación**. Un broadcast puntual perdona un rebote; una newsletter semanal
// que sigue escribiéndole a casillas muertas quema el dominio del cliente, y ahí
// es donde muerden las trampas anotadas más abajo.
//
// De dónde salió esto: el `pedido` es textual, del turno del dueño en
// docs/chats/chat-redise-o-por-partes-88457d97.md (la hora del chat viene en UTC
// y acá está pasada a -03:00, que es la zona de los commits); el índice de
// sesiones, en docs/chats.md; las trampas del canal, en
// docs/hallazgos-comunicacion.md y en la nota del área
// `email-delivery-bajas` de app/admin/dev/areas.ts; fecha, hora, sha y tamaño,
// de `git log`.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El envío a una lista', detalle: 'Broadcasts a segmentos sobre Resend · reanudables, con corte por rate-limit y tope diario · doble gate para mandar de verdad', estado: 'hecha' },
  { titulo: 'La baja y la supresión', detalle: 'Token HMAC en el footer + One-Click · el rebote duro suprime, el blando no · las dos escriben leads.email_opt_out', estado: 'hecha' },
  { titulo: 'El dominio es del cliente', detalle: 'Opción A: key única de MaKo + dominio por workspace, con titularidad verificada para que nadie firme como otro', estado: 'hecha' },
  { titulo: 'La tab /newsletters', detalle: 'MaKo abre preguntando (sin IA) · los suscriptos son un CRM «Newsletter» · las ediciones, broadcasts de ese CRM · sólo el super admin hasta el go-live del email', estado: 'hecha' },
  { titulo: 'La recurrencia', detalle: 'Frecuencia y próxima edición anclada en la anterior · Lee/Dormido calculados de la lectura · la baja atribuida a su edición', estado: 'hecha' },
  { titulo: 'Abrirla a todos los negocios', detalle: 'Sacar la fila de PRONTO en nav.ts (chat Sidebar) con el go-live del email, que decide Martín', estado: 'cola' },
  { titulo: 'El tracking del cliente con key propia', detalle: 'Pendiente F2: con su propia RESEND_API_KEY manda igual pero pierde abiertos, clics y rebotes — y con eso, la supresión', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  // ── junio / julio: el canal, que ya existe entero ──────────────────────────
  {
    fecha: '30 jun', hora: '11:55', chat: 'Email Marketing y WhatsApp no oficial', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El envío a una lista ya existe: broadcasts, segmentos y baja',
    puntos: [
      'Todo lo que una newsletter necesita para SALIR quedó hecho acá: broadcast a un segmento, KPIs y stats reales, tracking por webhook de Resend con firma Svix, y baja con token HMAC en el footer. La migración 0046 trae las tablas y `leads.email_opt_out`.',
      '**El envío real vive detrás de un doble gate** (`EMAIL_SEND_ENABLED` + secuencias pausadas), y eso es a propósito: lo irreversible de este canal no es escribir el mail, es mandarlo. Un botón que dispara cientos de envíos no se prueba «a ver qué pasa».',
      '⚠️ **El rebote blando NO suprime.** Un buzón lleno o un servidor caído un martes no es una dirección muerta, y tratarlo como tal te borra suscriptores buenos. Solo el rebote duro escribe el opt-out. Para una newsletter recurrente esta distinción es la que decide si la lista se achica sola.',
      '⚠️ Y dos guardas que se pagaron en la review adversarial del mismo commit: la ruta de baja tiene que ser **pública en el middleware** (si exige sesión, el que se quiere ir no puede irse) y hay un guard de 20 h cross-canal para que un broadcast no le caiga encima a alguien que ya recibió un WhatsApp.',
    ],
    commits: [
      { sha: '2aa65c89', msg: 'feat(email): Email Marketing funcional con Resend sobre el motor de nutrición', lineas: 1897, archivos: 15 },
    ],
    archivos: [
      'lib/email-marketing.ts — segmentos, broadcasts y stats: la lista y el envío',
      'app/api/email/broadcasts/ — crear, programar y disparar',
      'app/api/email/unsubscribe/ — la baja, pública a propósito',
    ],
  },
  {
    fecha: '9 jul', hora: '16:05', chat: 'Email Marketing y WhatsApp no oficial', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El dominio es del cliente, la cuenta es de MaKo (Opción A)',
    puntos: [
      '**La decisión de arquitectura que hoy sigue gobernando el canal:** una sola key de Resend —la de MaKo— y **un dominio por cliente**, dado de alta por la API de Domains con un mini-onboarding en `/email` (DNS → verificar → remitente). Ni una key por cliente ni un dominio compartido: lo primero multiplica la operación, lo segundo hace que la reputación de uno se la coma el otro.',
      '⚠️ **Anti-spoofing cross-tenant:** la titularidad del dominio se valida por workspace. Sin eso, un cliente podía reclamar el dominio de otro y firmar sus mails — que en un canal donde lo único que autentica es el `from` es el peor agujero posible.',
      '⚠️ **Lo que quedó abierto y está anotado en `lib/resend.ts` como pendiente F2:** el webhook de eventos valida **UN solo signing secret**, el de la cuenta de MaKo. Un cliente que cargue su propia `RESEND_API_KEY` **sigue enviando** —o sea que no falla, no avisa y parece que anda— pero pierde abiertos, clics y rebotes, y por lo tanto la **supresión automática**. Para una newsletter semanal eso no es una métrica que falta: es la lista degradándose sin que nadie lo vea.',
      'El envío real dejó de ser un flag de deploy y pasó a ser **por workspace** (`lib/envio-flags.ts`), y los pasos de un canal apagado avanzan como `omitido` en vez de quedarse trabados ensuciando los KPIs.',
    ],
    commits: [
      { sha: '1457ace5', msg: 'feat(email): F1 multi-workspace — flags por ws, dominios Resend por cliente y crons por tenant', lineas: 1088, archivos: 12 },
    ],
    archivos: ['lib/resend.ts:25-33 — la Opción A y el pendiente F2, escritos donde se toman las decisiones'],
  },

  // ── agosto: la tab, y lo que falta antes de mandar la primera ──────────────
  {
    fecha: '7 ago', hora: '03:21', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Nace la ruta, en el bloque «conversar»',
    pedido: '1. Cambiar "Create" por "Sales Machine". Y las tabs dentro serán "Landing Generator" - "VSL Generator" - "Lead Magnet Generator" - separación - "Chatbot" - "Sales Email" - "Newsletters" - separación - "Closing Script" - "Sales Roleplay"\n2. Te dejo todos los iconos, asegurate de que esten del mismo tamaño que el resto.',
    puntos: [
      'La tab entra en **conversar** (Chatbot · Sales Email · Newsletters), y sale como `ComingSoon` con el chip «pronto»: **no hay backend y prometer un canal que no existe es peor que no tenerlo**.',
      '⚠️ **Es la única de las ocho tabs de Sales Machine sin proyecto propio en el catálogo del board.** `lib/plan-proyectos-catalogo.ts` no tiene una fila «Newsletters»; la de «Sales Email» dice, textual, que cubre *«el generador de emails de venta y las newsletters para el cliente»*. Consecuencia concreta: una tarea de newsletter no puede rutearse a un lugar propio — el Perro la manda a Sales Email o la deja sin proyecto, y el área queda sin backlog visible.',
      '⚠️ **Y el punto ciego del registro:** el `vive[]` declaraba solo `page.tsx` + `nav.ts`. Como `nav.ts` lo toca cualquier cambio del sidebar, el Change History automático de esta tab mostraba doce commits de la barra de admin y **ninguno** de un envío. Un área con historial ajeno se lee como un área tranquila. Corregido: ahora apunta también al canal.',
    ],
    commits: [
      { sha: 'a56135f0', msg: 'Rediseño · Sales Machine y los 14 íconos del set', lineas: 176, archivos: 13 },
    ],
    archivos: [
      'app/newsletters/page.tsx — el ComingSoon con `requireRolWs`',
      'app/_components/nav.ts:224 — la fila del sidebar, con `comingSoon: true`',
    ],
  },
  {
    fecha: '10 ago', hora: '23:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El escritor del compositor mandaba copy del negocio de otro',
    puntos: [
      '**El system prompt de `/email` decía, literal, «escribiendo para Mauricio Bustos (Negocio que Escala™)» y ordenaba usar SU Calendly** — hardcodeado para todos los workspaces. No fallaba: contestaba bien redactado. Cualquier cliente que le pidiera a MaKo el texto de un envío recibía copy del negocio de otro.',
      '**Por qué esto es peor en una newsletter que en cualquier otra pieza:** una newsletter sale a la lista entera de una vez y es irreversible. Un texto mal escrito se nota y no se manda; un texto bien escrito sobre el negocio equivocado se lee perfecto hasta que lo abren 400 personas.',
      'Ahora el prompt se arma con perfil + voz destilada + funnel **reales del workspace**, es editable desde `/configuraciones`, y lleva un bloque **PROHIBIDO INVENTAR**: sin link en el contexto escribe `[LINK DE AGENDA]` en lugar de improvisar uno.',
    ],
    commits: [
      { sha: '97f98ba8', msg: 'El paso de Productos por fin cierra, y /email deja de escribir para Mauricio', lineas: 268, archivos: 13 },
    ],
  },
  {
    fecha: '16 ago', hora: '19:18', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El preflight del remitente lo debilité yo, y el MX no prueba nada',
    puntos: [
      '⚠️ **Una regresión propia, del commit anterior:** al pasar la regex de sandbox del remitente completo a la dirección pelada, un valor como `MaKo <onboarding@resend.dev>` **pasaba el control** — o sea que el preflight que existe justamente para que nada salga desde la casilla de prueba de Resend dejaba de verlo. El contrato de «dirección pelada» vivía **solo en un comentario**, que es la definición de la casa de algo que no es un contrato. Ahora valida al arrancar y tira: una dirección rota no tiene degradación razonable, y enterarse en el primer envío es enterarse tarde.',
      '⚠️ **El MX no prueba que la casilla exista, y se usó el MX como evidencia.** Los MX del dominio son de **reenvío**: entregan alias por alias, solo los dados de alta a mano en el panel, y la API no expone esas reglas. El dominio puede **mandar** perfecto y no **recibir** nada. Una newsletter cuyo `Responder` cae en un buzón inexistente se ve, del lado de acá, exactamente igual que una que nadie contestó.',
      'La regla que queda para este canal: **el test es de COMPORTAMIENTO, no un grep del fuente.** Importar el módulo con el env puesto es lo único que encuentra el caso de arriba; buscar la regex en el código la encuentra igual de rota y da verde.',
    ],
    commits: [
      { sha: '9bee13c0', msg: 'El MX no prueba que la casilla exista, y otras tres del barrido', lineas: 156, archivos: 6 },
    ],
    archivos: ['docs/hallazgos-comunicacion.md — el circuito de reenvío y qué quedó sin confirmar'],
  },

  // ── 29 de octubre: el newsletter, aprobado ─────────────────────────────────
  {
    fecha: '29 oct', hora: '23:00', chat: 'Cerebro', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Un newsletter no es una secuencia: es una base que no termina',
    pedido: 'cómo podemos instalar dentro de MaKo la funcionalidad de newsletter… es diferente a una secuencia de ventas por email… algo que no termina nunca, indefinido, una gran base de datos… ¿lo hacemos en Automations, con una nueva tarjeta, o en otra pestaña? … necesitamos la base de datos de registrados… podría ser un nuevo CRM que diga newsletter. [A la propuesta del Cerebro:] Sí, armalo así.',
    puntos: [
      'Lo aprobado: los suscriptos son un CRM «Newsletter» (Suscripto → Lee → Dormido → Dado de baja); las ediciones viven en esta tab, se escriben en el Copywriter, quedan en el Calendario y salen desde el dominio del negocio; Automations sólo para la bienvenida; métricas por edición y «Dormido» solo.',
      'El envío de email sigue APAGADO en producción: prenderlo es decisión de Martín. Todo tenía que andar y poder probarse con el flag apagado.',
    ],
  },
  {
    fecha: '29 oct', hora: '23:57', chat: 'Newsletter', sesion: 'local_3058f25f-a009-403a-add8-7da19e902e24', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Una edición es un broadcast del CRM «Newsletter»',
    puntos: [
      '**El modelo, sin tabla nueva:** una edición es un broadcast con segmento `newsletter:<funnelId>[:<etapa>]`, así que hereda el envío desde el dominio del negocio, el flag por workspace, la baja, el guard de 20 h y el cron de los programados. Que sea una edición se deriva del segmento.',
      '**La tab abre con MaKo tomando la iniciativa, sin IA:** «¿Cada cuánto quieres mandar tu newsletter?» y «¿De qué trata?», con pastillas. Al contestar, la IA del negocio propone la primera edición; sin IA, se escribe en el Copywriter igual.',
      '⚠️ **«Dormido» sin tracking dormía a toda la lista:** con su propia key de Resend o sin el webhook no llega ni una apertura. Una edición sin NINGUNA apertura no mide; tampoco cuentan los envíos simulados (envío apagado).',
      '⚠️ **La bienvenida pedía una etiqueta que nadie pone:** la plantilla de la galería ya existía; ahora arranca con la etapa «Suscripto», que es la clave canónica `lead` porque el opt-in de la landing nunca escribe la etapa.',
      'Con el envío apagado: vista previa, prueba al email de quien la pide y programar (espera). «Enviar ahora» se niega: quemaría la edición.',
    ],
    commits: [
      { sha: '8c004a6a', msg: 'Newsletter: los suscriptos son un CRM y cada edición, un broadcast de ese CRM (aprobado por Martín el 29/10)', lineas: 2636, archivos: 35 },
    ],
    archivos: [
      'lib/newsletter-reglas.ts — el segmento, las etapas, la regla de «Dormido», la config y la charla de apertura (puro)',
      'lib/newsletter.ts — el CRM, los suscriptos (casa y agregados), las ediciones y la conciliación de la lectura',
      'app/newsletters/ — la tab: la apertura con MaKo, los suscriptos, las ediciones y su editor',
      'supabase/migrations/0351_newsletter.sql — la baja por edición y el guion del Copywriter de cada una',
      'docs/hallazgos-newsletters.md — lo que hay que saber antes de tocarlo, y lo que quedó sin hacer',
    ],
    revisar: '/newsletters',
  },
];
