// =============================================================================
// api-mako/areas/crm.def — las operaciones del área `crm` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// crm.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Las NUEVE heredadas (buscar_leads, ficha_lead, reuniones_lead, reuniones_recientes,
// ver_funnel, listar_horarios_reunion, proponer_agendar_reunion, proponer_cambio_etapa,
// proponer_lead) conservan el id EXACTO: los usa el doer, la skill instalada y las
// pendientes que ya están en la base (`lead_etapa`, `agendar_reunion`). Sus cuerpos
// siguen en lib/mako-tools.ts y lib/mako-doer-acciones.ts: acá solo se envuelven.
//
// Qué NO está acá, a propósito:
//   · Datos sin marcar (getPendientesDeMarcar): la LECTURA escribe (registra etapas
//     derivadas en lead_audit y dispara Fathom). Ninguna lectura del registro escribe.
//   · Reagendar R1/R2, exportar la cartera, deshacer un movimiento, importar archivo:
//     la lógica vive inline en app/crm/actions.ts y pasa largo las 40 líneas.
//   · Acciones en lote (ignorar pendientes, completar setter/closer, ignorar empresa):
//     son masivas y no hay pantalla de revisión que muestre a quién tocan.
//   · Borrar un lead, guardar el funnel entero: irreversibles o de radio alto.
//   · Cuotas vencidas y cobranza de toda la cartera: no van acá, están en el área
//     métricas (getOutstandingDetalle y getCuotasPendientes, lib/api-mako/areas/metricas.run.ts).
//   · Identidades fiscales y equipo → área equipo; llamadas analizadas y follow-up
//     post llamada → área closing.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
// Los tipos de «Nuevo CRM» y lo que se elige con «Otro»: módulos PUROS, así el enum de `crear_crm`
// es el mismo catálogo que dibuja el modal (copiarlo a mano es crear uno que se desincroniza).
import { TIPOS_CRM, TIPO_CRM_OTRO, ENTRADAS_OFRECIDAS } from '@/lib/pipeline';
import { CANALES } from '@/lib/fase-diagnostico';

const TAB = { tab: 'crm' } as const;
const TAB_ADMIN = { tab: 'crm', rolMinimo: 'admin' } as const;
const CALENDLY = { tab: 'crm', integracion: 'calendly' } as const;
// ⚠️ `integracion` es INFORMATIVA (tipos.ts): no saca la tool del turno. El modelo ve
// las de Calendly y las de Google a la vez, así que cada descripción dice cuándo es
// la suya, y el runner contesta un error legible si la agenda no está conectada.
const GOOGLE = { tab: 'crm', integracion: 'google-calendar' } as const;
const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;

const leadId = (desc = 'id del lead (de buscar_leads o listar_leads).'): Parametro =>
  ({ nombre: 'leadId', tipo: 'number', descripcion: desc, obligatorio: true, entero: true, minimo: 1 });
// En la agenda de Google una reunión NO siempre es con un lead: «agendame una reunión mañana
// a las 12 que se llame PRUEBA» es un evento del negocio (pedido de un cliente inmobiliario,
// 08/10/2026). Sin lead se la busca por el día y la hora que dijo la persona.
const leadIdOpcional = (desc: string): Parametro =>
  ({ nombre: 'leadId', tipo: 'number', descripcion: desc, entero: true, minimo: 1 });
const fechaIso = (nombre: string, desc: string, obligatorio = false): Parametro =>
  ({ nombre, tipo: 'string', descripcion: desc, max: 10, ...(obligatorio ? { obligatorio: true } : {}) });
const cualReunion: Parametro = { nombre: 'cual', tipo: 'string', enum: ['R1', 'R2'], obligatorio: true, descripcion: 'qué reunión: R1 (primera) o R2 (segunda).' };
// ⚠️ EL PRODUCTO DEL CRM VA POR EL ID DE SU EMBUDO, que es lo que leen lib/lead-funnel.ts y la
// tabla `lead_funnel` (mig 0207). NO es el id de listar_productos (el catálogo de ofertas): del
// producto al embudo hay dos saltos, y un id del otro catálogo que coincida con un embudo
// movería al lead en el producto equivocado sin un solo error. Por eso se llama `embudoId`.
const embudoId: Parametro = { nombre: 'embudoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el producto del CRM, por el id de su embudo (de productos_del_lead). NO es el id de listar_productos.' };
// ⚠️ LAS ETIQUETAS DEL CRM VAN POR SU ID (mig 0224), nunca por el nombre: renombrar una etiqueta no
// puede romper una automatización que la pone. Lo leen las siete operaciones de etiquetas y el
// paso «⚡ Acción» de un flujo, que la elige de un desplegable (app/_components/EditorAccionMako.tsx).
const etiquetaId = (desc = 'id de la etiqueta (de listar_etiquetas).'): Parametro =>
  ({ nombre: 'etiquetaId', tipo: 'number', descripcion: desc, obligatorio: true, entero: true, minimo: 1 });
// El vínculo a una etapa y la etiqueta del celular, que comparten crear y editar.
const camposEtiqueta: readonly Parametro[] = [
  { nombre: 'color', tipo: 'string', max: 7, descripcion: 'color en hex, #RRGGBB (por ejemplo #5E81AC).' },
  { nombre: 'emoji', tipo: 'string', max: 16, descripcion: 'un emoji opcional que se muestra delante del nombre.' },
  { nombre: 'etapa', tipo: 'string', max: 60, descripcion: 'key de la etapa del CRM a la que se vincula (de ver_funnel o productos_del_lead). Vinculada, ponerla mueve al lead a esa etapa, y entrar o salir de la etapa la pone o la saca.' },
  { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el producto del CRM de esa etapa, por el id de su embudo (de productos_del_lead). Sin él, el producto principal del negocio.' },
  { nombre: 'waLabelId', tipo: 'string', max: 60, descripcion: 'la etiqueta del WhatsApp del celular a la que corresponde (de listar_etiquetas_whatsapp). Las de WhatsApp no se crean por API: se elige una que ya existe en el celular.' },
];

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas heredadas (lib/mako-tools.ts y lib/mako-doer-acciones.ts) ─────────
  {
    id: 'buscar_leads', area: 'crm', tipo: 'lectura',
    titulo: 'Buscar leads por texto',
    descripcion: 'Busca leads del negocio por nombre, teléfono, email o empresa y devuelve una lista compacta (id, nombre, estado, etapa, fechas de reuniones, monto de cierre en USD, closer y setter). Es el primer paso antes de cualquier otra operación sobre un lead: de aquí sale el leadId. Compara el texto tal cual (sensible a acentos) y devuelve como máximo 20 resultados.',
    parametros: [{ nombre: 'texto', tipo: 'string', obligatorio: true, max: 200, descripcion: 'texto a buscar en nombre, teléfono, email o empresa.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ficha_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Ficha de un lead',
    descripcion: 'La ficha de UN lead: contacto, estado comercial, fechas de R1 y R2 con asistencia, calificado, cierre y monto en USD, origen (campaña o UTM), closer y setter, más las respuestas del formulario de calificación de R1 y R2 y lo que contestó en el formulario de Meta (formulario_meta: pregunta y respuesta de las preguntas propias del formulario; null = no vino de un formulario de Meta o entró antes del 04/10/2026, y no significa que no contestó). Úsala después de buscar_leads cuando necesites el detalle antes de opinar o proponer algo. No trae cobranza, historial ni tracking: para eso están cobranza_lead, historial_lead y tracking_lead.',
    parametros: [leadId()],
    // ⚠️ formulario_meta sale por TODOS los canales, a propósito (08/10/2026): es dato del lead
    // como el teléfono y el email, que esta misma ficha ya entrega. Los dos caminos de afuera
    // son el runner de HTTP (crm.run.ts → runMakoTool) y la ruta vieja de la skill
    // (app/api/agente/consultar, que corre runMakoTool directo, sin ctx.canal): recortarlo en
    // uno solo deja el otro abierto. El snapshot de HTTP fija ids, no campos: esto no lo frena nada.
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'reuniones_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Reuniones y grabaciones de un lead',
    descripcion: 'Busca las reuniones de un lead: fechas reales de R1 y R2 en Calendly (por el email del invitado), grabaciones de Fathom ya analizadas y enganchadas al lead, y las llamadas analizadas por Closing Analyst con su score. NO incluye la agenda de Google: si el negocio agenda en Google, lo que tiene el lead ahí lo muestra reuniones_agenda_lead. Ojo: si el análisis de una llamada nunca corrió, no aparece; vacío NO significa que la reunión no ocurrió.',
    parametros: [leadId()],
    // SIN http: fathomR1/fathomR2 traen el share_url de Fathom, el link público a la
    // grabación y la transcripción de una llamada de venta con una persona.
    // Sin Google Calendar, a propósito: lo lee un modelo, y la agenda no pasa por ninguno
    // (lib/agenda-sin-ia.ts). La agenda de un lead la muestra reuniones_agenda_lead.
    salida: 'json', canales: SIN_HTTP, costo: 'externo', gating: TAB, lenta: true,
  },
  {
    id: 'reuniones_recientes', area: 'crm', tipo: 'lectura',
    titulo: 'Últimas reuniones del negocio',
    descripcion: 'Las reuniones R1 y R2 más recientes del negocio (ventana hacia atrás de N días más la próxima semana), ordenadas por fecha, con el lead, la hora en la zona del negocio, si asistió, si ya pasó y si tiene Fathom cargado. Úsala cuando pregunten por «la última llamada» sin nombrar al lead, o para ver a qué reunión pasada le falta la grabación.',
    parametros: [{ nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 90, descripcion: 'ventana hacia atrás en días (default 21, máximo 90).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_funnel', area: 'crm', tipo: 'lectura',
    titulo: 'Etapas del funnel del negocio',
    descripcion: 'La estructura del proceso comercial configurado en /funnel: el pipeline activo en orden (con su tipo: entrada, reunión, pago, cierre), las etapas de nutrición y las de descarte, con su key. Úsala antes de proponer un cambio de etapa o de filtrar leads para usar las keys REALES del negocio y no un embudo genérico. No pide parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_horarios_reunion', area: 'crm', tipo: 'lectura',
    titulo: 'Horarios libres en Calendly',
    descripcion: 'Los horarios REALES libres en Calendly para la R1 o la R2 en los próximos días, con el startIso exacto que Calendly acepta y la hora legible en la zona del negocio (máximo 12). Paso obligatorio antes de proponer_agendar_reunion: el startIso se copia TAL CUAL, sin redondear. A la persona se le muestra la hora legible, no el startIso.',
    parametros: [
      cualReunion,
      { nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 31, descripcion: 'cuántos días hacia adelante mirar (1 a 31; default 7).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: CALENDLY,
  },

  // ── Lecturas nuevas ────────────────────────────────────────────────────────────
  {
    id: 'listar_leads', area: 'crm', tipo: 'lectura',
    titulo: 'Listar leads con filtros',
    descripcion: 'Lista la cartera filtrada por etapa EFECTIVA (la misma que pinta el tablero, no la columna cruda), por banda del funnel (activo, nutrición o descartado), por una ventana de fechas sobre alta, agenda, R1, R2 o cierre, y por closer o setter. Responde «¿qué leads tengo en R2?», «¿cuántos entraron esta semana?», «¿quiénes están en nutrición sin setter?». Devuelve el total que coincide y como máximo `limite` filas, más recientes primero; dice cuántas quedaron afuera.',
    parametros: [
      { nombre: 'etapas', tipo: 'string[]', max: 20, descripcion: 'keys de etapa (de ver_funnel). Si no vienen, todas las de la banda.' },
      { nombre: 'banda', tipo: 'string', enum: ['activo', 'nutricion', 'descartado'], descripcion: 'banda del funnel: activo (pipeline), nutricion o descartado.' },
      { nombre: 'campo_fecha', tipo: 'string', enum: ['created_at', 'fecha_agenda', 'fecha_junta_1', 'fecha_junta_2', 'fecha_cierre'], descripcion: 'a qué fecha se aplican desde/hasta (default created_at, el alta).' },
      fechaIso('desde', 'YYYY-MM-DD, inclusive.'),
      fechaIso('hasta', 'YYYY-MM-DD, inclusive.'),
      { nombre: 'persona', tipo: 'string', max: 120, descripcion: 'nombre del closer o setter tal como figura en el lead, o SIN_ASIGNAR para los que no tienen ninguno.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántas filas devolver (default 30, máximo 100).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'contar_leads_por_etapa', area: 'crm', tipo: 'lectura',
    titulo: 'Conteo de leads por etapa',
    descripcion: 'La foto del tablero en números: cuántos leads hay en cada etapa del funnel (con su banda), cuántos por origen (campaña, anuncio o canal, los 15 principales) y cuántos no tienen closer ni setter, más el total de la cartera. Responde «¿cómo está repartida mi cartera?». No pide parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'transiciones_desde_etapa', area: 'crm', tipo: 'lectura',
    titulo: 'A qué etapas puede pasar',
    descripcion: 'Dada una etapa, a qué etapas permite pasar el funnel del negocio (avanza, nutrición o pérdida), con la etiqueta de cada destino. Si se declara si asistió a la reunión, filtra los destinos que lo contradicen. Úsala antes de proponer_cambio_etapa para no proponer un movimiento que el funnel no contempla.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 60, descripcion: 'key de la etapa actual (de ver_funnel o de la etapa de ficha_lead).' },
      { nombre: 'asistio', tipo: 'boolean', descripcion: 'si ya se sabe: true asistió a la reunión, false no se presentó.' },
      { nombre: 'cual', tipo: 'string', enum: ['R1', 'R2'], descripcion: 'a qué reunión se refiere `asistio` (default R1).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'requisitos_para_mover', area: 'crm', tipo: 'lectura',
    titulo: 'Qué falta para mover un lead',
    descripcion: 'Antes de proponer un cambio de etapa: qué datos exige la etapa DESTINO que el lead todavía no tiene (fecha de reunión, asistencia, Fathom si la reunión ya pasó, monto para ganado, motivo para perdido o descalificado). Separa lo que se puede pedir por el chat (monto y motivo) de lo que solo se carga en la ficha. Lista vacía = se puede mover.',
    parametros: [
      leadId(),
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 60, descripcion: 'key de la etapa destino (de ver_funnel).' },
      { nombre: 'monto', tipo: 'number', minimo: 0, descripcion: 'monto de cierre en USD que se aportaría en el movimiento.' },
      { nombre: 'motivo', tipo: 'string', max: 500, descripcion: 'motivo de pérdida o descalificación que se aportaría.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'faltantes_del_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Datos que le faltan a un lead',
    descripcion: 'Los datos que la etapa ACTUAL de un lead adeuda para que el tablero sea confiable (asistencia, calificado, Fathom, monto, plan de pagos, comprobantes, motivo, setter, empresa, Deal Details), respetando sus excepciones declaradas. Sirve para explicar por qué un lead aparece en «Datos sin marcar» y qué cargar. Lista vacía = el lead está al día.',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'reuniones_proximas', area: 'crm', tipo: 'lectura',
    titulo: 'Reuniones de los próximos días',
    descripcion: 'Las R1 y R2 agendadas desde hoy (en la zona del negocio) y los próximos días, con lo que hay que saber antes de la llamada: quién es, empresa, respuestas del formulario, si vio el VSL (vio / sin_ver / sin_datos: sin datos NO significa que no lo vio), origen, madurez y estado. Solo el día, sin hora: para la hora usa reuniones_recientes. Responde «¿qué reuniones tengo hoy?».',
    parametros: [{ nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 14, descripcion: 'cuántos días contando hoy (default 2: hoy y mañana; máximo 14).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'historial_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Historial de cambios de un lead',
    descripcion: 'Quién tocó qué campo de un lead y cuándo (etapa, estado, asistencias, fechas, closer, setter, monto, motivo, contacto), con MaKo como autor cuando fue la IA, más los eventos sueltos (reuniones agendadas, notas, pagos, movimientos automáticos). Más reciente primero, con tope de 100 filas: si llega al tope, lo dice. Responde «¿quién movió a este lead y cuándo?».',
    parametros: [leadId()],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'notas_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Notas de seguimiento de un lead',
    descripcion: 'Las notas manuales que el equipo dejó sobre un lead (llamadas, acuerdos, recordatorios), con fecha y autor, más recientes primero. Salen del historial, que tiene tope de 100 eventos: en un lead con mucho movimiento las notas más viejas pueden no aparecer, y la respuesta lo avisa.',
    parametros: [leadId()],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'cobranza_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Plan de pagos de un lead',
    descripcion: 'El estado de cobranza de UN lead: total vendido en USD, si es suscripción (con su monto mensual), duración, fecha de cierre e inicio de servicio, si tiene contrato, y cada cuota con su id, monto en USD, vencimiento, si está pagada, fecha de pago y si tiene comprobante. Responde «¿cuánto le falta pagar a X?». El id de cada cuota es el que pide marcar_pago_cobrado.',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'insight_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Último diagnóstico MaKo del lead',
    descripcion: 'El diagnóstico comercial más reciente que MaKo generó para un lead (resumen, dolor, situación, señales de compra, objeciones, riesgos, próxima acción, preguntas y qué datos faltan), con las fuentes que usó y cuándo se generó. Úsala antes de proponer generar_insight_lead: si el último es reciente, no hace falta gastar otra generación.',
    parametros: [leadId()],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'tracking_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Landing y VSL de un lead',
    descripcion: 'Qué hizo un lead en la landing y el VSL: resumen de visitas (total, días distintos, primera y última), reproducciones y porcentaje máximo visto por video, y los últimos 60 eventos (visitas, plays, retención, abandono). Solo existe si el lead tiene visitor_id: sin él la respuesta es «sin datos», que NO significa que no vio el VSL. Responde «¿vio el VSL antes de agendar?».',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'journey_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Recorrido de un lead',
    descripcion: 'La línea de tiempo de un lead en orden: entró, agendó, R1 (asistió, no-show o agendada), R2, confirmó, primer pago y cierre (ganado, perdido o en proceso), cada hito con su fecha y estado. Es barata y sirve para narrar «qué pasó con X» sin interpretar fechas sueltas.',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'duplicados_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Contacto ya cargado en el CRM',
    descripcion: 'Dado un nombre, email o teléfono, qué leads existentes parecen la misma persona y por qué (email, teléfono por sus últimos 10 dígitos, o nombre sin acentos solo cuando no hay email ni teléfono). Úsala antes de proponer_lead para avisar «ya está cargado» con su id. Si la consulta falla devuelve vacío: vacío no garantiza que no exista.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', max: 200, descripcion: 'nombre y apellido.' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email.' },
      { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono en cualquier formato.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'propuestas_lead_pendientes', area: 'crm', tipo: 'lectura',
    titulo: 'Leads propuestos sin confirmar',
    descripcion: 'La bandeja /crm/revisar: altas de leads que dejó un canal (Claude, WhatsApp, un formulario) y nadie confirmó todavía, con su link, cuántos contactos trae cada una y hace cuántas horas espera. Responde «¿tengo leads sin confirmar?». Tope de 100 propuestas.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  // El Leads Scraper (15/10/2026, docs/diseno-leads-scraper.md): la lista aparte de la prospección en
  // frío. SIN HTTP: son datos de contacto de terceros (decisión de canales de la casa). Buscar y pasar
  // al CRM son acciones que CUESTAN PLATA o escriben en lote: van por la pantalla /crm/prospectos.
  {
    id: 'listar_prospectos', area: 'crm', tipo: 'lectura',
    titulo: 'Prospectos de la búsqueda en frío',
    descripcion: 'La lista de prospectos que encontraron las búsquedas en Google Maps o Instagram (la pantalla /crm/prospectos), ordenada por puntaje: nombre, rubro, ciudad, fuente, si se puede contactar (tiene email o teléfono), el puntaje de 0 a 100 con su razón y su estado (por revisar, en el CRM o descartado). Responde «¿cuáles son los mejores prospectos?» o «¿cuántos me quedan por revisar?». No pasa a nadie al CRM: eso se hace en la pantalla.',
    parametros: [
      { nombre: 'estado', tipo: 'string', enum: ['nuevo', 'en_crm', 'descartado'], descripcion: 'nuevo (por revisar, el default), en_crm o descartado.' },
      { nombre: 'minimo', tipo: 'number', entero: true, minimo: 0, maximo: 100, descripcion: 'puntaje mínimo (default 0).' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos devolver, de mayor a menor puntaje (default 30, máximo 100).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'busquedas_prospeccion', area: 'crm', tipo: 'lectura',
    titulo: 'Búsquedas de prospectos',
    descripcion: 'Las últimas 20 búsquedas de prospectos (Google Maps o Instagram): qué se buscó, dónde, cuántos, si sigue corriendo, terminó o falló (con el motivo) y cuántos prospectos nuevos trajo. Responde «¿ya terminó la búsqueda de inmobiliarias?». No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'confirmaciones_crm_automatico', area: 'crm', tipo: 'lectura',
    titulo: 'Cambios automáticos por confirmar',
    descripcion: 'Lo que el CRM automático de MaKo ya aplicó o propone y espera que una persona confirme, rechace o elija una opción (no-show detectado por Fathom, nutrición manual vencida, reactivación): id, lead, regla, título, cambios campo por campo y opciones. Son TODAS las del negocio; el aviso del CRM muestra sólo las del producto que se está mirando, así que su número puede ser menor. El id es el que pide resolver_confirmacion_crm. Tope de 100.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'estado_crm_automatico', area: 'crm', tipo: 'lectura',
    titulo: 'Estado del CRM automático',
    descripcion: 'Si este negocio tiene prendido que MaKo mueva leads solo (reglas de no-show, nutrición, nutrición manual vencida y reactivación, con confirmación posterior). Un negocio sin configurarlo está apagado, salvo el workspace principal, que hereda la configuración del deploy: `origen` dice de dónde sale el valor. No pide parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'evaluar_crm_automatico', area: 'crm', tipo: 'lectura',
    titulo: 'Qué haría hoy el CRM automático',
    descripcion: 'Simulación sin escribir nada: qué movimientos haría hoy MaKo sobre la cartera con las reglas del CRM automático (reunión pasada sin marcar, lead sin agendar a nutrición, nutrición manual vencida, lead frío a reactivación), con el conteo por regla y hasta 50 acciones de ejemplo. Sirve para explicar el motor antes de prenderlo. Con etapas propias del funnel puede no disparar nada: la respuesta lo advierte.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'horarios_libres_dia', area: 'crm', tipo: 'lectura',
    // «huecos» en el título: es como se pregunta («¿tengo hueco el jueves?»), y la
    // relevancia del turno puntúa id + título doble. Lo mide tests/agenda-whatsapp.test.ts.
    titulo: 'Horarios libres o huecos del día',
    descripcion: 'Le MUESTRA a la persona los horarios libres de un día según la agenda de Google del negocio, en su zona horaria. Tú NO ves la agenda: el sistema se la muestra directo y tú recibes sólo que se mostró. Úsala cuando quieran agendar y no dijeron la hora, o cuando pregunten qué tienen libre; después pídele que elija una hora.',
    parametros: [
      fechaIso('fecha', 'YYYY-MM-DD del día a mirar.', true),
      { nombre: 'duracion_min', tipo: 'number', entero: true, minimo: 15, maximo: 240, descripcion: 'minutos de la reunión (default 45): el hueco solo cuenta si entra entera.' },
    ],
    // SIN http desde el 07/10/2026: el libre/ocupado es de la agenda de Google, y la agenda
    // no pasa por ningún modelo — tampoco por el agente del cliente que llama con su token.
    // Por chat lo ve la persona (lib/agenda-sin-ia.ts); por HTTP no hay persona.
    salida: 'json', canales: SIN_HTTP, costo: 'externo', gating: { tab: 'crm', integracion: 'google-calendar' },
    datosDeGoogle: true,
  },
  {
    id: 'reuniones_agenda_lead', area: 'crm', tipo: 'lectura',
    // El título lleva las palabras con las que se PIDE mover («reagendá», «cambiá»,
    // «mové»): la relevancia del turno puntúa id + título doble, y sin ellas esta
    // lectura quedaba afuera del presupuesto de 12.000 caracteres frente al resto del
    // CRM. Lo mide tests/agenda-whatsapp.test.ts.
    titulo: 'Próximas reuniones para mover o reagendar',
    descripcion: 'Le MUESTRA a la persona las próximas reuniones (o visitas, o citas) de un lead en la agenda de Google del negocio: las que lo tienen invitado por su email, en los próximos 60 días. Tú NO ves la lista: el sistema se la muestra directo y tú recibes sólo que se mostró. Úsala cuando pregunten qué reuniones tiene alguien. Para mover una no hace falta: proponer_mover_reunion la encuentra con el día y la hora que dijo la persona.',
    parametros: [leadId('id del lead (con email cargado).')],
    // SIN http: son los eventos de la agenda de Google del negocio, con el nombre de
    // terceros en el título. Por chat los ve la persona y nunca el modelo
    // (lib/agenda-sin-ia.ts); por HTTP no hay persona a quien mostrárselos.
    salida: 'json', canales: SIN_HTTP, costo: 'externo', gating: GOOGLE, datosDeGoogle: true,
  },
  {
    id: 'agenda_del_dia', area: 'crm', tipo: 'lectura',
    // «qué tengo» en el título: es como se pregunta, y la relevancia del turno puntúa id +
    // título doble. Lo mide tests/agenda-whatsapp.test.ts.
    titulo: 'Agenda del día: qué tengo',
    descripcion: 'Le MUESTRA a la persona todo lo que tiene un día en la agenda de Google del negocio (con o sin invitados), en su zona horaria. Tú NO ves la agenda: el sistema se la muestra directo y tú recibes sólo que se mostró. Úsala cuando pregunten qué tienen hoy, mañana o un día, o a una hora. Para mover, cambiar o cancelar una no hace falta: esas herramientas la encuentran con el día y la hora que dijo la persona.',
    parametros: [fechaIso('fecha', 'YYYY-MM-DD del día a mirar.', true)],
    // SIN http: es la agenda de Google del negocio; por chat la ve la persona y nunca el
    // modelo (lib/agenda-sin-ia.ts), y por HTTP no hay persona.
    salida: 'json', canales: SIN_HTTP, costo: 'externo', gating: GOOGLE, datosDeGoogle: true,
  },
  {
    id: 'link_agenda_calendly', area: 'crm', tipo: 'lectura',
    titulo: 'Link de Calendly para agendar',
    descripcion: 'La página pública de Calendly del negocio para la R1 o la R2, opcionalmente con el nombre y el email de un lead ya completados. Es lo que se manda cuando la reserva directa no se puede hacer. No crea nada en Calendly. Sin Calendly configurado devuelve el motivo, nunca la agenda de otro. El link lo arma el código: se pasa tal cual.',
    parametros: [
      cualReunion,
      { nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del lead para completar su nombre y email (opcional).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: CALENDLY,
  },
  {
    id: 'link_resumen_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Link al resumen de un lead',
    descripcion: 'El link a la pantalla /crm/<id>/resumen (todo lo del lead antes y después de la llamada, pensado para el celular), con la próxima reunión, cuántas llamadas analizadas tiene y si MaKo dejó un follow-up sin enviar. Por WhatsApp NO se cuenta la reunión: se manda este link tal cual.',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'r2_sin_lead', area: 'crm', tipo: 'lectura',
    titulo: 'R2 agendadas sin lead',
    descripcion: 'Reuniones 2 que entraron por Calendly y no se pudieron atar a ningún lead (ni por teléfono ni por email): quedan para resolver a mano. Devuelve nombre, email y fecha del evento, más nuevas primero, con tope de 50.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_productos', area: 'crm', tipo: 'lectura',
    titulo: 'Catálogo de productos y ofertas',
    descripcion: 'Los productos u ofertas del negocio con id, tipo (pago único o suscripción), precio en USD (o mensualidad y plazo), promesa, qué incluye, garantía y si está activo. Úsala antes de hablar de precios o de proponer guardar_producto. El CRM todavía no vincula un producto al cierre de un lead.',
    parametros: [{ nombre: 'soloActivos', tipo: 'boolean', descripcion: 'true para ver solo los activos (default false).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  // Un lead en VARIOS productos (mig 0207, 06/10/2026) no existía para ninguna operación del
  // registro (medido el 08/10). SIN http, como las tres acciones que lo usan: abrirlo es una
  // decisión que regenera tests/api-mako-http.snapshot.txt.
  {
    id: 'productos_del_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Productos del CRM de un lead',
    descripcion: 'Los productos del CRM del negocio (cada uno con su propio tablero de etapas), con el embudoId y las keys de etapa que piden agregar_lead_a_producto, quitar_lead_de_producto y mover_lead_en_producto. Con leadId, además, en cuáles está ese lead, en qué etapa de cada uno, cuál es su producto principal y si se lo puede quitar de alguno (solo con dos o más). Un lead puede estar en varios productos a la vez. El embudoId NO es el id de listar_productos (el catálogo de ofertas).',
    parametros: [{ nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads). Sin él, solo la lista de productos con sus etapas.' }],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  // Las ETIQUETAS del CRM (mig 0224, punto 12 del rediseño de /automations). Salen por HTTP a
  // propósito: la sesión de la API de MaKo las pidió con sus rutas REST (diseño §3), y no traen
  // conversaciones, transcripts ni datos del equipo.
  {
    id: 'listar_etiquetas', area: 'crm', tipo: 'lectura',
    titulo: 'Etiquetas del CRM',
    descripcion: 'Las etiquetas del CRM del negocio (las que se le agregan a un lead: «Seguimiento», «Cualificado»…) con su id, nombre, color, la etapa del CRM a la que está vinculada (si la hay), a qué etiqueta del WhatsApp del celular corresponde y cuántos leads la tienen. De aquí sale el etiquetaId que piden poner_etiqueta_lead, sacar_etiqueta_lead, editar_etiqueta y archivar_etiqueta. Las archivadas no se pueden agregar y solo vienen si se piden.',
    parametros: [{ nombre: 'incluirArchivadas', tipo: 'boolean', descripcion: 'true para ver también las archivadas (default false).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'etiquetas_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Etiquetas de un lead',
    descripcion: 'Las etiquetas que tiene UN lead, con su id, nombre y color, cuándo se le agregó cada una y quién (una persona, MaKo o una automatización; por la API HTTP no se dice QUÉ persona: sale «una persona»). Úsala antes de agregar o eliminar una etiqueta, o para contestar «¿este lead está cualificado?». Una archivada viene con archivada en true: ya no cuenta en las automatizaciones. Pide el leadId (de buscar_leads).',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  // Las SUGERENCIAS de MaKo para un CRM (14/10/2026, el chat de MaKo al costado del CRM). El motor es puro
  // (lib/sugerencias-crm.ts, sin IA) y la cuenta la hace el server UNA vez y la guarda unos minutos
  // (lib/sugerencias-crm-server.ts): es lo mismo que ve el botón plegado del CRM. Sale por HTTP a propósito:
  // trae etapas, conteos y frases sobre el tablero, ningún nombre, teléfono ni conversación de un lead. Para
  // HACER una, crear_automatizacion_desde_plantilla (área chatbot) con la plantilla y la etapa que trae.
  {
    id: 'sugerencias_crm', area: 'crm', tipo: 'lectura',
    titulo: 'Sugerencias de MaKo para un CRM',
    descripcion: 'La foto de UN CRM del negocio y lo que MaKo le sugiere: sus etapas en orden con cuántos leads hay en cada una, cómo vende y cómo le llega la gente, y una lista corta de sugerencias de una línea cada una. Cada sugerencia dice qué hacer: crear una automatización de la galería (con su plantilla y la etapa donde arranca: nace pausada; se crea con crear_automatizacion_desde_plantilla), abrir una pantalla (conectar Fathom) o revisar algo en el chat. Salen de las etapas que no tienen su automatización (reunión, entrada, pago, Ganado, plazos, cuotas) y del estado del tablero (leads parados en la entrada, reuniones pasadas sin asistencia, ganados sin cobro, nutriciones manuales vencidas). Nunca sugiere una automatización que ya existe en esa etapa. Lo que el equipo calló con «Ahora no» no vuelve en 30 días: viene aparte, en calladas, con hasta cuándo, y se vuelve a mostrar con volver_a_mostrar_sugerencia. Sin embudoId, el CRM principal.',
    parametros: [{ nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (de productos_del_lead). Sin él, el CRM principal del negocio.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  // Deshacer el «Ahora no» del panel del CRM (14/10/2026): lo callado lo calla para todo el equipo 30 días, y
  // sin esto no tenía vuelta. Del admin, como en el panel (app/api/crm/mako/route.ts). Escribe por
  // `volverAMostrar` (lib/sugerencias-crm-server.ts), con el mismo compare-and-set que callar.
  {
    id: 'volver_a_mostrar_sugerencia', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Volver a mostrar una sugerencia',
    descripcion: 'PROPONE deshacer el «Ahora no» de una sugerencia de MaKo en UN CRM (queda pendiente hasta el «sí»): vuelve a la lista de sugerencias de ese CRM para todo el equipo. En los otros CRM no cambia nada. El id sale de las calladas de sugerencias_crm. Solo el administrador.',
    parametros: [
      { nombre: 'sugerenciaId', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el id de la sugerencia callada (de las calladas de sugerencias_crm), por ejemplo lead-agendo:agenda.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (el mismo que se le pasó a sugerencias_crm). Sin él, el CRM principal del negocio.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'saca la sugerencia de lo callado de ese CRM (la configuración del negocio)',
  },

  // ── Acciones heredadas ─────────────────────────────────────────────────────────
  {
    id: 'proponer_cambio_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', tipoPendiente: 'lead_etapa',
    titulo: 'Mover un lead de etapa',
    descripcion: 'PROPONE mover un lead a otra etapa del funnel (queda pendiente hasta el «sí»; no lo ejecuta). Cubre cerrar como ganado (pasa el monto en USD), marcar perdido o descalificado (pasa el motivo), mandar a nutrición o reactivar. Consigue el leadId con buscar_leads y la key con ver_funnel. Si falta el monto o el motivo lo pide; lo que este canal no puede cargar (fecha de reunión, asistencia, Fathom) no bloquea y queda declarado en el historial.',
    parametros: [
      leadId(),
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 60, descripcion: "key de la etapa destino (de ver_funnel), por ejemplo 'agenda', 'manual', 'ganado', 'perdido'." },
      { nombre: 'monto', tipo: 'number', minimo: 0, descripcion: 'monto de cierre en USD (solo para la etapa ganada).' },
      { nombre: 'motivo', tipo: 'string', max: 500, descripcion: 'motivo (solo para perdido o descalificado).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'cambia la etapa y el estado del lead (y monto o motivo), deja historial; puede mandar la conversión a Meta y ajustar la etiqueta de WhatsApp',
  },
  {
    id: 'proponer_agendar_reunion', area: 'crm', tipo: 'accion', confirmacion: 'chat', tipoPendiente: 'agendar_reunion',
    titulo: 'Agendar una reunión en Calendly',
    descripcion: 'PROPONE reservar en Calendly la R1 o la R2 de un lead en un horario EXACTO de listar_horarios_reunion (queda pendiente hasta el «sí»). Al confirmar se revalida que el hueco siga libre y se intenta la reserva directa; si Calendly la rechaza, deja el formulario de Calendly ya completado con los datos del lead para mandarlo. El lead necesita email. Las fechas de la reunión las escribe después el aviso de Calendly, no esta acción.',
    parametros: [
      leadId('id del lead (con email cargado).'),
      cualReunion,
      { nombre: 'startIso', tipo: 'string', obligatorio: true, max: 40, descripcion: 'el startIso COPIADO TAL CUAL de listar_horarios_reunion. Si no coincide carácter por carácter, Calendly lo rechaza.' },
    ],
    canales: TODOS, costo: 'externo', gating: CALENDLY,
    reversible: false, escribe: 'reserva la reunión en Calendly (o acuña un link de un solo uso) y deja el evento en el historial del lead',
  },
  {
    id: 'proponer_lead', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/crm/revisar',
    titulo: 'Proponer alta de un lead',
    descripcion: 'PROPONE dar de alta un contacto en el CRM: deja una propuesta y devuelve el LINK a /crm/revisar/<id>, donde una persona ve los datos, corrige y confirma; recién ahí se crea el lead (avisando duplicados). Úsala cuando pidan agregar a alguien al CRM. Necesita al menos el nombre; el teléfono es lo que después lo cruza con su WhatsApp. Pasa el link tal cual y no pidas confirmación por el chat. Para varios contactos a la vez usa proponer_leads.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre y apellido de la persona.' },
      { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono, solo dígitos con código de país si lo tienes.' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email, si lo tienes.' },
      { nombre: 'empresa', tipo: 'string', max: 200, descripcion: 'nombre del negocio, si lo dijeron.' },
      { nombre: 'nota', tipo: 'string', max: 1000, descripcion: 'el contexto que dio el dueño en sus palabras; va a la ficha y explica de dónde salió el lead.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'deja una propuesta de alta en propuestas; al confirmarla en /crm/revisar se crea el lead con su historial',
  },

  // ── Acciones nuevas: chat ──────────────────────────────────────────────────────
  // Agendar y mover en la agenda de GOOGLE. Las de Calendly (proponer_agendar_reunion)
  // siguen: son otro proveedor y otra forma de reservar. Pedido por un cliente
  // inmobiliario (ws13) que agenda VISITAS en Google y por Cal.com, no por Calendly,
  // y que quería hacerlo escribiéndole al grupo de MaKo (07/10/2026).
  {
    id: 'proponer_agendar_agenda', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agendar reunión, visita o cita',
    descripcion: 'PROPONE agendar una reunión (o visita, o cita) en la agenda de Google del negocio (queda pendiente hasta el «sí»). Con un lead, lo invita por email; SIN lead es un evento del negocio, sin invitados, y entonces el título es obligatorio. Úsala cuando el negocio tiene su Google Calendar conectado; si agenda por Calendly, la que corresponde es proponer_agendar_reunion. La fecha y la hora van como las dijo la persona, en la zona del negocio: el código arma la hora exacta. Si no te dieron una hora, mira antes horarios_libres_dia. Si el horario se pisa con otro evento, el sistema se lo avisa a la persona directo (tú no lo ves, así que no afirmes que está libre); no lo bloquea: la agenda es del negocio.',
    parametros: [
      leadIdOpcional('id del lead a invitar (con email cargado). Sin él, el evento no invita a nadie.'),
      fechaIso('fecha', 'YYYY-MM-DD del día de la reunión.', true),
      { nombre: 'hora', tipo: 'string', obligatorio: true, max: 5, descripcion: 'HH:MM de inicio, en 24 h y en la zona del negocio (ej. 10:30).' },
      { nombre: 'duracion_min', tipo: 'number', entero: true, minimo: 15, maximo: 240, descripcion: 'cuántos minutos dura (default 45). «De 1 h» son 60.' },
      { nombre: 'titulo', tipo: 'string', max: 120, descripcion: 'cómo se llama el evento, como lo dijo la persona (ej. «PRUEBA», «Visita al departamento de Palermo»). Obligatorio sin lead; con lead, si no lo dicen, se arma con su nombre.' },
    ],
    // SIN http, por lo mismo que reuniones_agenda_lead y porque manda una invitación a
    // un tercero desde la cuenta de Google del negocio.
    canales: SIN_HTTP, costo: 'externo', gating: GOOGLE, datosDeGoogle: true,
    reversible: false, escribe: 'crea un evento en la agenda de Google del negocio; si es con un lead, Google le manda la invitación y queda en su historial',
  },
  {
    id: 'proponer_mover_reunion', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Mover o reagendar reunión, visita o cita',
    descripcion: 'PROPONE cambiar el día o la hora de una reunión (o visita, o cita) que ya está en la agenda de Google del negocio, con un lead o sin lead (queda pendiente hasta el «sí»). El sistema busca la reunión en la agenda: tú pasas el día y la hora que tiene HOY (fecha_actual, hora_actual) como los dijo la persona —sin lead, fecha_actual es obligatorio—, y la fecha y la hora nuevas como las dijo; el código arma la hora exacta. Tú NO ves la agenda: si hay varias o ninguna que coincida, el sistema se las muestra a la persona y tú le pides el día y la hora de la que quiere mover. Conserva la duración, el título y los invitados, y Google les avisa del cambio. Si no encuentra la que se nombró, NO crea una nueva.',
    parametros: [
      leadIdOpcional('id del lead de la reunión, si es con uno. Sin él se busca en el día de fecha_actual.'),
      fechaIso('fecha_actual', 'YYYY-MM-DD del día que tiene HOY la reunión que se mueve, como lo dijo la persona. Con lead y sin esto, la única que tenga; sin lead, obligatorio.'),
      { nombre: 'hora_actual', tipo: 'string', max: 5, descripcion: 'HH:MM que tiene HOY esa reunión, en 24 h, sólo si la persona la dijo.' },
      fechaIso('fecha', 'YYYY-MM-DD del día nuevo.', true),
      { nombre: 'hora', tipo: 'string', obligatorio: true, max: 5, descripcion: 'HH:MM nueva, en 24 h y en la zona del negocio.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: GOOGLE, datosDeGoogle: true,
    reversible: false, escribe: 'cambia el horario del evento en la agenda de Google del negocio (Google les avisa a los invitados) y, si es con un lead, deja el cambio en su historial',
  },
  {
    id: 'proponer_cambiar_reunion', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar nombre o duración de una reunión',
    descripcion: 'PROPONE cambiarle el nombre (el título) o la duración a una reunión (o visita, o cita) que ya está en la agenda de Google del negocio, con un lead o sin lead (queda pendiente hasta el «sí»). Para cambiarle el día o la hora, la que corresponde es proponer_mover_reunion. Se la encuentra como en proponer_mover_reunion: el día y la hora que tiene HOY, como los dijo la persona. Pasa sólo lo que cambia: el título nuevo, la duración nueva, o las dos.',
    parametros: [
      leadIdOpcional('id del lead de la reunión, si es con uno. Sin él se busca en el día de fecha_actual.'),
      fechaIso('fecha_actual', 'YYYY-MM-DD del día que tiene la reunión, como lo dijo la persona. Sin lead, obligatorio.'),
      { nombre: 'hora_actual', tipo: 'string', max: 5, descripcion: 'HH:MM que tiene esa reunión, en 24 h, si la persona la dijo.' },
      { nombre: 'titulo', tipo: 'string', max: 120, descripcion: 'el nombre nuevo, como lo dijo la persona.' },
      { nombre: 'duracion_min', tipo: 'number', entero: true, minimo: 15, maximo: 480, descripcion: 'cuántos minutos pasa a durar. «De 1 h» son 60.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: GOOGLE, datosDeGoogle: true,
    reversible: false, escribe: 'cambia el título o el fin del evento en la agenda de Google del negocio (Google les avisa a los invitados) y, si es con un lead, deja el cambio en su historial',
  },
  {
    id: 'proponer_cancelar_reunion', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cancelar o borrar una reunión, visita o cita',
    descripcion: 'PROPONE cancelar (borrar) una reunión (o visita, o cita) que ya está en la agenda de Google del negocio, con un lead o sin lead (queda pendiente hasta el «sí»). Se la encuentra con el día y la hora que tiene, como los dijo la persona. No se deshace y Google les avisa a los invitados: el sistema le muestra a la persona cuál es y a cuántos les avisa antes de que diga que sí.',
    parametros: [
      leadIdOpcional('id del lead de la reunión, si es con uno. Sin él se busca en el día de fecha_actual.'),
      fechaIso('fecha_actual', 'YYYY-MM-DD del día que tiene la reunión, como lo dijo la persona. Sin lead, obligatorio.'),
      { nombre: 'hora_actual', tipo: 'string', max: 5, descripcion: 'HH:MM que tiene esa reunión, en 24 h, si la persona la dijo.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: GOOGLE, datosDeGoogle: true,
    reversible: false, escribe: 'borra el evento de la agenda de Google del negocio (Google les avisa a los invitados) y, si es con un lead, deja la cancelación en su historial',
  },
  {
    id: 'marcar_asistencia_reunion', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Marcar asistencia a una reunión',
    descripcion: 'PROPONE registrar si un lead asistió o no a su R1 o R2 ya agendada (queda pendiente hasta el «sí»). Exige que la reunión tenga fecha cargada. Cambiar la asistencia cambia la etapa derivada del lead. Marcar que NO asistió a la R1 borra el calificado que tuviera cargado, y eso sí se le resta a Meta. Para «no asistió y pasa a no-show» también sirve proponer_cambio_etapa.',
    parametros: [
      leadId(),
      cualReunion,
      { nombre: 'asistio', tipo: 'boolean', obligatorio: true, descripcion: 'true asistió, false no se presentó.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'cambia asistio_j1 o asistio_j2 del lead y deja historial; si la R1 pasa a no asistida borra el calificado, y la conversión que ya salió a Meta no se deshace',
  },
  {
    id: 'marcar_calificado', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Marcar lead calificado',
    descripcion: 'PROPONE registrar si un lead era un buen fit (queda pendiente hasta el «sí»). NO exige reunión: también se marca en un funnel que no tiene llamadas. Lo único que se rechaza al proponer es un lead que consta que NO asistió a su R1, porque ahí el dato se descarta. Marcar calificado manda a Meta las conversiones SubmitApplication y QualifiedLead, que no se deshacen.',
    parametros: [
      leadId(),
      { nombre: 'calificado', tipo: 'boolean', obligatorio: true, descripcion: 'true calificado, false no calificado.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'cambia calificado del lead y deja historial; manda la conversión a Meta si pasa a calificado, que no se deshace',
  },
  {
    id: 'agregar_nota_lead', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agregar una nota al lead',
    descripcion: 'PROPONE dejar una nota en el historial de un lead (una llamada, un acuerdo, un recordatorio), con fecha y autor (queda pendiente hasta el «sí»). Úsala cuando el dueño diga «anota en X que…». Las notas no se borran.',
    parametros: [
      leadId(),
      { nombre: 'texto', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'la nota, en las palabras del dueño.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'agrega una fila «Nota» al historial del lead',
  },
  {
    id: 'asignar_closer_setter', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Asignar closer o setter',
    descripcion: 'PROPONE asignar o cambiar el closer y/o el setter de un lead por su NOMBRE (queda pendiente hasta el «sí»). El nombre tiene que coincidir con alguien del equipo o con un closer o setter ya usado en el CRM: si no coincide, la respuesta trae los nombres válidos. MaKo no se asigna a mano. Para quitar una asignación, hazlo en la ficha.',
    parametros: [
      leadId(),
      { nombre: 'closer', tipo: 'string', max: 120, descripcion: 'nombre del closer.' },
      { nombre: 'setter', tipo: 'string', max: 120, descripcion: 'nombre del setter.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'cambia closer y/o setter del lead y deja historial',
  },
  {
    id: 'mover_a_nutricion_manual', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Pasar a nutrición manual',
    descripcion: 'PROPONE aparcar un lead en «Nutrición manual» con una fecha límite y un motivo (queda pendiente hasta el «sí»). Si la fecha vence sin resolverse, el lead vuelve a «Datos sin marcar». Úsala cuando el dueño diga «a X lo sigo yo hasta el viernes».',
    parametros: [
      leadId(),
      fechaIso('deadline', 'YYYY-MM-DD: hasta cuándo lo sigue a mano.', true),
      { nombre: 'motivo', tipo: 'string', max: 500, descripcion: 'por qué se aparca.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'mueve el lead a la etapa manual con su fecha límite y deja el motivo en el historial',
  },
  {
    id: 'marcar_pago_cobrado', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Marcar una cuota cobrada',
    descripcion: 'PROPONE marcar una cuota concreta como cobrada en una fecha, o desmarcarla (queda pendiente hasta el «sí»). Recalcula lo cobrado del lead. El pagoId sale de cobranza_lead. Si se cobró un monto DISTINTO, pasa montoUsd: si fue menos, la diferencia queda como una cuota nueva pendiente con el mismo vencimiento, salvo que la persona diga que es un descuento (resto=descuento). Úsala cuando digan «ya me pagó la cuota 2» o «me pagó 300 de la cuota de 500».',
    parametros: [
      { nombre: 'pagoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id de la cuota (de cobranza_lead).' },
      leadId('id del lead dueño de la cuota.'),
      { nombre: 'pagado', tipo: 'boolean', obligatorio: true, descripcion: 'true cobrada, false revertir.' },
      fechaIso('fechaPago', 'YYYY-MM-DD en que se cobró (default hoy en la zona del negocio).'),
      { nombre: 'montoUsd', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'Lo que se cobró de verdad, en USD, si fue distinto del monto de la cuota. Si se omite, la cuota se cobra tal cual.' },
      { nombre: 'resto', tipo: 'string', enum: ['pendiente', 'descuento'], descripcion: 'Sólo si montoUsd es MENOR que la cuota: pendiente (default, la diferencia queda como una cuota nueva) o descuento (no se cobra).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'marca o desmarca la cuota en pagos (con el monto real si vino), deja la diferencia como una cuota nueva si se cobró de menos, recalcula total_cobrado_usd del lead y deja historial',
  },
  {
    id: 'registrar_pago_suelto', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Registrar un pago fuera del plan',
    descripcion: 'PROPONE registrar un cobro que no es ninguna cuota del plan del lead (un adelanto, un extra, un pago de otro esquema): entra como una cuota nueva ya cobrada y suma a lo cobrado del lead. No cambia el monto de cierre. Si el pago corresponde a una cuota que ya existe, usa marcar_pago_cobrado.',
    parametros: [
      leadId('id del lead que pagó.'),
      { nombre: 'montoUsd', tipo: 'number', obligatorio: true, minimo: 0.01, maximo: 100000000, descripcion: 'Lo que se cobró, en USD.' },
      fechaIso('fechaPago', 'YYYY-MM-DD en que se cobró (default hoy en la zona del negocio).'),
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'insert en pagos (una cuota nueva ya cobrada), recalcula total_cobrado_usd del lead y deja historial',
  },
  {
    id: 'ignorar_datos_sin_marcar', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Ignorar datos sin marcar',
    descripcion: 'PROPONE silenciar los pendientes de un lead en «Datos sin marcar» (queda pendiente hasta el «sí»): deja de contar en el worklist y en el contador, pero siguen visibles en su ficha. No silencia una reunión pasada sin decisión, que se sigue pidiendo. Se deshace con reactivar_datos_sin_marcar.',
    parametros: [leadId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'marca pendientes_ignorados en el lead y deja historial',
  },
  {
    id: 'reactivar_datos_sin_marcar', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Reactivar datos sin marcar',
    descripcion: 'PROPONE deshacer ignorar_datos_sin_marcar sobre un lead (queda pendiente hasta el «sí»): el lead vuelve a contar en «Datos sin marcar» con todo lo que le falta.',
    parametros: [leadId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'limpia pendientes_ignorados del lead y deja historial',
  },
  {
    id: 'resolver_confirmacion_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Resolver un cambio automático',
    descripcion: 'PROPONE cerrar una confirmación del CRM automático (queda pendiente hasta el «sí»): «confirmar» deja el cambio de MaKo, «rechazar» lo revierte, y «op:<key>» aplica una de sus opciones (por ejemplo marcar perdido), validando los datos de la etapa. El id y las keys de opciones salen de confirmaciones_crm_automatico.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id de la confirmación (de confirmaciones_crm_automatico).' },
      { nombre: 'decision', tipo: 'string', obligatorio: true, max: 80, descripcion: "'confirmar', 'rechazar' u 'op:<key>' con la key de una de sus opciones." },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'cierra la confirmación; al rechazar revierte los campos del lead, con una opción mueve el lead de etapa; deja historial',
  },
  {
    id: 'generar_insight_lead', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Generar diagnóstico MaKo del lead',
    descripcion: 'PROPONE que MaKo genere un diagnóstico comercial nuevo de un lead cruzando ficha, reuniones, respuestas, llamadas analizadas, chat, anuncio, tracking y cobranza (queda pendiente hasta el «sí»; usa IA y tarda). No genera si a la etapa del lead le faltan datos o si no hay al menos una llamada analizada: en ese caso lo dice. Antes mira insight_lead por si ya hay uno reciente.',
    parametros: [leadId()],
    canales: SIN_HTTP, costo: 'ia', gating: TAB, lenta: true,
    reversible: false, escribe: 'inserta un diagnóstico nuevo en lead_insights',
  },
  {
    id: 'declarar_entradas_funnel', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Declarar cómo entran los leads',
    descripcion: 'PROPONE declarar por qué caminos llega la gente al negocio (hasta 3): formulario del anuncio, formulario en la página, agenda desde un link, te escriben ellos o les escribes tú (queda pendiente hasta el «sí»). De eso dependen los audios, el ensayo del chatbot y las secuencias. Reemplaza la declaración anterior y conserva el evento de fecha fija, que se edita en /funnel. Solo el administrador.',
    parametros: [
      { nombre: 'entradas', tipo: 'string[]', obligatorio: true, max: 3, enum: ['formulario_anuncio', 'landing', 'agenda_sola', 'chat_entrante', 'chat_saliente'], descripcion: 'al menos una: formulario_anuncio, landing, agenda_sola, chat_entrante o chat_saliente.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'reescribe las entradas declaradas en el funnel del negocio',
  },

  // ── Crear un CRM por su TIPO (14/10/2026, §2 de docs/diseno-ficha-bloques.md) ──────────────
  // «Nuevo CRM» elige un tipo (DM funnel, LinkedIn, dos reuniones…) que trae canal, entrada y
  // etapas (`TIPOS_CRM`, lib/pipeline.ts), o «otro» con el canal y las entradas a mano. Las dos
  // ops van por el mismo camino que el modal: `siembraDeCrm` sanea y `crearCrm` (lib/nuevo-crm.ts)
  // escribe. Por HTTP a propósito: un tipo y sus etapas no traen datos de nadie.
  {
    id: 'tipos_de_crm', area: 'crm', tipo: 'lectura',
    titulo: 'Tipos de CRM para crear',
    descripcion: 'Los tipos de CRM que se pueden crear con crear_crm, los mismos de «Nuevo CRM» en la pantalla: llamada de venta, dos reuniones (high-ticket), webinar, sesión presencial, conversaciones por chat, DM funnel (comentan una palabra clave), Instagram orgánico, anuncio con formulario de Meta, recurso gratis (lead magnet), LinkedIn, YouTube y carrito. Por cada uno, su id, qué es en una línea, cómo se vende, cómo llega la gente y las etapas con las que nace el tablero. Úsala antes de crear_crm cuando no está claro cuál corresponde. El tipo otro arma el CRM con el canal y las entradas que se pasen.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'crear_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear un CRM nuevo',
    descripcion: 'PROPONE crear un CRM nuevo del negocio, con su propio tablero de etapas, de un tipo de tipos_de_crm (queda pendiente hasta el «sí»). El tipo pone las etapas, cómo se vende y cómo llega la gente, igual que «Nuevo CRM» en la pantalla; con tipo otro se pasan el canal y las entradas. No toca los CRM que ya existen. Devuelve el embudoId del CRM nuevo, que es el que piden productos_del_lead y agregar_lead_a_producto. Solo el administrador.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'cómo se llama el CRM, por ejemplo «Mentoría». No puede ser «Funnel principal», que es el del negocio.' },
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: [...TIPOS_CRM.map((t) => t.id), TIPO_CRM_OTRO], descripcion: 'el tipo de CRM (de tipos_de_crm), u otro para elegir a mano el canal y las entradas.' },
      { nombre: 'canal', tipo: 'string', enum: CANALES.map((c) => c.id), descripcion: 'solo con tipo otro, y obligatorio ahí: cómo se cierra la venta (de él salen las etapas).' },
      { nombre: 'entradas', tipo: 'string[]', max: 3, enum: ENTRADAS_OFRECIDAS, descripcion: 'solo con tipo otro, y al menos una ahí: cómo llega la gente (hasta 3).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'crea un producto, su oferta y su embudo, con las etapas y la entrada del tipo',
  },
  // Un lead en VARIOS productos (mig 0207). «No se debe "Mover", se debe agregar al otro
  // producto» (Martín, 06/10/2026): los tres van por lib/lead-funnel.ts tal como lo usa la ficha,
  // y escriben SÓLO la tarjeta de ese producto (ni etapa principal, ni estado, ni Meta, ni
  // secuencias: la cabecera de lib/lead-funnel.ts dice por qué). SIN http, como su lectura.
  {
    id: 'agregar_lead_a_producto', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agregar un lead a un producto',
    descripcion: 'PROPONE sumar un lead a OTRO producto del CRM, en la etapa de entrada de ese producto (queda pendiente hasta el «sí»). No lo saca de los que ya tiene: un lead puede estar en varios productos a la vez. Escribe solo su tarjeta en ese tablero: no cambia su etapa principal, su estado ni su monto, no manda nada a Meta y no lo inscribe en secuencias. Si ya está en ese producto, lo dice. Pide antes el leadId (buscar_leads) y el embudoId (productos_del_lead).',
    parametros: [leadId(), embudoId],
    canales: SIN_HTTP, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'inserta la fila del lead en lead_funnel, en la etapa de entrada de ese producto, y deja historial',
  },
  {
    id: 'quitar_lead_de_producto', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Quitar un lead de un producto',
    descripcion: 'PROPONE sacar un lead de UNO de sus productos del CRM (queda pendiente hasta el «sí»). Solo si está en dos o más: del único no se lo puede quitar. Si era su producto principal, el que tiene hace más tiempo pasa a serlo, con la etapa que tenía ahí. Pide antes el leadId (buscar_leads) y el embudoId (productos_del_lead).',
    parametros: [leadId(), embudoId],
    canales: SIN_HTTP, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'borra la fila del lead en lead_funnel; si era su producto principal, el siguiente pasa a leads.funnel_id y pipeline_stage; deja historial',
  },
  {
    id: 'mover_lead_en_producto', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Mover un lead dentro de un producto',
    descripcion: 'PROPONE cambiar la etapa de un lead en un producto del CRM que se le AGREGÓ (queda pendiente hasta el «sí»). Escribe solo esa tarjeta: no cambia su etapa principal, su estado ni su monto, ni manda nada a Meta; si la etapa nueva es la de ganado y ese producto tiene prendido invitar al curso al ganar, lo invita. En su producto PRINCIPAL se mueve con proponer_cambio_etapa. Pide antes el leadId (buscar_leads), el embudoId y la key de la etapa (productos_del_lead).',
    parametros: [
      leadId(), embudoId,
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 60, descripcion: 'key de la etapa destino en ESE producto (de productos_del_lead).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'cambia la etapa del lead en lead_funnel (solo en ese producto) y deja historial; ganar ahí invita al curso de ese producto si ese embudo tiene prendida la invitación',
  },

  // ── Etiquetas del CRM (mig 0224) ──────────────────────────────────────────────
  // El CRUD es del admin (la pantalla también lo es); poner y sacar, de cualquiera del CRM. Las
  // dos de un lead contestan `yaEstaba` cuando no cambia nada: con un token de escritura corren en
  // el acto, y un paso «⚡ Acción» de un flujo no puede alarmar al dueño cada vez que se repite.
  {
    id: 'crear_etiqueta', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una etiqueta del CRM',
    descripcion: 'PROPONE crear una etiqueta del CRM con su nombre y, si se quiere, color, emoji, la etapa del CRM a la que se vincula y la etiqueta del WhatsApp del celular a la que corresponde (queda pendiente hasta el «sí»). Si ya hay una con ese nombre, lo dice. Si el negocio tiene Chatwoot, también la crea allá.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 40, descripcion: 'el nombre de la etiqueta, como se va a ver (hasta 40 caracteres).' },
      ...camposEtiqueta,
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'una fila en crm_etiquetas (y, si el negocio tiene Chatwoot, la etiqueta en esa cuenta)',
  },
  {
    id: 'editar_etiqueta', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Editar una etiqueta del CRM',
    descripcion: 'PROPONE cambiar el nombre, el color, el emoji, la etapa vinculada o la etiqueta del WhatsApp del celular de una etiqueta del CRM (queda pendiente hasta el «sí»). Cambiar la etapa vale desde ahora: no les agrega ni les elimina la etiqueta a los que ya están en esa etapa. Para desvincular, sinEtapa o sinWhatsApp en true. Si no cambia nada, lo dice.',
    parametros: [
      etiquetaId(),
      { nombre: 'nombre', tipo: 'string', max: 40, descripcion: 'el nombre nuevo (hasta 40 caracteres).' },
      ...camposEtiqueta,
      { nombre: 'sinEtapa', tipo: 'boolean', descripcion: 'true para desvincularla de su etapa.' },
      { nombre: 'sinWhatsApp', tipo: 'boolean', descripcion: 'true para que deje de ponerse en el WhatsApp del celular.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'la fila de la etiqueta en crm_etiquetas (nombre, color, emoji, etapa vinculada o etiqueta de WhatsApp)',
  },
  {
    id: 'archivar_etiqueta', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Archivar una etiqueta del CRM',
    descripcion: 'PROPONE archivar una etiqueta del CRM (queda pendiente hasta el «sí»). Archivarla la APAGA: deja de ofrecerse y de poder agregarse, no dispara más las automatizaciones que arrancan con ella y las condiciones que la nombran dejan de cumplirse. Nunca se borra: los leads que la tienen conservan la fila como historia (su ficha la muestra «archivada»), y con archivar en false se recupera. Antes del «sí» dice cuántas automatizaciones y cuántos leads la usan.',
    parametros: [
      etiquetaId(),
      { nombre: 'archivar', tipo: 'boolean', descripcion: 'false para recuperarla (default true, archivar).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'archivada_at de la etiqueta en crm_etiquetas (no borra nada)',
  },
  {
    id: 'poner_etiqueta_lead', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agregarle una etiqueta a un lead',
    descripcion: 'PROPONE agregarle una etiqueta del CRM a un lead (queda pendiente hasta el «sí»). Si la etiqueta está vinculada a una etapa, lo pasa a esa etapa (salvo un cierre, que se mueve a mano). Dispara las automatizaciones que arrancan con esa etiqueta (y las de «Se agrega etiqueta a un lead») y la agrega también en su chat de WhatsApp y en Chatwoot si están conectados. Si ya la tiene, lo dice y no hace nada. Pide el leadId (buscar_leads) y el etiquetaId (listar_etiquetas).',
    parametros: [leadId(), etiquetaId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'una fila en crm_lead_etiquetas y una línea en el historial del lead; puede mover al lead a la etapa vinculada, inscribirlo en las automatizaciones de esa etiqueta y agregarla en WhatsApp y Chatwoot',
  },
  {
    id: 'sacar_etiqueta_lead', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Eliminarle una etiqueta a un lead',
    descripcion: 'PROPONE eliminarle una etiqueta del CRM a un lead (queda pendiente hasta el «sí»). No lo mueve de etapa; dispara las automatizaciones de «Se elimina etiqueta a un lead», y la elimina también de su chat de WhatsApp y de Chatwoot si estaba ahí. Si no la tiene, lo dice y no hace nada. Pide el leadId (buscar_leads) y el etiquetaId (etiquetas_lead).',
    parametros: [leadId(), etiquetaId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'borra la fila de crm_lead_etiquetas y deja una línea en el historial del lead; puede inscribirlo en las automatizaciones de «Se elimina etiqueta a un lead» y la elimina de WhatsApp y Chatwoot',
  },

  // ── Acciones nuevas: pantalla (genérica /mako/revisar) ────────────────────────
  // La OFERTA de un lead (13/10/2026, Pagos punto 1): las ofertas son las de la tab Offer (tabla
  // `ofertas`, lib/ofertas.ts), NO el catálogo de listar_productos. La lógica es la misma que la
  // ficha (lib/oferta-lead.ts). Salen por HTTP: son ofertas y precios del negocio, no personas.
  {
    id: 'oferta_del_lead', area: 'crm', tipo: 'lectura',
    titulo: 'La oferta de un lead',
    descripcion: 'Las ofertas del negocio (las de la tab Offer: id, nombre, cómo se cobra y el ticket en USD) y cuál tiene asignada el lead. El ofertaId es el que piden asignar_oferta_lead; NO es el id de listar_productos.',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'asignar_oferta_lead', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Asignarle una oferta a un lead',
    descripcion: 'PROPONE asignarle a un lead una de las ofertas del negocio (de oferta_del_lead), o sacársela con quitar (queda pendiente hasta el «sí»). Dice a qué oferta entró: no cambia su etapa, su monto ni sus cuotas. Si ya tiene esa, lo dice.',
    parametros: [
      leadId(),
      { nombre: 'ofertaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'id de la oferta (de oferta_del_lead). Sin él, hace falta quitar.' },
      { nombre: 'quitar', tipo: 'boolean', descripcion: 'true para dejar al lead sin oferta.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'cambia leads.oferta_id y deja historial',
  },
  {
    id: 'crear_oferta_lead', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una oferta para un lead',
    descripcion: 'PROPONE crear una oferta con lo mínimo —nombre, cómo se cobra y el ticket— y asignársela al lead (queda pendiente hasta el «sí»). Queda ligada al CRM del lead, así aparece en la tab Offer, donde se completa y se analiza. Si ya hay una con ese nombre, usa asignar_oferta_lead.',
    parametros: [
      leadId(),
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 80, descripcion: 'el nombre de la oferta.' },
      { nombre: 'modelo', tipo: 'string', obligatorio: true, enum: ['unico', 'suscripcion'], descripcion: 'cómo se cobra: unico = pago único, suscripcion = por mes.' },
      { nombre: 'ticketUsd', tipo: 'number', minimo: 0, descripcion: 'el precio en USD (en una suscripción, el de cada mes).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'una fila en ofertas, su liga al CRM del lead (funnel_ofertas) y leads.oferta_id; deja historial',
  },
  {
    id: 'editar_contacto_lead', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Editar contacto de un lead',
    descripcion: 'PROPONE corregir los datos de contacto de un lead —nombre, email, teléfono, empresa, web, Instagram, YouTube, LinkedIn, dirección o sexo—: deja un link donde una persona revisa el dato exacto y confirma. Cambiar el teléfono cambia la llave con la que WhatsApp, Meta y Calendly reconocen al lead: un dígito mal lo separa de su chat. Pasa al menos un campo. Devuelve el link: pásalo tal cual.',
    parametros: [
      leadId(),
      { nombre: 'nombre', tipo: 'string', max: 200, descripcion: 'nombre y apellido.' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email.' },
      { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono con código de país.' },
      { nombre: 'empresa', tipo: 'string', max: 200, descripcion: 'empresa.' },
      // Los de la ficha (mig 0194, 0258 y 0274): los mismos que edita «Información principal».
      { nombre: 'web', tipo: 'string', max: 300, descripcion: 'la web.' },
      { nombre: 'instagram', tipo: 'string', max: 300, descripcion: 'el usuario de Instagram (con o sin @) o el link al perfil.' },
      { nombre: 'youtube', tipo: 'string', max: 300, descripcion: 'el link al canal de YouTube.' },
      { nombre: 'linkedin', tipo: 'string', max: 300, descripcion: 'el link al perfil de LinkedIn.' },
      { nombre: 'direccion', tipo: 'string', max: 300, descripcion: 'la dirección.' },
      { nombre: 'sexo', tipo: 'string', enum: ['mujer', 'hombre', 'otro'], descripcion: 'mujer, hombre u otro.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'cambia los datos de contacto del lead (y su teléfono normalizado) y deja historial',
  },
  {
    id: 'agregar_link_fathom', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Agregar grabación de Fathom',
    descripcion: 'PROPONE agregar el link de la grabación de Fathom de la R1 o R2 de un lead: deja un link donde una persona revisa la URL exacta y confirma. Destraba el requisito «Fathom» de la etapa y habilita analizar la llamada. Lo normal es que entre solo por Fathom; esto es el camino manual.',
    parametros: [
      leadId(),
      cualReunion,
      { nombre: 'url', tipo: 'string', obligatorio: true, max: 500, descripcion: 'link para compartir de Fathom (https://fathom.video/…).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'agrega el link a fathom_links del lead y deja historial',
  },
  {
    id: 'marcar_reunion_manual', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Cargar reunión fuera de Calendly',
    descripcion: 'PROPONE cargar a mano la fecha de la R1 o R2 de un lead (y su asistencia si se sabe), para reuniones viejas o agendadas fuera de Calendly: deja un link donde una persona revisa y confirma. No sirve para un lead GANADO: reabrirlo borraría el monto y la fecha de cierre, así que se rechaza y eso se hace desde la ficha. Un lead perdido o descalificado se REABRE (se borra su motivo) y se limpia el override de etapa para que avance solo. La regla es agendar por Calendly: esto es la excepción, y el motivo va al historial.',
    parametros: [
      leadId(),
      { nombre: 'which', tipo: 'string', obligatorio: true, enum: ['agenda', 'agendaj2'], descripcion: 'agenda = R1, agendaj2 = R2.' },
      fechaIso('fecha', 'YYYY-MM-DD de la reunión.', true),
      { nombre: 'asistio', tipo: 'boolean', descripcion: 'si ya se sabe: true asistió, false no se presentó.' },
      { nombre: 'notaExcepcion', tipo: 'string', max: 500, descripcion: 'por qué se agendó fuera de Calendly (va al historial).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'escribe la fecha (y asistencia) de la reunión, reabre el lead si estaba perdido o descalificado (borra el motivo) y limpia su override de etapa; deja historial',
  },
  {
    id: 'guardar_plan_pagos', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Guardar plan de pagos uniforme',
    descripcion: 'PROPONE el plan de cobranza de un lead: cobro inicial, monto por cuota, cantidad de cuotas (1 a 6) y día de pago, todo en USD; deja un link donde una persona revisa los montos y confirma. Regenera las cuotas NO pagadas anclándolas en la fecha de cierre (las cobradas no se tocan). No marca el lead como ganado. Para cuotas de montos o fechas distintas usa guardar_cuotas.',
    parametros: [
      leadId(),
      { nombre: 'cobro_inicial_usd', tipo: 'number', minimo: 0, descripcion: 'cobro inicial en USD.' },
      { nombre: 'monto_cuota_usd', tipo: 'number', minimo: 0, descripcion: 'monto de cada cuota en USD.' },
      { nombre: 'total_cuotas', tipo: 'number', entero: true, minimo: 1, maximo: 6, descripcion: 'cantidad de cuotas (1 a 6).' },
      { nombre: 'dia_de_pago', tipo: 'number', entero: true, minimo: 1, maximo: 28, descripcion: 'día del mes en que vence cada cuota (1 a 28).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'guarda el plan en el lead y BORRA sus cuotas no pagadas en pagos (con sus fechas) para regenerarlas; deja historial',
  },
  {
    id: 'guardar_cuotas', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Guardar cuotas explícitas',
    descripcion: 'PROPONE reemplazar las cuotas NO pagadas de un lead por una lista explícita (monto en USD y vencimiento de cada una), y opcionalmente total, duración y fechas del cierre; deja un link donde una persona revisa y confirma. ⚠️ MARCA EL LEAD COMO GANADO aunque no haya cerrado y el ingreso empieza a contar: úsala solo con una venta cerrada.',
    parametros: [
      leadId(),
      {
        nombre: 'cuotas', tipo: 'object[]', obligatorio: true, max: 24, descripcion: 'las cuotas sin pagar, en orden.',
        campos: [
          { nombre: 'monto_usd', tipo: 'number', obligatorio: true, minimo: 0, descripcion: 'monto de la cuota en USD.' },
          fechaIso('fecha_esperada', 'YYYY-MM-DD de vencimiento.'),
        ],
      },
      { nombre: 'total_usd', tipo: 'number', minimo: 0, descripcion: 'monto total del cierre en USD.' },
      { nombre: 'duracion_meses', tipo: 'number', entero: true, minimo: 1, maximo: 120, descripcion: 'duración del servicio en meses.' },
      fechaIso('fecha_cierre', 'YYYY-MM-DD del cierre.'),
      fechaIso('fecha_inicio', 'YYYY-MM-DD de inicio del servicio.'),
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'marca el lead como ganado, guarda total y fechas del cierre y reemplaza sus cuotas no pagadas; deja historial',
  },
  {
    id: 'guardar_deal_details', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Guardar Deal Details del lead',
    descripcion: 'PROPONE completar el trato de un lead ganado: datos fiscales del cliente, qué es el servicio, la promesa y garantía, las obligaciones de cada parte y quién factura; deja un link donde una persona revisa y confirma. Solo pisa lo que viene, y dentro de cada sección solo los campos que vienen (el documento fiscal subido se conserva). El monto y las fechas del cierre se cargan con guardar_cuotas.',
    parametros: [
      leadId(),
      // Campos PLANOS, no objetos: la pantalla genérica pinta un object como JSON
      // crudo, y un RFC o una razón social se revisan campo por campo o no se revisan.
      { nombre: 'fiscal_razon', tipo: 'string', max: 200, descripcion: 'datos fiscales: razón social.' },
      { nombre: 'fiscal_id_fiscal', tipo: 'string', max: 40, descripcion: 'datos fiscales: RFC, CUIT o equivalente.' },
      { nombre: 'fiscal_domicilio', tipo: 'string', max: 300, descripcion: 'datos fiscales: domicilio fiscal.' },
      { nombre: 'fiscal_correo', tipo: 'string', max: 200, descripcion: 'datos fiscales: correo de facturación.' },
      { nombre: 'servicio_que_es', tipo: 'string', max: 500, descripcion: 'servicio: qué es.' },
      fechaIso('servicio_fecha_inicio', 'servicio: YYYY-MM-DD de inicio.'),
      fechaIso('servicio_fecha_termino', 'servicio: YYYY-MM-DD de término.'),
      { nombre: 'servicio_duracion', tipo: 'string', max: 100, descripcion: 'servicio: duración, en palabras.' },
      { nombre: 'servicio_frecuencia', tipo: 'string', max: 100, descripcion: 'servicio: frecuencia de las sesiones.' },
      { nombre: 'servicio_modalidad', tipo: 'string', max: 100, descripcion: 'servicio: presencial, en línea…' },
      { nombre: 'servicio_sesiones', tipo: 'string', max: 100, descripcion: 'servicio: cantidad de sesiones.' },
      { nombre: 'promesa_resultado', tipo: 'string', max: 500, descripcion: 'promesa: resultado prometido.' },
      { nombre: 'promesa_garantia', tipo: 'string', max: 500, descripcion: 'promesa: garantía.' },
      { nombre: 'obligaciones_cliente', tipo: 'string[]', max: 30, descripcion: 'obligaciones del cliente (reemplaza su lista entera).' },
      { nombre: 'obligaciones_prestador', tipo: 'string[]', max: 30, descripcion: 'obligaciones del negocio (reemplaza su lista entera).' },
      { nombre: 'facturado_por_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id de la identidad fiscal propia que factura.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'guarda las secciones del Deal Details en el lead y deja historial',
  },
  {
    id: 'activar_crm_automatico', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Prender o apagar CRM automático',
    descripcion: 'PROPONE prender o apagar que MaKo mueva leads solo en este negocio (no-show, nutrición, nutrición manual vencida, reactivación, con confirmación posterior); deja un link donde el administrador confirma. Prenderlo afecta a TODA la cartera en la próxima corrida: antes mira evaluar_crm_automatico. Apagar siempre se puede.',
    parametros: [{ nombre: 'on', tipo: 'boolean', obligatorio: true, descripcion: 'true prende, false apaga.' }],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'cambia el ajuste crm_auto_enabled del negocio; prenderlo deja que MaKo mueva leads en la próxima corrida, y apagarlo no revierte esos movimientos',
  },
  {
    id: 'guardar_producto', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear o editar un producto',
    descripcion: 'PROPONE crear un producto u oferta del catálogo, o editar uno existente pasando su id (de listar_productos); deja un link donde el administrador revisa el precio y confirma. Al editar, lo que no venga conserva el valor guardado.',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del producto a editar; sin id se crea uno nuevo.' },
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre del producto.' },
      { nombre: 'tipo', tipo: 'string', enum: ['unico', 'suscripcion'], descripcion: 'unico (pago único) o suscripcion (mensual). Obligatorio al crear; al editar, sin valor conserva el tipo guardado.' },
      { nombre: 'monto_usd', tipo: 'number', minimo: 0, descripcion: 'precio en USD, o la mensualidad si es suscripción.' },
      { nombre: 'suscripcion_meses', tipo: 'number', entero: true, minimo: 1, maximo: 120, descripcion: 'plazo en meses de la suscripción; sin valor = indefinida.' },
      { nombre: 'promesa', tipo: 'string', max: 1000, descripcion: 'la promesa del producto.' },
      { nombre: 'incluye', tipo: 'string', max: 2000, descripcion: 'qué incluye.' },
      { nombre: 'garantia', tipo: 'string', max: 1000, descripcion: 'garantía.' },
      { nombre: 'activo', tipo: 'boolean', descripcion: 'false para dejarlo inactivo (default true).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'crea o actualiza una fila en productos',
  },

  // ── Acción nueva: pantalla propia (/crm/revisar) ──────────────────────────────
  {
    id: 'proponer_leads', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/crm/revisar',
    titulo: 'Proponer alta de varios leads',
    descripcion: 'PROPONE dar de alta un LOTE de contactos (hasta 200) en el CRM: deja UNA propuesta y devuelve el link a /crm/revisar/<id>, donde una persona ve la tabla, corrige, marca duplicados y confirma. Cada contacto necesita nombre y además email o teléfono; los que no traen ninguno de los dos se devuelven en `descartados`. Idempotente por `ref`: reenviar el mismo lote devuelve el mismo link. Para un solo contacto dicho en un chat, usa proponer_lead.',
    parametros: [
      {
        nombre: 'leads', tipo: 'object[]', obligatorio: true, max: 200, descripcion: 'los contactos del lote.',
        campos: [
          { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre y apellido.' },
          { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email.' },
          { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono con código de país.' },
          { nombre: 'empresa', tipo: 'string', max: 200, descripcion: 'empresa.' },
          { nombre: 'utm_source', tipo: 'string', max: 200, descripcion: 'utm_source de origen.' },
          { nombre: 'utm_medium', tipo: 'string', max: 200, descripcion: 'utm_medium de origen.' },
          { nombre: 'utm_campaign', tipo: 'string', max: 200, descripcion: 'utm_campaign de origen.' },
          { nombre: 'utm_content', tipo: 'string', max: 200, descripcion: 'utm_content de origen.' },
        ],
      },
      { nombre: 'origen', tipo: 'string', max: 120, descripcion: 'de dónde vienen, en palabras (por ejemplo «formulario de la landing»).' },
      { nombre: 'ref', tipo: 'string', max: 200, descripcion: 'llave de idempotencia del emisor; sin ella se arma con los contactos.' },
    ],
    // SIN whatsapp: el doer reemplaza toda salida con /crm/revisar/ por el mensaje
    // canónico de UN lead (lib/mako-doer-in.ts) y la lista de descartados se perdía.
    canales: ['app', 'http'], costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'deja una propuesta de alta en propuestas; al confirmarla en /crm/revisar se crean los leads',
  },
];
