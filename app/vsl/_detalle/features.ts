// =============================================================================
// Contenido de las páginas de detalle por funcionalidad (/vsl/<slug>).
// =============================================================================
// Carpeta privada (_detalle): NO genera ruta. La consumen los page.tsx de cada
// slug. Mantiene el mismo lenguaje visual y de copy que la landing /vsl
// (Geist, azul #2F6FED, headline punchy + problema→solución + bullets + CTA),
// pero acá la descripción es MUCHO más detallada que en la card de la landing.
//
// NO importa nada de ./Landing, ./landing-html ni ./content para no acoplarse a
// archivos que otra sesión está editando. Es 100% autocontenido.

export type FeatureGroup = {
  title: string;
  bullets: string[];
  // PLACEHOLDER: ruta de captura para esta capacidad (ej '/vsl-assets/crm-captura.png').
  // Si queda vacío, se muestra un recuadro placeholder con el título como caption.
  img?: string;
};

export type Feature = {
  slug: string;
  name: string; // eyebrow (nombre de la funcionalidad)
  icon: string[]; // paths SVG (viewBox 0 0 24 24, stroke currentColor)
  headline: string; // titular punchy
  lead: string; // párrafo de apertura (admite <strong>/<em>)
  groups: FeatureGroup[]; // bloques de capacidades (bullets admiten <strong>)
  conecta?: string[]; // chips de integraciones
  quote?: string; // frase-ejemplo de salida del producto
  nota?: string; // estado honesto (en activación / en construcción)
  // PLACEHOLDER: demo/captura del hero (ej '/vsl-assets/crm-demo.png' o un .mp4).
  // Si queda vacío, se muestra un recuadro placeholder 16:9.
  heroImg?: string;
  metaTitle: string;
  metaDesc: string;
};

// Testimonios (placeholder): cuando esté vacío, las páginas muestran tarjetas
// placeholder para que Martín las complete. Reemplazar por testimonios reales.
export type Testimonio = { quote: string; titular: string; nombre: string; rol: string; foto?: string };
export const TESTIMONIOS: Testimonio[] = [];

// Íconos Tabler (outline) — set verificado a mano por funcionalidad.
const ICON: Record<string, string[]> = {
  funnel: [
    'M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z',
  ],
  crm: [
    'M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z',
    'M10 16h6', 'M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 8h3', 'M4 12h3', 'M4 16h3',
  ],
  api: [
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
    'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4',
  ],
  ads: [
    'M18 8a3 3 0 0 1 0 6',
    'M10 8v11a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-5',
    'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8',
  ],
  script: [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
    'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0',
  ],
  closing: [
    'M4 14v-3a8 8 0 1 1 16 0v3',
    'M18 19a2 2 0 0 1 -2 2h-3a1 1 0 0 1 -1 -1',
    'M20 15a2 2 0 0 0 -2 -2h-1a1 1 0 0 0 -1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 0 2 -2z',
    'M4 15a2 2 0 0 1 2 -2h1a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-1a2 2 0 0 1 -2 -2z',
  ],
  seguimiento: [
    'M10 14l11 -11',
    'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5',
  ],
  cobranza: [
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1',
    'M12 6v2', 'M12 16v2',
  ],
  contrato: [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
    'M9 15l2 2l4 -4',
  ],
  customer: [
    'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
    'M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25',
    'M12.5 15.5l2 2', 'M15 13l2 2',
  ],
  semaforo: [
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M7 12a5 5 0 0 1 5 -5', 'M13.41 10.59l2.59 -2.59',
    'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  ],
  experimentos: [
    'M9 3l6 0', 'M10 9l4 0',
    'M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6',
  ],
  prioridades: [
    'M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5',
    'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0',
  ],
  whatsapp: [
    'M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9',
    'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1',
  ],
  email: [
    'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z',
    'M3 7l9 6l9 -6',
  ],
  mako: [
    'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z',
  ],
};

export const FEATURE_ORDER = [
  'funnel', 'crm', 'api', 'ads', 'script', 'closing', 'seguimiento',
  'cobranza', 'contrato', 'customer', 'semaforo', 'experimentos',
  'prioridades', 'whatsapp', 'email', 'mako',
];

export const FEATURES: Record<string, Feature> = {
  funnel: {
    slug: 'funnel',
    name: "Tu funnel en un solo lugar",
    icon: ICON.funnel,
    headline: "Configurás cómo avanza tu lead una vez. MaKo te arma el resto del embudo solo.",
    lead: "El embudo real de un VSL Funnel no es <em>Lead → R1 → R2 → cierre</em>. Es eso <strong>más</strong> las tres nutriciones de No-Show por reunión, la de No-Paga, la reactivación de fríos y la ventana de preparación pre-R2 — todo lo que nadie quiere modelar a mano y que en Miro se desactualiza a la semana. En <strong>MaKo</strong> vos editás solo la fila del pipeline activo y el resto del embudo <em>se deriva solo</em> según el tipo de cada etapa. Y esa misma config se convierte en tu tablero CRM, en las opciones de \"Datos sin marcar\", en tu onboarding y en el contexto que lee MaKo.",
    groups: [
      {
        title: "Editás una banda, el sistema deriva las otras dos",
        bullets: [
          "Trabajás <strong>solo sobre la fila \"Activo\"</strong>: nombrás cada etapa, le ponés tipo (entrada, reunión, grupo, pago, cierre o paso) y la ordenás. Agregás y quitás con un clic.",
          "La <strong>banda de Nutrición negativa</strong> — No-Show de R1, No-Show de R2, No-Paga, reactivación de fríos — <em>se genera sola</em> a partir del tipo de cada etapa que pusiste. No la dibujás: la derivás.",
          "La <strong>banda de Descartado</strong> es fija e igual para todos los funnels, así no reinventás las salidas en cada negocio.",
          "Es un embudo <em>lineal ordenado</em>, no un editor de grafo libre: no arrastrás flechas arbitrarias, las transiciones se generan por tipo. Menos decisiones, cero embudo huérfano.",
        ],
      },
      {
        title: "El mapa te dice quién dispara cada paso",
        bullets: [
          "Arriba del editor hay un <strong>mapa SVG</strong> del embudo completo con ruteo ortogonal de flechas por canales — de un vistazo ves entradas, reuniones, nutriciones y salidas.",
          "Cada transición muestra su disparador: <strong>⚡ automático hoy</strong>, <strong>◐ automatizable por MaKo</strong> o <strong>✋ requiere que marques el resultado</strong>. Sabés exactamente qué corre solo y qué todavía es tuyo.",
          "Pasás el mouse sobre una etapa y el mapa <strong>resalta sus transiciones entrantes y salientes</strong> y atenúa el resto — leés el flujo real de ese punto sin ruido.",
          "Hoy están cableados de verdad dos disparadores: <strong>Formulario</strong> (Meta instant forms) y <strong>Agenda</strong> (Calendly). Pago, asistencia y tiempo son automatizables, todavía por marcado.",
        ],
      },
      {
        title: "Plantilla VSL+Webinar lista para arrancar",
        bullets: [
          "Cuatro plantillas aplicables desde un modal con confirmación: <strong>High-Ticket, Simple, Directa y VSL</strong>. Elegís una y reemplaza tu pipeline entero.",
          "La plantilla <strong>VSL+Webinar trae el grupo de WhatsApp incluido</strong> como etapa de tipo grupo — la logística que a mano siempre queda a medias.",
          "El <strong>wizard de onboarding también puede setear el funnel desde plantilla</strong> del lado del servidor, no solo la tab: el cliente nuevo arranca con un embudo real, no una hoja en blanco.",
          "Cambiás lo que quieras encima de la plantilla; sigue siendo tu embudo, no un molde cerrado.",
        ],
      },
      {
        title: "Una config, fuente de verdad de todo el proceso comercial",
        bullets: [
          "El funnel vive en <strong>una fila por workspace</strong> (funnel_config: pipeline + suppressed). La misma config alimenta el <strong>Kanban del CRM</strong>, las opciones de <strong>\"Datos sin marcar\"</strong>, el onboarding y el contexto que lee MaKo en su prompt.",
          "No es un diagrama que se desactualiza: es el <strong>embudo ejecutable</strong>. Tocás una etapa acá y se mueve el tablero del equipo.",
          "Guarda solo en el fondo, con <strong>toast de 5 segundos y botón Deshacer</strong>. No hay botón guardar que se te olvide apretar.",
          "MaKo lee tu funnel como contexto: cuando te sugiere una nutrición o interpreta una señal, habla <em>en los términos de tu embudo</em>, no de uno genérico.",
        ],
      },
    ],
    conecta: ["Supabase", "Calendly", "Meta Ads / instant forms", "Fathom", "MaKo (Anthropic)"],
    quote: "Modelás cómo avanza tu lead una vez; el resto del embudo — y tu tablero CRM — se arman solos.",
    nota: "Vivo y en producción: el editor edita, deriva y persiste por workspace, y ya alimenta CRM, Datos sin marcar, onboarding y MaKo. En activación (no lo prometemos como automático todavía): el motor de Automatizaciones de MaKo (T1-T6) que MUEVE leads solo corre en modo observación / dry-run — calcula los movimientos pero no toca nada hasta pr…",
    metaTitle: "Funnel MaKo: editá tu pipeline y el embudo se deriva solo",
    metaDesc: "Editás solo el pipeline activo y MaKo deriva las nutriciones, el No-Show y las salidas. La misma config alimenta tu CRM, el onboarding y el contexto de MaKo. Plantilla VSL+Webinar lista.",
  },

  crm: {
    slug: 'crm',
    name: "CRM Automatizado",
    icon: ICON.crm,
    headline: "Tu pipeline se mueve solo. Vos solo confirmás con un click.",
    lead: "En high-ticket con VSL funnel el pipeline no se rompe por mala estrategia: se pudre por <strong>olvido humano</strong>. Nadie marca el No Show, el lead que no agendó se enfría sin nutrir, la nutrición vencida queda en limbo. <strong>MaKo mira Fathom, Calendly y WhatsApp por vos</strong> y mueve cada lead al lugar correcto del funnel, dejándote un <em>diff de una línea</em> para confirmar o deshacer. Es el único CRM que cierra el loop entre la reunión de ventas grabada y la etapa del funnel, con un revert quirúrgico que te deja dormir con la automatización prendida.",
    groups: [
      {
        title: "Cuatro reglas que mueven el lead sin que arrastres una sola tarjeta",
        bullets: [
          "<strong>Asistencia y No Show contra Fathom (T1):</strong> a las <strong>3 horas exactas</strong> del horario de Calendly, MaKo busca la grabación de la venta en Fathom. Si aparece, marca asistió y adjunta el link de la llamada; si no, la manda a No Show R1/R2. El match prioriza el tipo de reunión que Claude dedujo leyendo la llamada, después la venta más cercana (±4 días) a la agenda.",
          "<strong>Reactivación con umbral caliente-vs-frío (T2):</strong> el que no agendó a los <strong>2 días</strong> pasa a <em>Nutrición - No Agenda</em> (sigue caliente, invitalo a agendar); a los <strong>7 días</strong> sin agendar va directo a Reactivación. Nunca confunde recién-llegado con frío.",
          "<strong>Nutrición vencida resuelta leyendo el chat (T3):</strong> cuando vence una <em>Nutrición - Manual</em>, MaKo consulta Chatwoot por teléfono. Si el lead escribió mensajes reales lo clasifica como No responde; si no escribió nada, no toca nada y te pide decidir.",
          "<strong>Reactivación de fríos (T6):</strong> los No responde / Perdido enfriados a los <strong>30 días</strong> vuelven a entrar en juego. Todos los umbrales viven en un solo objeto, listos para volverse configurables por funnel.",
        ],
      },
      {
        title: "Apply-then-confirm: aplica de verdad, pero con red de deshacer",
        bullets: [
          "No es una cola de aprobación que te frena: el cambio fuerte <strong>se aplica al instante</strong> (el lead se mueve solo) pero deja una confirmación con su patch de revert exacto.",
          "Al entrar a Leads, un <strong>modal bloqueante y no cerrable</strong> te muestra el diff <em>antes → después</em> de cada campo que MaKo tocó. Confirmás o deshacés, campo por campo.",
          "<strong>Deshacer es quirúrgico:</strong> restaura estado del lead, etapa del pipeline y motivo de pérdida, y quita <strong>solo el link de Fathom que agregó MaKo</strong> sin pisar los que sumaron otros flujos.",
          "Si el registro de la confirmación fallara después de aplicar el cambio, MaKo <strong>compensa deshaciendo su propia mutación</strong>: nunca queda un cambio automático huérfano que no puedas ver ni revertir.",
        ],
      },
      {
        title: "Idempotente, anti-loop y respetuoso de tu criterio",
        bullets: [
          "Cada acción tiene una <strong>clave única</strong> (T1:j1, T3, T6…) y antes de aplicar se precargan en una sola query todas las confirmaciones existentes: si <strong>ya rechazaste un No Show, MaKo no te lo vuelve a proponer</strong> aunque la reunión siga en el pasado.",
          "Tope de <strong>25 llamadas externas por corrida</strong> (Fathom/Chatwoot) para no reventar el tiempo del cron; los que quedan afuera se procesan en la próxima pasada, no se pierden.",
          "Un fallo transitorio de Chatwoot <strong>no clasifica ni quema cupo</strong>: la siguiente corrida reintenta.",
          "<strong>Guard anti-carrera:</strong> re-chequea que el lead siga abierto entre plan y aplicación, así uno que ya pasó a Ganado o Perdido por otro camino nunca se reabre a reactivación (y no te corrompe Revenue ni el CAPI).",
        ],
      },
      {
        title: "Insights por lead: Claude cruza 7 fuentes y te da la próxima acción",
        bullets: [
          "Un botón por lead corre Claude sobre <strong>ficha CRM, respuestas de Calendly R1/R2, llamadas ya analizadas en Closing Analyst, chat de WhatsApp, el transcript del anuncio de Meta que lo trajo, tracking de landing/VSL y cobranza</strong>.",
          "Devuelve JSON con <strong>dolor, señales de compra, objeciones (resuelta o pendiente), riesgos y LA próxima acción</strong> concreta.",
          "<strong>Doble gate anti-humo:</strong> si faltan datos de reuniones que podés completar, no genera y te manda al wizard; y no genera sin al menos una llamada analizada. Nunca te inventa un análisis de un lead vacío.",
          "Todo el contenido de terceros va <strong>delimitado como no confiable</strong> contra prompt-injection antes de entrar al prompt.",
        ],
      },
      {
        title: "Requisitos de datos que salen de TU funnel, no de un molde",
        bullets: [
          "Una fuente única acumulativa (stage-requirements) define qué exige cada etapa y alimenta <strong>Kanban, ficha, wizard y el motor</strong> a la vez: un Ganado necesita R1 marcada + calificado + Fathom, R2 marcada, y monto + Deal Details.",
          "Distingue <strong>posible vs imposible</strong>: nunca te pide el Fathom de una reunión futura ni el comportamiento en VSL que todavía no ocurrió.",
          "El nivel, las reuniones y la venta se derivan de la fila <em>Activo</em> de tu funnel: en un funnel de una sola reunión, o sin reunión, <strong>MaKo no te reclama una R2 que no existe</strong>.",
          "Toda acción automática deja rastro con actor <strong>MaKo</strong> en el historial del lead (ej. \"T2: → Nutrición - No Agenda\"), y si el lead no tenía setter, MaKo se autoasigna para que nunca quede huérfano.",
        ],
      },
    ],
    conecta: ["Fathom", "Calendly", "Google Calendar", "Chatwoot (WhatsApp)", "Meta Ads", "Anthropic Claude", "Supabase", "Vercel Cron"],
    quote: "Vos no arrastrás tarjetas. MaKo mira la reunión grabada y mueve el lead; vos solo confirmás con un click.",
    nota: "El motor, el modal bloqueante de confirmación, los Insights y los requisitos por etapa ya corren y son reales. La automatización 100% desatendida (que MaKo mueva tus leads 24/7 sin intervención) está en activación: hoy aplica los cambios en modo confirmado, y el commit automático del cron se prende con el go-live por workspace.",
    metaTitle: "CRM Automatizado para High Ticket | MaKo",
    metaDesc: "MaKo mueve tus leads solos por el funnel high-ticket: detecta No Show contra Fathom, nutre a los que no agendaron y reactiva fríos. Vos confirmás o deshacés con un click.",
  },

  api: {
    slug: 'api',
    name: "La API de Meta, optimizada",
    icon: ICON.api,
    headline: "Meta deja de perseguir el lead barato y empieza a perseguir al que califica y agenda",
    lead: "El pixel del navegador le grita a Meta <em>\"otro formulario lleno\"</em> — y el algoritmo te trae más formularios llenos que nunca contestan. MaKo le manda a Meta las señales que importan <strong>server-side y desde la verdad de tu CRM</strong>: no cuando alguien deja el mail, sino cuando <strong>califica</strong> y cuando <strong>reserva la llamada</strong>. Con identidad hasheada que sobrevive a los bloqueadores de pixel, para que el algoritmo aprenda a buscar compradores reales, no relleno de embudo.",
    groups: [
      {
        title: "CAPI de fondo de embudo, atada al estado real del CRM",
        bullets: [
          "El evento <strong>Lead</strong> no se dispara cuando entra el formulario: se dispara cuando el lead pasa a <strong>calificado=true</strong> en tu CRM.",
          "<strong>QualifiedLead</strong> cuando asistió a la R1 y calificó; <strong>Schedule</strong> cuando reserva la llamada en Calendly. Meta optimiza hacia gente que agenda, no hacia el clic más barato.",
          "Son señales <em>server-side</em> desde la verdad del negocio — no desde el lead crudo del navegador que cualquier bot o curioso puede inflar.",
          "Honestidad: todavía <strong>no mandamos el evento Purchase por CAPI</strong>. Meta se entera del calificado y del agendado, no de la venta cerrada. No te prometemos 'optimización hacia la compra' server-side.",
        ],
      },
      {
        title: "Identidad hasheada que sobrevive al bloqueo de pixel",
        bullets: [
          "Email (lowercase + trim) y teléfono (solo dígitos) viajan como <strong>SHA-256</strong>. Meta recibe la identidad para hacer match, nunca el dato en claro.",
          "El evento Schedule usa un <strong>event_id determinístico</strong> con <code>action_source='website'</code>, listo para deduplicar contra el pixel si dispara el mismo id.",
          "Si el visitante bloquea el pixel del navegador, el evento igual llega por el servidor. La señal no depende de que el browser coopere.",
        ],
      },
      {
        title: "CAPI que jamás rompe tu operación",
        bullets: [
          "<code>sendMetaCAPIEvent</code> <strong>nunca lanza excepción</strong>: si falta el token, la red falla o Meta responde no-200, loguea y sigue.",
          "Tu lead <strong>se guarda igual</strong> aunque Meta esté caído. La venta nunca se cae por un problema de tracking.",
          "Doble guardia try/catch alrededor del disparo, para que ni un bug futuro en esta capa toque el flujo del negocio.",
        ],
      },
      {
        title: "Ingesta diaria de insights, con la retención del VSL por cuartiles",
        bullets: [
          "Trae por anuncio y por día: gasto, CPM, CPC, CTR y leads hacia <code>marketing_metrics_daily</code>.",
          "Extrae la <strong>retención de video por cuartiles</strong> — video 3s, ThruPlay, p25/p50/p75/p100 y segundos promedio vistos — para saber <em>en qué segundo se cae el espectador de tu VSL</em>, creativo por creativo.",
          "Cuenta leads sin doble-contar: toma <code>lead</code> del instant form y si no está cae a <code>onsite_conversion.lead_grouped</code>, pero <strong>nunca suma los dos</strong> (es el mismo evento).",
          "Guarda un <strong>snapshot diario de presupuesto por adset</strong> en MXN, porque Meta solo expone el valor actual y no el histórico (los adsets con CBO quedan en NULL).",
        ],
      },
      {
        title: "Lead Ads con doble red: webhook firmado + polling",
        bullets: [
          "Webhook en tiempo real verificado con <strong>HMAC-SHA256</strong> (<code>timingSafeEqual</code>) contra tu app secret. Si la firma no valida, no entra.",
          "Un cron diario <strong>repasa los formularios</strong> de los últimos días (Meta retiene 90) como red de seguridad si el webhook se perdió algo.",
          "Todo deduplicado por <code>meta_lead_id</code>: re-correr no duplica. El mismo motor de polling hace el <strong>backfill histórico</strong> del onboarding (?dias=90).",
          "Cada lead que entra <strong>dispara los avisos y flujos de MaKo</strong> y da de alta el contacto de WhatsApp en Chatwoot — no es solo almacenamiento.",
        ],
      },
      {
        title: "Multi-tenant fail-closed y a prueba de rate-limit",
        bullets: [
          "Credenciales <strong>por workspace (BYOK)</strong>: cada cliente carga las suyas. El webhook resuelve el workspace por <code>page_id</code> y si no mapea <strong>NO ingiere el lead</strong> — jamás cae al dueño de la plataforma.",
          "Ante rate-limit (code 17), <strong>backoff exponencial</strong> 1-2-4-8-16s, hasta 5 intentos. Errores tipados: token vencido (190)→401, rate-limit→429, resto→502.",
          "Enriquece cada creativo eligiendo la <strong>imagen de mayor resolución</strong> disponible (evita el thumbnail crudo de ~64px) más el permalink de IG/FB, en paralelo por chunks de 10 para respetar el límite.",
        ],
      },
    ],
    conecta: ["Meta Graph API v24.0", "Meta Conversions API", "Meta Lead Ads", "Calendly", "Chatwoot", "Supabase", "Vercel Cron"],
    quote: "Que Meta persiga al que agenda, no al que llena formularios.",
    metaTitle: "API de Meta optimizada para High Ticket | CAPI server-side desde tu CRM — MaKo",
    metaDesc: "MaKo conecta la Graph API de Meta con la verdad de tu CRM: manda QualifiedLead y Schedule server-side con identidad hasheada, ingesta insights con retención de VSL por cuartiles y captura leads con webhook firmado + polling. BYOK, multi-tenant, fail-closed.",
  },

  ads: {
    slug: 'ads',
    name: "Ads Manager para VSL Funnel",
    icon: ICON.ads,
    headline: "El único Ads Manager que te muestra, en la misma fila, cuánto CASH cerró cada anuncio",
    lead: "Meta te dice el CPL y las \"conversiones\" del pixel. Ninguno de esos números te dice si <em>vendiste</em>. MaKo replica el Ads Manager de Meta dentro del dashboard y le agrega la columna que falta: <strong>los cierres y el cash real de tu CRM, por anuncio</strong>. Pausás por ROAS de caja, no por CPL vanidoso — y cuando querés escalar, MaKo ya sabe cuál fue tu creativo ganador por ventas y te lo propone replicar, con el árbol completo armado y en PAUSA hasta que vos apretés activar.",
    groups: [
      {
        title: "La tabla que Meta no te da: estado en vivo + rendimiento + CRM en una sola fila",
        bullets: [
          "Cruza <strong>tres fuentes por anuncio</strong>: estado de entrega en vivo de Meta (activo, en aprendizaje, en revisión, rechazado, pausado), rendimiento del rango (gasto, CPL, CTR, agendas) y <strong>cierres + cash reales del CRM</strong>. El cash cerrado por anuncio no lo muestra ningún Ads Manager nativo.",
          "El cash no sale de una estimación del pixel: se une por <strong>meta_ad_id</strong> contra los leads que quedaron en 'ganado', sumando el total cobrado. Es plata confirmada, no 'valor de conversión'.",
          "Jerarquía real <strong>Campañas → Conjuntos → Anuncios</strong>, columnas ordenables y configurables (se guardan en tu navegador), primera columna fija al hacer scroll y multiselección para operar en lote.",
          "Distingue leads directos de <em>onsite_conversion.lead_grouped</em> para no doble-contar, e ingesta las métricas de retención de video por cuartil (3s, thruplay, p25/p50/p75/p100).",
        ],
      },
      {
        title: "Escribe de verdad contra Meta, desde la celda",
        bullets: [
          "<strong>Pausar/activar, cambiar presupuesto, renombrar y borrar</strong> directo contra el Graph API — CBO en la campaña, ABO en el conjunto. No es una vista de solo lectura.",
          "El renombrado se <strong>propaga en el acto</strong> a tus leads y a las métricas diarias, para que no te quede el nombre viejo colgado en ningún reporte.",
          "Maneja el patrón traicionero de Meta: errores que llegan con <strong>HTTP 200</strong>. MaKo mira el cuerpo de la respuesta, nunca el status, así un fallo no pasa como éxito.",
          "<strong>Renombrado masivo con IA sobre tu plantilla</strong>: vos definís el formato (ej. '{nnn}. {objetivo} / {ángulo} - {mes} / {año}'), MaKo solo EXTRAE el valor de cada variable mirando nombre, jerarquía y fecha; la plantilla arma el nombre — formato exacto garantizado.",
        ],
      },
      {
        title: "Crear campañas con MaKo: del funnel al árbol publicado, siempre en PAUSA",
        bullets: [
          "MaKo recibe un brief real de tu negocio —<strong>etapas del funnel, perfil de cliente, CPL/CAC/ROAS de los últimos 30 días, tus anuncios ganadores para replicar y el método de adquisición</strong>— y devuelve un CampaignSpec editable: objetivo, CBO/ABO, targeting, creativos y copy.",
          "Arma el <strong>árbol completo campaña → conjunto → creativo → anuncio</strong> creado siempre en PAUSED, con rollback best-effort si algo falla a mitad de camino. Nada sale al aire sin que vos lo actives.",
          "También <strong>agregás un conjunto o un anuncio a una campaña que ya existe</strong>: hereda el optimization_goal y la conversión (pixel/evento) del conjunto vivo, así el nuevo optimiza por lo mismo sin re-pedirte pixel.",
          "Cablea lo que Meta necesita para publicar de verdad: <strong>cuenta de Instagram conectada</strong> (si no, solo entrega en Facebook), eventos ACTIVOS del pixel, intereses resueltos a ids reales y soporte de formularios instantáneos (lead ads).",
        ],
      },
      {
        title: "Tracking, retargeting y reparación de anuncios sin salir de la app",
        bullets: [
          "<strong>UTMs automáticos en cada anuncio nuevo</strong>: se inyectan las macros {{campaign.name}}/{{ad.name}}/{{adset.name}}, así utm_source/medium/campaign/content se rellenan solos en cada clic — y es lo que después empalma la identificación del lead con el funnel.",
          "<strong>Públicos de retargeting</strong> (engagement de Facebook/Instagram, video o pixel por evento) con ventana de retención configurable, sin ir a Meta.",
          "Editor de segmentación <strong>no destructivo</strong>: como el POST reemplaza el targeting entero, MaKo trae el objeto crudo de Meta y superpone solo lo que tocás — no te borra geo por ciudad, idiomas, behaviors ni exclusiones.",
          "<strong>Reparar un anuncio rechazado editando el texto</strong>: en Meta el creativo es inmutable, así que MaKo crea uno nuevo reusando el mismo video/imagen, cambia el copy y re-apunta el anuncio (re-dispara la revisión). No rompe casos delicados: Advantage+, CTA de WhatsApp/Messenger o posts reutilizados los deriva a Meta.",
        ],
      },
      {
        title: "MaKo mira tus creativos y aprende de ellos",
        bullets: [
          "Un cron diario baja el mp4 de cada anuncio y lo <strong>transcribe con Whisper</strong> (guarda transcript, secciones, idioma y duración), o analiza el thumbnail si no hay video. Es lo que alimenta el análisis de creativos y el copy alineado.",
          "<strong>Análisis visual con gpt-4o</strong>: MaKo mira las miniaturas y devuelve descripción + ángulo de cada una, para preguntarte mejor en el wizard y escribir copy pegado al creativo.",
          "Snapshotea el <strong>presupuesto diario de cada conjunto</strong>: Meta solo expone el valor actual, sin histórico — el snapshot diario ES la única serie de presupuesto que vas a tener.",
          "El copy que propone sale en <strong>español mexicano</strong>, listo para el mercado, no un borrador genérico que hay que rehacer.",
        ],
      },
    ],
    conecta: ["Meta Ads (Graph API)", "MaKo · Claude", "OpenAI gpt-4o visión", "OpenAI Whisper", "Supabase", "CRM interno"],
    quote: "Dejá de pausar por CPL. Pausá por la plata que entró.",
    nota: "Hoy corre sobre la cuenta y página de Meta del dueño del workspace (Fase 1): administrás TUS campañas, todavía no las de cada cliente por separado. La creación de campañas está cableada de punta a punta pero sus permisos de escritura contra cuentas nuevas aún se están validando en vivo.",
    metaTitle: "Ads Manager para VSL Funnel | MaKo",
    metaDesc: "El único Ads Manager que muestra el cash cerrado de tu CRM por cada anuncio. Pausás, activás, cambiás presupuesto y creás campañas con MaKo contra Meta — sin salir del dashboard.",
  },

  script: {
    slug: 'script',
    name: "Script Analyst",
    icon: ICON.script,
    headline: "No te dice qué anuncio gana. Te dice en qué línea del guion se te va la gente.",
    lead: "Sabés que un video ad rinde y otro no, pero <em>no por qué</em>. Script Analyst lee el guion de cada anuncio de Meta con Claude Opus, lo parte en bloques y le superpone tu curva de retención real: ves el segundo exacto donde el scroll frena, dónde cae la audiencia antes del CTA y qué ángulo te agenda por cada $1.000. Y antes de gastar un peso en producir, <strong>pegás un guion nuevo y te dice si se parece a lo que ya te cierra o si repite tu ángulo saturado</strong> — todo medido contra el perfil real de tu cuenta, no contra benchmarks de internet.",
    groups: [
      {
        title: "El guion partido en bloques, con la retención encima",
        bullets: [
          "MaKo segmenta el transcript en <strong>3 a 7 beats tipados</strong> (gancho, contexto, problema, mecanismo, prueba, objeción, recordatorio, oferta, CTA) y estima el segundo de arranque de cada uno.",
          "Reconstruye tu <strong>curva de retención desde los cuartiles de Meta</strong> (p25/p50/p75/p100 sobre los plays de 3s) y la interpola bloque por bloque, marcando la caída más fuerte con un <em>Aquí se va la mayor parte de los views</em>.",
          "Cuando los cuartiles vienen en cero pero hubo reproducciones, cae al <strong>hold rate como proxy</strong> en vez de pintarte un 0% falso.",
          "Nota honesta: Meta no da la curva segundo a segundo por API; se reconstruye de 4 cuartiles y los tiempos de cada beat los <em>estima</em> la IA (~2,5 palabras/seg). La alineación es aproximada, no un cronómetro exacto.",
        ],
      },
      {
        title: "Cruce guion × Meta × CRM, sin trampa de fechas",
        bullets: [
          "Cada guion se juzga por su <strong>histórico completo</strong>: agrega spend, hook rate, retención por cuartiles, frecuencia y agendas de Meta sobre todo el acumulado del ad_id, no un rango elegido a dedo.",
          "Le suma los <strong>cierres reales de tu CRM</strong>: cuenta los leads en estado <em>ganado</em> atribuidos a ese anuncio, así un guion no se mide solo por agendas sino por plata cerrada.",
          "Lo cuantitativo <strong>nunca se cachea</strong>: se recalcula en cada render, no queda stale.",
          "Un guion solo aparece si tiene señal (leads, agendas o spend) y métricas de Meta; el ruido sin datos no ensucia la vista.",
        ],
      },
      {
        title: "Patrones ganadores calculados en código, no inventados por IA",
        bullets: [
          "<strong>Plata quemada:</strong> te dice cuántos dólares tiraste en guiones con 0 agendas y cuáles pausar ya (no es falta de muestra, no convierten).",
          "<strong>Gancho sin cuerpo:</strong> detecta los guiones que frenan el scroll pero pierden a la gente antes del CTA — el problema es el medio, no la entrada.",
          "<strong>Escalá esto:</strong> lista los guiones que ya frenan, retienen, agendan y tienen frecuencia sana (<2,4) — tus candidatos a subir presupuesto hoy.",
          "Además: sub-testeo (guiones con <$10 o <3 días), ángulo saturado (>60% del pool), fatiga por frecuencia ≥2,4, el ángulo más eficiente en <strong>juntas por cada $1.000</strong> y el patrón dashboard que agenda más. Todo determinístico sobre los guiones confiables (≥8k impresiones).",
        ],
      },
      {
        title: "Valorá un guion ANTES de producirlo",
        bullets: [
          "Pegás un guion que todavía no corrió y MaKo lo compara contra el <strong>perfil real de tu cuenta</strong>: distribución de ángulos, ángulo saturado, eficiencia de agendas por $1k, tags que agendan, hook rate por tipo de gancho, tus ejemplares top y tu anti-ejemplo que quemó plata.",
          "Devuelve un <strong>veredicto claro</strong> — escalar-candidato, mejorar-gancho, reescribir-cuerpo, repensar-ángulo o promesa-pero-validar — con rangos estimados de hook rate y retención.",
          "Te arma un <strong>plan de validación</strong>: presupuesto, días mínimos, impresiones objetivo (~8.000) y un guion de control contra el cual medir.",
          "Sin humo: la valoración es explícitamente <em>una hipótesis</em>. El guion no tiene datos todavía, así que MaKo no te vende resultados como hechos — te dice a qué se parece y cómo probarlo barato.",
        ],
      },
      {
        title: "Tuyo, corregible y siempre al día",
        bullets: [
          "Los <strong>vocabularios de ángulos y avatares son editables por cliente</strong>: alimentan los chips, filtros y el cuadrante de la UI y también el prompt de Claude. Los avatares arrancan vacíos hasta que los definís vos.",
          "Corregís el ángulo o el avatar de un anuncio a mano y ese <strong>override sobrevive al re-análisis</strong>: se guarda aparte y la IA no te lo vuelve a pisar al re-sincronizar.",
          "<strong>Sync incremental diario</strong> (cron 16:00, tras transcribir los ads a las 14:00): saltea lo ya analizado para no re-gastar Claude, reintenta los que fallaron y se autocompleta corrida a corrida.",
          "Cada análisis y cada guion nuevo valorado <strong>quedan guardados y navegables</strong>, con re-análisis manual de un anuncio cuando lo necesites.",
        ],
      },
    ],
    conecta: ["Meta Ads", "CRM propio (leads → cierres)", "Claude Opus", "Transcripción de video ads", "Supabase", "Vercel Cron"],
    quote: "Dejá de adivinar por qué gana un anuncio: mirá el bloque del guion donde se te cae la gente.",
    metaTitle: "Script Analyst — auditá el guion de tus video ads de Meta | MaKo",
    metaDesc: "MaKo lee el guion de cada video ad, lo parte en bloques y le superpone tu retención real de Meta para mostrarte dónde se cae la audiencia. Cruza guion, métricas y cierres de tu CRM, y valora guiones nuevos contra el perfil real de tu cuenta antes de gastar.",
  },

  closing: {
    slug: 'closing',
    name: "Closing Analyst",
    icon: ICON.closing,
    headline: "Tus grabaciones de Fathom saben por qué perdés cierres. MaKo te lo dice.",
    lead: "Tenés cientos de horas de llamadas de venta en Fathom mezcladas con sesiones de coaching de clientes que ya cerraste — y nadie las revisa porque nadie tiene tiempo de mirarlas ni de taggear cuál es cuál. <strong>Closing Analyst separa automáticamente las llamadas de venta reales (R1 diagnóstico / R2 propuesta) de la entrega de servicio</strong>, las puntúa con SPIN + ejecución citando el transcript con el segundo exacto, y sobre todo te dice <em>cuál dimensión decide tus cierres</em> y qué closer flojea en qué. Es review de llamadas de cierre que <strong>se auto-alimenta de tu CRM</strong>.",
    groups: [
      {
        title: "Separa venta de entrega de servicio, sola",
        bullets: [
          "Un <strong>triage barato sin IA</strong> descarta antes de gastar Claude: internas del equipo, tests y demos (menos de 4 min o título \"test/prueba\") y entrega de servicio nombrada explícitamente (\"SERVICIO:\", \"COACHING:\", weeklies, Scaling Up). Solo las candidatas reales llegan al análisis.",
          "Claude es el <strong>árbitro final venta-vs-entrega usando el estado del lead como pista fuerte</strong>: un lead ya <em>ganado</em> con cierre anterior a la llamada se lee como coaching, no venta — aunque el título no lo diga.",
          "Las sesiones de servicio se cuentan aparte y <strong>se excluyen del score</strong>, para que el coaching de clientes activos no ensucie tus métricas de cierre.",
          "El match llamada↔lead es por el email del invitado externo de calendario o el share_url ya guardado en la ficha — sin taggear nada a mano.",
        ],
      },
      {
        title: "Score SPIN + ejecución con evidencia citada",
        bullets: [
          "<strong>7 dimensiones 0-10</strong>: Situación, Problema, Implicación, Necesidad (SPIN) + Propuesta, Objeciones y CTA (ejecución). Cada nota viene con <strong>una cita textual del transcript</strong> y su timestamp real.",
          "El transcript se le pasa a Claude ya con <strong>segundos precomputados ([123s · 2:03])</strong>, así cada cita apunta al momento exacto y no a un párrafo aproximado.",
          "Además de las notas: fortalezas y debilidades, objeciones marcadas como manejadas o no, <strong>6 a 12 momentos clave y 8 a 20 anotaciones</strong> sobre el transcript.",
          "Solo puntúa llamadas con transcript real (status <em>analizada</em>); las que no lo tienen quedan pendientes y <strong>se excluyen de los promedios</strong> para no meter ceros falsos.",
        ],
      },
      {
        title: "El hallazgo de la semana: qué dimensión decide tus cierres",
        bullets: [
          "Un <strong>dumbbell</strong> mide el gap por dimensión entre llamadas ganadas y perdidas, ordenado por brecha, y titula la de mayor gap: <em>\"X decide tus cierres\"</em>. Deja de adivinar dónde se te caen los deals.",
          "<strong>Embudo R1 → R2 → ganada</strong> con el porcentaje de fuga en cada paso, más la tendencia mensual del score con su delta.",
          "<strong>Ranking de closers</strong> con el punto débil de cada uno — quién flojea en objeciones, quién no cierra el CTA.",
          "Todo se computa sobre las ventas reales, no sobre el ruido de las sesiones de servicio.",
        ],
      },
      {
        title: "Grabación embebida y transcript anotado",
        bullets: [
          "<strong>Player de Fathom embebido</strong> (thumbnail + iframe) dentro del dashboard, con el transcript pintado línea por línea resaltando las anotaciones en verde y rojo, matcheadas por cercanía temporal (±30s).",
          "Cada timestamp, momento u objeción <strong>abre la grabación de Fathom posicionada en ese segundo</strong> en una pestaña nueva — salto directo al clip que importa.",
          "Podés <strong>pisar los scores por dimensión</strong> (recalcula el promedio), corregir el outcome y el resumen a mano, o darle a MaKo un comentario libre para que <strong>re-corra el análisis completo</strong> incorporándolo.",
          "Cada cambio queda en un <strong>historial con score antes → después</strong>, autor y tipo; un re-análisis nunca borra el rastro.",
        ],
      },
      {
        title: "Se llena sola, todos los días",
        bullets: [
          "Un <strong>cron diario a las 14:30</strong> drena el backlog por workspace: barre la metadata de Fathom paginada, saltea lo ya resuelto, guarda los descartables al instante y auto-adjunta la grabación al lead.",
          "El sync es <strong>por lotes con presupuesto</strong> (hasta 6 llamadas nuevas por corrida, ~150s): prioriza títulos de venta y matches de lead, y manda los reintentos al fondo de la fila.",
          "Desde la <strong>ficha del lead</strong>, el botón de Insights busca sus llamadas por email o por el share_url cargado, <strong>re-linkea análisis existentes sin volver a gastar Claude</strong>, y solo baja el transcript de las que faltan.",
          "Cada grabación se guarda una sola vez (idempotente, 1 fila por recording_id): no se re-analiza ni se duplica.",
        ],
      },
    ],
    conecta: ["Fathom", "Claude (MaKo)", "CRM de leads", "Supabase", "Vercel Cron"],
    quote: "No mires 200 horas de llamadas. MaKo te dice cuál dimensión te está costando los cierres.",
    nota: "Closing Analyst corre punta a punta hoy. Requiere tener Fathom conectado en tu workspace: si no lo está, la tab muestra el panel de activación en vez del análisis. El prompt está afinado para venta consultiva de un programa High Ticket (método SPIN + ejecución) — no es un analizador de ventas genérico para cualquier vertical.",
    metaTitle: "Closing Analyst — Review de llamadas de cierre que se alimenta de tu CRM | MaKo",
    metaDesc: "MaKo ingiere tus grabaciones de Fathom, separa las llamadas de venta de la entrega de servicio usando el estado del lead, las puntúa con SPIN + ejecución citando el transcript, y te dice qué dimensión decide tus cierres y qué closer flojea en qué.",
  },

  seguimiento: {
    slug: 'seguimiento',
    name: "Seguimiento automático",
    icon: ICON.seguimiento,
    headline: "El setter que nunca se olvida de nadie y nunca suena a bot",
    lead: "La venta High Ticket no se cae porque el lead sea malo: se cae en el hueco exacto donde nadie hizo seguimiento. <strong>Vio el VSL pero no agendó, no apareció a la R1, calificó pero no reservó la R2, confirmó pero no pagó.</strong> MaKo inscribe a cada lead en la secuencia de <em>ese</em> momento y le manda el mensaje correcto por email y WhatsApp, escrito en la voz de tu propio negocio, y se calla solo apenas el lead contesta. <strong>Sin que nadie apriete nada.</strong>",
    groups: [
      {
        title: "Dispara por el momento donde se traba la venta, no por \"entró un lead\"",
        bullets: [
          "<strong>13 disparadores mapeados a etapas reales del funnel VSL:</strong> dejó el form sin agendar, vio el VSL al 50%+ sin agendar, agendado sin confirmar, no-show R1, post-R1 sin avanzar, calificado sin R2, no-show R2, post-R2 sin cerrar, confirmado sin pagar, post-pago (bienvenida), reactivación de fríos (30-90d) y último intento (90-365d).",
          "Cada cohorte es una <strong>query distinta sobre el estado real del lead</strong> — <em>fecha_agenda, asistio_j1, calificado, fecha_confirmacion, fecha_primer_pago</em> — no una lista de emails suelta.",
          "Arrancás con <strong>5 secuencias listas al alta</strong> (No agendó 3-toques, No Show R1, No Show R2, No paga aún, Reactivación de fríos). El resto de los disparadores quedan soportados para que crees la secuencia cuando la quieras.",
          "No se pisa lo que ya existe: si ya hay una secuencia para esa cohorte, el seed no la duplica.",
        ],
      },
      {
        title: "El copy lo escribe MaKo en la voz de TU negocio",
        bullets: [
          "MaKo <strong>destila tu voz leyendo las transcripciones literales de tus propios anuncios</strong> más tu perfil de marca, y guarda una guía de voz por workspace.",
          "Genera el copy de cada paso cruzando esa guía con <strong>metodología de copywriting (RAG) y ejemplos swipe</strong> — reescribe solo el texto, nunca el canal, el orden ni los tiempos.",
          "<strong>Vos aprobás el preview antes de que se persista</strong> nada: MaKo propone, el que decide sos vos.",
          "No termina sonando a plantilla robótica: termina sonando a como hablás vos en tus ads.",
        ],
      },
      {
        title: "Se pausa sola y guarda el número de WhatsApp",
        bullets: [
          "<strong>Apenas el lead responde por WhatsApp, la nutrición se corta sola:</strong> el webhook de Chatwoot marca todas sus inscripciones activas como \"respondió\" y borra el próximo envío. Igual por el número no-oficial (Evolution).",
          "Si el que responde estaba en frío, además lo <strong>re-etiqueta a Nutrición - Manual</strong> y le pasa la posta a los flujos — no le seguimos escribiendo a alguien que ya arrancó la conversación.",
          "<strong>Rate-limiting anti-baneo por workspace:</strong> tope de 40 mensajes cada 24h, 6 por corrida, uno solo por lead cada 20h, y únicamente entre las 9 y 21 hora de México.",
          "Guard cross-canal: el conteo mira email y WhatsApp juntos, con backoff (4h/24h) en fallos para que una fila fallada no monopolice la cola. <em>No es un blaster de volumen.</em>",
        ],
      },
      {
        title: "WhatsApp que respeta a Meta y separa caliente de cliente",
        bullets: [
          "<strong>El WhatsApp oficial no envía hasta que Meta aprueba la plantilla:</strong> MaKo convierte el copy en una plantilla Meta-safe (saca links, deja variables del catálogo, CTA que invita a responder) y la manda a aprobar. Si no puede confirmar el \"approved\", falla cerrado — nada de phantom-sends.",
          "<strong>Dos números con reglas distintas por temperatura:</strong> a un lead caliente por el número de empresa nunca se le envía automático — se crea un borrador que el setter manda con un clic. A clientes que ya pagaron, envío automático con anti-ban.",
          "Respeta bloqueos de contacto y no apila borradores sobre el mismo lead.",
          "Idempotente: no reenvía la plantilla a Meta si ya está aprobada o pendiente, y re-lee los pasos frescos antes de bindear para no pisar una edición concurrente.",
        ],
      },
      {
        title: "Un motor auditable que corre solo todos los días",
        bullets: [
          "<strong>Un cron corre cada hora (15-23 UTC) e itera todos los workspaces activos:</strong> por corrida inscribe leads nuevos en cada secuencia y procesa los envíos vencidos. Si un workspace falla, se aísla del resto.",
          "<strong>Cada intento deja una fila auditable</strong> en el log — estado (enviado / simulado / omitido / borrador / fallo), canal, destino y el proveedor_id de Resend — de donde salen los conteos de inscriptos y enviados por secuencia en la UI.",
          "Máquina de estados real: cada inscripción avanza paso a paso, y las <strong>condiciones terminales (opt-out, sin email) cierran la inscripción</strong> en vez de reintentar para siempre.",
          "<strong>Prendés email y/o WhatsApp desde la UI</strong>, sin tocar Vercel. Modos de testing incluidos: preview sin escribir (dry), commit forzado marcado \"simulado\", e ignorar ventana horaria.",
        ],
      },
    ],
    conecta: ["Resend (email + unsubscribe one-click)", "Chatwoot (WhatsApp oficial + pausa por respuesta)", "Meta / WhatsApp Business (aprobación de plantillas)", "Evolution (WhatsApp no oficial por QR)", "MaKo / Claude (voz + copy)", "Vercel Cron", "Supabase (multi-tenant)", "Tracking de retención del VSL"],
    quote: "No le vuelvas a escribir a un lead que ya te contestó, y no dejes de escribirle al que se está por caer.",
    nota: "Está vivo y cableado end-to-end, pero el envío real viene apagado por diseño: cada workspace prende email y/o WhatsApp desde la UI (un workspace sin canales no manda ni inscribe). El WhatsApp oficial no entrega hasta que Meta aprueba la plantilla, y el remitente de email necesita dominio verificado.",
    metaTitle: "Seguimiento automático de leads High Ticket | MaKo",
    metaDesc: "MaKo hace el seguimiento de cada lead según su etapa exacta del funnel VSL: vio el VSL sin agendar, no-show, calificó sin reservar, confirmó sin pagar. Email y WhatsApp, en la voz de tu negocio, con anti-baneo y pausa automática al responder.",
  },

  cobranza: {
    slug: 'cobranza',
    name: "Cobranza y Revenue real",
    icon: ICON.cobranza,
    headline: "Firmaste $80k. ¿Cuánto entró de verdad este mes?",
    lead: "Vendés High Ticket en planes de pago y todo termina apilado en un solo número: \"facturado\". Ese número te <em>miente</em>: mezcla lo que firmaste con lo que todavía no cobraste. MaKo modela cada deal cerrado como un plan de cuotas real y de ahí saca las <strong>tres cifras que un negocio High Ticket suele confundir</strong> — Sold, Cash Collected y Outstanding — más una lista concreta de <strong>a quién cobrarle hoy</strong>.",
    groups: [
      {
        title: "Tres cifras que siempre cuadran, no un total suelto",
        bullets: [
          "<strong>Sold Revenue</strong>: la suma de lo firmado en el período — cierres con fecha dentro del rango. Es tu producción comercial, no tu caja.",
          "<strong>Cash Collected</strong>: lo que <em>realmente entró</em> por fecha de pago, incluyendo cuotas de clientes que cerraste meses atrás. Por fin ves el ingreso del mes, no la ilusión del cierre.",
          "<strong>Outstanding</strong>: todo lo que falta cobrar del pipeline (Σ de cuotas con pagado=false). Lo que ya es tuyo pero todavía no está en la cuenta.",
          "Las tres salen de la <strong>misma tabla de cuotas</strong>, así que siempre cierran entre sí. Cada KPI es clickeable y se abre con el desglose lead por lead.",
        ],
      },
      {
        title: "A quién cobrarle hoy — una lista, no una intuición",
        bullets: [
          "Un renglón por lead con cuota pendiente, <strong>ordenado por vencimiento más cercano arriba</strong>: quién debe, cuánto, y para cuándo.",
          "Las cuotas <strong>vencidas se marcan URGENTE en rojo con un punto parpadeante</strong>; las que vencen en ≤5 días quedan en ámbar. Sabés a quién timbrar sin abrir un Excel.",
          "<strong>Marcás cobrado con un click</strong> desde la misma tabla, y aparece un toast con botón <em>Deshacer</em> de 5 segundos por si le pegaste al lead equivocado.",
          "La suma del pendiente de la tabla iguala exacto tu Outstanding total. Nada se te escapa entre las cuotas.",
        ],
      },
      {
        title: "El plan de cuotas se arma como cobrás de verdad",
        bullets: [
          "Generás el plan de tres formas: <strong>uniforme</strong> (inicial + N cuotas espaciadas por tu día de pago desde el cierre), <strong>manual</strong> (cada cuota con su monto y fecha propios), o derivado del contrato.",
          "Regenerar un plan <strong>nunca toca las cuotas ya pagadas</strong>: el histórico queda intacto y solo se reacomodan las pendientes.",
          "Cada vez que marcás o desmarcás un pago, MaKo <strong>recalcula solo el total cobrado y la fecha del primer pago del lead</strong>, y deja el evento en el Change History ('Pago registrado' / 'Pago desmarcado'). Cero contabilidad a mano.",
          "El día de pago va del 1 al 28 y el plan uniforme cubre hasta inicial + 6 cuotas mensuales.",
        ],
      },
      {
        title: "Subís el comprobante y MaKo llena el registro",
        bullets: [
          "Arrastrás la imagen o el PDF del comprobante y <strong>gpt-4o lee monto, fecha y hora</strong> para prellenarte el pop-up de 'Marcar pagada'. Dejás de tipear datos de una captura de pantalla.",
          "El comprobante queda guardado en el bucket del workspace, atado a la fila de ese pago — con el archivo a la vista cuando alguien pregunte cuándo entró esa cuota.",
          "El OCR <strong>prellena pero nunca marca solo</strong>: confirmás vos, y la action guarda la <strong>fecha y hora reales del ingreso</strong> — no el vencimiento como proxy. Tu Cash Collected refleja el día que de verdad cayó la plata.",
        ],
      },
      {
        title: "La foto del mes y las alertas donde ya estás mirando",
        bullets: [
          "Un gráfico de <strong>18 meses que contrasta Sold vs Cash Collected vs gasto en Meta</strong>, con lectura de MaKo encima: ves si estás firmando más de lo que cobrás, o gastando en ads sin caja que lo sostenga.",
          "En la Vista General, las cuotas vencidas y las que caen dentro de los próximos días aparecen como <strong>alertas accionables</strong> — URGENTE en rojo con días de atraso, vigilar en ámbar — sin que las tengas que ir a buscar.",
          "El filtro de fecha de la cobranza es <strong>forward-looking</strong>: mira hacia adelante por vencimiento. Con 'Máximo' ves todo el pipeline de cuotas futuras; con un rango, solo lo que vence en la ventana.",
        ],
      },
    ],
    conecta: ["Supabase", "OpenAI gpt-4o (OCR)", "Meta Ads", "Calendly"],
    quote: "Firmaste no es lo mismo que cobraste. MaKo te dice cuánto entró de verdad este mes y a quién le tocás timbre hoy.",
    nota: "Live y cableado de punta a punta. Lo único que MaKo todavía NO hace es la cobranza automatizada al cliente: las cuotas vencidas y por vencer se te muestran como alertas accionables dentro de la app (/general y la tabla \"A quién cobrarle\"), pero el recordatorio por WhatsApp o email todavía lo mandás vos.",
    metaTitle: "Cobranza y Revenue real | Sold, Cash Collected y Outstanding — MaKo",
    metaDesc: "MaKo separa lo que firmaste (Sold), lo que de verdad entró este mes (Cash Collected) y lo que falta cobrar (Outstanding), con una lista operativa de a quién cobrarle hoy y OCR del comprobante. Cobranza real, no un número de vanity.",
  },

  contrato: {
    slug: 'contrato',
    name: "Tu contrato, leído por IA",
    icon: ICON.contrato,
    headline: "Soltá el PDF firmado. MaKo arma la cobranza y la ficha del deal sin que teclees.",
    lead: "Cerrás en la llamada, el cliente firma, y ahí empieza el trabajo aburrido: <strong>re-teclear el plan de cuotas, los datos fiscales, el servicio, la promesa y las obligaciones en el CRM</strong>. MaKo lee el contrato firmado — <strong>un PDF o una foto sacada con el celu</strong> — y arma el borrador entero del deal en español simple, resumido como se lo explicarías al dueño, no en jerga legal. <em>Nada se guarda hasta que apretás \"Guardar cambios\", y nunca pisa lo que ya cargaste a mano.</em>",
    groups: [
      {
        title: "Lee el contrato entero, no solo las cuotas",
        bullets: [
          "De un solo pase MaKo extrae el <strong>plan de cuotas</strong> (monto por monto) y las cuatro secciones del <strong>Deal Details</strong>: datos fiscales del cliente (razón social, ID fiscal, domicilio, correo), el servicio (qué es, fechas, frecuencia, modalidad, sesiones), la promesa con su garantía y las obligaciones de ambas partes.",
          "Las <strong>obligaciones</strong> salen como listas de 3 a 6 compromisos, en frases de hasta 10 palabras. El prompt le prohíbe copiar cláusulas legales textuales: <em>resume la idea, no transcribe el contrato</em>.",
          "Si el contrato está en otra moneda, lo <strong>convierte a USD</strong> (todo el CRM trabaja en USD) y deja escrito en una nota qué tasa aproximada usó, ej. 'convertido de MXN a USD a ~17 MXN/USD'.",
          "Salida determinista: modelo gpt-4o, <strong>temperature 0</strong> y respuesta en JSON estricto para que el parseo no se rompa.",
        ],
      },
      {
        title: "PDF o foto — MaKo detecta qué le diste",
        bullets: [
          "Si subís un <strong>PDF</strong>, lo manda a OpenAI como documento. Si es una <strong>foto o captura</strong>, la manda como visión con detalle alto. Vos no elegís nada: MaKo detecta el tipo de archivo.",
          "El <strong>botón 'Completar con IA'</strong> relee el contrato que ya está guardado en el lead — sin volver a subir nada — y rellena lo que falte al vuelo.",
          "Cuando un lead ganado tiene vacía cualquier sección clave (servicio, promesa, fiscal u obligaciones), la ficha te muestra el aviso y el CTA para completar con IA en un clic.",
        ],
      },
      {
        title: "Rellena solo lo vacío — nunca pisa tu trabajo",
        bullets: [
          "MaKo <strong>escribe únicamente los campos vacíos</strong> del borrador. Lo que cargaste a mano queda intacto, aunque MaKo hubiera puesto otra cosa.",
          "Las cuotas extraídas <strong>solo se aplican si el lead no tiene cuotas sin pagar ya cargadas</strong>: no mezcla ni pisa un plan que ya armaste.",
          "Al terminar te muestra la <strong>lista de qué rellenó</strong> y qué <strong>defaults asumió</strong> (ej. modalidad 'Online' o frecuencia '1 vez por semana' cuando el contrato no lo dice), para que revises antes de guardar.",
          "<strong>Nada se persiste sin tu confirmación.</strong> La extracción llena el borrador; hasta que no apretás 'Guardar cambios', el lead no cambia.",
        ],
      },
      {
        title: "Cableado al cash del dashboard",
        bullets: [
          "Las cuotas extraídas alimentan el <strong>motor de cobranza</strong>, que es de donde el dashboard calcula el <strong>cash collected</strong>. Guardar las cuotas marca el lead como ganado y cerrado, y refresca las vistas de Comercial y General.",
          "Al reemplazar el plan, <strong>conserva las cuotas ya pagadas</strong> y solo cambia las que faltan cobrar: no te desarma el histórico.",
          "El archivo se guarda al toque en un <strong>bucket privado de Storage</strong>, aislado por workspace. Se previsualiza inline y se descarga con URLs firmadas de corta duración — un contrato de otro cliente nunca se firma ni se filtra.",
        ],
      },
    ],
    conecta: ["OpenAI gpt-4o (visión + documento)", "Supabase Storage privado", "URLs firmadas por workspace", "Motor de cobranza / cash collected", "Prompts editables de MaKo"],
    quote: "Cerraste en la llamada. En vez de re-teclear el contrato, se lo tirás a MaKo y sale el deal armado.",
    nota: "El monto y la fecha de cierre, más el inicio de servicio, hoy los seguís tipeando a mano: la IA los lee pero todavía no los vuelca al borrador (en activación). Las cuotas entran con su monto — que ya alimenta el cash collected — pero las fechas de vencimiento aún se ajustan a mano en algunos casos, así que revisá el semáforo de cobranza d…",
    metaTitle: "Lectura de contratos con IA — MaKo | Del cierre a la cobranza sin teclear",
    metaDesc: "Subí el PDF o la foto del contrato firmado y MaKo extrae el plan de cuotas, los datos fiscales, el servicio, la promesa y las obligaciones al CRM. Solo rellena lo vacío y no guarda nada sin tu OK.",
  },

  customer: {
    slug: 'customer',
    name: "Customer Success",
    icon: ICON.customer,
    headline: "Cerrar es el 30%. Retener y hacer upsell del mismo cliente es el negocio.",
    lead: "Tus llamadas de entrega y coaching están llenas de señales que hoy se pierden: quién está feliz, quién se te está por ir, a quién ofrecerle más. La idea de <strong>Customer Success</strong> es que MaKo escuche <em>esas mismas llamadas</em> que ya grabás con Fathom y te derive salud, riesgo de churn y oportunidades de upsell — <strong>sin montar un equipo de CS</strong>.",
    groups: [
      {
        title: "El cimiento ya está puesto: MaKo separa las llamadas de servicio de las de venta",
        bullets: [
          "Cada transcript de Fathom que ya analizás para venta, MaKo lo clasifica en <strong>venta, entrega de servicio, interna u otro</strong> — así las sesiones con clientes que ya cerraron quedan identificadas sin que muevas un dedo.",
          "Es la <em>misma materia prima</em> que ya se graba: no hay herramienta nueva, ni encuestas NPS, ni un equipo de CS que sostener.",
          "Hoy esas llamadas de servicio quedan detectadas pero <strong>todavía sin analizar en profundidad</strong> — ese es exactamente el motor que estamos construyendo encima.",
        ],
      },
      {
        title: "Health Score por cliente (en construcción)",
        bullets: [
          "Un puntaje de salud por cliente que cruza lo que se dijo en la llamada de coaching o entrega con el <strong>estado real de su cobranza</strong>.",
          "Pensado para que veas de un vistazo quién está enganchado y quién se te está enfriando, antes de que te enteres por el churn.",
          "Sale de leer sentimiento, compromisos y próximos pasos de la sesión — no de rellenar un formulario a mano.",
        ],
      },
      {
        title: "Alerta de churn antes de que se vaya (en construcción)",
        bullets: [
          "La señal que importa no es una sola: es la <strong>combinación de una señal negativa en la llamada + una cuota impaga</strong>. Cuando las dos coinciden, MaKo te avisa.",
          "El objetivo es cazar la baja mientras todavía la podés revertir, no hacerte la autopsia después.",
        ],
      },
      {
        title: "Upsell y renovación de lo que el cliente YA dijo (en construcción)",
        bullets: [
          "Para High Ticket, el cierre es apenas una parte del LTV: la <strong>renovación y el upsell del mismo cliente</strong> es donde queda la plata.",
          "MaKo va a detectar la oportunidad en las propias palabras del cliente durante el servicio, no en tu intuición.",
          "Más el tracking del onboarding y los compromisos asumidos <strong>de ambos lados</strong>.",
        ],
      },
    ],
    conecta: ["Fathom", "Claude (Anthropic)", "Cobranza del lead", "Supabase"],
    quote: "CS sin equipo de CS: la renovación se escucha en la misma llamada donde ya estás entregando.",
    nota: "En construcción. Lo que YA corre: MaKo clasifica cada llamada de Fathom y separa las de entrega de servicio de las de venta. El Health Score, la alerta de churn (señal negativa + cuota impaga) y la detección de upsell/renovación todavía no están activos — son el próximo motor que armamos encima de ese cimiento.",
    metaTitle: "Customer Success — retené y hacé upsell con las llamadas que ya grabás | MaKo",
    metaDesc: "MaKo escuchará tus sesiones de servicio en Fathom para darte un health score, avisarte del churn cuando se junten señal negativa y cuota impaga, y detectar upsell. Hoy en construcción: ya clasifica y separa las llamadas de servicio de las de venta.",
  },

  semaforo: {
    slug: 'semaforo',
    name: "Semáforo del Negocio",
    icon: ICON.semaforo,
    headline: "Una luz te dice si el negocio se está incendiando — y en qué cliente o anuncio exacto",
    lead: "Vos no vivís mirando dashboards de KPIs: querés saber <strong>qué se está prendiendo fuego ahora mismo y cuánto te cuesta en cierres</strong>. El Semáforo colapsa la salud de tu negocio en <strong>una sola luz roja/ámbar/verde</strong> con un veredicto en castellano — y cada foco linkea al lead, a la cuota o al anuncio que lo resuelve. <em>No es un número muerto: es el panel de lo que le sangra plata a un funnel de tráfico pago antes de que sea tarde.</em>",
    groups: [
      {
        title: "Una luz, un veredicto, y los focos ordenados por urgencia",
        bullets: [
          "Prende <strong>una sola luz</strong>: roja si hay al menos un foco urgente, ámbar si hay algo que vigilar, verde si no hay focos — con un título humano ('Hay algo urgente que atender' / 'El negocio está sano').",
          "Chips que cuentan <strong>urgente / vigilar / en orden</strong>, y todas las alertas ordenadas rojo→ámbar→verde para que lo que sangra plata quede arriba.",
          "Cada foco es clickeable: las cuotas abren un <strong>desglose por lead</strong> (nombre · monto · vence · días de atraso · botón Editar lead), el resto linkea directo a /comercial, /marketing o /marketing/salud.",
        ],
      },
      {
        title: "Los cuatro modos de falla que un funnel de VSL no ve hasta que es tarde",
        bullets: [
          "<strong>Cuenta de Meta que dejó de entregar en silencio</strong>: detecta el caso traicionero donde las campañas figuran ACTIVAS pero la cuenta no corre (saldo impago, deshabilitada, pending-closure). Es salud <em>live</em> — 1 GET a la Graph API, no un dato cacheado del día.",
          "<strong>Creativo fatigado con umbral concreto</strong>: marca un adset solo si la frecuencia 7d supera 3.5 <em>y</em> el CPL 7d es más de 1.5× el CPL 28d — un cruce de dos señales, no una métrica suelta — y lo muestra con el nombre del conjunto y ambos CPL.",
          "<strong>Deals que se enfrían entre R1 y R2</strong>: si el promedio de días del tramo supera el umbral con al menos 3 casos, avisa en ámbar 'los deals se enfrían'.",
          "<strong>Cobranza vencida</strong>: cuotas vencidas → rojo 'cobrar URGENTE' con el monto total; cuotas por vencer → ámbar.",
        ],
      },
      {
        title: "Lee el sistema de venta, no solo el gasto",
        bullets: [
          "Mide la <strong>tasa de cierre en cohortes maduras</strong> (leads que ya tuvieron tiempo de cerrar): ≥30% pinta verde 'sistema de venta sano', <20% pinta rojo 'califican pero no cierran'.",
          "Solo dispara con <strong>al menos 3 cohortes limpias</strong>, para que un mal día no te encienda una alarma falsa.",
          "Cuando Meta no expone su Opportunity Score por la Graph API, <strong>MaKo deriva las recomendaciones</strong> de las señales que sí llegan: cuenta que no entrega, anuncios rechazados, conjuntos en aprendizaje limitado, cuenta verde pero 0 anuncios corriendo.",
        ],
      },
      {
        title: "El mismo semáforo, cada mañana en tu WhatsApp",
        bullets: [
          "Tres reportes por cron: <strong>diario</strong> (digest matutino ~7:00), <strong>horario</strong> (solo te escribe si hay algo urgente — no te spamea con 'todo bien') y <strong>semanal</strong> los lunes.",
          "Cada reporte respeta tus <strong>preferencias</strong>: activás o apagás cada uno, elegís canales (WhatsApp / email) y qué secciones incluir (semáforo / ads / wins / pendientes).",
          "El reporte <strong>siempre queda en el feed in-app</strong>; según prefs sale por email (Resend) y WhatsApp (Chatwoot). Si la ventana de 24h de WhatsApp está cerrada, queda en cola y se reintenta al reabrirse — el cron diario abre la ventana validando la plantilla aprobada.",
        ],
      },
      {
        title: "Memoria de qué se rompió y cuándo",
        bullets: [
          "Cada corrida horaria <strong>abre un incidente</strong> cuando Meta pasa a rojo/ámbar, lo mantiene mientras persiste y lo <strong>cierra con su hora de fin</strong> cuando vuelve a verde.",
          "El registro guarda inicio→fin por servicio, así ves <strong>cuánto tiempo estuvo caída</strong> la entrega, no solo que hoy está mal.",
          "Reconcilia con <em>scoping defensivo</em>: la corrida de Meta toca solo los incidentes de Meta, sin cerrar por error los de otros servicios.",
        ],
      },
    ],
    conecta: ["Meta Ads (Graph API — salud de cuenta live)", "WhatsApp vía Chatwoot", "Email vía Resend", "Vercel Cron (diario · horario · semanal)", "Supabase (feed + incidentes)", "MaKo / IA para la voz de los avisos"],
    quote: "Una luz, un veredicto en castellano, y un click al lead o al anuncio exacto que se está incendiando.",
    nota: "El semáforo vigila un set fijo de señales de alto impacto (salud de cuenta Meta, cuotas vencidas y por vencer, tramo R1→R2, fatiga de adsets y tasa de cierre madura), no los ~48 casos del catálogo de avisos de MaKo — la mayoría de ese catálogo todavía no dispara.",
    metaTitle: "Semáforo del Negocio | MaKo — qué se incendia y cuánto te cuesta en cierres",
    metaDesc: "Una luz roja/ámbar/verde con veredicto en castellano: cuenta de Meta que dejó de entregar, creativo fatigado, deals que se enfrían y cobranza vencida — cada foco linkea al lead o al anuncio, más un WhatsApp cada mañana con lo urgente.",
  },

  experimentos: {
    slug: 'experimentos',
    name: "Experimentos",
    icon: ICON.experimentos,
    headline: "Dejá de discutir hooks en reuniones. Convertí cada \"¿y si...?\" en una apuesta con baseline medido.",
    lead: "Todo equipo de High Ticket vive la misma pelea: <strong>opiniones sobre creativos, filtros de formulario y hooks de VSL que nadie puede zanjar con datos</strong>. En Experimentos escribís una hipótesis en una frase y MaKo la fija en una métrica medible, una ventana en días y un baseline comparable. Corre en vivo contra el CAC y el costo-por-agenda <em>reales de tu cuenta</em>, y al cerrar dicta un veredicto con el número adentro. Es la <strong>única superficie del panel donde el sistema declara verdades</strong> — en el resto MaKo sugiere abrir un experimento en vez de opinar.",
    groups: [
      {
        title: "De una frase a un experimento configurado",
        bullets: [
          "Escribís <strong>\"si filtro más el formulario, baja el costo por agenda\"</strong> y MaKo (Claude, effort:high) elige la métrica, la dirección de éxito (subir/bajar), la ventana en días y el objetivo, con el racional de por qué.",
          "<strong>No crea nada hasta que confirmás</strong>: el modal te deja editar título, el cambio a medir, la ventana y el objetivo antes de arrancar.",
          "MaKo solo puede elegir de un <strong>catálogo cerrado de 17 métricas</strong> ancladas al funnel real (cpl, cp_form, cpa, cac, ctr, tasa_agenda, agendamientos, cierres, spend_usd...). No inventa métricas: es el único termómetro válido.",
        ],
      },
      {
        title: "Baseline honesto, medición en vivo, cero cache",
        bullets: [
          "El baseline <strong>no es fijo</strong>: se recalcula con la misma cantidad de días que ya lleva el experimento. Una ventana parcial de 3 de 14 días se compara contra 3 días previos, no contra 14 completos — manzanas con manzanas.",
          "El valor se mide <strong>en cada carga contra el dato real</strong>, nunca cacheado, partido en hasta 21 tramos contiguos que cubren toda la ventana sin huecos.",
          "La card te muestra <strong>baseline→actual, delta%, semáforo va-bien/en-contra, sparkline y barra de progreso día X de N</strong>.",
        ],
      },
      {
        title: "El cierre dicta una verdad, no una opinión",
        bullets: [
          "Al cerrar, MaKo lee baseline vs resultado + la serie y dicta veredicto: <strong>validada, refutada o no concluyente</strong>, más un aprendizaje de 1-2 frases con el número clave adentro (de cuánto a cuánto).",
          "Si Claude falla, <strong>cae a no_concluyente</strong> con un aprendizaje numérico mínimo generado por código — nunca te quedás sin cierre.",
          "El veredicto es un juicio sobre el delta medido en <em>tu</em> cuenta, respaldado por tu CAC y tu costo-por-agenda — no un benchmark genérico de gurú.",
        ],
      },
      {
        title: "Cada verdad validada alimenta a MaKo en todo el panel",
        bullets: [
          "Las <strong>verdades validadas se inyectan en el system prompt global de MaKo</strong>: cita lo ya probado en tu negocio en cualquier tab, en vez de repetir consejos genéricos.",
          "Para lo que <strong>todavía no probaste</strong>, MaKo no afirma: te sugiere abrir un experimento. Es el mecanismo que separa dato de opinión en toda la app.",
          "La tab <strong>Conclusions</strong> junta las verdades cerradas con su número; los experimentos en curso quedan visibles como conocimiento vivo del negocio.",
        ],
      },
      {
        title: "Ciclo de vida completo, aislado por workspace",
        bullets: [
          "Estados <strong>propuesto, activo, cerrado, descartado</strong>: guardás una idea sin arrancar, la iniciás después (mide baseline en ese momento), la descartás sin concluir o la eliminás.",
          "La <strong>Retro auto-crea experimentos</strong> desde sus hallazgos y encadena 1-3 tareas del to-do necesarias para poder correrlo, linkeadas al experimento.",
          "Todo persistido <strong>por-workspace</strong> vía getTenantDb, y los 6 prompts de MaKo (sugerir, idear, cerrar) son <strong>editables desde /configuraciones</strong> con {{slots}}, sin tocar código.",
        ],
      },
    ],
    conecta: ["Meta Ads", "YouTube", "Panda VSL", "Calendly", "Supabase", "Anthropic Claude (effort:high)"],
    quote: "Cada \"¿y si...?\" se vuelve una apuesta con baseline medido y un veredicto con el número adentro. Se acabó ganar la discusión por hablar más fuerte.",
    nota: "Requiere Meta conectado: sin métricas de Meta la tab muestra un panel de activación en vez de experimentos. Métricas de VSL dependen de YouTube configurado, y agendas/cierres de que estén pobladas las fechas del funnel (Calendly / fecha_cierre).",
    metaTitle: "Experimentos de marketing con baseline medido | MaKo",
    metaDesc: "Escribí una hipótesis en una frase y MaKo la vuelve un experimento medible contra el CAC y el costo-por-agenda reales de tu cuenta. Baseline comparable, medición en vivo y un veredicto con el número adentro. La única superficie donde el sistema declara verdades.",
  },

  prioridades: {
    slug: 'prioridades',
    name: "Prioridades — El Perro Guardián",
    icon: ICON.prioridades,
    headline: "La única IA que te dice que NO cuando querés priorizar la tarea equivocada",
    lead: "Cerrar High Ticket no se muere por falta de tareas: se muere por <strong>parálisis por análisis</strong> y por la trampa de pulir el funnel un día más en vez de salir a vender. El Perro Guardián de MaKo puntúa TODO tu plan con una sola regla — <strong>más plata, más rápido, más fácil</strong> — te ordena en un único Objetivo Principal y tres jugadas del día, y cuando querés subir una tarea por cariño, <em>te lo discute y gana</em>.",
    groups: [
      {
        title: "Puntúa todo el plan por vos, con impacto vs. esfuerzo",
        bullets: [
          "Cada tarea recibe un <strong>IMPACTO 1-100</strong> (cuánta plata mueve y qué tan rápido) y un <strong>ESFUERZO 1-100</strong> (menos es mejor), y un score que los combina. El quick win —alto impacto, bajo esfuerzo— sube solo a la cima.",
          "Vos <strong>no fijás los números</strong>: los asigna el guardián comparando cada tarea contra el resto ('¿esta trae más plata, más rápido y más fácil que aquella?') y te deja la razón del puntaje en 1-2 frases.",
          "La columna —<strong>Alta / Media / Baja / A futuro</strong>— se deriva directo del score. No arrastrás tarjetas: el orden es una consecuencia del criterio, no de tu estado de ánimo del día.",
          "Corre sobre <strong>Claude con effort alto</strong> (hasta 8000 tokens por corrida) para que la comparación sea de verdad razonada, no un ordenamiento por keywords.",
        ],
      },
      {
        title: "No es complaciente: te discute y tiene la última palabra",
        bullets: [
          "Podés abrir un debate sobre cualquier tarea o proyecto. El guardián devuelve veredicto <strong>acepta</strong> (diste un argumento con datos), <strong>ajusta</strong> (algo de razón tenés) o <strong>rechaza</strong> (es puro cariño por la tarea, sin números).",
          "'<em>Me parece importante</em>' no es un argumento: la <strong>carga de la prueba es tuya</strong>. Si subís una tarea por apego, te nombra el sesgo en la cara ('eso suena a que te encariñaste con la tarea').",
          "Cuando te echás atrás —'no, ahora que lo veo…'— sale un mensaje de consolación <strong>pre-escrito, sin gastar un token</strong>: 'urgente no es lo mismo que importante… si de verdad prende fuego, va a volver a aparecer sola'.",
          "Es un socio que <strong>protege tu foco discutiéndote</strong>, no un to-do list que te obedece.",
        ],
      },
      {
        title: "Te fuerza a una pirámide sana y un solo Objetivo Principal",
        bullets: [
          "El modelo tiende a inflar y meter todo en Alta. Un post-procesado determinístico <strong>curva los scores por banda</strong>: ~15% Alta, ~25% Media, ~30% Baja, ~30% A futuro. Casi todo cae abajo, como debe ser.",
          "Los proyectos se reparten en toda la escala 1-100 <strong>sin empatar</strong>, para que siempre haya <strong>un único Objetivo Principal</strong> — no cinco prioridades número uno.",
          "La vista Prioridades pinta ese objetivo grande a la izquierda y sus <strong>3 jugadas del día numeradas 1-2-3</strong>, elegidas automáticamente (las 3 de mayor score del proyecto top). Vos no las elegís: las ganan.",
          "Hay <strong>bypass de emergencia</strong>: una tarea con score ≥ 90 (Meta te suspendió la cuenta, se prende fuego algo) entra a Alta aunque no sea del objetivo principal.",
        ],
      },
      {
        title: "Guardián del borrado y anti-duplicados",
        bullets: [
          "Borrar es irreversible, así que el guardián decide por vos: si tu motivo es débil —'ya no me interesa', 'lo hago después'— <strong>conserva la tarea y te sugiere bajarle la prioridad</strong> en vez de borrarla. Solo aprueba borrar si ya no aplica, está duplicada o fue un error.",
          "Detecta <strong>semánticamente</strong> tareas que son el MISMO trabajo aunque estén escritas distinto, para no llenar el board de repetidos.",
          "Cuando MaKo saca tareas de una <strong>reunión de Fathom</strong>, cruza cada candidata contra tu plan actual y decide 'nueva' o '<strong>enriquece</strong>' una tarjeta que ya existe — enriquece en vez de duplicar.",
        ],
      },
      {
        title: "Trabaja sola, en background, sin quemar tokens",
        bullets: [
          "No hay botón de 're-priorizar'. Se dispara <strong>2.5s después de un cambio estructural</strong> (agregás, quitás o completás una tarea), nunca al entrar a la tab ni al refrescar la página.",
          "Una <strong>firma del plan</strong> que ignora los scores evita que se re-dispare a sí misma, y un dedup por firma evita re-puntuar lo mismo dos veces.",
          "<strong>Estabilidad</strong>: cada tarea viaja con su score previo y el guardián lo mantiene salvo razón concreta (venció un deadline, cambió el avance, entró o salió algo que altera la comparación). Ante la duda, mantiene — para que el board no baile en cada corrida.",
          "MaKo abre solo un <strong>nudge por tareas sin deadline</strong> cuando hay algo importante (score ≥ 50) sin fecha, y te obliga a poner checklist en toda tarea Alta antes de darla por planificada.",
        ],
      },
    ],
    conecta: ["Claude (effort alto)", "Fathom", "Supabase (multi-tenant)", "Prompts editables", "Historial de gasto de IA"],
    quote: "Tu plan no necesita otra lista de pendientes. Necesita alguien que te diga que NO.",
    metaTitle: "Prioridades: la IA que te dice que NO | MaKo — El Perro Guardián",
    metaDesc: "El Perro Guardián de MaKo puntúa todo tu plan con la regla 'más plata, más rápido, más fácil', te discute cuando priorizás por cariño y te deja un solo Objetivo Principal con 3 jugadas del día. Corre solo, en background, sobre Claude.",
  },

  whatsapp: {
    slug: 'whatsapp',
    name: "WhatsApp",
    icon: ICON.whatsapp,
    headline: "Reactivá al lead frío por WhatsApp, con el reloj de las 24h a la vista y MaKo escribiendo el mensaje",
    lead: "En High Ticket con VSL Funnel la plata está en los que <strong>vieron el video o agendaron y se enfriaron</strong> — y contestan por WhatsApp, no por mail. El problema es que WhatsApp tiene reglas: <em>fuera de la ventana de 24h de Meta solo pasan plantillas aprobadas</em>, y si querés un segundo número para el toque caliente arriesgás el baneo. Esta bandeja resuelve las dos cosas: te muestra <strong>al minuto cuánto te queda para escribir gratis</strong>, y arriba del hilo vive MaKo, que lee la conversación real más la etapa del funnel y te deja 2-3 mensajes de reactivación listos para <em>Usar</em>.",
    groups: [
      {
        title: "Dos números en una sola bandeja: el oficial y el de empresa",
        bullets: [
          "<strong>Número oficial</strong> por WhatsApp Cloud API (vía Chatwoot) para todo lo que Meta permite, y <strong>número de empresa no oficial</strong> (Evolution API) que vinculás escaneando un QR desde WhatsApp &gt; Dispositivos vinculados.",
          "El inbox <strong>agrupa por persona, no por conversación</strong>: Chatwoot arma una conversación por cada interacción (los recordatorios de n8n generan varias por contacto) y acá se mergean todas en un solo hilo cronológico — un chat por persona.",
          "Cada lead nuevo con teléfono <strong>arranca con su chat ya creado</strong> en el inbox, así el deep-link de la ficha nunca cae en la conversación de otro; y si el alta del contacto falla, <em>nunca</em> rompe el alta del lead.",
          "Cada contacto muestra un <strong>chip con su etapa del funnel</strong> (cliente, por-cobrar, no-show, R2…) con color; filtrás por etapa o por 'solo ventana abierta', y bloqueás/desbloqueás con motivo.",
        ],
      },
      {
        title: "La ventana de 24h de Meta, con contador en vivo",
        bullets: [
          "Detecta si la ventana de servicio de 24h está abierta (<code>can_reply</code> de Chatwoot): <strong>dentro mandás texto libre; fuera, solo plantillas aprobadas</strong>.",
          "<strong>Contador regresivo en pantalla</strong> (Xh Ym) que tickea cada 30 segundos y se pone en rojo cuando quedan menos de 60 minutos o cuando ya venció.",
          "Los mensajes llevan <strong>tildes de estado reales</strong> — enviado, entregado, leído, falló — como en tu teléfono.",
          "Grabás <strong>notas de voz desde el navegador</strong> (con pausa/reanudar y contador) y en el canal oficial se transcodifican a MP3, el único formato que este WABA acepta sin tirar el error 131053 de Meta.",
        ],
      },
      {
        title: "MaKo asesor: lee el hilo real y te escribe la reactivación",
        bullets: [
          "MaKo (Claude) lee <strong>la conversación real + la etapa del funnel + el estado de la ventana</strong> y devuelve un diagnóstico con la etapa detectada y <strong>2-3 sugerencias</strong> con metodología <em>Levanta Muertos</em>.",
          "Cada sugerencia trae su <strong>ángulo</strong> (valor, curiosidad, prueba social, objeción, cierre suave o depuración), su tono, y un guion opcional de <strong>nota de voz de máximo 40 segundos</strong>.",
          "Si la ventana está cerrada, las sugerencias ya vienen <strong>redactadas como plantilla reactivadora</strong> — no como texto libre que Meta bloquearía.",
          "El botón <strong>'Usar' inyecta el mensaje al compositor</strong>: lo revisás, lo ajustás y lo mandás. MaKo también conversa sobre el lead y te redacta plantillas de Meta.",
        ],
      },
      {
        title: "Motor de plantillas de Meta, de punta a punta",
        bullets: [
          "<strong>Validador que predice el veredicto de Meta</strong>: Claude aplica la rúbrica de políticas al borrador y devuelve riesgo ALTO/MEDIO/BAJO, categoría sugerida, hallazgos con código de regla, y una <strong>propuesta ya corregida que aplicás de un click</strong>.",
          "Chequeo por código de que las variables sean <strong>nombradas y con ejemplo</strong> (<code>{{nombre}}</code>, no <code>{{1}}</code>) — como exige la Graph API con <code>parameter_format NAMED</code>.",
          "Ciclo completo contra la Graph API: <strong>redactar, subir media de encabezado</strong> al resumable-upload, enviar a aprobar, listar con su status real, editar, borrar y <strong>reconciliar el motivo de rechazo</strong>.",
          "Las credenciales de Meta (WABA id + token) <strong>se extraen del inbox de Chatwoot</strong> — no te pedimos nada nuevo. El estado de cada plantilla falla-cerrado: el motor de nutrición nunca cuenta como 'enviado' un mensaje de una plantilla que Meta no aprobó.",
        ],
      },
      {
        title: "Canal no oficial: anti-ban de verdad, no un blaster",
        bullets: [
          "<strong>Cola de borradores anti-ban</strong>: a un lead CALIENTE nunca se le dispara automático por el no oficial — se deposita un borrador que el setter manda con 1 clic. El automático directo solo aplica a leads que ya <strong>pagaron</strong> (gateado por <code>fecha_primer_pago</code>).",
          "El envío del borrador hace un <strong>CLAIM atómico</strong> (<code>UPDATE WHERE estado='pendiente'</code>) para que dos setters no manden el mismo mensaje dos veces.",
          "Cada envío por Evolution lleva un <strong>delay proporcional al largo del texto + jitter de ±20%</strong> que muestra 'escribiendo…' / 'grabando audio…' nativo antes de soltar el mensaje; ajustes de instancia que ignoran grupos, no marcan leído automático y no fuerzan 'en línea'.",
          "<strong>Una instancia de Evolution por workspace</strong> con guard estricto: nunca opera sobre la línea del dueño por fallback. Y cuando el 'espejo de mensajes' (webhook) se cae, un diagnóstico clasifica el problema (sin_secret, url_distinta, no_registrado…) y el botón <strong>'Reparar espejo'</strong> re-registra el webhook.",
        ],
      },
    ],
    conecta: ["Chatwoot", "Meta WhatsApp Cloud API", "Evolution API", "Supabase", "Anthropic Claude", "n8n"],
    quote: "El lead frío no se murió: dejó de contestarte. MaKo lee el hilo, mira el reloj de las 24h y te escribe el mensaje que lo revive.",
    nota: "El canal de empresa (no oficial, por QR) usa la API de Evolution/Baileys: conlleva el riesgo de baneo inherente de WhatsApp, que mitigamos con delays humanos y ajustes de instancia pero no eliminamos. Requiere el webhook bien configurado en el deploy; por eso trae el diagnóstico y el 'Reparar espejo'.",
    metaTitle: "WhatsApp para High Ticket — reactivación con MaKo y ventana de 24h | MaKo",
    metaDesc: "Bandeja de WhatsApp de doble canal (oficial + empresa por QR) con contador de la ventana de 24h de Meta, MaKo que escribe la reactivación Levanta Muertos, motor de plantillas contra la Graph API y cola de borradores anti-ban.",
  },

  email: {
    slug: 'email',
    name: "Email Marketing",
    icon: ICON.email,
    headline: "El mismo lead que no se presentó a la R1 recibe el email correcto, solo",
    lead: "Vendés High Ticket con VSL Funnel y hay plata quedándose sobre la mesa: el que vio el VSL y no agendó, el que confirmó y no pagó, el que faltó a la reunión. <strong>MaKo Email Marketing</strong> los mete en secuencias automáticas por su estado exacto en el CRM y te deja disparar broadcasts a segmentos que son etapas reales de tu embudo. El copy lo escribe MaKo en tu voz con el link de agenda ya puesto, <em>sin salir del tablero ni contratar un Mailchimp aparte</em>.",
    groups: [
      {
        title: "Email nativo del embudo, no un ESP pegado con cinta",
        bullets: [
          "<strong>Secuencias que se disparan solas por estado del lead.</strong> El que no se presentó a la R1, el que confirmó sin pagar, el que vio el VSL sin agendar: cada uno entra a su secuencia de email según <em>uno de 14 triggers</em> del funnel (No Show R1/R2, Post pago, Reactivación de frío…), sin que muevas un dedo.",
          "<strong>Broadcasts a segmentos que son etapas reales del CRM.</strong> 6 segmentos calculados por SQL sobre tus leads —activos, No agendaron, Confirmó sin pagar, No Show, post-agenda, Ganados— con el <strong>conteo en vivo</strong> del segmento antes de mandar.",
          "<strong>Cada paso muestra su rendimiento.</strong> Inscriptos y stats de enviados/abiertos/clics por paso de la secuencia, adentro de la misma tab. Sin exportar a otro lado.",
          "<strong>Un mismo email vive como automatización o como envío puntual.</strong> Bajo el capó las secuencias son nutrición single-channel (todos los pasos canal email) con delay en horas; el broadcast es el mismo motor apuntado a un segmento.",
        ],
      },
      {
        title: "MaKo escribe el copy, no vos a las 2am",
        bullets: [
          "<strong>Botón MaKo en cada paso y en cada broadcast.</strong> Claude redacta en la voz de Mauricio Bustos y devuelve <em>asunto + preheader + cuerpo</em> ya armados, listos para revisar.",
          "<strong>Reglas de copy incrustadas, no texto genérico.</strong> Asunto corto (máx ~6 palabras), preheader que no repite el asunto, cuerpo de 2 a 5 párrafos con <strong>un solo CTA</strong> y tu link de Calendly ya puesto adentro.",
          "<strong>Te dice lo que costó.</strong> Cada generación reporta tokens y costo — sabés lo que gastás en IA por email, no una caja negra.",
          "<strong>Prueba a una dirección tuya antes de disparar.</strong> Envío de prueba con prefijo [PRUEBA] a un email puntual, sin tocar el estado del lead ni el CRM.",
        ],
      },
      {
        title: "Sale firmado por tu negocio, con tu dominio",
        bullets: [
          "<strong>El \"De:\" es el negocio del cliente, no la agencia.</strong> El remitente sale del setting del workspace (resend_from), nunca de algo hardcodeado del dueño: los emails de cada cliente van firmados por su propia marca.",
          "<strong>Alta y verificación de dominio propio adentro de la tab.</strong> Das de alta el dominio contra la API de Resend, te devuelve los registros <strong>DKIM/SPF</strong> para el DNS, dispara la verificación, y sólo fija el remitente cuando el dominio figura <em>verified</em> en vivo.",
          "<strong>Anti-spoofing multi-tenant.</strong> Un dominio ya reclamado por otro workspace no se puede adoptar; y el nombre del remitente se sanea contra inyección de headers antes de fijarse.",
          "<strong>Nunca manda desde el sandbox.</strong> Si el remitente sigue en resend.dev, tanto el broadcast como el motor de secuencias abortan sin contar el envío como real.",
        ],
      },
      {
        title: "Entregabilidad y respeto por la bandeja de entrada",
        bullets: [
          "<strong>Baja con token firmado + One-Click RFC 8058.</strong> Cada email lleva link de baja con token HMAC sobre el lead_id (nadie da de baja a otro cambiando el número) y los headers List-Unsubscribe/One-Click que piden Gmail y Outlook.",
          "<strong>Supresión automática de rebotes y quejas.</strong> El webhook firmado de Resend marca aperturas y clics, y ante un <strong>bounce permanente</strong> o una <em>queja de spam</em> pone email_opt_out=true en el lead solo. No le volvés a escribir.",
          "<strong>Guard anti-spam de 20h en los broadcasts.</strong> Antes de enviar, junta los leads contactados por email en las últimas 20h —cruzando nutrición-email y broadcasts— y los saltea, para no pegarle dos veces al mismo. Nunca escribe a un email vacío ni a un opt-out.",
          "<strong>Envío reanudable pensado para listas grandes.</strong> Persiste en chunks de 100, corta a los 240s y retoma en la próxima corrida sin re-enviar; ante un 429 de Resend corta sin registrar el lead para reintentarlo. Tope de 2000 por broadcast.",
        ],
      },
    ],
    conecta: ["Resend", "Claude (MaKo)", "Motor de nutrición", "Calendly", "Cron de Vercel", "Webhook Svix", "CRM / Funnel"],
    quote: "El copy lo escribe MaKo en tu voz, con el link de agenda adentro, y el email sale firmado por tu negocio.",
    nota: "El envío real viene APAGADO por defecto en cada workspace (toggle \"Envío real\"): mientras está off, todo se registra como simulado y no sale nada — lo prendés cuando estás listo. Para entregar a terceros primero verificás tu dominio (DKIM/SPF) desde la misma tab; con el remitente sandbox no llegan.",
    metaTitle: "Email Marketing para High Ticket VSL Funnel | MaKo",
    metaDesc: "Secuencias de email que se disparan solas por el estado del lead en tu CRM y broadcasts a segmentos reales del funnel. El copy lo escribe MaKo, sale desde tu dominio con supresión de rebotes y baja One-Click. Sobre Resend.",
  },

  mako: {
    slug: 'mako',
    name: "MaKo, tu consultor con IA",
    icon: ICON.mako,
    headline: "El consultor que ya sabe en qué etapa está cada lead de tu funnel",
    lead: "Le preguntás a un ChatGPT cualquiera y te contesta en abstracto, porque no sabe nada de <em>tu</em> negocio. <strong>MaKo razona sobre tu operación real</strong>: leyó el historial de WhatsApp de ese lead, sus respuestas de calificación R1/R2, el análisis de la última llamada de ventas y sabe en qué fase está tu negocio. Y te responde con la voz de Martín Koncke, sin humo: <strong>hipótesis cuando ve el dashboard, verdades solo cuando lo validaste en Experimentos</strong>.",
    groups: [
      {
        title: "Contexto real inyectado en cada respuesta",
        bullets: [
          "El system prompt se arma <strong>en vivo y aditivo</strong>: persona editable + núcleo de reglas + perfil del cliente + la <strong>FASE/Norte de tu negocio</strong> + el funnel configurado en /funnel + estado de Experimentos + metodología vía RAG. Cada pieza cae en silencio si falta.",
          "Con tu funnel real a la vista, MaKo razona con <strong>las etapas de tu workspace</strong>, no con un embudo genérico de memoria.",
          "Enmarca lo que ve en el dashboard como <em>hipótesis</em>, nunca como verdad: solo afirma como cerrado lo validado en Experimentos. No promete causa-efecto ni cifras mágicas: es una regla dura del núcleo, no una preferencia.",
        ],
      },
      {
        title: "El Doer: consulta los hechos antes de opinar",
        bullets: [
          "Antes de responder llama a <strong>9 herramientas de lectura</strong> sobre datos reales: buscar_leads, ficha_lead (ficha 360 + respuestas R1/R2), historial_whatsapp, reuniones_lead (Calendly/Google Calendar/Fathom + análisis de Closing), reuniones_recientes, buscar_conocimiento, estado_experimentos, ver_funnel y ver_plan.",
          "Todo pasa por <strong>getTenantDb, aislado a tu workspace</strong>, y es solo lectura: si una tool no lo trae, MaKo <em>dice que no lo tiene</em> en vez de inventar.",
          "Corre en loop tool-use de hasta 8 pasos: encadena varias consultas en un turno para armar la respuesta con datos, no con suposiciones.",
        ],
      },
      {
        title: "'Hola MaKo': te contesta desde el propio grupo de WhatsApp",
        bullets: [
          "Escucha tus grupos vía WhatsApp: lee <strong>texto, transcribe notas de voz (STT), lee imágenes y PDFs nativo</strong> con visión de Claude. Le mandás una captura o un audio y te responde.",
          "<strong>Recuerda la conversación</strong> (últimos 24 turnos), manda 'escribiendo…', acusa recibo al instante cuando cargás algo al plan y parte las respuestas largas en varios mensajes.",
          "Distingue el eco de su propia respuesta (la línea de voz es tu número, así que todo llega como fromMe) para no contestarse a sí mismo. Fuera de la allowlist y sin workspace dueño reconocido, no contesta: <em>fail-closed</em>.",
        ],
      },
      {
        title: "Escribe sobre tu cuenta, pero siempre con tu 'sí' primero",
        bullets: [
          "No ejecuta cambios de una: los <strong>PROPONE</strong> — mover un lead de etapa, activar o pausar nutrición, renombrar/pausar/cambiar presupuesto de una campaña Meta, cargar tareas al plan.",
          "Cada propuesta deja una <strong>acción pendiente con vencimiento de 2 horas</strong>; recién con tu confirmación se ejecuta por callers ya gateados (setPipelineStage, setSecuenciaActiva, metaWrite). Un guard bloquea el auto-confirm en el mismo turno.",
          "Un <strong>router propio elige el modelo por turno</strong> con heurística de costo cero: saludo → Groq barato; dato/acción → Sonnet con tools; razonamiento y copy → Opus. Ante la duda escala, nunca degrada, para no quemar Opus en un 'buenas'.",
        ],
      },
      {
        title: "Modo perro guardián: te lleva la contra",
        bullets: [
          "Puntúa proyectos y tareas <strong>1 a 100 por impacto y esfuerzo</strong> para definir prioridad, y a diferencia de una IA complaciente <strong>puede rechazar tu pedido</strong> y explicarte por qué.",
          "Un post-procesado determinístico <strong>fuerza una pirámide de prioridades y prohíbe empates entre proyectos</strong>, corrigiendo el sesgo del modelo a amontonar todo arriba.",
          "Cruza en una sola pasada las tareas candidatas de una reunión o archivo contra el plan actual y decide por cada una <em>nueva</em> vs <em>enriquece una existente</em>, para no duplicar tarjetas. Debate prioridad a nivel tarea y a nivel proyecto.",
        ],
      },
      {
        title: "Método curado + persona con voz propia",
        bullets: [
          "RAG multi-tenant: el conocimiento se embebe con <strong>OpenAI text-embedding-3-small</strong> y cada búsqueda lee tu workspace <strong>más el método curado de la agencia</strong>, servido read-only a todos. El área de ejemplos (swipe few-shot) se excluye del RAG general para no contaminar.",
          "La voz/persona se edita desde Configuraciones y se <strong>versiona (historial de 30, restaurar, volver al default)</strong>.",
          "El <strong>núcleo de reglas duras vive en código y no se toca</strong>: nunca cerrar con una pregunta, hipótesis y no verdades, no inventar datos, y cerrar siempre proponiendo un experimento para validar.",
        ],
      },
    ],
    conecta: ["Anthropic Claude (Opus / Sonnet)", "Groq", "OpenAI (embeddings + STT)", "Evolution API (WhatsApp)", "Chatwoot", "Meta Marketing API", "Fathom", "Calendly", "Google Calendar", "Supabase"],
    quote: "No es otro ChatGPT: es el consultor que ya leyó el WhatsApp de tu lead, vio la última llamada de ventas y sabe en qué fase está tu negocio.",
    nota: "Matiz honesto: las escrituras a Meta Ads (renombrar, presupuesto, pausar) hoy solo corren desde el workspace principal de la agencia; el resto de las acciones (etapa de lead, nutrición, tareas al plan) ya corre por cliente. Las escrituras con confirmación viven en el canal 'Hola MaKo' de WhatsApp; el Doer web es solo de lectura.",
    metaTitle: "MaKo, tu consultor con IA que conoce tu funnel | MaKo",
    metaDesc: "MaKo es un consultor con IA que razona sobre tu negocio real: sabe la etapa de cada lead, leyó el WhatsApp y las respuestas R1/R2, vio el análisis de la última llamada. Te contesta desde el grupo de WhatsApp y ejecuta acciones solo con tu confirmación.",
  },

};
