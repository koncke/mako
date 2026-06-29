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
  'whatsapp', 'email', 'mako',
];

export const FEATURES: Record<string, Feature> = {
  funnel: {
    slug: 'funnel',
    name: 'Tu funnel en un solo lugar',
    icon: ICON.funnel,
    headline: 'Por primera vez, ves tu negocio completo de un vistazo.',
    lead: 'Tus datos viven en cinco plataformas y juntarlos es un infierno de pestañas. MaKo los une y te muestra la <strong>salud real de tu funnel</strong>, de la primera impresión al contrato.',
    groups: [
      {
        title: 'Todo conectado, sin exportar nada',
        bullets: [
          'Meta Ads, tu landing, el VSL, Calendly, WhatsApp y las llamadas de Fathom — sincronizados solos todos los días.',
          'Cada etapa del embudo con su número real: clics, leads, agendas, asistencias, calificación, cierres y <strong>cash cobrado</strong>.',
          'Si una fuente se cae, MaKo te lo marca en vez de mostrarte un 0% que te haga tomar una mala decisión.',
        ],
      },
      {
        title: 'De métrica a diagnóstico',
        bullets: [
          'No solo ves cómo viene el funnel: ves <strong>dónde se está rompiendo</strong>.',
          'Cada gráfico tiene a MaKo al lado para decirte qué significa y qué hacer.',
          'Comparás contra tu propio mejor mes, no contra promedios de internet.',
        ],
      },
    ],
    conecta: ['Meta Ads', 'Landing', 'VSL (Panda)', 'YouTube', 'Calendly', 'WhatsApp', 'Fathom'],
    quote: 'Donde antes intuías, ahora ves.',
    metaTitle: 'Tu funnel en un solo lugar — MaKo',
    metaDesc: 'Meta, tu landing, el VSL, Calendly, WhatsApp y las llamadas: conectados y con la salud real de tu funnel de un vistazo.',
  },

  crm: {
    slug: 'crm',
    name: 'CRM Automatizado',
    icon: ICON.crm,
    headline: 'El trabajo más aburrido del mundo, hecho solo.',
    lead: 'Actualizar fichas a mano te roba horas y <em>algo siempre se escapa</em>. MaKo <strong>captura cada lead y mantiene su historia al día</strong> sin que toques una tecla.',
    groups: [
      {
        title: 'Captura cada lead, venga de donde venga',
        bullets: [
          'Entra solo desde el instant form de Meta, desde Calendly o desde WhatsApp, y lo <strong>deduplica</strong> por teléfono y email.',
          'Sabe de qué anuncio, campaña y conjunto vino cada lead, con todos sus UTMs.',
          'Guarda las respuestas del formulario de calificación (facturación, equipo, inversión, decisor) sin que las copies.',
        ],
      },
      {
        title: 'Trackea lo que hace antes de comprar',
        bullets: [
          'Cuántas veces volvió a tu landing y <strong>hasta qué % de tu VSL miró</strong>.',
          'Te avisa si agendó SIN ver el VSL, para que prepares la llamada.',
        ],
      },
      {
        title: 'Se mantiene al día solo',
        bullets: [
          'Marca asistencias a R1/R2 y engancha la grabación de la llamada, automático.',
          'Historial de cambios por lead: ves quién movió qué — Calendly, Fathom o vos.',
        ],
      },
    ],
    metaTitle: 'CRM Automatizado — MaKo',
    metaDesc: 'MaKo captura cada lead, lo deduplica, sabe de qué anuncio vino, cuánto del VSL vio y mantiene su ficha al día sin que toques una tecla.',
  },

  api: {
    slug: 'api',
    name: 'La API de Meta optimizada',
    icon: ICON.api,
    headline: 'Le enseñas a Meta a quién traerte.',
    lead: 'Meta solo aprende de lo que le devuelves. MaKo le manda <strong>las conversiones reales de tu embudo</strong> para que su algoritmo busque más gente como la que sí te compra.',
    groups: [
      {
        title: 'Eventos que de verdad mueven la aguja',
        bullets: [
          'Le avisa a Meta cuando alguien <strong>agenda</strong> la primera llamada.',
          'Le avisa cuando un lead <strong>califica</strong> y cuando <strong>pasa la llamada de calificación limpia</strong> — el escalón más profundo del embudo.',
          'Matchea por email y teléfono encriptados del lado del servidor: funciona aunque el navegador bloquee el pixel.',
        ],
      },
      {
        title: 'Más calificado cada vez',
        bullets: [
          'Mientras más cierres, mejor afina Meta a quién mostrarte.',
          'Dejas de optimizar a "lead barato" y empiezas a optimizar a <strong>cliente que paga</strong>.',
        ],
      },
    ],
    metaTitle: 'La API de Meta optimizada — MaKo',
    metaDesc: 'MaKo le devuelve a Meta las conversiones reales de tu embudo (agenda, califica, pasa la llamada) para traerte gente cada vez más calificada.',
  },

  ads: {
    slug: 'ads',
    name: 'Ads Manager para VSL Funnel',
    icon: ICON.ads,
    headline: 'Administra tus campañas sin volver a perderte en Meta.',
    lead: 'Meta está lleno de opciones que no necesitas cuando corres un VSL Funnel. MaKo te deja <strong>manejar lo que importa</strong> desde un solo lugar, cruzado con tu CRM.',
    groups: [
      {
        title: 'Tu Ads Manager, cruzado con tu CRM',
        bullets: [
          'Pausa, activa y ajusta el presupuesto de campañas y conjuntos en un clic, también en masa.',
          'Cada campaña con sus <strong>Cierres, Cash y ROAS reales</strong> — lo que Meta no ve.',
          'Recomendaciones nativas de Meta y análisis con MaKo, sin salir de la app.',
        ],
      },
      {
        title: 'Pensado para tu modelo',
        bullets: [
          'Detecta creativos fatigados y te dice cuándo rotar o apagar.',
          'Sube tus creativos y crea campañas con plantillas para VSL Funnel: MaKo arma la estructura y escribe los textos.',
        ],
      },
    ],
    nota: 'Crear campañas y subir creativos está en activación — depende de habilitar la escritura sobre tu cuenta de Meta.',
    metaTitle: 'Ads Manager para VSL Funnel — MaKo',
    metaDesc: 'Administra tus campañas de Meta desde MaKo, cruzadas con los cierres y el cash reales de tu CRM. Sin volver a perderte en Meta.',
  },

  script: {
    slug: 'script',
    name: 'Script Analyst',
    icon: ICON.script,
    headline: 'Encuentra tu anuncio ganador con datos, no con corazonadas.',
    lead: 'Deja de adivinar qué creativo funciona. MaKo <strong>lee todos tus guiones</strong> y los cruza con la métrica que de verdad importa.',
    groups: [
      {
        title: 'Del guión al resultado',
        bullets: [
          'Transcribe todos tus video ads y clasifica ángulo, hook y estructura.',
          'Compara tus anuncios por <strong>agendas y cierres reales</strong>, no por likes.',
          'Te dice qué escalar y qué apagar, con un cuadrante claro.',
        ],
      },
      {
        title: 'Ve dónde se fuga la audiencia',
        bullets: [
          'Retención por cuartiles de Meta mapeada a <strong>cada bloque del guión</strong>.',
          'Encuentra tus mejores hooks, tu mejor desarrollo y tus CTA más efectivos.',
        ],
      },
      {
        title: 'Valora un guión antes de gastar',
        bullets: [
          'Pegas un guión nuevo y MaKo lo compara con lo que ya te funciona: veredicto, rangos esperados de hook rate y retención, y plan de prueba.',
        ],
      },
    ],
    quote: 'Los guiones que muestran el dashboard agendan 31% vs 12% de los que no: es tu patrón ganador.',
    metaTitle: 'Script Analyst — MaKo',
    metaDesc: 'MaKo transcribe tus guiones de ads y los cruza con retención y cierres reales para decirte cuál escalar, cuál apagar y por qué.',
  },

  closing: {
    slug: 'closing',
    name: 'Closing Analyst',
    icon: ICON.closing,
    headline: 'Sabé por qué se ganó o se perdió cada llamada.',
    lead: 'Escuchar y puntuar cada llamada es imposible a mano. MaKo <strong>analiza cada una</strong> y la convierte en feedback accionable para tu equipo.',
    groups: [
      {
        title: 'Cada llamada, evaluada con evidencia',
        bullets: [
          'Sincroniza solo desde Fathom y matchea cada llamada con su lead del CRM.',
          'Puntúa método SPIN, presentación, manejo de objeciones y CTA — con <strong>quotes textuales y deep-link al minuto exacto</strong>.',
          'Distingue venta (R1 diagnóstico / R2 cierre) de entrega de servicio, y arma tu embudo de cierre.',
        ],
      },
      {
        title: 'Mejora a tu equipo, semana a semana',
        bullets: [
          'Compara a tus closers y te muestra qué hábito decide los cierres.',
          'Detecta objeciones recurrentes y señales de compra que se dejaron pasar.',
          'Corregís el análisis a mano o le pedís a MaKo que re-evalúe, con historial de cambios.',
        ],
      },
    ],
    metaTitle: 'Closing Analyst — MaKo',
    metaDesc: 'MaKo analiza cada llamada de venta de Fathom (SPIN, objeciones, CTA) con evidencia citada y compara a tus closers para que cierres mejor.',
  },

  seguimiento: {
    slug: 'seguimiento',
    name: 'Seguimiento automático',
    icon: ICON.seguimiento,
    headline: 'El dinero está en el seguimiento. MaKo no se olvida de ninguno.',
    lead: 'La mayoría de los leads no compran en la primera. MaKo <strong>nutre, recuerda y reactiva</strong> por vos, por el canal correcto y en el momento justo.',
    groups: [
      {
        title: 'Secuencias por etapa, sin trabajo manual',
        bullets: [
          'Cohortes listas para cada momento: no agendó, vio el VSL pero no reservó, no-show de R1/R2, post-reunión, confirmado sin pago, reactivación de fríos.',
          'Recordatorios y confirmación antes de cada llamada para <strong>bajar el no-show</strong>.',
          'Cuando el lead responde o avanza, la secuencia se corta sola y pasa a atención humana.',
        ],
      },
      {
        title: 'Mensajes que MaKo escribe por vos',
        bullets: [
          'Redacta cada paso en tu voz, según la etapa y cuánto del VSL vio el lead.',
          'Después de la llamada, te deja listo el follow-up citando la objeción que quedó abierta.',
        ],
      },
    ],
    nota: 'El envío automático se activa cuando tus plantillas estén aprobadas por Meta.',
    metaTitle: 'Seguimiento automático — MaKo',
    metaDesc: 'Secuencias de nutrición, recordatorios y reactivación por el canal correcto y en el momento justo. El dinero está en el seguimiento.',
  },

  cobranza: {
    slug: 'cobranza',
    name: 'Cobranza y Revenue real',
    icon: ICON.cobranza,
    headline: 'No es lo que vendiste, es lo que cobraste.',
    lead: 'El revenue de verdad es la plata que entra. MaKo <strong>separa lo firmado de lo cobrado</strong> y te arma la cobranza por cuotas.',
    groups: [
      {
        title: 'Tu plata, sin planillas',
        bullets: [
          '<strong>Sold vs Cash Collected vs Outstanding</strong>, con ROAS real sobre lo que SÍ entró.',
          'CAC real en dólares, convirtiendo el gasto de Meta automáticamente.',
          'Forecast del cash que entra las próximas semanas con las cuotas ya firmadas.',
        ],
      },
      {
        title: 'A quién cobrarle, hoy',
        bullets: [
          'Plan de pagos por lead: cobro inicial + cuotas con día de vencimiento.',
          'Lista accionable: <strong>vencidas en rojo, por vencer en ámbar</strong>.',
          'Marcás la cuota cobrada en un clic; el cash del tablero se actualiza solo.',
        ],
      },
    ],
    metaTitle: 'Cobranza y Revenue real — MaKo',
    metaDesc: 'MaKo separa lo vendido de lo cobrado, arma la cobranza por cuotas y te dice a quién cobrarle hoy. ROAS sobre la plata que SÍ entró.',
  },

  contrato: {
    slug: 'contrato',
    name: 'Tu contrato, leído por IA',
    icon: ICON.contrato,
    headline: 'Subís el contrato firmado y la cobranza se arma sola.',
    lead: 'Pasar un contrato a cuotas a mano es tedioso y se presta a errores. MaKo <strong>lo lee por vos</strong> y autollena el plan de pagos.',
    groups: [
      {
        title: 'Del PDF a la cobranza, en segundos',
        bullets: [
          'Subís el contrato firmado (PDF o foto) y MaKo extrae total, duración, fecha de cierre y cada cuota.',
          'Autollena el plan de pagos y la cobranza del lead, <strong>sin tipear nada</strong>.',
          'Guarda el contrato seguro y descargable cuando lo necesites.',
        ],
      },
    ],
    metaTitle: 'Tu contrato, leído por IA — MaKo',
    metaDesc: 'Subís el PDF (o foto) del contrato firmado y MaKo extrae el plan de pagos y arma la cobranza del lead automáticamente.',
  },

  customer: {
    slug: 'customer',
    name: 'Customer Success',
    icon: ICON.customer,
    headline: 'Cerrar es el principio. Retener es el negocio.',
    lead: 'Las llamadas con tus clientes están llenas de señales que hoy se pierden. MaKo <strong>las escucha y te avisa</strong> quién está feliz, quién está por irse y a quién ofrecerle más.',
    groups: [
      {
        title: 'La salud de cada cliente, a la vista',
        bullets: [
          'Analiza tus sesiones de servicio igual que las de venta: temas, sentimiento, compromisos y próximos pasos.',
          'Health Score por cliente que cruza las señales de las llamadas con el estado de su cobranza.',
          'Alerta de <strong>churn inminente</strong>: cuando se juntan una señal negativa y una cuota sin pagar.',
        ],
      },
      {
        title: 'Más LTV del mismo cliente',
        bullets: [
          'Detecta oportunidades de upsell y renovación en lo que el cliente ya dijo.',
          'Trackea el onboarding y los compromisos asumidos de ambos lados.',
        ],
      },
    ],
    nota: 'Construido sobre las mismas llamadas que ya analizás con MaKo.',
    metaTitle: 'Customer Success — MaKo',
    metaDesc: 'MaKo analiza tus sesiones con clientes, calcula un health score y te avisa quién está por irse y a quién ofrecerle más. Retener es el negocio.',
  },

  semaforo: {
    slug: 'semaforo',
    name: 'Semáforo del Negocio',
    icon: ICON.semaforo,
    headline: 'Sin parálisis por análisis: sabés qué atacar primero.',
    lead: 'Tener muchos datos puede paralizarte. MaKo <strong>prende una luz</strong> y te dice por dónde empezar, hoy.',
    groups: [
      {
        title: 'Una sola lectura, accionable',
        bullets: [
          'Rojo, amarillo o verde con un veredicto en tu idioma: "hay algo urgente" o "el negocio está sano".',
          'Cruza Meta, Calendly y Cobranza: entrega frenada, cuotas vencidas, deals que se enfrían entre R1 y R2, fatiga de creativos y tasa de cierre.',
          'Ordena los focos por urgencia y te lleva con un clic a donde se arregla.',
        ],
      },
    ],
    metaTitle: 'Semáforo del Negocio — MaKo',
    metaDesc: 'MaKo cruza Meta, Calendly y cobranza, prende una luz y te dice qué atacar primero. Sin parálisis por análisis.',
  },

  experimentos: {
    slug: 'experimentos',
    name: 'Experimentos',
    icon: ICON.experimentos,
    headline: 'Convierte cada "¿y si...?" en una respuesta con datos.',
    lead: '¿Cambio el VSL? ¿Filtro más con el formulario? ¿Mis creativos ya se quemaron? Dejá de responder con el estómago: <strong>probalo y medilo</strong>.',
    groups: [
      {
        title: 'De la hipótesis al aprendizaje',
        bullets: [
          'Le contás tu hipótesis a MaKo en lenguaje natural y la convierte en un experimento configurado: métrica, ventana, presupuesto y criterio de éxito.',
          'Recopila los datos a diario y te muestra cómo evoluciona.',
          'Al cerrar, queda un <strong>aprendizaje guardado</strong> sobre TU funnel.',
        ],
      },
    ],
    nota: 'En construcción — la base de medición (A/B de VSL y métricas diarias) ya corre.',
    metaTitle: 'Experimentos — MaKo',
    metaDesc: 'Convertí tus hipótesis en experimentos que MaKo configura y mide a diario, y cerrá con un aprendizaje real sobre tu funnel.',
  },

  whatsapp: {
    slug: 'whatsapp',
    name: 'WhatsApp',
    icon: ICON.whatsapp,
    headline: 'Chateá con tus leads desde la app, sin riesgo de baneo.',
    lead: 'MaKo te da un <strong>inbox real de WhatsApp</strong> con API oficial, más un motor de plantillas y secuencias listo para encender.',
    groups: [
      {
        title: 'Tu inbox, ordenado',
        bullets: [
          'Conversación por contacto: texto, audios, fotos y archivos, con bloqueo.',
          'Usa las credenciales de Meta de tu inbox, <strong>sin pedirte nada extra</strong>.',
        ],
      },
      {
        title: 'Plantillas que Meta aprueba',
        bullets: [
          'Creás la plantilla y la mandás a revisión de Meta desde la app.',
          'MaKo <strong>predice si Meta la va a aprobar</strong> y te devuelve la versión corregida en un clic.',
        ],
      },
    ],
    metaTitle: 'WhatsApp integrado — MaKo',
    metaDesc: 'Inbox real de WhatsApp con API oficial, sin riesgo de baneo, más un motor de plantillas que MaKo valida antes de mandarlas a Meta.',
  },

  email: {
    slug: 'email',
    name: 'Email Marketing',
    icon: ICON.email,
    headline: 'Todo el poder del email marketing, dentro de MaKo.',
    lead: 'El email te da el seguimiento más largo y profundo: ahí terminás de cerrar a los que todavía no estaban listos. <strong>Las mismas cohortes que ya nutren por WhatsApp</strong>, llevadas al correo.',
    groups: [
      {
        title: 'Seguimiento que no se agota',
        bullets: [
          'Secuencias de nutrición que acompañan al lead durante semanas o meses.',
          'Reactivación automática de los contactos fríos que quedaron en el camino.',
          'Broadcasts a segmentos específicos (no agendó, no-show, no calificó).',
          'MaKo redacta y revisa tus correos para que cada envío sume.',
        ],
      },
    ],
    nota: 'En preparación — el riel de cohortes y segmentos ya está; falta conectar el envío.',
    metaTitle: 'Email Marketing — MaKo',
    metaDesc: 'Secuencias largas, reactivación de fríos y broadcasts por segmento. El seguimiento profundo donde terminás de cerrar a los que no estaban listos.',
  },

  mako: {
    slug: 'mako',
    name: 'MaKo, tu consultor con IA',
    icon: ICON.mako,
    headline: 'Un consultor que conoce tu negocio, tus números y tu método.',
    lead: 'No es un chatbot genérico. MaKo <strong>cruza tus datos en vivo con tu metodología</strong> y te responde con números en la mano, en tu idioma.',
    groups: [
      {
        title: 'Responde con TU data',
        bullets: [
          'Preguntale lo que sea — desde "¿apago este anuncio?" hasta "¿por qué no cerré a este lead?" — y responde con tu funnel, tu CRM, tus ads y tu cobranza.',
          'Análisis en tus gráficos: un clic en el botón de MaKo y te dice qué pasa y el próximo paso.',
        ],
      },
      {
        title: 'Aprende tu método de una',
        bullets: [
          'Cargás tu metodología (o pegás un doc) y la indexa sola con <strong>búsqueda semántica</strong>.',
          'Cada respuesta sale calibrada a tu oferta, tu avatar y tu voz de marca — nada de consejos de manual.',
        ],
      },
      {
        title: 'El cerebro detrás de todo MaKo',
        bullets: [
          'Corre sobre el modelo de IA más potente, con un contexto que apila tus números + el método de Martín Koncke + tu operación.',
        ],
      },
    ],
    quote: 'Cuanto más le cargás, mejor te diagnostica.',
    metaTitle: 'MaKo, tu consultor con IA — MaKo',
    metaDesc: 'Un consultor con IA que cruza tus datos en vivo con tu metodología y te responde con números, no con humo. Aprende tu método y te diagnostica.',
  },
};
