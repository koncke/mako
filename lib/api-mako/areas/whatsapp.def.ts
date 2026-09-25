// =============================================================================
// api-mako/areas/whatsapp.def — las operaciones del área `whatsapp` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// whatsapp.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Dos bandejas conviven en la tab y las operaciones lo dicen en el id:
//   · `_oficial`  → número de la API de Meta, leído y escrito a través de Chatwoot.
//   · `_empresa`  → número vinculado por QR (Evolution), espejado en wa_mensajes.
//
// ⚠️ NINGUNA operación manda un mensaje a un lead. Lo único que existe es
// `crear_borrador_whatsapp_empresa`: deja el texto en la cola de borradores de
// /whatsapp y una persona lo manda con un clic. El envío directo (sendToContact,
// enviarYEspejar, plantillas pagas) no pasa por ningún gate y se quedó afuera.
//
// ⚠️ Los mensajes de personas (hilos, bandejas, borradores, asesoría) NO salen por
// http: `canales` sin 'http' a propósito. Lo mismo el número conectado y la salud
// de los webhooks (infraestructura).
//
// Las secuencias de nutrición (listar, ficha, activar, editar pasos, copy) viven en
// el área `chatbot`: el código es lib/nutricion*.ts y la tab es /chatbot.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const APP: ['whatsapp', 'app'] = ['whatsapp', 'app'];
const TODOS: ['whatsapp', 'app', 'http'] = ['whatsapp', 'app', 'http'];

const LEAD_ID: Parametro = { nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del lead (de buscar_leads).' };
const CONTACT_ID: Parametro = { nombre: 'contactId', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del contacto de Chatwoot (de listar_conversaciones_whatsapp_oficial o contacto_chatwoot_por_telefono).' };
const CHAT_JID: Parametro = { nombre: 'chatJid', tipo: 'string', max: 120, obligatorio: true, descripcion: 'chat del número de empresa: el jid («5215512345678@s.whatsapp.net», de listar_conversaciones_whatsapp_empresa) o el teléfono con lada (al menos 10 dígitos).' };
const ETAPAS_INBOX = ['cliente', 'por-cobrar', 'j2', 'post-j1', 'no-show', 'agendo', 'vio-vsl', 'form', 'abierto'] as const;

/** Los campos de una plantilla de Meta que se pueden escribir desde un agente. */
const CAMPOS_PLANTILLA: readonly Parametro[] = [
  { nombre: 'body', tipo: 'string', max: 1024, obligatorio: true, descripcion: 'cuerpo de la plantilla con variables NOMBRADAS ({{nombre}}, {{empresa}}); no puede empezar ni terminar con una variable.' },
  { nombre: 'category', tipo: 'string', enum: ['marketing', 'utility', 'authentication'], descripcion: 'categoría de Meta (default marketing).' },
  { nombre: 'header', tipo: 'string', max: 60, descripcion: 'encabezado de texto opcional (sin variables).' },
  { nombre: 'footer', tipo: 'string', max: 60, descripcion: 'pie opcional, sin variables ni emojis.' },
  {
    nombre: 'params', tipo: 'object[]', max: 20, descripcion: 'una entrada por variable del cuerpo, con un ejemplo realista (Meta lo exige).',
    campos: [
      { nombre: 'name', tipo: 'string', max: 60, obligatorio: true, descripcion: 'nombre de la variable sin llaves (p. ej. nombre).' },
      { nombre: 'example', tipo: 'string', max: 200, obligatorio: true, descripcion: 'valor de ejemplo (p. ej. Luis).' },
    ],
  },
];

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas: bandeja OFICIAL (Chatwoot / Meta) ───────────────────────────
  {
    id: 'historial_whatsapp', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Historial de WhatsApp oficial',
    descripcion: 'Últimos mensajes del WhatsApp OFICIAL (Chatwoot/Meta) con un lead: quién escribió (el lead, el negocio, o una plantilla del negocio), el texto y el estado de entrega. No cubre el número de empresa: para ese hilo usa hilo_whatsapp_empresa.',
    parametros: [LEAD_ID, { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 80, descripcion: 'cuántos mensajes traer, los más recientes (default 25, máximo 80).' }],
    salida: 'json', canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'listar_conversaciones_whatsapp_oficial', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Bandeja del WhatsApp oficial',
    descripcion: 'La bandeja oficial agrupada por persona (últimos 10 dígitos del teléfono): si el último mensaje es del lead (lo que dice si falta contestar; no hay contador de no leídos), si la ventana de 24 h está abierta y cuándo vence, y el lead del CRM que coincide con su etapa del inbox. Úsala para «¿quién me escribió y no le contesté?» o «¿a quién le vence la ventana hoy?». Lee las páginas más recientes de Chatwoot (25 conversaciones por página) y lo dice.',
    parametros: [
      { nombre: 'paginas', tipo: 'number', entero: true, minimo: 1, maximo: 8, descripcion: 'cuántas páginas de Chatwoot leer, de la más reciente (default 2 = ~50 conversaciones).' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántas personas devolver como máximo (default 30).' },
      { nombre: 'soloSinResponder', tipo: 'boolean', descripcion: 'true = solo las personas cuyo último mensaje es del lead.' },
      { nombre: 'soloVentanaAbierta', tipo: 'boolean', descripcion: 'true = solo las que tienen la ventana de 24 h abierta.' },
    ],
    salida: 'json', canales: APP, costo: 'externo', lenta: true,
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'hilo_contacto_whatsapp_oficial', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Hilo oficial de un contacto',
    descripcion: 'El hilo completo de un contacto del WhatsApp oficial, cronológico, juntando todas sus conversaciones de Chatwoot (si el contacto también escribió por otro canal de la cuenta, vienen mezcladas), con adjuntos, estado de entrega y error de Meta si falló. Separa lo que escribió el lead de lo que mandó el negocio y de las plantillas. Necesita el contactId (de listar_conversaciones_whatsapp_oficial). Para leer por lead usa historial_whatsapp.',
    parametros: [CONTACT_ID, { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 150, descripcion: 'cuántos mensajes devolver, los más recientes (default 40).' }],
    salida: 'json', canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'contacto_chatwoot_por_telefono', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Contacto oficial por teléfono',
    descripcion: 'Resuelve en vivo el contactId de Chatwoot de un teléfono (coincidencia por los últimos 10 dígitos) y confirma que esté en el inbox de WhatsApp de este negocio. No guardes el resultado: Chatwoot duplica contactos (+52 / +521) y el correcto cambia con la actividad.',
    parametros: [{ nombre: 'telefono', tipo: 'string', max: 30, obligatorio: true, descripcion: 'teléfono con o sin formato; se usan los últimos 10 dígitos (mínimo 8).' }],
    salida: 'json', canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },

  // ── Lecturas: plantillas de Meta ──────────────────────────────────────────
  {
    id: 'listar_plantillas_aprobadas', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Plantillas de WhatsApp aprobadas',
    descripcion: 'Las plantillas APROBADAS del WhatsApp oficial del negocio (las únicas que llegan fuera de la ventana de 24 h), con categoría, idioma, variables y texto. La fuente es Meta; si Meta no responde se cae a la lista de Chatwoot, que se sincroniza tarde, y la respuesta lo dice en `fuente`.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'listar_borradores_plantilla', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Borradores de plantilla y su estado',
    descripcion: 'Los borradores locales de plantillas de Meta con su estado guardado (borrador, pending, approved, rejected, paused, disabled), etapa asociada y motivo de rechazo explicado. Úsala para «¿qué plantillas tengo en revisión?» o para conseguir el id antes de enviar_plantilla_a_meta. El estado local envejece: para el estado en vivo usa estado_plantillas_meta.',
    parametros: [
      { nombre: 'status', tipo: 'string', enum: ['borrador', 'pending', 'approved', 'rejected', 'paused', 'disabled'], descripcion: 'filtra por estado guardado.' },
      { nombre: 'etapa', tipo: 'string', max: 60, descripcion: 'filtra por la etapa asociada al borrador.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'estado_plantillas_meta', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Estado en vivo de plantillas',
    descripcion: 'Todas las plantillas reales del WhatsApp oficial en Meta con su estado EN VIVO (pending, approved, rejected, paused, disabled) y el motivo de rechazo explicado. Es la respuesta a «¿ya me aprobaron la plantilla?». No actualiza los borradores locales: para eso propone reconciliar_plantillas.',
    parametros: [{ nombre: 'status', tipo: 'string', enum: ['pending', 'approved', 'rejected', 'paused', 'disabled'], descripcion: 'filtra por estado en Meta.' }],
    salida: 'json', canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'validar_plantilla', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Validar una plantilla con MaKo',
    descripcion: 'MaKo aplica la rúbrica de aprobación de Meta a una plantilla y devuelve riesgo (ALTO, MEDIO, BAJO), categoría sugerida, hallazgos con la regla citada y una propuesta corregida. Úsala SIEMPRE antes de enviar_plantilla_a_meta: cada rechazo cuesta un ciclo de revisión. Pasa el id de un borrador guardado, o name y body (y el resto de los campos) de una plantilla sin guardar. No guarda nada.',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id de un borrador guardado (de listar_borradores_plantilla). Si viene, se ignoran los demás campos.' },
      { nombre: 'name', tipo: 'string', max: 512, descripcion: 'nombre de la plantilla: minúsculas, números y guion bajo.' },
      { nombre: 'language', tipo: 'string', max: 20, descripcion: 'idioma de Meta (default es_MX).' },
      ...CAMPOS_PLANTILLA.map((p) => (p.nombre === 'body' ? { ...p, obligatorio: undefined, descripcion: `${p.descripcion} Obligatorio si no pasas id.` } : p)),
    ],
    salida: 'json', canales: APP, costo: 'ia', lenta: true,
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'variables_plantilla', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Variables que rellena la app',
    descripcion: 'El catálogo de variables {{...}} que la app sabe rellenar al enviar una plantilla o un paso (nombre = solo el primer nombre, nombre_completo, apellido, empresa). Con leadId devuelve el valor de cada una para ese lead; con texto devuelve el mensaje ya rellenado (con los datos del lead o con los ejemplos). Los corchetes tipo [tu link] NO son variables: nadie los reemplaza.',
    parametros: [
      { ...LEAD_ID, obligatorio: undefined, descripcion: 'id del lead para calcular los valores (opcional).' },
      { nombre: 'texto', tipo: 'string', max: 1024, descripcion: 'texto con variables a previsualizar (opcional).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },

  // ── Lecturas: estado de los canales ───────────────────────────────────────
  {
    id: 'estado_envio_whatsapp', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Interruptor de envío real',
    descripcion: 'Si el interruptor «Chatbot» de la tab WhatsApp está prendido (decide si el motor de nutrición manda de verdad o simula) y qué transporte hay: oficial (Chatwoot) y de empresa (según la fila guardada, que puede estar desactualizada; el dato medido es estado_canal_whatsapp_empresa). No gobierna lo que una persona manda a mano.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp', rolMinimo: 'admin' },
  },
  {
    id: 'estado_canal_whatsapp_empresa', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Estado medido del número de empresa',
    descripcion: 'Sondea en vivo (tope de 4 s) la sesión del número de empresa y dice si está conectado, desconectado o conectando, si el dato fue MEDIDO o se cayó a la fila guardada (`confirmado`), el número y perfil vinculados y, si está caído, el motivo y desde cuándo. Úsala para «¿mi WhatsApp de empresa está conectado?».',
    parametros: [],
    salida: 'json', canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },
  {
    id: 'salud_webhook_chatwoot', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Salud del webhook oficial',
    descripcion: 'Verifica de punta a punta que las respuestas del WhatsApp oficial le lleguen a MaKo: prueba el receptor, compara con el webhook registrado en Chatwoot y con el ruteo de la cuenta a este negocio. Si no da ok, la nutrición sigue escribiendo a leads que ya contestaron. Dice si reparar_webhook_chatwoot lo arregla.',
    parametros: [],
    salida: 'json', canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot', rolMinimo: 'admin' },
  },
  {
    id: 'salud_webhook_evolution', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Salud del espejo de empresa',
    descripcion: 'Verifica que los mensajes del número de empresa se estén copiando a MaKo: prueba el receptor y compara la configuración registrada en la instancia. Si no da ok, los hilos de empresa quedan incompletos. Dice si reparar_webhook_evolution lo arregla.',
    parametros: [],
    salida: 'json', canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },

  // ── Lecturas: bandeja de EMPRESA (Evolution, espejo wa_mensajes) ──────────
  {
    id: 'listar_conversaciones_whatsapp_empresa', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Bandeja del número de empresa',
    descripcion: 'Las conversaciones del número de empresa leídas del espejo de MaKo (no en vivo), una por persona, con lead, empresa, etapa del inbox, último mensaje, si el último es del lead y si está bloqueado. Nunca incluye los chats ocultos (son personales). El espejo se lee hasta los 20.000 mensajes más recientes. Úsala para «¿quién me escribió al número de empresa?».',
    parametros: [
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: 'cuántas conversaciones devolver (default 40).' },
      { nombre: 'soloSinResponder', tipo: 'boolean', descripcion: 'true = solo donde el último mensaje es del lead.' },
      { nombre: 'etapa', tipo: 'string', enum: [...ETAPAS_INBOX, 'manual'], descripcion: 'filtra por la etapa del inbox (derivación fija, no la etapa del funnel).' },
    ],
    salida: 'json', canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'hilo_whatsapp_empresa', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Hilo del número de empresa',
    descripcion: 'Los mensajes más recientes de una conversación del número de empresa, en orden, leídos SOLO del espejo de MaKo (lo que capturó el webhook o se sincronizó; si falta historia, propone sincronizar_chat_whatsapp_empresa). Separa lo que escribió el lead de lo que mandó el negocio y omite reacciones vacías. Coincide por los últimos 10 dígitos del teléfono además del jid exacto. Un chat oculto no se lee.',
    parametros: [CHAT_JID, { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 300, descripcion: 'cuántos mensajes devolver, los más recientes (default 50).' }],
    salida: 'json', canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'buscar_lead_para_whatsapp_empresa', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Buscar lead para escribirle',
    descripcion: 'Busca leads del CRM con teléfono por nombre, empresa o parte del teléfono y los devuelve con el chatJid del número de empresa, aunque nunca hayan tenido mensajes. Úsala antes de crear_borrador_whatsapp_empresa cuando solo tienes el nombre.',
    parametros: [
      { nombre: 'q', tipo: 'string', max: 100, obligatorio: true, descripcion: 'texto a buscar (mínimo 2 caracteres; 4 dígitos o más buscan también por teléfono).' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'cuántos resultados (default 10).' },
    ],
    salida: 'json', canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'listar_borradores_whatsapp_empresa', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Borradores por enviar',
    descripcion: 'La cola de borradores del número de empresa: mensajes que dejaron la nutrición, MaKo o el seguimiento post-llamada y que una persona tiene que mandar o descartar desde /whatsapp. Devuelve lead, teléfono, texto, origen y fecha. Úsala para «¿qué tengo pendiente de mandar?» o para el id antes de descartar_borrador_whatsapp_empresa.',
    parametros: [],
    salida: 'json', canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'contacto_bloqueado_whatsapp_empresa', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Bloqueo de un teléfono',
    descripcion: 'Dice si un teléfono está bloqueado u oculto en el número de empresa con la misma regla que lo aplica: la nutrición mira el teléfono EXACTO de cada lead y el inbox el del chat, así que un registro guardado con otro formato no frena nada y la respuesta lo muestra. Bloqueado = el motor de nutrición no le manda (un envío manual sí llega). Oculto = solo se saca del inbox y de lo que ve MaKo; no corta nada.',
    parametros: [{ nombre: 'telefono', tipo: 'string', max: 30, obligatorio: true, descripcion: 'teléfono con lada, con o sin formato (al menos 10 dígitos).' }],
    salida: 'json', canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'listar_etiquetas_whatsapp', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Etiquetas de WhatsApp por etapa',
    descripcion: 'El catálogo guardado de etiquetas del celular del número de empresa y qué etiqueta se pone sola cuando un lead entra en cada etapa del inbox (las 9 etapas fijas). No consulta el celular: para refrescar el catálogo propone sincronizar_etiquetas_whatsapp.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },
  {
    id: 'etapa_inbox_de_lead', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Etapa del inbox de un lead',
    descripcion: 'La etapa con la que las dos bandejas de WhatsApp muestran y filtran a un lead (cliente, por-cobrar, no-show, j2, post-j1, agendo, vio-vsl, form, abierto), derivada de sus fechas y asistencias. NO es la etapa del funnel configurable (pipeline_stage): la respuesta trae las dos para que digas cuál es cuál.',
    parametros: [LEAD_ID],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'lead_insiste_con_lo_mismo', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Objeción repetida del lead',
    descripcion: 'Cuenta, sin IA, si el último mensaje del lead repite una objeción que ya dijo antes (comparación por palabras, no textual). Es la señal para dejar de rebatir y cerrar o soltar. Pasa SOLO los textos que escribió el lead, en orden. El modelo no lleva la cuenta bien: la lleva esta operación.',
    parametros: [
      { nombre: 'mensajesDelLead', tipo: 'string[]', max: 200, obligatorio: true, descripcion: 'los textos entrantes del lead, del más viejo al más nuevo.' },
      { nombre: 'veces', tipo: 'number', entero: true, minimo: 2, maximo: 10, descripcion: 'a partir de cuántas veces cuenta como insistencia (default 3).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'historial_asesoria_whatsapp', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Asesoría previa sobre un contacto',
    descripcion: 'Lo que MaKo ya conversó con el equipo sobre un contacto en el asesor de WhatsApp de la tab (una sesión por persona). Sirve para no repetir el consejo y retomar el hilo. Pasa el teléfono del contacto.',
    parametros: [{ nombre: 'telefono', tipo: 'string', max: 30, obligatorio: true, descripcion: 'teléfono del contacto (se usan los últimos 10 dígitos, igual que la tab).' }],
    salida: 'json', canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'recomendar_mensajes_whatsapp', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Qué escribirle a un lead',
    descripcion: 'MaKo lee la conversación real con un lead, su etapa y si la ventana de 24 h está abierta, y devuelve un diagnóstico y 2 o 3 mensajes listos con ángulo y tono. No manda ni guarda nada. Trae antes la conversación con historial_whatsapp o hilo_whatsapp_empresa y pásala; para dejar el mensaje elegido en la cola usa crear_borrador_whatsapp_empresa.',
    parametros: [
      { nombre: 'contacto', tipo: 'string', max: 120, obligatorio: true, descripcion: 'nombre del lead.' },
      {
        nombre: 'mensajes', tipo: 'object[]', max: 80, obligatorio: true, descripcion: 'la conversación, del más viejo al más nuevo.',
        campos: [
          { nombre: 'saliente', tipo: 'boolean', obligatorio: true, descripcion: 'true si lo mandó el negocio, false si lo escribió el lead.' },
          { nombre: 'texto', tipo: 'string', max: 2000, descripcion: 'texto del mensaje.' },
        ],
      },
      { nombre: 'ventanaAbierta', tipo: 'boolean', obligatorio: true, descripcion: 'si la ventana de 24 h del WhatsApp oficial está abierta (en el número de empresa pasa true).' },
      { nombre: 'empresa', tipo: 'string', max: 120, descripcion: 'empresa del lead.' },
      { nombre: 'etapaLabel', tipo: 'string', max: 60, descripcion: 'etapa del lead, en palabras.' },
    ],
    salida: 'json', canales: APP, costo: 'ia', lenta: true,
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'redactar_plantilla_con_mako', area: 'whatsapp', tipo: 'lectura',
    titulo: 'Redactar una plantilla con MaKo',
    descripcion: 'MaKo redacta una plantilla de Meta con la metodología del negocio y las reglas de aprobación: nombre, categoría, cuerpo, pie y variables con ejemplo. No la guarda: para guardarla propone guardar_borrador_plantilla y valídala con validar_plantilla.',
    parametros: [
      { nombre: 'objetivo', tipo: 'string', max: 500, obligatorio: true, descripcion: 'para qué es la plantilla (p. ej. «reactivar leads que no agendaron»).' },
      { nombre: 'etapa', tipo: 'string', max: 60, descripcion: 'etapa del lead a la que apunta.' },
    ],
    salida: 'json', canales: APP, costo: 'ia', lenta: true,
    gating: { tab: 'whatsapp' },
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────
  {
    id: 'marcar_leido_whatsapp_oficial', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Marcar como leído un contacto',
    descripcion: 'Marca como leídas en Chatwoot todas las conversaciones de un contacto del WhatsApp oficial (también las de otros canales de la cuenta). Solo toca el contador interno de Chatwoot: la bandeja de la app guarda lo leído en el navegador y no cambia. No manda nada al lead. Necesita el contactId.',
    escribe: 'el último visto de las conversaciones del contacto en Chatwoot (no la bandeja de la app)',
    parametros: [CONTACT_ID],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'crear_contacto_chatwoot_lead', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Crear el chat oficial de un lead',
    descripcion: 'Crea (o reusa) el contacto de Chatwoot de un lead con su teléfono del CRM y una conversación vacía en el inbox de WhatsApp, para que aparezca en la bandeja oficial. No manda ningún mensaje. Úsala cuando un lead del CRM no aparece en la bandeja.',
    escribe: 'un contacto y una conversación vacía en Chatwoot',
    parametros: [LEAD_ID],
    canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'reparar_webhook_chatwoot', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Reparar el webhook oficial',
    descripcion: 'Vuelve a registrar el webhook de la cuenta de Chatwoot hacia MaKo y reclama el ruteo de la cuenta a este negocio. Solo sirve cuando salud_webhook_chatwoot dice no_registrado o sin_ruteo; los demás estados los resuelve el equipo técnico y esta operación lo dice.',
    escribe: 'el webhook de la cuenta de Chatwoot y el ruteo cuenta → negocio',
    parametros: [],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot', rolMinimo: 'admin' },
  },
  {
    id: 'reparar_webhook_evolution', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Reparar el espejo de empresa',
    descripcion: 'Vuelve a registrar en la instancia del número de empresa el webhook que copia los mensajes a MaKo, y verifica. Solo sirve cuando salud_webhook_evolution dice no_registrado; url_distinta y secret_prod son de la configuración de la plataforma y los resuelve el equipo técnico.',
    escribe: 'la configuración de webhook de la instancia de Evolution',
    parametros: [],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },
  {
    id: 'descartar_borrador_whatsapp_empresa', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Descartar un borrador',
    descripcion: 'Descarta un borrador pendiente de la cola del número de empresa (no se manda). Si lo dejó la nutrición, ese toque se pierde: la secuencia ya avanzó y no lo reintenta. Necesita el id (de listar_borradores_whatsapp_empresa).',
    escribe: 'el estado del borrador en wa_borradores (pasa a descartado)',
    parametros: [{ nombre: 'id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del borrador (de listar_borradores_whatsapp_empresa).' }],
    canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp' },
  },
  {
    id: 'sincronizar_chat_whatsapp_empresa', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Traer la historia de un chat',
    descripcion: 'Pide al número de empresa los últimos mensajes de UNA conversación (hasta 100 por jid) y los agrega al espejo de MaKo sin pisar lo que ya estaba. Úsala cuando hilo_whatsapp_empresa trae poca historia. No sirve con un chat oculto.',
    escribe: 'filas nuevas en wa_mensajes (sin pisar las existentes)',
    parametros: [CHAT_JID],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'sincronizar_etiquetas_whatsapp', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Refrescar etiquetas del celular',
    descripcion: 'Trae las etiquetas actuales del celular del número de empresa al catálogo de MaKo. Úsala antes de mapear_etapa_etiqueta_whatsapp si falta una etiqueta recién creada.',
    escribe: 'el catálogo de etiquetas en evolution_labels',
    parametros: [],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },
  {
    id: 'mapear_etapa_etiqueta_whatsapp', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Asociar etiqueta a una etapa',
    descripcion: 'Configura qué etiqueta del celular se pone sola cuando un lead entra en una etapa del inbox. Sin labelId, quita la etiqueta de esa etapa. El labelId sale de listar_etiquetas_whatsapp.',
    escribe: 'el mapeo etapa → etiqueta en evolution_stage_labels',
    parametros: [
      { nombre: 'etapa', tipo: 'string', enum: [...ETAPAS_INBOX, 'manual'], obligatorio: true, descripcion: 'etapa del inbox.' },
      { nombre: 'labelId', tipo: 'string', max: 60, descripcion: 'id de la etiqueta (de listar_etiquetas_whatsapp). Omítelo para quitar el mapeo.' },
    ],
    canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },
  {
    id: 'aplicar_etiqueta_lead_whatsapp', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Etiquetar un lead por su etapa',
    descripcion: 'Recalcula la etapa del inbox de un lead y deja en su chat del número de empresa EXACTAMENTE la etiqueta mapeada a esa etapa (quita las otras mapeadas). Necesita el mapeo configurado.',
    escribe: 'las etiquetas del chat del lead en el celular del número de empresa',
    parametros: [LEAD_ID],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'borrar_borrador_plantilla', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Borrar un borrador de plantilla',
    descripcion: 'Borra un borrador local de plantilla que TODAVÍA no se mandó a Meta (estado borrador). Si ya se mandó (pending, approved, rejected…) no sirve: usa borrar_plantilla_meta, que se revisa en pantalla.',
    escribe: 'borra la fila del borrador en whatsapp_template_drafts',
    parametros: [{ nombre: 'id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del borrador (de listar_borradores_plantilla).' }],
    canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'reconciliar_plantillas', area: 'whatsapp', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Actualizar estado de plantillas',
    descripcion: 'Trae de Meta el estado real de los borradores en revisión o rechazados y lo guarda (aprobada, rechazada con su motivo, pausada). No hay proceso automático que lo haga: sin esto el estado local puede estar viejo.',
    escribe: 'status y rejection_reason en whatsapp_template_drafts',
    parametros: [],
    canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },

  // ── Acciones en pantalla ──────────────────────────────────────────────────
  {
    id: 'crear_borrador_whatsapp_empresa', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/whatsapp', reversible: true,
    titulo: 'Proponer un WhatsApp a un lead',
    descripcion: 'Deja un mensaje propuesto en la cola de borradores del número de empresa para que una persona lo revise y lo mande con un clic desde /whatsapp. NO manda nada. Es la única forma de que MaKo proponga un WhatsApp a un lead. Pasa el leadId (el teléfono sale del CRM) o, si no es lead, el teléfono exacto. Si ya hay un borrador idéntico pendiente, devuelve ese.',
    escribe: 'una fila pendiente en wa_borradores con origen mako',
    parametros: [
      { nombre: 'texto', tipo: 'string', max: 4000, obligatorio: true, descripcion: 'el mensaje tal como se mandaría.' },
      { ...LEAD_ID, obligatorio: undefined, descripcion: 'id del lead destinatario (de buscar_leads). Preferido.' },
      { nombre: 'telefono', tipo: 'string', max: 30, descripcion: 'teléfono con lada, solo si no hay leadId.' },
    ],
    canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'bloquear_contacto_whatsapp_oficial', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Bloquear contacto oficial',
    descripcion: 'Bloquea o desbloquea un contacto en el WhatsApp oficial (bloqueado, sus mensajes no entran). Con leadId (tiene que ser el lead de ESE contacto: se cruza por teléfono), al BLOQUEAR un lead abierto lo pasa a descalificado con el motivo; desbloquear NO deshace la descalificación (se corrige a mano). Se revisa en pantalla.',
    escribe: 'el bloqueo del contacto en Chatwoot y, al bloquear un lead abierto, su etapa a descalificado con historial',
    parametros: [
      CONTACT_ID,
      { nombre: 'bloquear', tipo: 'boolean', obligatorio: true, descripcion: 'true bloquea, false desbloquea.' },
      { ...LEAD_ID, obligatorio: undefined, descripcion: 'lead que corresponde al contacto (opcional).' },
      { nombre: 'motivo', tipo: 'string', max: 200, descripcion: 'motivo de descalificación (default «Bloqueado en WhatsApp»).' },
    ],
    canales: APP, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'bloquear_contacto_whatsapp_empresa', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Bloquear teléfono en empresa',
    descripcion: 'Bloquea o desbloquea un teléfono en el número de empresa, a nivel MaKo: el motor de nutrición deja de mandarle y el inbox lo marca. No es un bloqueo de WhatsApp: la persona puede seguir escribiendo y un envío manual igual le llega. No toca el lead. Guarda el número en los formatos exactos que miran la nutrición y el inbox (el del lead y el del chat), y la pantalla los muestra.',
    escribe: 'wa_bloqueados (alta o baja del teléfono, con motivo y quién)',
    parametros: [
      { nombre: 'telefono', tipo: 'string', max: 30, obligatorio: true, descripcion: 'teléfono con lada (al menos 10 dígitos).' },
      { nombre: 'bloquear', tipo: 'boolean', obligatorio: true, descripcion: 'true bloquea, false desbloquea.' },
      { ...LEAD_ID, obligatorio: undefined, descripcion: 'lead asociado (opcional, queda registrado).' },
      { nombre: 'motivo', tipo: 'string', max: 200, descripcion: 'por qué se bloquea.' },
    ],
    canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'ocultar_contacto_whatsapp_empresa', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Ocultar un chat personal',
    descripcion: 'Oculta o vuelve a mostrar una conversación del número de empresa: sale del inbox y de lo que lee MaKo (para chats personales). No corta ningún envío. Se revisa en pantalla porque el teléfono tiene que ser exacto.',
    escribe: 'wa_ocultos (alta o baja del teléfono)',
    parametros: [
      { nombre: 'telefono', tipo: 'string', max: 30, obligatorio: true, descripcion: 'teléfono con lada (al menos 10 dígitos).' },
      { nombre: 'ocultar', tipo: 'boolean', obligatorio: true, descripcion: 'true oculta, false vuelve a mostrar.' },
      { ...LEAD_ID, obligatorio: undefined, descripcion: 'lead asociado (opcional).' },
    ],
    canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution' },
  },
  {
    id: 'borrar_chat_whatsapp_empresa', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar el historial de un chat',
    descripcion: 'Borra del espejo de MaKo todos los mensajes de UNA conversación del número de empresa, que tiene que existir en el espejo (la pantalla dice de quién es y cuántos mensajes son). Irreversible (el celular conserva su copia; se puede volver a traer con sincronizar_chat_whatsapp_empresa hasta donde Evolution tenga historia). Solo el administrador, en pantalla.',
    escribe: 'borra las filas de la conversación en wa_mensajes',
    parametros: [CHAT_JID],
    canales: APP, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'evolution', rolMinimo: 'admin' },
  },
  {
    id: 'prender_envio_whatsapp', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Prender o apagar el envío real',
    descripcion: 'Prende o apaga el interruptor «Chatbot» de la tab WhatsApp: con ON, toda secuencia de nutrición activa manda mensajes de verdad (y las plantillas oficiales las cobra Meta). Prender exige un número conectado. Solo el administrador, en pantalla.',
    escribe: 'app_settings.envio_whatsapp_enabled del negocio',
    parametros: [{ nombre: 'on', tipo: 'boolean', obligatorio: true, descripcion: 'true prende el envío real, false lo apaga.' }],
    canales: APP, costo: 'dinero',
    gating: { tab: 'whatsapp', rolMinimo: 'admin' },
  },
  {
    id: 'guardar_borrador_plantilla', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Guardar borrador de plantilla',
    descripcion: 'Crea un borrador de plantilla de Meta, o corrige uno que todavía no se mandó (estado borrador o rechazado) si pasas su id. No lo manda a Meta: eso es enviar_plantilla_a_meta. Al corregir se conservan los botones y el encabezado multimedia que ya tenía. Se revisa en pantalla.',
    escribe: 'una fila en whatsapp_template_drafts (alta, o edición del borrador indicado)',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del borrador a corregir (de listar_borradores_plantilla). Sin id, crea uno nuevo.' },
      { nombre: 'name', tipo: 'string', max: 512, obligatorio: true, descripcion: 'nombre: minúsculas, números y guion bajo, sin la palabra test.' },
      { nombre: 'language', tipo: 'string', max: 20, descripcion: 'idioma de Meta (default es_MX).' },
      ...CAMPOS_PLANTILLA,
      { nombre: 'etapa', tipo: 'string', max: 60, descripcion: 'etapa de la secuencia a la que se asocia (opcional).' },
    ],
    canales: TODOS, costo: 'gratis',
    gating: { tab: 'whatsapp', integracion: 'chatwoot' },
  },
  {
    id: 'enviar_plantilla_a_meta', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Mandar plantilla a aprobación',
    descripcion: 'Manda un borrador de plantilla (estado borrador o rechazado) a revisión de Meta; queda en pending hasta que Meta decida (horas o días; se ve con estado_plantillas_meta). Consume un ciclo de revisión: pasa antes por validar_plantilla. Solo el administrador, en pantalla.',
    escribe: 'crea la plantilla en Meta y deja el borrador en pending con su id de Meta',
    parametros: [{ nombre: 'id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del borrador (de listar_borradores_plantilla).' }],
    canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot', rolMinimo: 'admin' },
  },
  {
    id: 'editar_plantilla_meta', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Editar plantilla ya en Meta',
    descripcion: 'Cambia el contenido de una plantilla que ya existe en Meta (nombre e idioma no cambian). Vuelve a revisión: mientras está en pending NO se puede enviar y los pasos de secuencia que la usan dejan de salir. Conserva los botones; no edita plantillas con encabezado multimedia. Solo el administrador, en pantalla.',
    escribe: 'el contenido de la plantilla en Meta y su borrador local a pending',
    parametros: [
      { nombre: 'name', tipo: 'string', max: 512, obligatorio: true, descripcion: 'nombre exacto de la plantilla en Meta (de estado_plantillas_meta).' },
      { nombre: 'language', tipo: 'string', max: 20, descripcion: 'idioma de la plantilla (default es_MX).' },
      ...CAMPOS_PLANTILLA,
    ],
    canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot', rolMinimo: 'admin' },
  },
  {
    id: 'borrar_plantilla_meta', area: 'whatsapp', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar plantilla de Meta',
    descripcion: 'Borra una plantilla de Meta por nombre (todos sus idiomas) y después su borrador local. Irreversible: los pasos de secuencia que la usan quedan mudos. Solo el administrador, en pantalla.',
    escribe: 'borra la plantilla en Meta y sus filas en whatsapp_template_drafts',
    parametros: [{ nombre: 'name', tipo: 'string', max: 512, obligatorio: true, descripcion: 'nombre exacto de la plantilla (de estado_plantillas_meta o listar_borradores_plantilla).' }],
    canales: TODOS, costo: 'externo',
    gating: { tab: 'whatsapp', integracion: 'chatwoot', rolMinimo: 'admin' },
  },
];
