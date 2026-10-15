// =============================================================================
// Qué cubre cada documento, en términos del PRODUCTO
// =============================================================================
// Un `.md` dice de qué habla en su título, pero no a qué TAB de MaKo pertenece.
// Sin eso, la lista de la izquierda son veinte nombres parecidos y hay que
// abrirlos para saber cuál servía.
//
// Es presentación, no contenido: por eso vive acá y no adentro de los .md.
// Si mañana se agrega un hallazgos-<área>.md nuevo y no está en este catálogo,
// la pantalla no rompe — sale sin etiquetas y listo.

export type FichaDoc = {
  /** Las rutas del producto que gobierna. Vacío = es transversal. */
  tabs: string[];
  /** Las funcionalidades concretas, para reconocerlo sin abrirlo. */
  hace: string[];
  /** Para agrupar la lista. */
  grupo: 'Arranque' | 'Por área' | 'Auditorías' | 'Referencia' | 'Chats';
};

export const CATALOGO: Record<string, FichaDoc> = {
  // --- lo que se lee primero ---
  AGENTS: {
    grupo: 'Arranque', tabs: [],
    hace: ['Las reglas que gobiernan código nuevo', 'Se carga en cada sesión'],
  },
  'mapa-del-proyecto': {
    grupo: 'Arranque', tabs: [],
    hace: ['Qué es MaKo y cómo está armado', 'El vocabulario', 'Estado real de cada pieza'],
  },
  'dos-cuentas': {
    grupo: 'Arranque', tabs: [],
    hace: ['Las dos cuentas de Claude sobre este clon', 'Qué comparten y qué no'],
  },
  'corridas-multiagente': {
    grupo: 'Arranque', tabs: [],
    hace: ['Registro de las 260 corridas de workflow', 'Cuáles dejaron algo escrito'],
  },
  chats: {
    grupo: 'Arranque', tabs: [],
    hace: ['Las 48 sesiones de trabajo: qué se hizo en cada una', 'Qué quedó pendiente y dónde hubo fricción'],
  },
  conectores: {
    grupo: 'Arranque', tabs: [],
    hace: ['Qué conectores tiene la cuenta de Claude', 'Cuáles se usan de verdad y en qué orden conectarlos'],
  },

  // --- uno por área, que es donde vive el código ---
  'friccion-crm': {
    grupo: 'Por área', tabs: ['/crm'],
    hace: ['Dónde el CRM interrumpe, pregunta o hace esperar', 'Qué sacar y qué mantener', 'Lo que cuesta cada freno, en clics por día'],
  },
  'hallazgos-crm': {
    grupo: 'Por área', tabs: ['/crm', '/dashboard'],
    hace: ['Leads y etapas', 'El funnel derivado', 'Agenda y horarios', 'Datos sin marcar', 'Historial del lead'],
  },
  'hallazgos-plan': {
    grupo: 'Por área', tabs: ['/plan'],
    hace: ['El board', 'El Perro Guardián', 'Reunión → tareas (Fathom)', 'Ruteo a proyectos', 'Dedup'],
  },
  'hallazgos-ia': {
    grupo: 'Por área', tabs: ['/modelos-ia', '/configuraciones'],
    hace: ['Qué modelo usa cada tarea', 'Prompts editables', 'Topes de salida', 'La cascada barata', 'Gasto', 'El doer'],
  },
  'hallazgos-comunicacion': {
    grupo: 'Por área', tabs: ['/whatsapp', '/automations', '/email', '/agencia'],
    hace: ['WhatsApp no oficial (Evolution)', 'WhatsApp oficial (Chatwoot)', 'Nutrición y secuencias', 'Email (Resend)', 'Avisos'],
  },
  'hallazgos-ads': {
    // Ads Analyst se retiró el 11/10/2026: su análisis es la hoja «Ads Analyst» del Dashboard y su tarea
    // (valorar un guion) vive en Ads Writer.
    grupo: 'Por área', tabs: ['/ads-manager', '/ads-writer', '/dashboard?hoja=ads-analyst'],
    hace: ['Lecturas de Meta', 'Crear y publicar campañas', 'Análisis de creativos'],
  },
  'hallazgos-landing': {
    // Landing Analyst se retiró el 11/10/2026: analizar una página vive en Landing Generator y los
    // números de la landing son la hoja «Landing» del Dashboard.
    grupo: 'Por área', tabs: ['/vsl', '/web-generator', '/dashboard?hoja=landing'],
    hace: ['Tracking y beacon', 'Retención del VSL', 'Analizar una landing', 'El copy de las landings'],
  },
  'hallazgos-ui': {
    grupo: 'Por área', tabs: ['/admin/ui'],
    hace: ['Primitives (app/_ui)', 'Modales y capas', 'Wizards', 'Estados de pantalla', 'Layout y sidebar', 'El texto de la UI'],
  },
  'hallazgos-infra': {
    grupo: 'Por área', tabs: [],
    hace: ['Supabase y paginado', 'Migraciones', 'Build y deploy', 'Crons', 'Entorno local', 'Zonas horarias', 'Tests'],
  },
  'hallazgos-seguridad': {
    grupo: 'Por área', tabs: ['/integraciones', '/metodo'],
    hace: ['Aislamiento multi-inquilino', 'Cifrado de credenciales', 'Firma de webhooks', 'Superficie expuesta'],
  },

  // --- fotos de un momento, no se mantienen ---
  'depuracion-crm-03oct': {
    grupo: 'Arranque', tabs: ['/crm'],
    hace: ['Qué entra y qué sale de las 25 tarjetas del CRM', 'Lo que el 17/10 necesita y no tiene tarjeta'],
  },
  'panorama-03oct': {
    grupo: 'Arranque', tabs: [],
    hace: ['El runway, la poda real y la ventana de venta', 'Cruza los dos audios con las dos llamadas y el tablero'],
  },
  'llamada-leila-01oct': {
    grupo: 'Auditorías', tabs: [],
    hace: ['El orden y las fechas del desarrollo (P1 al 7/10 … P5 al 21/10)', 'La poda que quedó sin hacer'],
  },
  'llamada-leila-21sep': {
    grupo: 'Auditorías', tabs: [],
    hace: ['La poda para poder lanzar: qué entra y qué sale', 'El criterio de descarte, con las citas'],
  },
  'auditoria-crm-30sep': {
    grupo: 'Auditorías', tabs: ['/crm'],
    hace: ['Las 25 tareas abiertas de «Feature: CRM», una por una', 'Qué está hecho y qué falta, con archivo:línea'],
  },
  'auditoria-aislamiento-workspace': {
    grupo: 'Auditorías', tabs: [],
    hace: ['Qué se scopea por workspace y qué no'],
  },
  'migracion-cifrado-credenciales': {
    grupo: 'Auditorías', tabs: ['/integraciones', '/metodo'],
    hace: ['Runbook de la migración a gcm2'],
  },
  'tareas-ya-hechas': {
    grupo: 'Auditorías', tabs: ['/plan'],
    hace: ['Barrido de tareas cerradas'],
  },

  // --- referencia puntual ---
  'branding-mako': {
    grupo: 'Referencia', tabs: ['/admin/ui', '/conocimientos'],
    hace: ['El manual de marca entero, para llevar afuera', 'Color, tipografía, logo y las dos voces', 'La gramática de los nueve estados (generada del código)'],
  },
  'lovable-tracking': {
    grupo: 'Referencia', tabs: ['/integraciones'],
    hace: ['El snippet del beacon en la landing del cliente'],
  },
  'nutricion-templates': {
    grupo: 'Referencia', tabs: ['/automations', '/whatsapp'],
    hace: ['Las plantillas de WhatsApp de la nutrición'],
  },
  'usuarios-y-acceso': {
    grupo: 'Referencia', tabs: ['/usuarios', '/equipo'],
    hace: ['Roles, sesión y quién ve qué'],
  },
  'productos-y-funnels-plan': {
    grupo: 'Referencia', tabs: ['/crm', '/onboarding'],
    hace: ['Multiples ofertas y funnels: que fase esta hecha y que falta', 'El orden exacto en que se aplican las migraciones nuevas'],
  },
  'modelo-oferta-producto-funnel': {
    grupo: 'Referencia', tabs: ['/crm', '/onboarding'],
    hace: ['El modelo de datos que manda: producto, oferta, funnel y participacion', 'El SQL de cada migracion y el test de aceptacion'],
  },
  hallazgos: {
    grupo: 'Referencia', tabs: [],
    hace: ['El índice de todos los hallazgos', 'Cómo está armado cada documento'],
  },
};

// «Chats» va último: son 49 transcripciones y taparían a los 22 documentos que
// se leen de verdad. No están en el catálogo una por una —se reconocen por el
// prefijo `chat-` del slug— porque son un archivo, no documentación curada.
export const ORDEN_GRUPOS: FichaDoc['grupo'][] = ['Arranque', 'Por área', 'Auditorías', 'Referencia', 'Chats'];
