// =============================================================================
// servicio-slides — el copy del panel negro, por servicio
// =============================================================================
// Datos puros (sin 'server-only'): los consume el modal de /integraciones, el
// onboarding y el panel de activación de cada tab.
// =============================================================================

export type Slide = { t: string; d: string };
export const SLIDES: Record<string, Slide[]> = {
  meta: [
    // lib/meta-ads.ts (fetchMetaInsights, level=ad) + app/api/cron/meta-daily
    { t: 'Cada anuncio, todos los días', d: 'Gasto, CTR, CPC, leads y retención por cuartiles de cada anuncio. Entra solo, todos los días.' },
    // lib/meta-health.ts (semáforo + recomendaciones fuente:'mako')
    { t: 'El semáforo de la cuenta', d: 'Si Meta te frenó la entrega, te rechazó un anuncio o algo quedó en aprendizaje, lo ves aquí — y MaKo te dice qué tocar.' },
    // app/api/webhooks/meta-leads + lib/meta-leads.ts (poll de respaldo)
    // («con su hilo de WhatsApp ya abierto» se fue el 09/10/2026: lo abría Chatwoot.)
    { t: 'Los leads entran solos', d: 'Cada Lead Ad cae en el CRM en el momento.' },
    // lib/meta-capi.ts, disparado desde lib/leads.ts y el webhook de Calendly
    { t: 'Meta se entera de lo que cierra', d: 'Cuando un lead califica o agenda, le devolvemos el evento por CAPI para que optimice con datos reales, no con clicks.' },
  ],
  // (Las de `whatsapp` —el servicio Chatwoot— se fueron el 09/10/2026 con la integración.) Vuelven el 29/10/2026 para las líneas por QR
  // (Evolution): lo que de verdad hace cada una.
  whatsapp: [
    // lib/evolution.ts (varias líneas por negocio, `evolution_instancias`) + app/whatsapp/EvolutionConnect.tsx (el QR)
    { t: 'Una línea o varias', d: 'Cada número se vincula con su QR, desde WhatsApp › Dispositivos vinculados. Por ejemplo, una línea por setter.' },
    // app/chats (la bandeja, con el desplegable de la línea)
    { t: 'Los chats, en MaKo', d: 'Las conversaciones de cada línea entran a Chats, y se contesta desde la misma línea.' },
    // lib/nutricion-canal.ts (el envío de Automations por la línea elegida)
    { t: 'Automations manda por la que elijas', d: 'Cada automatización sale por la línea que le digas.' },
  ],
  email: [
    // lib/nutricion.ts (mismo motor que WhatsApp, canal email)
    { t: 'Secuencias que salen solas', d: 'El mismo motor de nutrición, por mail: pasos, variables y horarios.' },
    // lib/email-marketing.ts (enviarBroadcast, prueba, programados)
    { t: 'Broadcasts a un segmento', d: 'Borrador, envío de prueba y programado. Sin pegar direcciones a mano.' },
    // lib/resend.ts (createResendDomain/verifyResendDomain) + DominioSetup
    { t: 'Tu dominio, verificado desde aquí', d: 'MaKo te da los registros DNS y chequea solo hasta que quede verificado. Sin dominio propio no sale nada.' },
    // app/api/webhooks/resend (aperturas/clicks/rebotes + supresión)
    { t: 'Quién abrió y quién clickeó', d: 'Aperturas, clicks y rebotes por paso. El que rebota duro se suprime solo y la baja es de un click.' },
  ],
  anthropic: [
    // ⚠️ 17/10/2026 (decisión 3 del relevo de Integraciones, tomada con criterio): la tarjeta decía «Sin esta llave, MaKo no
    // piensa» y «Opus para el análisis pesado, Sonnet para lo conversacional», lo contrario de lo que corre: MaKo piensa con
    // su red de IA sin ninguna llave (el onboarding no pide una desde el 15/10) y Claude entra SÓLO en las tareas de
    // `CLAUDE_PERMITIDO` (lib/veto-claude.ts). Lo que se promete es eso, y nada que dependa de un modelo en particular.
    { t: 'Tu Claude, para lo que pide más cabeza', d: 'Con tu llave, MaKo usa Claude donde hace falta. No es necesaria para empezar: MaKo tiene su propia red de IA.' },
    // lib/closing.ts (SPIN, objeciones, recomendaciones)
    { t: 'Analiza tus llamadas', d: 'El Closing Analyst puntúa cada llamada de venta por SPIN, marca las objeciones y te deja recomendaciones.' },
    // lib/model-registry.ts (modeloDeFeature, editable en /modelos-ia)
    { t: 'Cada tarea, con su IA a la vista', d: 'En Modelos de IA ves qué IA hace cada tarea. Claude entra sólo donde está permitido.' },
    // recordUsage → /api/anthropic-usage (Costo de MaKo)
    { t: 'Cada peso, a la vista', d: 'Qué proceso gastó cuánto, con qué modelo y cuándo. Sin sorpresas a fin de mes.' },
  ],
  openai: [
    // lib/transcribe.ts (whisper-1 + gpt-4o-mini) → alimenta lib/ads-analyst.ts
    { t: 'Escucha tus creativos', d: 'Transcribe el video de cada anuncio y lo parte en secciones. Eso es lo que después lee el Ads Analyst.' },
    // lib/transcribe.ts (transcribeMediaBuffer) → /conocimiento
    { t: 'Tus clases, en texto', d: 'Subes la grabación de un curso y queda como conocimiento consultable de MaKo.' },
    // lib/ai-cheap.ts: provDe('groq') ?? provDe('openai')
    { t: 'El suplente de lo barato', d: 'Cuando no hay Groq, las tareas simples caen aquí en vez de gastar Claude.' },
  ],
  groq: [
    // lib/ai-cheap.ts (Groq gana si hay llave) + lib/model-registry.ts
    { t: 'IA gratis para lo simple', d: 'Clasificar, extraer, titular. MaKo la prefiere sobre OpenAI cuando hay llave.' },
    // lib/mako-doer-in.ts → transcribirAudio (whisper-large-v3-turbo)
    { t: 'Tus notas de voz, en texto', d: 'Le mandas un audio a "Hola MaKo" por WhatsApp y lo entiende.' },
    { t: 'Se mide en tokens, no en plata', d: 'El plan gratis limita por tokens/día y reinicia cada día. No hay saldo que se vacíe.' },
  ],
  fathom: [
    // lib/closing.ts (triage barato → Claude: venta vs entrega, SPIN, objeciones)
    { t: 'Cada llamada, puntuada', d: 'El Closing Analyst separa venta de entrega, puntúa por SPIN y marca las objeciones que aparecieron.' },
    // app/closing/ClosingBrowser.tsx (iframe + transcript con deep-link al segundo)
    { t: 'El video y el transcript, juntos', d: 'Player embebido y transcript clickeable: tocas una línea y el video salta a ese segundo.' },
    // app/api/webhooks/fathom (inviteeSpoke → asistencia real) + lib/fathom-auto.ts
    { t: 'La reunión se marca sola', d: 'Llega la grabación y el lead avanza: R1 o R2, y la asistencia se confirma según si el lead realmente habló.' },
    // lib/closing.ts (reviseAnalysis / reviseWithMako, con edit_history)
    { t: 'La última palabra es tuya', d: 'Corriges un puntaje a mano o le pides a MaKo que re-analice con tu nota. Queda el historial.' },
  ],
  // Los otros grabadores de reuniones (26/10/2026, lib/grabadores): leen lo mismo que Fathom por la misma capa, así que
  // prometen lo mismo — y lo que su API no da, lo dice su slide (lib/grabadores/catalogo.ts, `queDa`).
  tldv: [
    // lib/grabadores/tldv.ts + lib/reunion-auto.ts (cron de cada hora y el aviso MeetingReady)
    { t: 'Las tareas salen solas', d: 'Termina la reunión y MaKo saca los compromisos: te deja el borrador en el Plan para que lo confirmes.' },
    // lib/closing.ts (las de venta) + lib/grabadores/al-terminar.ts (el lead, R1 o R2, y el link)
    { t: 'Cada venta, puntuada y en su lead', d: 'Las llamadas de venta se analizan en el Closing y la grabación queda en la ficha del lead.' },
  ],
  fireflies: [
    { t: 'Las tareas salen solas', d: 'Fireflies termina de transcribir y MaKo saca los compromisos: te deja el borrador en el Plan.' },
    { t: 'Cada venta, puntuada y en su lead', d: 'Las llamadas de venta se analizan en el Closing y la grabación queda en la ficha del lead.' },
  ],
  zoom: [
    { t: 'Tus grabaciones en la nube, leídas', d: 'Cuando Zoom termina la transcripción, MaKo saca las tareas al Plan y analiza las llamadas de venta.' },
    // lib/grabadores/formas.ts (`deZoom`): el correo de los de afuera viene vacío
    { t: 'Lo que Zoom no da', d: 'Zoom no comparte el correo de los invitados de afuera: el link de la grabación lo pegas tú en el lead.' },
  ],
  otter: [
    { t: 'Tus conversaciones, leídas', d: 'MaKo lee tus conversaciones de Otter cada hora, saca las tareas al Plan y analiza las de venta.' },
    { t: 'Sólo con Enterprise', d: 'La API de Otter es del plan Enterprise. Sin él, Otter no deja que ninguna app lea tus conversaciones.' },
  ],
  loom: [
    // lib/grabadores/catalogo.ts: Loom no tiene API (support.atlassian.com/loom, 26/10/2026)
    { t: 'Loom no tiene API', d: 'Loom no deja que ninguna app lea tus videos ni lo que se habló en ellos (lo dice Loom).' },
    // app/crm/campo-inline.ts (el link de un grabador) + el Plan → Importar (transcripciones)
    { t: 'Lo que sí puedes hacer', d: 'Pega el link del Loom en el lead, y sube su transcripción en el Plan → Importar: MaKo saca las tareas.' },
  ],
  readai: [
    { t: 'Llega pronto', d: 'Read AI da tus reuniones por su API, pero se conecta con su inicio de sesión, y ese botón todavía no está en MaKo.' },
  ],
  meet: [
    { t: 'Llega pronto', d: 'Leer las transcripciones de Meet pide un permiso de Google que MaKo todavía no tiene aprobado.' },
    { t: 'Mientras tanto', d: 'Graba tus Meet con Fathom, tl;dv o Fireflies: MaKo ya los lee.' },
  ],
  calendly: [
    // app/api/webhooks/calendly (respuestas por frase, UTMs, visitor_id de la landing)
    { t: 'La agenda se vuelve lead', d: 'Cada reserva entra al CRM con sus respuestas, sus UTMs y hasta el visitante anónimo que venía de la landing.' },
    // route.ts: una J2 NUNCA crea lead; sin match → enqueueJ2SinMatch (revisión)
    { t: 'R1 y R2, cada una en su lugar', d: 'Una R2 nunca crea un lead nuevo: se pega a la ficha que ya existe. Si no matchea, va a revisión en vez de duplicar.' },
    // junta_1_at (ISO con hora) → lib/crm-auto.ts T1 (respeta la decisión humana)
    { t: 'El No Show se detecta solo', d: 'Si la reunión pasó y no hubo grabación, queda marcada — salvo que una persona ya lo haya decidido.' },
    // lib/meta-capi.ts (Schedule, event_id determinístico para dedup con el píxel)
    { t: 'Meta se entera del agendado', d: 'Cada reserva dispara un evento Schedule por CAPI, deduplicado contra el píxel del navegador.' },
  ],
  panda: [
    // app/api/cron/panda-daily → marketing_metrics_daily (plataforma='panda')
    { t: 'Los plays del VSL, al día', d: 'Reproducciones y espectadores únicos, todos los días, sin tocar nada.' },
    // lib/queries.ts (cuadrosVsl: retención media + tiempo promedio)
    { t: 'Hasta dónde llegan', d: 'Retención media y tiempo promedio de visualización, al lado del resto del funnel.' },
    // app/marketing/page.tsx (KPI "Costo / VSL View")
    { t: 'Cuánto te cuesta un view', d: 'El gasto de ads dividido por los views del VSL, como una métrica más del tablero.' },
  ],
  'apify-instagram': [
    { t: 'Lee a tus competidores', d: 'El perfil y las publicaciones públicas de Instagram, con sus números, en Competitors Spy.' },
    { t: 'Corre con tu cuenta', d: 'Apify cobra por perfil leído, y MaKo no pasa de 40 lecturas por día.' },
  ],
  youtube: [
    // lib/queries.ts: "YouTube aporta la historia, Panda el presente"
    { t: 'La historia del VSL', d: 'Si tu VSL vivió en YouTube, sus views se unifican con los de Panda en una sola serie.' },
    // OJO: la API key sola solo trae el título; las views diarias necesitan OAuth
    // (lib/youtube-analytics.ts). Lo decimos en vez de prometer de más.
    { t: 'Views diarias del canal', d: 'Con el OAuth cargado, MaKo trae las views día por día. Con la API key sola alcanza para el título del video.' },
  ],
  google: [
    { t: 'Entrar con Google', d: 'El botón "Continuar con Google" del login. Si algo falla, la contraseña sigue andando.' },
    // lib/auto-reuniones.ts:83 → buscarEventosGoogle (SOLO lectura)
    { t: 'Calendar como tercera fuente', d: 'Al buscar las reuniones de un lead, MaKo también mira Google Calendar. Solo lee: no agenda ni toca nada.' },
  ],
  landing: [
    // app/api/webhooks/calendly: utm_term transporta el UUID anónimo (nqe_visitor_id)
    { t: 'El anónimo se vuelve lead', d: 'El Pixel marca cada visita. Cuando esa persona agenda, MaKo une la reserva con todo lo que hizo antes.' },
    // lib/integraciones.ts: la única integración cuyo estado son eventos REALES
    { t: 'La única que se comprueba de verdad', d: 'Las demás se ven «conectadas» porque hay una credencial cargada. Esta se pone en verde solo cuando llega un evento real.' },
  ],
  // La pasarela de pagos (11/10/2026, docs/diseno-pasarela-pagos.md). Cada slide afirma sólo lo que
  // está escrito en el contrato y en la lib que cita; lo que es FASE 2 (el botón «Pagos» del CRON de
  // Automations, el aviso al dueño) no se promete aquí.
  stripe: [
    // lib/cobros.ts (crearCobro, urlParaPagar) + app/pagar/[token]
    { t: 'Un link de pago por lead', d: 'Desde la ficha del lead armas el link con el monto y se lo mandas. Si el de Stripe vence, MaKo crea otro solo.' },
    // app/api/webhooks/stripe + lib/cobros.ts (aplicarPagoAprobado → lib/pagos.ts registrarCobroDeProveedor)
    { t: 'El pago entra solo al CRM', d: 'Cuando te pagan, la cuota queda pagada en la ficha y el lead pasa a ganado. Sin cargar nada a mano.' },
    // lib/stripe-api.ts (mode subscription, interval month) + invoice.paid en el webhook
    { t: 'Cobros mensuales', d: 'Una suscripción cobra cada mes, y cada renovación suma su cuota pagada en la ficha.' },
    // lib/cobros-conexion.ts (descubrirStripe → asegurarWebhookStripe)
    { t: 'Se configura con una clave', d: 'Pegas tu clave y MaKo encuentra tu cuenta y registra el aviso de pagos en Stripe por ti.' },
  ],
  mercadopago: [
    // lib/cobros.ts (crearCobro) + lib/pasarela-moneda.ts (la moneda sale del sitio de la cuenta)
    { t: 'Un link de pago por lead', d: 'Desde la ficha del lead armas el link en la moneda de tu país y se lo mandas por donde quieras.' },
    // app/api/webhooks/mercadopago + lib/cobros.ts (aplicarPagoAprobado)
    { t: 'El pago entra solo al CRM', d: 'Cuando te pagan, la cuota queda pagada en la ficha y el lead pasa a ganado. Sin cargar nada a mano.' },
    // app/api/webhooks/mercadopago: el aviso no se cree, se relee el pago con tu token (§4.5 del contrato)
    { t: 'Un aviso falso no marca nada', d: 'Antes de anotar un pago, MaKo lo vuelve a consultar en tu Mercado Pago. Solo cuenta lo que Mercado Pago confirma.' },
  ],
  // Claude enchufado a MaKo. Sin API key: se instala una skill del lado del usuario y
  // habla por /api/agente/* con un token.
  //
  // ⚠️ El orden importa y no es el histórico. Antes las tres slides hablaban del PLAN,
  // porque el plan fue lo primero que se conectó; hoy lo que más cambia la conversación
  // es que Claude arranque sabiendo a qué te dedicás, a quién le vendés y cómo suena tu
  // marca. Eso va primero.
  agente: [
    { t: 'Arranca sabiendo de tu negocio', d: 'Tu oferta, tu cliente ideal, tus avatares, tus razones de compra y la voz de tu marca, sin contárselo en cada chat.' },
    { t: 'Mira tu plan antes de proponerte nada', d: 'Lee tus tareas y proyectos abiertos: no te propone lo que ya está anotado y te avisa de lo urgente o vencido.' },
    { t: 'Te propone, no decide', d: 'Cuando encuentra algo para anotar, deja un borrador y te pasa el link. La prioridad la pone el Perro Guardián.' },
  ],
};
