// =============================================================================
// Contenido del showcase de /vsl — copy por funcionalidad para el MODAL de detalle.
// =============================================================================
// Antes cada feature abría una sección `.mk-deep` DEBAJO de la grilla (había que
// hacer scroll). Ahora la card abre un POP-UP (ver ./FeatureModal.tsx) con este
// contenido. Copy nuevo, más marketinero y específico (fuente: transcript de MaKo
// función por función). Incluye la feature que faltaba: Prioridades / Perro Guardián.
//
// Voz: "tú" (pan-LATAM), consistente con la grilla de la landing.
// Los íconos replican EXACTAMENTE los de las cards de landing-html.ts (continuidad
// card → modal). email usa un sobre limpio (la card trae el logo de Gmail) y mako
// la estrella de marca (star: true).

export type ShowcaseFeature = {
  slug: string;
  name: string;      // eyebrow / nombre en la card
  icon: string[];    // paths SVG (viewBox 0 0 24 24, stroke) salvo star
  star?: boolean;    // mako: estrella dorada rellena (viewBox propio)
  hook: string;      // subtítulo de la card (+ H3 del viejo pop-up)
  intro?: string;    // (legacy del pop-up; hoy sin uso — la landing vive en features.ts)
  points?: string[]; // (legacy del pop-up)
  nota?: string;     // estado honesto (en activación / construcción / preparación)
};

// Orden de las cards en la grilla de /vsl (24 features). Las 8 nuevas + prioridades
// se inyectan en runtime desde Landing.tsx en estas posiciones.
export const SHOWCASE_ORDER = [
  'funnel', 'pipeline', 'onboarding', 'graphics', 'crm', 'api', 'ads', 'script', 'closing', 'seguimiento',
  'cobranza', 'contrato', 'semaforo', 'experimentos', 'prioridades', 'retro', 'fase-norte',
  'whatsapp', 'email', 'conocimiento', 'mako', 'integraciones', 'equipo', 'perfil-reportes',
];

/**
 * Cards que NO vienen en el HTML del diseño y se inyectan en la grilla:
 * [slug, después-de]. El orden importa — cada "después-de" ya tiene que existir
 * cuando se inserta el siguiente. Es la ÚNICA fuente: lo usan la landing (que
 * las inyecta en el DOM) y las páginas de funcionalidad (que arman el mismo
 * HTML del lado del servidor).
 */
export const INJECT_ORDER: Array<[string, string]> = [
  ['onboarding', 'funnel'], ['graphics', 'onboarding'],
  ['prioridades', 'experimentos'], ['retro', 'prioridades'], ['fase-norte', 'retro'],
  ['conocimiento', 'email'], ['integraciones', 'mako'], ['equipo', 'integraciones'],
  ['perfil-reportes', 'equipo'],
  // Va último para que quede pegado a funnel (si fuera primero, onboarding se
  // metería entre los dos).
  ['pipeline', 'funnel'],
];

/**
 * Funcionalidades que existen pero NO se muestran todavía en la grilla.
 * Customer Success es a futuro: sacarla deja la grilla en un 4×6 exacto.
 */
export const OCULTAS = new Set<string>(['customer']);

export const SHOWCASE: ShowcaseFeature[] = [
  {
    slug: 'funnel',
    name: 'Tu funnel en un solo lugar',
    icon: [
      'M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1',
      'M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1',
      'M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1',
      'M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1',
    ],
    hook: 'Tu negocio entero en una pantalla. Por primera vez.',
    intro: 'Hoy, para ver cómo va tu funnel, abres Meta, tu reproductor de VSL, el Excel de cobros, el píxel, tu CRM... <em>seis pestañas para entender una sola cosa</em>. MaKo conecta todo y te muestra <strong>la salud real de tu funnel en vivo</strong>, del primer clic al contrato firmado.',
    points: [
      'Marketing y ventas juntos: Meta, tu landing, tu VSL, Calendly, WhatsApp y tus llamadas, <strong>conectados y actualizándose solos</strong>.',
      'Donde antes intuías, <strong>ahora ves</strong>. Y donde antes veías números sueltos, ahora ves qué significan.',
    ],
  },
  {
    slug: 'pipeline',
    name: 'Armá tu embudo',
    icon: [
      'M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z',
    ],
    hook: 'Editás una fila y el resto se escribe solo.',
  },
  {
    slug: 'crm',
    name: 'CRM Automatizado',
    icon: [
      'M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z',
      'M10 16h6',
      'M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M4 8h3', 'M4 12h3', 'M4 16h3',
    ],
    hook: 'El trabajo más aburrido del mundo, hecho por ti.',
    intro: 'Cargar fichas y arrastrar leads de una fase a otra te roba horas, y <em>siempre se escapa alguno</em>. MaKo captura cada lead que entra, cruza sus datos y lo va <strong>moviendo de fase solo</strong>. Tú solo dedícate a cerrar.',
    points: [
      'Detecta por Calendly cada llamada que cae, la cruza con el lead correcto y lo avanza de fase. Hasta <strong>agenda la segunda llamada solo</strong>, leyendo la transcripción de la primera.',
      'Cada ficha trae la historia completa: de qué anuncio vino, cuántas veces volvió y <strong>hasta qué minuto de tu VSL miró</strong> antes de agendar.',
      'MaKo mueve leads por ti y te avisa: <em>"este lleva 30 días sin responder, lo paso a reactivación."</em> Confirmas o lo frenas. Tú decides; él ejecuta.',
    ],
  },
  {
    slug: 'api',
    name: 'La API de Meta optimizada',
    icon: [
      'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M12 7a5 5 0 1 0 5 5',
      'M13 3.055a9 9 0 1 0 7.941 7.945',
      'M15 6v3h3l3 -3h-3v-3z',
      'M15 9l-3 3',
    ],
    hook: 'Meta es tan buena como lo que le dejas ver.',
    intro: 'El píxel sabe quién hizo clic. No sabe quién llegó a la llamada descalificado, ni quién se vio tu VSL entero y compró. MaKo le devuelve a Meta esas <strong>conversiones reales</strong> (el CAPI) para que salga a buscar más gente como la que te paga, <em>no más curiosos</em>.',
    points: [
      'Le manda a Meta señales que el píxel no puede ver: <strong>quién vio del 5% al 100% de tu VSL</strong> y quién llegó calificado a tu llamada.',
      'Mismo presupuesto, <strong>leads cada vez mejores</strong>. Meta afina la puntería con cada venta que cierras.',
    ],
  },
  {
    slug: 'ads',
    name: 'Ads Manager para VSL Funnel',
    icon: [
      'M18 8a3 3 0 0 1 0 6',
      'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5',
      'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8',
    ],
    hook: 'Nunca más tres horas peleándote con el Ads Manager.',
    intro: 'Meta está hecho para todos: quien vende productos, servicios, catálogos, mensajes... por eso son <em>mil botones que no necesitas</em>. MaKo te deja solo lo que un VSL Funnel usa, y <strong>crea tu campaña en 5 preguntas simples</strong>.',
    points: [
      'Sube tu creativo (o usa uno ganador), di cuánto invertir y a quién apuntar. MaKo <strong>arma la estructura y escribe los textos</strong> por ti.',
      'Publica todo <strong>en pausa, listo para revisar</strong>. Un clic y sale. Pausar y escalar, también desde aquí.',
    ],
    nota: 'Crear campañas y subir creativos está en activación — depende de habilitar la escritura sobre tu cuenta de Meta.',
  },
  {
    slug: 'script',
    name: 'Script Analyst',
    icon: [
      'M14 3v4a1 1 0 0 0 1 1h4',
      'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
      'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0',
    ],
    hook: 'Deja de adivinar qué creativo funciona. Que lo diga la data.',
    intro: 'Cada anuncio gana o pierde plata todos los días. MaKo <strong>transcribe todos tus creativos solo</strong>, los cruza con su retención y los ordena en un mapa: cuál escalar, a cuál cambiarle el gancho, cuál reescribir y cuál apagar.',
    points: [
      'Ve <strong>palabra por palabra en qué segundo se cae tu video</strong>, y si el problema es el gancho o lo que viene después.',
      'Pega un guion nuevo y MaKo <strong>lo valora antes de que lo grabes</strong>. Sabes si sirve sin gastar un peso.',
      'Detecta patrones que solo no ves: <em>"atacas siempre al dolor y dejaste sin probar los testimonios"</em>, o <em>"tus anuncios con un dashboard en pantalla agendan más que el resto"</em>.',
    ],
  },
  {
    slug: 'closing',
    name: 'Closing Analyst',
    icon: [
      'M4 14v-3a8 8 0 1 1 16 0v3',
      'M18 19c0 1.657 -2.686 3 -6 3',
      'M4 14a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-3z',
      'M15 14a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-3z',
    ],
    hook: 'Cada llamada, puntuada y convertida en tu próxima lección.',
    intro: 'Escuchar y calificar cada llamada a mano es <em>imposible</em>. MaKo trae tus llamadas de Fathom, las <strong>puntúa con el método SPIN</strong> y te muestra, con el minuto exacto, dónde cerraste y dónde se te escapó.',
    points: [
      'Reproduce el momento clave y recibe <strong>coaching concreto</strong>: qué hiciste bien y qué corregir en la próxima.',
      'Cruza todas tus llamadas y encuentra <strong>qué hábito decide tus cierres</strong>, para que tu mejor closer sea el molde del equipo entero.',
    ],
  },
  {
    slug: 'seguimiento',
    name: 'Seguimiento automático',
    icon: [
      'M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10',
      'M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2',
    ],
    hook: 'El dinero está en el seguimiento. Y el seguimiento corre solo.',
    intro: 'La mayoría de los leads no se pierden por tu oferta, se pierden <strong>porque nadie los volvió a tocar</strong>. MaKo detecta a cada uno que se quedó en el camino y le manda, solo, el mensaje correcto para su momento, <em>por WhatsApp y email</em>.',
    points: [
      'No manda el mismo mensaje a todos: al que no agendó, al que faltó a la llamada, al que no compró y al que dejó de responder, <strong>cada uno recibe su secuencia</strong>.',
      'El mensaje se ajusta a lo que hizo el lead. Quien vio el <strong>9% de tu VSL</strong> recibe algo distinto a quien lo vio entero. Y se corta solo en cuanto responde.',
    ],
    nota: 'El envío automático se activa cuando tus plantillas estén aprobadas por Meta.',
  },
  {
    slug: 'cobranza',
    name: 'Cobranza y Revenue real',
    icon: [
      'M7 9m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z',
      'M14 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M17 9v-2a2 2 0 0 0 -2 -2h-10a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h2',
    ],
    hook: 'Vender no es cobrar. MaKo no te deja confundirlos.',
    intro: 'Un contrato firmado no paga tus cuentas; <em>el dinero en la cuenta, sí</em>. MaKo separa lo vendido de lo cobrado, te muestra cuánto falta por entrar y de quién, y te arma <strong>la lista de a quién cobrarle hoy</strong>.',
    points: [
      'Tu <strong>ROAS sobre la plata que de verdad entró</strong>, no sobre promesas.',
      'Cada cuota con nombre y fecha: <strong>lo vencido en rojo</strong>, lo que está por vencer en ámbar. Cero cobros olvidados.',
    ],
  },
  {
    slug: 'contrato',
    name: 'Tu contrato, leído por IA',
    icon: [
      'M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2',
    ],
    hook: 'Del contrato firmado al deal cargado, sin escribir una línea.',
    intro: 'Pasar cada contrato a cuotas, datos fiscales y compromisos a mano es <em>tedioso y se llena de errores</em>. Sube el PDF (o deja que MaKo lo genere desde la llamada) y él <strong>arma todo el trato</strong>.',
    points: [
      'Extrae total, cuotas y fechas, y <strong>monta el plan de pagos</strong> sin que tipees un solo número.',
      'Rellena el deal completo: <strong>datos fiscales, lo que prometiste, la garantía y las obligaciones de cada parte</strong>, con historial de cada cambio.',
    ],
  },
  {
    slug: 'customer',
    name: 'Customer Success',
    icon: [
      'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
      'M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25',
      'M12.5 15.5l2 2', 'M15 13l2 2',
    ],
    hook: 'Cerrar al cliente es la mitad. Que se quede es donde está el dinero.',
    intro: 'En High Ticket, <strong>tu próximo gran ingreso suele ser el cliente que ya te compró</strong>. MaKo escucha tus llamadas de servicio y te avisa quién está a gusto y <em>quién está por soltarte</em>.',
    points: [
      'Detecta <strong>señales de abandono antes de que sea tarde</strong>, cuando todavía puedes hacer algo.',
      'Convierte a los clientes contentos en tu mejor canal: <strong>renovaciones y referidos</strong>.',
    ],
  },
  {
    slug: 'semaforo',
    name: 'Semáforo del Negocio',
    icon: [
      'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
      'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M13.41 10.59l2.59 -2.59',
      'M7 12a5 5 0 0 1 5 -5',
    ],
    hook: 'Demasiada métrica paraliza. Un color no.',
    intro: 'MaKo cruza tus anuncios, tu pipeline y tu cobranza y te da la salud real de tu negocio en un <strong>semáforo, en vivo</strong>. Verde, avanza. Rojo, algo importante necesita tu atención hoy.',
    points: [
      'No te muestra veinte gráficos: <strong>te dice cuál problema atacar primero</strong> y te lleva justo a donde se arregla.',
      'Y no te suelta. Si hay algo en rojo, <strong>MaKo te insiste por WhatsApp hasta que lo resuelves</strong>.',
    ],
  },
  {
    slug: 'experimentos',
    name: 'Experimentos',
    icon: [
      'M9 3l6 0',
      'M10 9l4 0',
      'M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6',
    ],
    hook: 'Ningún gurú sabe qué funciona en TU negocio. Un experimento sí.',
    intro: 'Nadie puede prometerte qué va a funcionar en tu funnel; <em>eso solo lo dice tu mercado</em>. En vez de decidir con el estómago, le das a MaKo tu hipótesis y él <strong>lanza el experimento y lo mide día a día</strong>.',
    points: [
      'Dale una lectura de tu negocio y <strong>varios agentes de IA leen todo</strong> (Meta, anuncios ganadores, llamadas, CRM), cruzan la data y te devuelven un plan concreto: qué probar y qué hacer.',
      'Cada experimento deja <strong>un aprendizaje real y verificado</strong> en tu negocio. Dejas de repetir lo que "debería" funcionar y haces lo que a ti te funciona.',
    ],
    nota: 'En construcción — la base de medición (A/B de VSL y métricas diarias) ya corre.',
  },
  {
    slug: 'prioridades',
    name: 'Prioridades — El Perro Guardián',
    icon: [
      'M3.5 5.5l1.5 1.5l2.5 -2.5',
      'M3.5 11.5l1.5 1.5l2.5 -2.5',
      'M3.5 17.5l1.5 1.5l2.5 -2.5',
      'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0',
    ],
    hook: 'No te dice qué está mal. Te dice qué hacer hoy, en orden.',
    intro: 'El problema no es que no sepas qué hacer. Es que <em>todo parece urgente</em> y terminas eligiendo lo fácil o lo que menos miedo te da. MaKo corta el ruido: una sola pantalla con <strong>tu objetivo y las 3 tareas que de verdad mueven la aguja</strong>. Lo demás, ni lo mires.',
    points: [
      '<strong>El Perro Guardián.</strong> Un guardián con IA decide tus prioridades, y no por gusto: prioriza <strong>lo que trae dinero más rápido</strong>, pesa impacto contra esfuerzo y compara cada tarea con todas las demás. ¿Quieres subir algo de lugar? Tienes que convencerlo con un argumento real. Y no es complaciente.',
      '<strong>Kanban automatizado.</strong> Tus tareas se cargan solas: de tus experimentos, de tus juntas (MaKo las extrae de la transcripción) y hasta de <strong>un audio de WhatsApp</strong>. Tú hablas; MaKo las crea, las desglosa en subtareas y las prioriza.',
    ],
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    icon: [
      'M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9',
      'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1',
    ],
    hook: 'No es un WhatsApp más. Es un WhatsApp que sabe qué responder.',
    intro: 'Mientras conversas con un lead, MaKo lee su historial y su etapa y te sugiere, <strong>en vivo, qué contestar</strong> para acercarte al cierre. No improvisas: respondes con <em>lo que de verdad cierra</em>.',
    points: [
      'Dos vías en una: la <strong>API oficial</strong> para tus envíos masivos de nutrición (cero riesgo de baneo) y la <strong>no oficial</strong>, sin límites, para tus conversaciones uno a uno con quien está por cerrar.',
      'Crea plantillas con ayuda de MaKo, escritas para <strong>pasar la aprobación de Meta a la primera</strong>.',
    ],
  },
  {
    slug: 'email',
    name: 'Email Marketing',
    icon: [
      'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z',
      'M3 7l9 6l9 -6',
    ],
    hook: 'Todo tu email marketing, sin salir de MaKo.',
    intro: 'Listas, segmentos, secuencias y reportes: todo lo que esperas de una herramienta de email, <em>con una diferencia</em>. Aquí cada correo está <strong>conectado a tu funnel</strong>, así que sabes cuál te trajo ventas, no solo aperturas.',
    points: [
      'Arma campañas y secuencias en un editor simple, con MaKo <strong>ayudándote a redactar</strong>.',
      'Mide aperturas, clics y <strong>ventas reales, atribuidas a tu pipeline</strong> de punta a punta.',
    ],
    nota: 'En preparación — el riel de cohortes y segmentos ya está; falta conectar el envío.',
  },
  {
    slug: 'mako',
    name: 'MaKo, tu consultor con IA',
    icon: ['M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z'],
    star: true,
    hook: 'No es un chatbot. Es un consultor con tu negocio entero en la cabeza.',
    intro: 'MaKo cruza <strong>tus números en vivo, el criterio de Martín Koncke y el contexto de tu operación</strong>, y te habla en tu idioma: qué mover ahora y por qué. Desde la app o desde tu WhatsApp.',
    points: [
      'Pregúntale lo que sea, o toca su botón sobre cualquier gráfico y recibe <strong>una decisión, no un número más</strong>.',
      'Te avisa lo urgente, te manda tu <strong>reporte semanal</strong> y <strong>aplica los cambios por ti</strong> cuando le das luz verde. Cuanto más te conoce, más afilado te diagnostica.',
    ],
  },

  // ── Features nuevas (2026-07-19): sus cards se inyectan en /vsl y su landing
  //    rica vive en _detalle/features.ts. Acá solo va lo que la CARD necesita. ──
  {
    slug: 'onboarding',
    name: 'Onboarding',
    icon: ['M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3', 'M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3', 'M15 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
    hook: 'Tu primer login ya conoce tu negocio.',
  },
  {
    slug: 'graphics',
    name: 'Graphics',
    icon: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
    hook: 'Gráficos que te dicen qué hacer, no solo qué pasó.',
  },
  {
    slug: 'retro',
    name: 'Retro',
    icon: ['M9 17v-5', 'M12 17v-3', 'M15 17v-1', 'M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z'],
    hook: 'Cruza tus 6 tabs y te da una tesis + la fuga en dólares.',
  },
  {
    slug: 'fase-norte',
    name: 'Fase / Norte',
    icon: ['M8 16l2 -6l6 -2l-2 6l-6 2', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 3l0 2', 'M12 19l0 2', 'M3 12l2 0', 'M19 12l2 0'],
    hook: 'Antes de escalar, MaKo te dice en qué fase estás.',
  },
  {
    slug: 'conocimiento',
    name: 'Conocimiento',
    icon: ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6l0 13', 'M12 6l0 13', 'M21 6l0 13'],
    hook: 'Tu método adentro de la IA, no genéricos de ChatGPT.',
  },
  {
    slug: 'integraciones',
    name: 'Integraciones',
    icon: ['M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.977a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.977a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z', 'M15 9h.01'],
    hook: 'Tus llaves, tu embudo y tu saldo de IA, a la vista.',
  },
  {
    slug: 'equipo',
    name: 'Equipo',
    icon: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
    hook: 'Cada rol ve exactamente su herramienta. Nada más.',
  },
  {
    slug: 'perfil-reportes',
    name: 'Reportes',
    icon: ['M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
    hook: 'Tu dashboard te habla por WhatsApp cuando urge.',
  },
];

export const SHOWCASE_BY_SLUG: Record<string, ShowcaseFeature> = Object.fromEntries(
  SHOWCASE.map((f) => [f.slug, f]),
);
