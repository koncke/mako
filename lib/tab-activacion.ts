// =============================================================================
// tab-activacion — qué necesita cada tab para prenderse, y qué promete mientras
// =============================================================================
// El problema que resuelve: hoy una tab sin su integración NO dice que le falta
// una integración. Comercial renderiza seis secciones en $0 y un gráfico plano
// (se lee como roto, no como "todavía no"), y WhatsApp dice "Sin conversaciones"
// cuando en realidad Chatwoot nunca se conectó — un error de config disfrazado
// de dato vacío, que es la peor lectura posible: le echa la culpa al dato.
//
// En vez de eso, la tab muestra la MISMA pantalla partida del onboarding: a la
// izquierda el aside negro con lo que va a poder hacer (y, apenas conecta, los
// datos reales de SU cuenta); a la derecha, el form pidiendo la credencial.
// El cliente aprende UNA pantalla y la reconoce en los cuatro lugares.
//
// Datos puros (sin 'server-only'): lo consumen las pages (server) y el panel
// (client).
// =============================================================================

import type { Slide } from './servicio-slides';

export type TabActivacion = {
  /** Key del nav (lib/capas.ts, app/_components/nav.ts). */
  key: string;
  /** Cómo se llama la tab para el cliente. */
  titulo: string;
  /**
   * Servicio del catálogo (lib/metodo-catalogo.ts) que hay que conectar para
   * prenderla. La página pregunta por él con integracionConectada().
   * Ausente = no se prende con una credencial sino cargando datos (Comercial
   * necesita un plan de cobranza, no una API key) → se usa `cta`.
   */
  servicio?: string;
  /** Para las tabs sin credencial: adónde mandarlo a cargar lo que falta. */
  cta?: { label: string; href: string };
  /** Ícono que representa a la tab en el aside cuando no hay servicio. */
  icono?: string;
  /** Línea mono del aside. */
  eyebrow: string;
  /** Qué le falta, en criollo — el subtítulo de la derecha. */
  queFalta: string;
  /** El carrusel: qué va a poder hacer cuando la conecte. */
  slides: Slide[];
  /**
   * Aviso honesto cuando conectar NO alcanza para que la tab tenga contenido
   * (ej. Closing necesita además que existan llamadas grabadas). Se muestra
   * abajo del form. Ausente = con conectar alcanza.
   */
  ademas?: string;
};

// OJO — la regla de las slides es la misma que la de lib/servicio-slides.ts y no
// se negocia: cada una describe algo que la app HACE HOY, y al lado va el código
// que la respalda. Nada gateado por un flag apagado, nada owner-only, nada de
// ComingSoon. Una promesa falsa acá se paga con la confianza del cliente el día
// 1, que es el peor día para perderla.
//
// Este catálogo pasó una revisión adversarial contra el código (jul-2026) que
// volteó seis promesas: los rebotes de email no se cuentan, el t0 de los beats
// lo ESTIMA Claude (no es un timestamp), y el aviso de Calendly de acá abajo.
export const TABS_ACTIVACION: Record<string, TabActivacion> = {
  closing: {
    key: 'closing',
    titulo: 'Closing Analyst',
    servicio: 'fathom',
    eyebrow: '✦ Con Fathom conectado',
    queFalta: 'Fathom es donde se graban tus llamadas. Con su API key, el sync las trae solo y MaKo las analiza en lotes.',
    ademas: 'Con la key alcanza para traerlas. Para que cada llamada quede pegada a su lead tienen que coincidir por email, o sea tener el lead cargado en el CRM.',
    slides: [
      // lib/closing.ts (ClosingDim/ClosingObjection con t_seconds) + cron closing-sync
      { t: 'Cada llamada, puntuada', d: 'Separa venta de entrega de servicio, puntúa por SPIN y ejecución, y cita el minuto exacto de cada fortaleza y de cada objeción.' },
      // app/closing/ClosingBrowser.tsx (embedToken + deep-link al segundo)
      { t: 'El video y el transcript, juntos', d: 'Player embebido y transcript anotado: tocas una línea y la grabación salta a ese segundo.' },
      // ClosingBrowser: vista Métricas agregada en cliente sobre data.calls
      { t: 'Qué dimensión decide tus cierres', d: 'Cruza ganadas contra perdidas y te marca la dimensión con más gap, la tendencia del score y cómo va cada closer.' },
      // lib/closing.ts:828 reviseAnalysis + :870 reviseWithMako → edit_history
      { t: 'La última palabra es tuya', d: 'Corriges un puntaje a mano o le pides a MaKo que re-analice con tu nota, y queda el historial de quién cambió qué.' },
    ],
  },

  whatsapp: {
    key: 'whatsapp',
    titulo: 'WhatsApp',
    servicio: 'whatsapp',
    eyebrow: '✦ Con WhatsApp conectado',
    queFalta: 'Conecta tu cuenta por Chatwoot y la bandeja pasa a vivir aquí adentro. Tu número de empresa no pide credencial: se engancha escaneando un QR desde esta misma tab.',
    ademas: 'Ojo con el ID de bandeja: si no fijas el tuyo se usa uno por default que no es el tuyo. El nombre de tu bandeja aparece a la izquierda apenas conectas — si no es el que esperabas, cambia el ID.',
    slides: [
      // app/whatsapp/WhatsAppApp.tsx + _shared/VoiceRecorder.tsx
      { t: 'El inbox, aquí adentro', d: 'Un hilo por lead con su etapa del funnel al lado, adjuntos, y notas de voz que grabas desde el composer.' },
      // app/whatsapp/WhatsAppAdvisor.tsx (Sugerencia.guion_voz) + lib/whatsapp-advisor.ts
      { t: 'MaKo te dice qué escribir', d: 'Lee la conversación real, la etapa y la ventana de 24h, y te deja mensajes listos con su ángulo y su tono — hasta el guion de una nota de voz.' },
      // lib/template-validator.ts (Hallazgo/Propuesta + aplicarPropuesta)
      { t: 'Plantillas que no te rechazan', d: 'MaKo valida el borrador contra las reglas de Meta antes de mandarlo: la regla que rompe y una versión corregida que aplicas de un click.' },
      // EvolutionConnect + EmpresaInbox + lib/evolution.ts (espejo en wa_mensajes)
      { t: 'Dos números, un historial', d: 'El oficial y el de empresa conviven en la misma tab, y el no oficial queda espejado en tu base: si te banean el número, el historial sigue aquí.' },
    ],
  },

  email: {
    key: 'email',
    titulo: 'Email',
    servicio: 'email',
    eyebrow: '✦ Con Resend conectado',
    queFalta: 'Tu API key de Resend y tu dominio verificado desde esta misma tab. Sin dominio propio los envíos quedan en sandbox: se registran pero no salen.',
    ademas: 'El envío automático de las secuencias tiene además su propio interruptor. Con el envío real en OFF armas y pruebas todo, pero nada sale — a propósito, para que puedas escribir sin quemar leads.',
    slides: [
      // lib/email-marketing.ts (esSecuenciaEmail sobre nutricion_secuencias)
      { t: 'Secuencias que salen solas', d: 'La secuencia se dispara cuando el lead entra a la cohorte del trigger: pasos, delay en horas, asunto y variables del lead.' },
      // lib/resend.ts createResendDomain/verifyResendDomain + polling en EmailApp.tsx:740
      { t: 'Tu dominio, verificado desde aquí', d: 'Te damos los registros DNS y la app chequea sola hasta que quede verificado; sin dominio propio no sale nada.' },
      // lib/email-marketing.ts (statsPorPaso) + webhook resend (suprimirPorRebote)
      { t: 'Quién abrió y quién clickeó', d: 'Aperturas y clicks contados paso por paso de cada secuencia, y lo mismo por broadcast. Las direcciones que rebotan en duro se dan de baja solas para no quemarte el dominio.' },
      // lib/email-marketing.ts:209 SEGMENTOS + leadsDeSegmento/enviarBroadcast
      { t: 'Broadcasts a un segmento', d: 'Borrador, envío de prueba y programado a un segmento del CRM, sin pegar direcciones a mano.' },
    ],
  },

  script: {
    key: 'script',
    titulo: 'Ads Analyst',
    servicio: 'meta',
    eyebrow: '✦ Con Meta Ads conectado',
    queFalta: 'Con tu cuenta de Meta, MaKo baja y transcribe el video de cada anuncio, y recién ahí lo analiza. Se llena solo en segundo plano.',
    ademas: 'Los patrones ganadores necesitan histórico: con pocos anuncios corridos, MaKo va a ser prudente en vez de inventar.',
    slides: [
      // lib/ads-analyst.ts (StoredBeat/BEAT_KINDS son 9). OJO: t0 lo ESTIMA
      // Claude por ritmo de lectura — el transcript no trae timestamps (:250).
      { t: 'El guion partido en bloques', d: 'Gancho, problema, mecanismo, prueba, oferta y CTA — hasta 9 tipos de bloque, cada uno con su tramo estimado por ritmo de lectura y la retención que llegó hasta ahí.' },
      // lib/ads-analyst.ts:14-19 — cuartiles p25/p50/p75/p100 sobre plays de 3s
      { t: 'Dónde te abandonan', d: 'La curva se reconstruye desde los cuartiles que reporta Meta y se interpola por bloque — está rotulado que es estimación, no una curva segundo a segundo.' },
      // lib/ads-analyst.ts:618 getScriptMetrics — histórico acumulado del anuncio
      { t: 'Qué guion escalar', d: 'Ángulo, hook rate, frecuencia, agendas y cierres de todo el histórico del anuncio: un guion se juzga por lo acumulado, no por un rango de fechas.' },
      // lib/ads-analyst.ts:964-974 Valoracion + /api/ads-analyst/valorar
      { t: 'Valora un guion sin gastar', d: 'Pegas un guion que todavía no corrió y MaKo lo compara contra el perfil real de tu cuenta: qué patrones tuyos cumple, cuáles no, y un plan de validación con presupuesto y días mínimos.' },
    ],
  },

  crm: {
    key: 'crm',
    titulo: 'CRM',
    servicio: 'calendly',
    eyebrow: '✦ Con tu agenda conectada',
    queFalta: 'Calendly, con los event types de tu R1 y tu R2 — sin ellos las reuniones no entran. Puedes arrancar sin nada igual: los leads se cargan a mano.',
    // Honestidad obligada, la cazó la revisión del copy contra el código: los
    // event types figuran como OPCIONALES pero sin ellos wsPorIdentificador
    // devuelve null y el webhook descarta el evento con 200 OK, en silencio — el
    // cliente ve "Calendly conectado" y cero agendas, sin un solo error. Y la
    // signing key que pega HOY no se lee (el webhook usa la de plataforma), o
    // sea que su webhook propio devolvería 401 para siempre. Hasta que eso se
    // arregle en código, el aviso se queda acá.
    ademas: 'Los event types de R1 y R2 figuran como opcionales pero NO lo son: sin ellos el webhook no sabe de quién es la reunión y la descarta sin avisar. El webhook lo crea y lo firma la agencia — la signing key no la pones tú.',
    slides: [
      // app/crm/StageMoveDialog.tsx + lib/stage-requirements.ts
      { t: 'El kanban con las reglas puestas', d: 'Arrastras el lead a la etapa y si le falta un dato el asistente te lo pide ahí mismo: el closer, la grabación, el motivo, o las cuotas que tienen que cuadrar con el monto.' },
      // lib/auto-reuniones.ts buscarReunionesAutomatico (Calendly + Fathom matcheado)
      { t: 'Los datos se buscan solos', d: 'Antes de preguntarte nada, MaKo cruza Calendly con las grabaciones de Fathom ya matcheadas: si hay grabación, la reunión ocurrió.' },
      // app/crm/LeadSheet.tsx + lib/journey.ts:47 buildJourney
      { t: 'La ficha entera del lead', d: 'Origen, recorrido paso a paso, respuestas de Calendly, chat de WhatsApp y cobranza en una sola pantalla, con el historial de quién tocó qué.' },
    ],
  },

  marketing: {
    key: 'marketing',
    titulo: 'Marketing',
    servicio: 'meta',
    eyebrow: '✦ Con Meta conectado',
    queFalta: 'Conecta tu cuenta de Meta y este tablero se llena con tu gasto, tus costos y tu embudo de tráfico de todos los días.',
    ademas: 'El histórico entra en las próximas horas y crece solo cada día. Las etapas que dependen del CRM (agenda, cierre) van a decir "fuente pendiente" hasta que conectes también la agenda — no es un cero, es que todavía no las mides.',
    slides: [
      // lib/queries.ts getMarketingWindow — KPIs TOFU
      { t: 'CAC, ROAS y CPL, al día', d: 'Gasto, costo por lead, CAC real y ROAS sobre lo vendido y lo cobrado — no sobre clics, sobre dinero.' },
      // getFunnelEtapas + lib/sources.ts — embudo con fuente honesta
      { t: 'Tu embudo, sin mentiras', d: 'Impresión → clic → landing → VSL con el % de paso de cada tramo, y lo que todavía no mides queda marcado como pendiente, no como cero.' },
      // ResumenCreativos — breakdowns live de Meta
      { t: 'Quién ve tus anuncios', d: 'Edad, género, plataforma y región de toda tu cuenta, en vivo desde Meta — para saber a quién le estás pegando.' },
    ],
  },

  experimentos: {
    key: 'experimentos',
    titulo: 'Experiments',
    servicio: 'meta',
    eyebrow: '✦ Con Meta conectado',
    queFalta: 'La Retro y los experimentos necesitan tus números de Meta para tener contra qué medir. Conéctala y corre tu primera Retro.',
    ademas: 'La Retro rinde más mientras más fuentes conectes (llamadas, cobranza, VSL), pero arranca con lo que haya. Es a demanda: la disparas tú cuando quieres.',
    slides: [
      // lib/retro-pipeline.ts — 8 fases, diagnóstico + plan
      { t: 'Un diagnóstico de tu negocio', d: 'MaKo cruza todo tu histórico y te dice dónde se te va el dinero, qué funciona y el plan priorizado para arrancar.' },
      // aplicarPlan → crearExperimento/crearTareasDesde
      { t: 'Del informe al plan, solo', d: 'Aceptas una idea de la Retro y se crea sola en tu plan como experimento o tarea — no queda en un PDF que nadie abre.' },
      // lib/experimentos.ts — baseline + medición + veredicto
      { t: 'Es el único que concluye', d: 'Una hipótesis se vuelve experimento con línea de base, medición automática y veredicto al cerrar: aquí MaKo afirma con datos, no opina.' },
    ],
  },

  comercial: {
    key: 'comercial',
    titulo: 'Comercial',
    // No se prende con una credencial: se prende cargando el plan de cobranza de
    // un lead cerrado. Por eso va CTA en vez de form.
    cta: { label: 'Ir al CRM y cargar un cierre →', href: '/crm' },
    icono: 'landing',
    eyebrow: '✦ Con tus cierres cargados',
    queFalta: 'Esta vista sale de tus cierres y sus cobros. Carga un lead ganado con su monto y su plan de cuotas, y el tablero se arma solo.',
    slides: [
      // app/comercial/RevenueKpis.tsx + lib/pagos.ts getRevenueBreakdowns
      { t: 'Vendido, cobrado y pendiente', d: 'Los tres números que no son lo mismo, separados — y atrás de cada uno, el desglose lead por lead.' },
      // app/comercial/CobrarTable.tsx:49-62 (undo real de 5s) + getOutstandingDetalle
      { t: 'A quién le cobras esta semana', d: 'La lista ordenada por vencimiento, lo vencido en rojo, y marcas la cuota cobrada desde la misma fila con cinco segundos para deshacer.' },
      // app/comercial/page.tsx:667 renderTasa + lib/queries.ts:355-411
      { t: 'Cohortes que no te mienten', d: 'Cada semana se rotula madura, madurando o reciente: la tasa de cierre solo se pinta cuando la cohorte ya tuvo tiempo de cerrar.' },
      // app/comercial/page.tsx:577 SCLTimeline + lib/queries.ts:1686 getTramosSCL
      { t: 'Dónde se traba la venta', d: 'El ciclo de agenda a pago partido en tramos, con el más lento pintado en rojo y su promedio en días.' },
    ],
  },
};

export const tabActivacion = (key: string): TabActivacion | null => TABS_ACTIVACION[key] ?? null;
