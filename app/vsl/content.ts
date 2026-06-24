// =============================================================================
// Contenido (copy) de la landing de venta de MaKo — ruta pública /vsl
// =============================================================================
// Todo el texto vive acá para que sea fácil de editar sin tocar el layout.
// El copy está escrito en voz de Martín (español rioplatense) y refleja las
// funcionalidades REALES de la app.
//
// TODO del usuario:
//  - CTA_HREF: reemplazá "#" por tu link de Calendly / cal.com / WhatsApp.
//  - VSL.embedUrl: pegá la URL de embed de tu VSL (YouTube/Vimeo/vturb). Si
//    queda vacío, se muestra un reproductor placeholder con botón de play.

export const CTA_HREF = '#'; // ← reemplazá por tu link de agendamiento

export const VSL = {
  embedUrl: '', // ← p.ej. 'https://www.youtube.com/embed/XXXX' o el iframe de tu plataforma VSL
};

export type Feature = {
  name: string;
  glyph: string;
  benefitHeadline: string;
  desc: string;
};

export type FeatureCategory = {
  category: string;
  eyebrow: string;
  items: Feature[];
};

export const content = {
  hero: {
    eyebrow: 'MaKo · Marketing OS con IA',
    // <em> resalta en dorado.
    headlineHtml:
      'Tu marketing y tus ventas, en <em>un solo</em> sistema que te dice <em>qué hacer</em> hoy.',
    subhead:
      'MaKo junta tus ads, tu CRM, tu funnel y tus cobranzas en un solo lugar — y le suma una IA que conoce tus números y te marca dónde está la plata y dónde el incendio. Sin planillas, sin adivinar.',
    ctaPrimary: 'AGENDÁ TU DEMO',
    trustBar: [
      'Vista General con semáforo del negocio',
      'CRM Kanban + cobranzas',
      'Meta Ads en vivo: CAC y ROAS cash',
      'Preguntale a MaKo, tu copiloto con IA',
    ],
  },

  problema: {
    eyebrow: '01 · El problema',
    heading: 'Tenés los datos en diez lugares y la decisión en ninguno.',
    dolores: [
      {
        title: 'Vivís saltando entre pestañas',
        desc: 'Meta por un lado, el CRM por otro, las cobranzas en una planilla y los cierres en tu cabeza. Cuando juntás todo, ya es tarde para reaccionar.',
      },
      {
        title: 'No sabés qué ad escalar ni cuál apagar',
        desc: 'Mirás leads que parecen buenos pero no agendan. Sin CAC real ni ROAS cash, escalás a ciegas y quemás presupuesto en creativos fatigados.',
      },
      {
        title: 'Se te enfrían los deals y no te enterás',
        desc: 'Leads que se congelan entre R1 y R2, cuotas vencidas sin cobrar, no-shows sin recontactar. El atraso te come la tasa de cierre y ni lo ves.',
      },
      {
        title: 'Confundís plata vendida con plata cobrada',
        desc: 'Festejás un cierre que todavía no entró al banco. Sin separar Sold Revenue de Cash Collected, no sabés cuánto tenés de verdad.',
      },
    ],
  },

  queEs: {
    eyebrow: '02 · Qué es MaKo',
    heading: 'Un Marketing OS que piensa con tus números, no con corazonadas.',
    body: 'MaKo es el sistema operativo de tu adquisición de clientes. Conecta Meta Ads, tu CRM, el funnel, las cobranzas y las grabaciones de tus reuniones en una sola pantalla — y arriba de todo eso corre una IA entrenada con tu metodología y tus datos en vivo. No es un dashboard más para mirar lindo: te detecta los focos urgentes solo, te dice dónde está el cuello de botella y te arma la operativa del día. Vos decidís; MaKo te da el contexto para decidir bien.',
  },

  featureCategories: [
    {
      category: 'Tu negocio en claro',
      eyebrow: 'Ver todo de un vistazo',
      items: [
        {
          name: 'Vista General',
          glyph: '🧭',
          benefitHeadline: 'El norte del negocio en una pantalla',
          desc: 'Hero "Camino a los N cierres", resumen del mes (Ad Spend, Agendas, Cierres, Cash Collected) con tendencia vs período anterior, y un Semáforo que detecta solo cuotas vencidas, deals enfriados y fatiga de creativos. Cada KPI se abre en un clic con detalle por lead o por anuncio.',
        },
        {
          name: 'CRM',
          glyph: '🗂️',
          benefitHeadline: 'Tu pipeline visual, arrastrable, sin perder nada',
          desc: 'Kanban multi-banda (Pipeline, Nutrición, Salidas) + vista tabla + ficha de lead. Movés deals con un arrastre, ves quién atiende cada uno, los planes de pago por cuotas, las grabaciones de R1/R2 y la nutrición automática — todo sin salir del CRM.',
        },
        {
          name: 'Pendientes',
          glyph: '✅',
          benefitHeadline: 'Tu operativa del día en cuatro bloques',
          desc: 'Datos sin marcar (lo más viejo primero), tus próximas juntas, la cola de acción (cobranzas, R2 sin match, no-shows) y los formularios sin agenda. Cada marca corrige tus tasas de no-show y mantiene el dashboard confiable.',
        },
        {
          name: 'Funnel',
          glyph: '🪜',
          benefitHeadline: 'Una sola fuente de verdad para todo el pipeline',
          desc: 'Diseñás y editás las etapas de tu embudo (Formulario → Agenda → Asistió → Calificado → Cierre) en tiempo real. El funnel alimenta cada pantalla comercial: lo cambiás acá y se refleja en todos lados.',
        },
      ],
    },
    {
      category: 'Convertí más, gastá mejor',
      eyebrow: 'De la intención al dinero',
      items: [
        {
          name: 'Marketing',
          glyph: '📊',
          benefitHeadline: 'Sabé qué ad escalar y cuál apagar',
          desc: 'Performance de Meta Ads en vivo: Ad Spend, CAC real, ROAS cash y ROAS sold. Salud del funnel (Impresión → Click → Landing → VSL), eficiencia por CPM/CPC, tendencias y "Anuncios ganadores" con badges Validada/Explorando/Apagar según agendas reales, no leads de juguete.',
        },
        {
          name: 'Comercial',
          glyph: '💼',
          benefitHeadline: 'Encontrá dónde se atasca y se enfría la venta',
          desc: 'Funnel comercial (Agenda → Asistió → Calificado → Cierre) con no-show rate y ratio de cierre, el SCL que localiza el cuello de botella del ciclo de venta, y cohortes que te dicen si podés confiar en una tasa de cierre o todavía está madurando.',
        },
        {
          name: 'Revenue',
          glyph: '💵',
          benefitHeadline: 'Plata firmada vs plata en el banco, sin estrés',
          desc: 'Sold Revenue, Cash Collected y Outstanding en una barra clara, más la eficiencia que importa (ROAS cash destacado). El drill de Outstanding te lleva directo a los leads que te deben para saber a quién llamar hoy.',
        },
        {
          name: 'Closing Analysis',
          glyph: '🎯',
          benefitHeadline: 'Tus R1/R2 analizadas y con coaching por closer',
          desc: 'Review automática de las llamadas vía Fathom: scoring SPIN (Situación, Problema, Implicación, Necesidad) + ejecución, momentos clave con timestamp y recomendaciones tácticas concretas por cada closer para cerrar más rápido.',
        },
        {
          name: 'WhatsApp',
          glyph: '💬',
          benefitHeadline: 'Inbox unificado + nutrición automática por etapa',
          desc: 'Conversaciones agrupadas por contacto: respondés texto libre dentro de las 24h, mandás notas de voz, adjuntos y plantillas aprobadas. Secuencias de nutrición por etapa con {{nombre}}, demora configurable, bloqueo de spam y avisos en vivo.',
        },
        {
          name: 'Email Marketing',
          glyph: '📧',
          benefitHeadline: 'Secuencias por etapa y broadcasts puntuales',
          desc: 'Secuencias de nutrición según dónde quedó el lead (No Agenda, No Paga, No Show, Post Agenda, Manual) con delay, asunto, preheader y body editables, más métricas de apertura y clic por email y broadcasts a segmentos.',
        },
      ],
    },
    {
      category: 'El cerebro IA',
      eyebrow: 'MaKo piensa con vos',
      items: [
        {
          name: 'Preguntale a MaKo',
          glyph: '✨',
          benefitHeadline: 'Un copiloto que conoce tus números en vivo',
          desc: 'Chat de IA conectado a tu funnel, CRM y métricas reales. Le preguntás "¿cómo viene el mes?", "¿dónde está mi cuello de botella?", "¿el gasto en ads rinde?" y te responde con datos, no con humo. Historial de chats por gráfico, siempre a mano.',
        },
        {
          name: 'Contexto',
          glyph: '🧠',
          benefitHeadline: 'Entrená a MaKo para que responda como vos',
          desc: 'Panel con tres pestañas: Conocimiento (RAG) donde cargás tu metodología y se indexa sola, Fases para definir tu funnel exacto, y Prompts con historial de versiones. Cuanto más le cargás, mejor diagnostica tus cuellos con tu propio criterio.',
        },
        {
          name: 'Onboarding',
          glyph: '📝',
          benefitHeadline: 'Cargá el perfil del negocio en dos minutos',
          desc: 'Wizard de configuración con campos que diseñás vos. Completás inline o descargás un template, lo llenás offline y lo subís: MaKo extrae las respuestas solo. El perfil guardado alimenta el contexto para que la IA responda conociendo el negocio.',
        },
      ],
    },
  ] as FeatureCategory[],

  como: {
    eyebrow: '03 · Cómo funciona',
    heading: 'De cero a decidir con datos, en cuatro pasos.',
    pasos: [
      {
        n: '01',
        title: 'Conectás tus fuentes',
        desc: 'Enchufamos Meta Ads, tu CRM, Calendly, las grabaciones de Fathom y WhatsApp. En una corrida MaKo empieza a leer tus números reales — no tenés que armar nada a mano.',
      },
      {
        n: '02',
        title: 'Definís tu funnel y tu contexto',
        desc: 'Configurás las etapas de tu embudo (la única fuente de verdad) y cargás tu metodología en Contexto. El Onboarding te deja subir el perfil del negocio y MaKo extrae las respuestas solo.',
      },
      {
        n: '03',
        title: 'Operás el día desde un solo lugar',
        desc: 'Abrís Vista General y el Semáforo te marca los incendios. Pendientes te ordena la operativa: marcás asistencias, resolvés leads rezagados y mantenés la cola de cobranzas al día.',
      },
      {
        n: '04',
        title: 'Decidís con MaKo al lado',
        desc: 'Le preguntás qué ad escalar, dónde está el cuello de botella o a quién cobrarle hoy. MaKo cruza tus datos en vivo y te da la respuesta con números y una acción clara.',
      },
    ],
  },

  resultados: {
    eyebrow: '04 · Lo que cambia',
    heading: 'Menos planillas, más decisiones que mueven la aguja.',
    kpis: [
      { value: '1', label: 'Pantalla para ver todo el negocio (en vez de 10 pestañas)' },
      { value: '<1 clic', label: 'Para abrir el detalle por lead o por anuncio de cada KPI' },
      { value: 'ROAS cash', label: 'La métrica de plata real que MaKo destaca por sobre lo "comprometido"' },
      { value: '24/7', label: 'Semáforo detectando cuotas vencidas y deals enfriados solo' },
    ],
    nota: 'Estos son placeholders — reemplazalos con tus números reales y testimonios cuando tengas la cuenta corriendo. MaKo te muestra el dato; los resultados son tuyos.',
  },

  esParaVos: {
    heading: '¿Esto es realmente para vos?',
    siList: [
      'Corrés ads en Meta y vendés con reuniones (R1/R2) o llamadas de cierre',
      'Estás cansado de saltar entre planillas, el CRM y los reportes de ads',
      'Querés saber con números qué ad escalar, dónde se atasca la venta y a quién cobrarle hoy',
      'Tenés un equipo de closers y querés coachearlos con datos, no con sensaciones',
      'Te importa la plata cobrada de verdad, no solo lo firmado en el papel',
    ],
    noList: [
      'Buscás un curso grabado o una plantilla mágica que se llena sola',
      'No tenés un proceso de venta ni vas a cargar tus datos',
      'Querés "resultados garantizados" sin tocar tu operativa',
      'No corrés tráfico pago ni hacés reuniones de venta',
      'Esperás que una IA decida por vos sin que mires nunca los números',
    ],
  },

  faq: [
    {
      q: '¿MaKo reemplaza a mi CRM y a mis reportes de ads?',
      a: 'Los junta en uno. Tenés el CRM Kanban con cobranzas, el dashboard de Meta Ads con CAC real y ROAS cash, el funnel comercial y la IA, todo en la misma herramienta. Dejás de cruzar planillas a mano.',
    },
    {
      q: '¿La IA inventa o realmente usa mis datos?',
      a: 'Usa tus datos en vivo. Preguntale a MaKo está conectado a tu funnel, CRM y métricas, y en Contexto cargás tu metodología para que responda con tu criterio. Cada respuesta viene con números y una acción concreta, no con humo.',
    },
    {
      q: '¿Cuánto tardo en configurarlo?',
      a: 'La idea es minimizar la config: conectás las fuentes, definís tu funnel y cargás el contexto. El Onboarding te deja subir un documento y MaKo extrae las respuestas solo en vez de llenar formularios eternos.',
    },
    {
      q: '¿Necesito saber de datos o de tecnología?',
      a: 'No. MaKo te traduce todo: el Semáforo te avisa qué está mal, los KPIs se abren en un clic con el detalle y la IA te explica en criollo dónde está el problema y qué hacer.',
    },
    {
      q: '¿Sirve si todavía tengo poco volumen?',
      a: 'Sí. Las cohortes te marcan cuáles tasas son confiables y cuáles todavía están madurando, así no tomás decisiones grandes con datos chicos. A medida que escalás, MaKo escala con vos.',
    },
    {
      q: '¿Cómo arranco?',
      a: 'Agendás una demo. Te mostramos MaKo con un caso real, vemos si encaja con tu operación y, si tiene sentido, lo conectamos a tus números.',
    },
  ],

  ctaFinal: {
    heading: 'Dejá de adivinar. Empezá a decidir con tus números.',
    sub: 'Agendá una demo de 30 minutos. Te mostramos MaKo funcionando, con tu tipo de operación, y vemos juntos dónde está la plata que estás dejando sobre la mesa.',
    cta: 'AGENDÁ TU DEMO',
  },

  footer: {
    tagline:
      'MaKo — el Marketing OS con IA de Marketing Koncept. Tus ads, tu CRM y tus cierres, con un cerebro que piensa con tus números.',
    copyright: 'MARKETING KONCEPT · © 2026 Martín Koncke',
  },
};
