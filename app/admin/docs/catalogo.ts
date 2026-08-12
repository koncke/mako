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
  'hallazgos-crm': {
    grupo: 'Por área', tabs: ['/crm', '/comercial'],
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
    grupo: 'Por área', tabs: ['/whatsapp', '/chatbot', '/email', '/agencia'],
    hace: ['WhatsApp no oficial (Evolution)', 'WhatsApp oficial (Chatwoot)', 'Nutrición y secuencias', 'Email (Resend)', 'Avisos'],
  },
  'hallazgos-ads': {
    grupo: 'Por área', tabs: ['/ads-manager', '/ads-analyst'],
    hace: ['Lecturas de Meta', 'Crear y publicar campañas', 'Análisis de creativos'],
  },
  'hallazgos-landing': {
    grupo: 'Por área', tabs: ['/vsl', '/landing-generator', '/landing-analyst'],
    hace: ['Tracking y beacon', 'Retención del VSL', 'Landing Analyst', 'El copy de las landings'],
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
    grupo: 'Referencia', tabs: ['/chatbot', '/whatsapp'],
    hace: ['Las plantillas de WhatsApp de la nutrición'],
  },
  'usuarios-y-acceso': {
    grupo: 'Referencia', tabs: ['/usuarios', '/equipo'],
    hace: ['Roles, sesión y quién ve qué'],
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
