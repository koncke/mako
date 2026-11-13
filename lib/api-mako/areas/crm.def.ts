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
// Puros (sin server-only): el catálogo de la ficha por bloques, sus plantillas, los datos que avisan y el
// estilo del Dashboard. Copiar sus ids a mano sería un segundo catálogo.
import { TABS_FICHA, DENSIDADES } from '@/lib/ficha/catalogo';
import { PLANTILLAS_TEMA, TIPOGRAFIAS } from '@/lib/graficos-temas';
// Puro: los métodos de pago son los de la ficha (copiarlos a mano sería otro catálogo).
import { METODOS_PAGO } from '@/lib/pagos-campo';
import { CAMPOS_TARJETA_LEAD, DISENOS_TARJETA } from '@/lib/tarjeta-kanban';
import { TIPOS_ETAPA } from '@/lib/etapa-reunion';
import { MAX_LABEL_ETAPA } from '@/lib/pipeline';
import { PLAZO_MAX_DIAS } from '@/lib/lead-quieto';
import { MAX_NOMBRE_EVENTO } from '@/lib/agenda-evento-etapa';

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
// Cómo se COBRÓ un pago a mano (14/10/2026, decisión 7 de docs/diseno-ficha-bloques.md): la misma regla que la ficha
// (`pagoEnMoneda` + `etiquetaDePago`, lib/pagos-campo.ts). ⚠️ `montoUsd` SIEMPRE es dólares: un pago en pesos por
// WhatsApp entraba como dólares porque la operación no tenía dónde decir la moneda (Mauricio, 17/10/2026).
const paramsDeCobro: Parametro[] = [
  { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', max: 3, descripcion: 'La moneda en que se cobró de verdad, código de 3 letras (MXN, ARS, COP, EUR…). Pásala SIEMPRE que la persona hable de pesos, euros o cualquier moneda que no sea dólares. Sin moneda el pago es en dólares.' },
  { nombre: 'montoOriginal', rotulo: 'Monto en esa moneda', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'Cuánto se cobró, en la «moneda» (no en dólares). Va siempre con la moneda; sin ella se rechaza.' },
  { nombre: 'concepto', rotulo: 'Concepto', tipo: 'string', max: 200, descripcion: 'Para qué fue el pago, en pocas palabras («adelanto», «segunda cuota», «extra de diseño»).' },
  { nombre: 'metodo', rotulo: 'Método', tipo: 'string', enum: METODOS_PAGO, descripcion: 'Cómo se pagó: transferencia, efectivo, tarjeta, deposito, cheque, cripto (Binance, USDT) u otro.' },
];
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
    descripcion: 'Busca leads del negocio por nombre, teléfono, email o empresa y devuelve una lista compacta (id, nombre, estado, etapa y etapa_nombre —la etapa en la que la ve el equipo y cómo se llama—, fechas de reuniones, monto de cierre en USD, closer y setter). Es el primer paso antes de cualquier otra operación sobre un lead: de aquí sale el leadId. Compara el texto tal cual (sensible a acentos) y devuelve como máximo 20 resultados.',
    parametros: [{ nombre: 'texto', tipo: 'string', obligatorio: true, max: 200, descripcion: 'texto a buscar en nombre, teléfono, email o empresa. Si ningún lead se llama así y es el nombre (o una parte) de una campaña de Meta, vuelven los leads de esa campaña con su teléfono; con más de 20 personas, dice cuántas quedaron afuera.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ficha_lead', area: 'crm', tipo: 'lectura',
    titulo: 'Ficha de un lead',
    descripcion: 'La ficha de UN lead: contacto, estado comercial, fechas de R1 y R2 con asistencia, calificado, cierre y monto en USD, origen (campaña o UTM), closer y setter, más las respuestas del formulario de calificación de R1 y R2 y lo que contestó en el formulario de Meta (formulario_meta: pregunta y respuesta de las preguntas propias del formulario; null = no vino de un formulario de Meta o entró antes del 04/10/2026, y no significa que no contestó) y en el de su landing (formulario_landing, igual: null = no se guardó, no «no contestó»). La etapa viene como etapa y etapa_nombre, la misma que ve el equipo. Trae además, SÓLO si están cargados: web, instagram, youtube, linkedin, direccion, sexo, ingreso_estimado_usd (lo que alguien cree que vale mientras está abierto; en un lead ganado no va, como en la nueva ficha: lo real es el monto de cierre, y en su lugar viene ingreso_estimado_oculto con el porqué: no es «no tiene»), venta_tipo con suscripcion_mensual_usd y suscripcion_meses, la oferta asignada, pagina_registro (la página donde se registró), entrada_social (cómo entró por Instagram o Messenger: comentario, mensaje, historia o anuncio) y email_dado_de_baja. Un campo que no está es «no está cargado», no «no tiene». Con una ficha muy larga, las respuestas de los formularios se acortan (ficha_acortada) en vez de cortarse. Úsala después de buscar_leads cuando necesites el detalle antes de opinar o proponer algo. No trae cobranza, historial ni tracking: para eso están cobranza_lead, historial_lead y tracking_lead.',
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
    descripcion: 'La estructura del proceso comercial configurado en /funnel: el pipeline activo en orden (con su tipo: entrada, reunión, pago, cierre), las etapas de nutrición y las de descarte, con su key. Úsala antes de proponer un cambio de etapa o de filtrar leads para usar las keys REALES del negocio y no un embudo genérico. Con embudoId, las de otro CRM.',
    parametros: [{ nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (de productos_del_lead). Sin él, el CRM principal del negocio.' }],
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
      // ⚠️ La campaña se dice en el PARÁMETRO y no en la descripción (ticket #56, 4/11/2026): en la descripción, «campaña» y
      // «Meta» puntúan, y le sacaron el lugar a `ver_rendimiento_anuncios` y a `editar_contacto_lead` (tests/ops-center-bateria).
      { nombre: 'campana', tipo: 'string', max: 200, descripcion: 'la campaña de Meta de la que vinieron: su nombre o una parte (sin importar tildes ni mayúsculas), o su id. No hace falta la fecha. Si ninguna se llama así, vuelven las parecidas.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'cuántas filas devolver (default 30; con campana, 200; máximo 500).' },
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
    descripcion: 'Los datos que la etapa ACTUAL de un lead adeuda para que el tablero sea confiable (asistencia, calificado, Fathom, monto, plan de pagos, comprobantes, motivo, setter, empresa, Deal Details), respetando sus excepciones declaradas. Sirve para explicar por qué un lead aparece en «Datos sin marcar» y qué cargar. Lista vacía = el lead está al día. sin_marcar es el número que muestra su ficha y su fila en «A revisar»: lo que falta menos lo ignorado y lo que el CRM de ese lead no avisa (no_avisan dice cuál y por qué).',
    parametros: [leadId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'reuniones_proximas', area: 'crm', tipo: 'lectura',
    titulo: 'Reuniones de los próximos días',
    descripcion: 'Las R1 y R2 agendadas desde hoy (en la zona del negocio) y los próximos días, con lo que hay que saber antes de la llamada: quién es, empresa, respuestas del formulario, si vio el VSL (vio / sin_ver / sin_datos: sin datos NO significa que no lo vio), origen, madurez y estado, la hora (si la tiene) y el link para entrar. Responde «¿qué reuniones tengo hoy?».',
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
    descripcion: 'El estado de cobranza de UN lead: total vendido en USD, si es suscripción (con su monto mensual), duración, fecha de cierre e inicio de servicio, si tiene contrato, y cada cuota con su id, monto en USD, vencimiento, si está pagada, fecha de pago y si tiene comprobante. Responde «¿cuánto le falta pagar a X?». Trae también el estado de cuenta de la tab Pagos (qué debe, el detalle y qué hacer ahora: la acción que toca y, si es cobrar una cuota, su id), los últimos movimientos de plata (cobros, rechazos y devoluciones, del más nuevo al más viejo) y los avisos que piden algo (un contracargo, una devolución que falló). El id de cada cuota es el que pide marcar_pago_cobrado. El bloque `cobrado` dice lo cobrado con la misma cuenta que la ficha (texto, estado y semáforo —verde, ámbar, rojo o gris—, cobrado, total, pendiente y vencido en USD, la próxima cuota, cuántas hay cobradas, vencidas y por vencer, la suscripción con su estado y la renovación rechazada si la hay, lo cobrado en otras monedas y si las cuentas cuadran): úsalo para «¿cómo va X con sus pagos?» en vez de sumar a mano. Una cuota en otra moneda trae cobrada_en (cobrada) o pactada_en (sin cobrar: lo que se le pide, en esa moneda; sus dólares son monto_usd). Para cambiar el vencimiento o el monto de una cuota, mandarle su link o cortar su recordatorio están editar_cuota, crear_link_cuota y cortar_recordatorio_cuota (área cobros), con ese mismo id.',
    parametros: [leadId(), { nombre: 'comprobante', tipo: 'boolean', descripcion: 'Chat de la app: true si el único archivo del mensaje es el comprobante de pago de ESTE lead. Si no está claro, no lo pases y pregúntale.' }],
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
    descripcion: 'Dado un nombre, email, teléfono o Instagram, qué leads existentes parecen la misma persona y por qué (email, teléfono por sus últimos 10 dígitos, Instagram, o nombre sin acentos solo cuando no hay email ni teléfono). Úsala antes de proponer_lead para avisar «ya está cargado» con su id. Si la consulta falla devuelve vacío: vacío no garantiza que no exista.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', max: 200, descripcion: 'nombre y apellido.' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email.' },
      { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono en cualquier formato.' },
      { nombre: 'instagram', tipo: 'string', max: 200, descripcion: 'usuario de Instagram, con o sin @, o el link del perfil.' },
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

  // ── La ficha del lead por bloques (14/10/2026, docs/diseno-ficha-bloques.md) ──────────────────────
  // La ficha se arma POR CRM (decisión 1): plantilla por tipo de funnel, bloques por tab y avisos de
  // «datos sin marcar». El motor es lib/ficha/ (config.ts lo puro, config-server.ts la lectura y el
  // guardado con compare-and-set); los ids de bloques, diseños y plantillas salen de su catálogo.
  {
    id: 'ver_ficha_funnel', area: 'crm', tipo: 'lectura',
    titulo: 'Ver la ficha de un CRM',
    descripcion: 'Cómo se arma la ficha del lead en UN CRM del negocio, para todos sus leads: la plantilla (la que elige MaKo según las etapas de reunión y cómo entra la gente, o la que eligió alguien) y por qué; por tab (Resumen, Reuniones, Pagos y Tracking) y por hoja propia su nombre, su plantilla, si va épica y sus bloques en orden con su ancho, su diseño y su ícono; de qué «datos sin marcar» avisa y por qué no de los otros, y el estilo. Trae también, por tab, los bloques que se pueden sumar y su galería de plantillas (las sugeridas primero), y los íconos de un bloque. Es el paso previo a cambiar_ficha_funnel. Sin embudoId, el CRM principal.',
    parametros: [{ nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (de productos_del_lead). Sin él, el CRM principal del negocio.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'cambiar_ficha_funnel', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar la ficha de un CRM',
    // (17/10/2026) La lista de cambios vive en la descripción de `cambio`: repetirla acá pagaba peso en el turno de
    // WhatsApp, y las hojas propias necesitaban ese lugar (tests/ficha-api.test.ts, «no crece»).
    descripcion: 'PROPONE UN cambio en la ficha del lead de UN CRM (pendiente hasta el «sí»), para todos sus leads: sus bloques, sus avisos, el estilo, las plantillas, las tabs y las hojas propias. Los ids salen de ver_ficha_funnel. «Contacto» no se quita y las asistencias siempre avisan. Solo el administrador. Sin embudoId, el CRM principal.',
    parametros: [
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (de productos_del_lead). Sin él, el CRM principal del negocio.' },
      {
        nombre: 'cambio', tipo: 'string', obligatorio: true, enum: ['poner', 'quitar', 'mover', 'ancho', 'diseno', 'icono', 'opciones', 'aviso', 'estilo', 'densidad', 'plantilla', 'volver', 'nombre', 'epica', 'nueva_hoja', 'quitar_hoja', 'mover_hoja'],
        descripcion: 'qué cambiar: poner, quitar o mover un bloque (con tab y bloque; mover y poner con lugar), su ancho, diseno, icono u opciones, aviso (con aviso y avisa), estilo (tema, acento o tipografia), densidad, plantilla, nombre o epica de una tab (con tab), volver a la plantilla (con tab, sólo esa), o nueva_hoja, quitar_hoja o mover_hoja (id en tab).',
      },
      // Sin enum desde el 17/10/2026: además de las cuatro tabs, el id de una hoja propia (h-…, de ver_ficha_funnel).
      { nombre: 'tab', tipo: 'string', max: 20, descripcion: 'resumen, reuniones, pagos, tracking o id de hoja.' },
      // Sin enum, a propósito: son 56 ids y el ToolDef viaja en cada turno. preparar() valida y devuelve los disponibles.
      { nombre: 'bloque', tipo: 'string', max: 40, descripcion: 'el id del bloque (de ver_ficha_funnel), por ejemplo cuotas o redes-y-web.' },
      { nombre: 'lugar', tipo: 'number', entero: true, minimo: 1, maximo: 40, descripcion: 'en poner y mover: el lugar en la tab, 1 es el primero. Sin él, poner lo suma al final.' },
      { nombre: 'ancho', tipo: 'string', enum: ['1/4', '1/3', '1/2', 'completo'], descripcion: 'en poner y ancho: el ancho del bloque sobre la grilla de la ficha. Cada bloque acepta sólo algunos (ver_ficha_funnel).' },
      { nombre: 'diseno', tipo: 'string', max: 40, descripcion: 'en poner y diseno: el id del diseño del bloque (de ver_ficha_funnel).' },
      // Sin enum, a propósito (como bloque): son ~70 íconos. preparar() valida y devuelve los disponibles.
      { nombre: 'icono', tipo: 'string', max: 30, descripcion: 'en icono: el id (de los iconos de ver_ficha_funnel), o de-siempre: el del bloque.' },
      { nombre: 'n', tipo: 'number', entero: true, minimo: 1, maximo: 40, descripcion: 'si el bloque está más de una vez en la tab (respuesta-destacada), cuál: 1 es el primero.' },
      // (16/10/2026) UNO de texto y no tres (redes, fuentes, pregunta): viaja en el turno de WhatsApp. Lo traduce lib/ficha/api.ts.
      { nombre: 'opcion', tipo: 'string', max: 200, descripcion: 'en opciones: redes (web,instagram,youtube,linkedin), fuentes (meta,landing,agenda) o la pregunta destacada; en estilo: esquinas=redondas.' },
      // ⚠️ SIN ENUM DESDE EL 15/10/2026 (eran 21 ids): este ToolDef viaja en el turno del doer de WhatsApp, que tiene
      // 12.000 caracteres para TODAS las del CRM, y por el «cambiar» de su id entra entre las primeras en cualquier
      // «cambiá…». Sumarle el ícono dejó afuera a proponer_mover_reunion (tests/agenda-whatsapp.test.ts). Los ids
      // están en los avisos de ver_ficha_funnel, y la traducción (lib/ficha/api.ts) valida y devuelve los que hay.
      { nombre: 'aviso', tipo: 'string', max: 30, descripcion: 'en aviso: el id del dato sin marcar (de los avisos de ver_ficha_funnel).' },
      { nombre: 'avisa', tipo: 'boolean', descripcion: 'en aviso: true para que avise, false para que no.' },
      { nombre: 'tema', tipo: 'string', enum: PLANTILLAS_TEMA.map((p) => p.id), descripcion: 'en estilo: la plantilla, la misma del Dashboard.' },
      { nombre: 'acento', tipo: 'string', max: 7, descripcion: 'en estilo: el color de acento en hex, #RRGGBB. Vacío para volver al de la plantilla de estilo.' },
      { nombre: 'tipografia', tipo: 'string', enum: TIPOGRAFIAS.map((t) => t.id), descripcion: 'en estilo: la tipografía de toda la ficha.' },
      { nombre: 'densidad', tipo: 'string', enum: DENSIDADES.map((x) => x.id), descripcion: 'en densidad: el tamaño de las tarjetas.' },
      // Sin enum desde el 16/10/2026: con tab es una plantilla de ESA tab (lib/ficha/plantillas-tab.ts), y la
      // traducción (lib/ficha/api.ts) valida y devuelve las que hay. Pagó, con el texto de arriba, el nombre y la épica.
      { nombre: 'plantilla', tipo: 'string', max: 60, descripcion: 'en plantilla: el id (de ver_ficha_funnel) o auto. Sin tab, la de toda la ficha (arranca de cero bloques y avisos); con tab, la de esa tab.' },
      { nombre: 'nombre', tipo: 'string', max: 24, descripcion: 'en nombre: cómo se llama la tab. Vacío, el de siempre.' },
      { nombre: 'epica', tipo: 'boolean', descripcion: 'en epica: true, la vista épica (pocas cosas, en grande).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'guarda el cambio en la ficha del CRM (funnels.data.ficha, sólo lo que difiere de la plantilla); cambia lo que ven y lo que avisa la ficha de todos sus leads',
  },

  // ── El evento de agenda VINCULADO a una etapa de reunión (16/10/2026, lib/agenda-evento-etapa.ts) ──
  // Quien reserva ese evento de Calendly o Cal.com cae en esa etapa de ese CRM (y no en el principal). Las
  // mismas funciones que las server actions de la pantalla (app/crm/agenda-evento-actions.ts). Los
  // identificadores van SIN enum: son URIs e ids de la cuenta del negocio.
  {
    id: 'listar_eventos_agenda', area: 'crm', tipo: 'lectura',
    titulo: 'Eventos de agenda y su etapa',
    descripcion: 'Los tipos de evento de Calendly y Cal.com del negocio: cuál es la R1 o la R2 de Integraciones y a qué etapa de reunión de qué CRM está vinculado cada uno (quien lo reserva cae en esa etapa). Trae las etapas que se pueden vincular. Paso previo a vincular_evento_etapa. Solo el administrador.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'vincular_evento_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Vincular un evento a una etapa',
    descripcion: 'PROPONE vincular un evento de Calendly o Cal.com a una etapa de reunión de un CRM (queda pendiente hasta el «sí»): desde ahí, quien lo reserva cae en esa etapa de ese CRM; si ya está en otro, se lo agrega sin moverlo. Un evento va a una sola etapa. Evento, embudoId y etapa salen de listar_eventos_agenda. Solo el administrador.',
    parametros: [
      { nombre: 'proveedor', tipo: 'string', obligatorio: true, enum: ['calendly', 'calcom'], descripcion: 'la agenda: calendly o calcom.' },
      { nombre: 'evento', tipo: 'string', obligatorio: true, max: 300, descripcion: 'el identificador del evento (de listar_eventos_agenda), o su nombre.' },
      { nombre: 'embudoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (de listar_eventos_agenda).' },
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 80, descripcion: 'key de la etapa de reunión (de listar_eventos_agenda).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'guarda el vínculo del evento con la etapa (agenda_evento_etapa) y lo registra en el índice de webhooks (webhook_routing); sus reservas pasan a caer en esa etapa de ese CRM',
  },
  {
    id: 'desvincular_evento_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Desvincular un evento de su etapa',
    descripcion: 'PROPONE sacar el vínculo de un evento de Calendly o Cal.com con su etapa (queda pendiente hasta el «sí»): sus reservas vuelven a la R1 o R2 de Integraciones y al CRM principal. Solo el administrador.',
    parametros: [
      { nombre: 'proveedor', tipo: 'string', obligatorio: true, enum: ['calendly', 'calcom'], descripcion: 'la agenda: calendly o calcom.' },
      { nombre: 'evento', tipo: 'string', obligatorio: true, max: 300, descripcion: 'el identificador del evento (de listar_eventos_agenda), o su nombre.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'borra el vínculo del evento (agenda_evento_etapa) y suelta su fila del índice de webhooks si ya nadie la usa',
  },
  // #893 (17/10/2026): una campaña o un conjunto de Meta va a UNO O VARIOS funnels (lib/campana-config.ts, `tambien`).
  {
    id: 'ver_campanas_funnels', area: 'crm', tipo: 'lectura',
    titulo: 'Campañas de Meta y sus funnels',
    descripcion: 'Qué campañas y conjuntos de Meta están asignados a qué funnels del CRM: cada lead nuevo de esa campaña entra al primero (su funnel principal) y se suma a los demás. Un conjunto asignado gana a su campaña. Trae también los funnels que se pueden elegir, con su embudoId. Úsala antes de asignar_campana_funnels.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    // LA TARJETA PERSONALIZADA (20/10/2026): qué datos ve cada persona en la tarjeta de un lead. Es DE UNA PERSONA,
    // así que sale sólo por la app y sólo como lectura, como el perfil (cabecera de equipo.def.ts, punto 3): por
    // WhatsApp y HTTP no hay sesión que diga quién es. Se cambia en el CRM, «⋯» › «Personalizar tarjetas».
    id: 'ver_campos_tarjeta_crm', area: 'crm', tipo: 'lectura',
    titulo: 'Qué muestra la tarjeta de un lead',
    descripcion: 'Qué datos ve la persona en cada tarjeta del tablero del CRM, en su orden (foto, plata, por dónde llegó, vencimientos, datos pendientes, reunión, fuera del funnel, empresa, teléfono, campaña, fecha de alta), con qué forma (Completa, Compacta, Con avance, Monto grande, Próxima reunión o Con portada), qué plantilla tiene puesta, las plantillas de fábrica y las propias, y el catálogo completo. Se elige en el CRM, «⋯» › «Personalizar tarjetas» (o clic derecho en una tarjeta), y es de cada persona: vale en todos sus funnels.',
    parametros: [],
    salida: 'json', canales: ['app'], costo: 'gratis', gating: TAB,
  },
  {
    id: 'asignar_campana_funnels', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Asignar una campaña a funnels',
    descripcion: 'PROPONE a qué funnels entran los leads nuevos de una campaña o un conjunto de Meta (queda pendiente hasta el «sí»): el primero es su funnel principal y en los demás se suma; [] la deja sin asignar. Reemplaza lo que tenía. Los leads que ya entraron no se mueven. Ids de listar_campanas_meta y de ver_campanas_funnels. Solo el administrador.',
    parametros: [
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['campana', 'conjunto'], descripcion: 'campana o conjunto.' },
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 30, descripcion: 'el id de Meta de la campaña o del conjunto.' },
      { nombre: 'embudos', tipo: 'string[]', obligatorio: true, max: 11, vaciaEsValor: true, descripcion: 'los embudoId, el principal primero (de ver_campanas_funnels).' },
      { nombre: 'nombre', tipo: 'string', max: 200, descripcion: 'su nombre en Meta, para mostrarlo.' },
      { nombre: 'campanaId', tipo: 'string', max: 30, descripcion: 'en un conjunto: el id de su campaña.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'guarda a qué funnels entran los leads nuevos de esa campaña o conjunto (el setting meta.campanas)',
  },

  // ── Acciones heredadas ─────────────────────────────────────────────────────────
  {
    id: 'proponer_cambio_etapa', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat', tipoPendiente: 'lead_etapa',
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
    id: 'proponer_agendar_reunion', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat', tipoPendiente: 'agendar_reunion',
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
    // 4c (16/10/2026, Martín por Cerebro: «acciones de Calendly para el paso ⚡ Acción»). Lo único de Calendly que un
    // flujo hace solo sin inventar un dato: crear pide la hora que elige el lead, y editar no existe en su API.
    id: 'cancelar_reunion_calendly', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cancelar su reunión de Calendly',
    descripcion: 'PROPONE cancelar en Calendly la PRÓXIMA reunión de un lead (la primera que todavía no empezó), buscada por su email en la cuenta de Calendly del negocio. Calendly le avisa al lead, con el motivo si lo hay, y su aviso la marca cancelada en el CRM. Si no tiene ninguna por delante, no hay nada que cancelar. Calendly no deja mover ni renombrar una reunión: para reagendar, mándale su link. El lead necesita email.',
    parametros: [
      leadId('id del lead (con email cargado).'),
      { nombre: 'motivo', tipo: 'string', max: 500, descripcion: 'opcional: el motivo que le llega al lead con la cancelación.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: CALENDLY,
    reversible: false, escribe: 'cancela la reunión en Calendly (le llega el aviso al lead) y lo deja en el historial del lead',
  },
  {
    id: 'proponer_lead', area: 'crm', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/crm/revisar',
    titulo: 'Proponer alta de un lead',
    descripcion: 'PROPONE dar de alta un contacto en el CRM: deja una propuesta y devuelve el LINK a /crm/revisar/<id>, donde una persona ve los datos, corrige y confirma; recién ahí se crea el lead (avisando duplicados). Úsala cuando pidan agregar a alguien al CRM. Necesita al menos el nombre; el teléfono es lo que después lo cruza con su WhatsApp, y si sólo hay su Instagram, alcanza con el @. Pasa el link tal cual y no pidas confirmación por el chat. Para varios contactos a la vez usa proponer_leads.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre y apellido de la persona.' },
      { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono, solo dígitos con código de país si lo tienes.' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email, si lo tienes.' },
      { nombre: 'instagram', tipo: 'string', max: 200, descripcion: 'su usuario de Instagram (@usuario o el link del perfil), si lo tienes.' },
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
    id: 'proponer_agendar_agenda', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
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
    id: 'proponer_mover_reunion', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
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
    id: 'proponer_cambiar_reunion', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
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
    id: 'proponer_cancelar_reunion', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
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
    descripcion: 'PROPONE marcar una cuota concreta como cobrada en una fecha, o desmarcarla (queda pendiente hasta el «sí»). Recalcula lo cobrado del lead. El pagoId sale de cobranza_lead. Si se cobró un monto DISTINTO, pasa montoUsd: si fue menos, la diferencia queda como una cuota nueva pendiente con el mismo vencimiento, salvo que la persona diga que es un descuento (resto=descuento). Si se cobró en otra moneda que no es dólares («me pagó 500 mil pesos»), pasa moneda y montoOriginal: nunca los pongas en montoUsd, que SIEMPRE son dólares (si la persona no dijo cuántos dólares son y la cuota está en dólares, se salda con el monto de la cuota). Concepto y metodo son opcionales. Úsala cuando digan «ya me pagó la cuota 2» o «me pagó 300 de la cuota de 500».',
    parametros: [
      { nombre: 'pagoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id de la cuota (de cobranza_lead).' },
      leadId('id del lead dueño de la cuota.'),
      { nombre: 'pagado', tipo: 'boolean', obligatorio: true, descripcion: 'true cobrada, false revertir.' },
      fechaIso('fechaPago', 'YYYY-MM-DD en que se cobró (default hoy en la zona del negocio).'),
      { nombre: 'montoUsd', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'Lo que se cobró de verdad, en USD, si fue distinto del monto de la cuota. Si se omite, la cuota se cobra tal cual.' },
      { nombre: 'resto', tipo: 'string', enum: ['pendiente', 'descuento'], descripcion: 'Sólo si montoUsd es MENOR que la cuota: pendiente (default, la diferencia queda como una cuota nueva) o descuento (no se cobra).' },
      ...paramsDeCobro,
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'marca o desmarca la cuota en pagos (con el monto real, la moneda, el concepto y el método si vinieron), deja la diferencia como una cuota nueva si se cobró de menos, recalcula total_cobrado_usd del lead y deja historial',
  },
  {
    id: 'registrar_pago_suelto', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Registrar un pago fuera del plan',
    descripcion: 'PROPONE registrar un cobro que no es ninguna cuota del plan del lead (un adelanto, un extra, un pago de otro esquema): entra como una cuota nueva ya cobrada y suma a lo cobrado del lead. No cambia el monto de cierre. Si se cobró en otra moneda que no es dólares («me pagó 500 mil pesos»), pasa moneda y montoOriginal además de montoUsd (los dólares que son: si la persona no lo dijo, pregúntalo, no inventes una tasa); montoUsd SIEMPRE es dólares. Concepto y metodo son opcionales. Si el pago corresponde a una cuota que ya existe, usa marcar_pago_cobrado.',
    parametros: [
      leadId('id del lead que pagó.'),
      { nombre: 'montoUsd', tipo: 'number', obligatorio: true, minimo: 0.01, maximo: 100000000, descripcion: 'Lo que se cobró, EN DÓLARES. Si se cobró en otra moneda, los dólares que son (el valor para los reportes); lo que se cobró de verdad va en montoOriginal.' },
      fechaIso('fechaPago', 'YYYY-MM-DD en que se cobró (default hoy en la zona del negocio).'),
      ...paramsDeCobro,
      // (5/11/2026) En una suscripción: qué mes paga, o que es un ajuste (docs/investigacion-suscripciones.md).
      { nombre: 'mes', tipo: 'string', max: 7, descripcion: 'En una suscripción: AAAA-MM que paga (sin valor, el más viejo que falta).' },
      { nombre: 'ajuste', tipo: 'boolean', descripcion: 'En una suscripción: true si no paga un mes (un diferencial).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'insert en pagos (una cuota nueva ya cobrada, con su moneda, concepto y método si vinieron; en una suscripción, el mes que paga o si es un ajuste), recalcula total_cobrado_usd del lead y deja historial',
  },
  {
    id: 'ignorar_datos_sin_marcar', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Ignorar datos sin marcar',
    descripcion: 'PROPONE ignorar los datos sin marcar de un lead (queda pendiente hasta el «sí»), igual que la ✕ de «A revisar»: dejan de contar en el worklist, en el contador y en su ficha, también los que le falten después, y quedan en «Ver más», donde una persona los puede volver a mostrar. No ignora la asistencia a una reunión pasada, que se sigue pidiendo. Se deshace con reactivar_datos_sin_marcar.',
    parametros: [leadId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'guarda los datos ignorados del lead en datos_ignorados (lo mismo que la pantalla) y deja historial',
  },
  {
    id: 'reactivar_datos_sin_marcar', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Reactivar datos sin marcar',
    descripcion: 'PROPONE deshacer ignorar_datos_sin_marcar sobre un lead (queda pendiente hasta el «sí»): el lead vuelve a contar en «Datos sin marcar» con todo lo que le falta, también lo que se ignoró desde su ficha o desde «A revisar».',
    parametros: [leadId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'vacía los datos ignorados del lead (y la marca vieja de lead ignorado) y deja historial',
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
    id: 'mover_lead_en_producto', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
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
    id: 'poner_etiqueta_lead', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agregarle una etiqueta a un lead',
    descripcion: 'PROPONE agregarle una etiqueta del CRM a un lead (queda pendiente hasta el «sí»). Si la etiqueta está vinculada a una etapa, lo pasa a esa etapa (salvo un cierre, que se mueve a mano). Dispara las automatizaciones que arrancan con esa etiqueta (y las de «Se agrega etiqueta a un lead») y la agrega también en su chat de WhatsApp y en Chatwoot si están conectados. Si ya la tiene, lo dice y no hace nada. Pide el leadId (buscar_leads) y el etiquetaId (listar_etiquetas).',
    parametros: [leadId(), etiquetaId()],
    canales: TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'una fila en crm_lead_etiquetas y una línea en el historial del lead; puede mover al lead a la etapa vinculada, inscribirlo en las automatizaciones de esa etiqueta y agregarla en WhatsApp y Chatwoot',
  },
  {
    id: 'sacar_etiqueta_lead', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
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
    // El id quedó con «fathom» (lo usan los clientes de la API); desde el 26/10/2026 acepta el link de cualquier grabador.
    titulo: 'Agregar la grabación de una reunión',
    descripcion: 'PROPONE agregar el link de la grabación (de Fathom, Loom, tl;dv, Fireflies, Zoom u otro grabador) de la R1 o R2 de un lead: deja un link donde una persona revisa la URL exacta y confirma. Destraba el requisito «Fathom» de la etapa y habilita analizar la llamada. Lo normal es que entre solo por el grabador conectado; esto es el camino manual (y el único para Loom, que no tiene API).',
    parametros: [
      leadId(),
      cualReunion,
      { nombre: 'url', tipo: 'string', obligatorio: true, max: 500, descripcion: 'link de la grabación, con https: de Fathom (fathom.video), Loom, tl;dv, Fireflies, Zoom, Otter, Read AI o Meet.' },
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
    descripcion: 'PROPONE el plan de cobranza de un lead: cobro inicial, monto por cuota, cantidad de cuotas (1 a 6) y día de pago, todo en USD; deja un link donde una persona revisa los montos y confirma. Regenera las cuotas NO pagadas anclándolas en la fecha de cierre (las cobradas no se tocan). No marca el lead como ganado. Para una primera cuota en una fecha dada, quincenas, semanas, otra moneda o tramos de montos distintos usa armar_plan_por_tramos; para cuotas sueltas de montos o fechas distintas, guardar_cuotas.',
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
      // `fijoAlRevisar`: el título de /mako/revisar nombra este producto y su precio de antes; cambiar el id ahí aplicaría otro.
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, fijoAlRevisar: true, descripcion: 'id del producto a editar; sin id se crea uno nuevo.' },
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
    descripcion: 'PROPONE dar de alta un LOTE de contactos (hasta 200) en el CRM: deja UNA propuesta y devuelve el link a /crm/revisar/<id>, donde una persona ve la tabla, corrige, marca duplicados y confirma. Cada contacto necesita nombre y además email, teléfono o Instagram; los que no traen ninguno se devuelven en `descartados`. Idempotente por `ref`: reenviar el mismo lote devuelve el mismo link. Para un solo contacto dicho en un chat, usa proponer_lead.',
    parametros: [
      {
        nombre: 'leads', tipo: 'object[]', obligatorio: true, max: 200, descripcion: 'los contactos del lote.',
        campos: [
          { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre y apellido.' },
          { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email.' },
          { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono con código de país.' },
          { nombre: 'instagram', tipo: 'string', max: 200, descripcion: 'usuario de Instagram (@usuario o el link del perfil).' },
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

  // ── Lo del feedback de Martín del 21/10: AL FINAL DEL ÁREA A PROPÓSITO, ANTES DE armar_tab_ficha (22/10/2026) ────────────────────────
  // ⚠️ En un empate de relevancia (`ordenarPorRelevancia`, lib/api-mako/registro.ts) gana la operación declarada ANTES,
  //    y el presupuesto del turno corta a las que vienen después. Declarada arriba, `cambiar_tipo_etapa` («cambiar» y
  //    «etapa» en el id, que es lo que suma la relevancia genérica de un pedido sobre un lead) dejó sin
  //    `editar_contacto_lead` a «cambia el teléfono del lead Juan…» en la app y en WhatsApp
  //    (tests/ops-center-bateria.test.ts), y sin `cambiar_ficha_funnel` a la edición de la ficha. Una operación nueva va
  //    al FINAL de su área: en un empate pierde con las que el piso ya mide. Justo ANTES de `armar_tab_ficha`, que sigue
  //    última por la misma regla desde el 16/10 (lenta y con IA; tests/ficha-tabs.test.ts).
  // 21/10/2026, Martín, sobre «Asignar evento»: «me gustaría que se pueda editar o crear eventos desde allí también».
  // Las mismas funciones que la pantalla (lib/agenda-evento-etapa-server.ts): el nombre y la duración, nada más.
  // ⚠️ «PÁGINA DE RESERVA» Y NO «EVENTO DE AGENDA» EN EL ID Y EL TÍTULO (22/10/2026): «agenda» y «evento» son lo que el
  //    clasificador suma a CUALQUIER pedido de agenda (`RELEVANCIA_AGENDA`), y en el id pesan doble. Llamadas
  //    `crear_evento_agenda` y `editar_evento_agenda` le ganaban el presupuesto a `crear_evento_calendario`,
  //    `proponer_cambiar_reunion` y `crear_etiqueta` (tests/ops-center-bateria.test.ts, el piso de Ops Center del 22/10).
  //    Es lo que de verdad crean: lo que Calendly y Cal.com llaman «event type», la página donde se reserva.
  {
    id: 'crear_pagina_reserva', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una página de reserva (Calendly o Cal.com)',
    descripcion: 'PROPONE crear una página de reserva (lo que Calendly y Cal.com llaman tipo de evento) en la cuenta del negocio (queda pendiente hasta el «sí»): uno a uno, con su nombre y su duración; la disponibilidad y la ubicación son las de la cuenta. Nace activa. Para que sus reservas caigan en una etapa, después vincular_evento_etapa. Google Calendar no: no expone sus páginas de reserva. Solo el administrador.',
    parametros: [
      { nombre: 'proveedor', tipo: 'string', obligatorio: true, enum: ['calendly', 'calcom'], descripcion: 'la agenda: calendly o calcom.' },
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: MAX_NOMBRE_EVENTO, descripcion: 'el nombre del evento («Llamada de diagnóstico»).' },
      { nombre: 'duracionMin', tipo: 'number', obligatorio: true, entero: true, minimo: 5, maximo: 720, descripcion: 'cuánto dura, en minutos.' },
      // Varias cuentas por proveedor (23/10/2026, fase B de Cobros).
      { nombre: 'cuenta', tipo: 'string', max: 20, descripcion: 'la cuenta (de listar_eventos_agenda); sin ella, la principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'crea el tipo de evento en la cuenta de Calendly o Cal.com del negocio (se borra desde esa cuenta)',
  },
  {
    id: 'editar_pagina_reserva', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Editar una página de reserva (Calendly o Cal.com)',
    descripcion: 'PROPONE cambiar el nombre, la duración, la descripción o dónde es la reunión de una página de reserva de Calendly o Cal.com del negocio (queda pendiente hasta el «sí»). Lo que no se pasa queda como está. Su identificador sale de listar_eventos_agenda. Solo el administrador.',
    parametros: [
      { nombre: 'proveedor', tipo: 'string', obligatorio: true, enum: ['calendly', 'calcom'], descripcion: 'la agenda: calendly o calcom.' },
      { nombre: 'evento', tipo: 'string', obligatorio: true, max: 300, descripcion: 'el identificador del evento (de listar_eventos_agenda), o su nombre.' },
      { nombre: 'nombre', tipo: 'string', max: MAX_NOMBRE_EVENTO, descripcion: 'el nombre nuevo.' },
      { nombre: 'duracionMin', tipo: 'number', entero: true, minimo: 5, maximo: 720, descripcion: 'la duración nueva, en minutos.' },
      // La edición completa (23/10/2026): lib/agenda-evento-detalle.ts. Las preguntas y la disponibilidad, en la pantalla o allá.
      { nombre: 'descripcion', tipo: 'string', max: 1000, descripcion: 'la descripción nueva.' },
      { nombre: 'ubicacion', tipo: 'string', enum: ['meet', 'zoom', 'llamada', 'presencial', 'link'], descripcion: 'dónde es la reunión.' },
      { nombre: 'ubicacionValor', tipo: 'string', max: 300, descripcion: 'la dirección (presencial) o el link (link).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'cambia el nombre, la duración, la descripción o la ubicación del tipo de evento en la cuenta de Calendly o Cal.com del negocio',
  },
  {
    // 21/10/2026: las plantillas de la tarjeta (Martín: «poder ver TEMPLATES de estilos de tarjeta… y puedes crear otras
    // más»). Sólo por la app, como su lectura: es de UNA persona, y por WhatsApp o HTTP no hay sesión que diga quién es.
    id: 'personalizar_tarjetas_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Personalizar la tarjeta de los leads',
    descripcion: 'PROPONE cómo se ve la tarjeta de un lead en el tablero del CRM para la persona que lo pide (queda pendiente hasta el «sí»): poner una plantilla por su nombre (de fábrica o propia, de ver_campos_tarjeta_crm), o elegir la forma y los datos en su orden. Con guardarComo, además la guarda como plantilla propia con ese nombre (con el mismo nombre, la reemplaza). Es de cada persona: no cambia la tarjeta del resto del equipo.',
    parametros: [
      { nombre: 'plantilla', tipo: 'string', max: 40, descripcion: 'el nombre de una plantilla (Completa, Compacta, Sin foto, Monto grande, Próxima reunión, Con avance, Con portada, Sólo el nombre, o una propia).' },
      { nombre: 'forma', tipo: 'string', enum: [...DISENOS_TARJETA], descripcion: 'la forma, si no se pasa una plantilla.' },
      { nombre: 'campos', tipo: 'string[]', max: CAMPOS_TARJETA_LEAD.length, vaciaEsValor: true, descripcion: 'los datos en su orden, si no se pasa una plantilla ([] = sólo el nombre).' },
      { nombre: 'guardarComo', tipo: 'string', max: 32, descripcion: 'guardar lo elegido como plantilla propia con este nombre.' },
    ],
    canales: ['app'], costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'la tarjeta de los leads de esa persona (usuarios.perfil.crmTarjeta)',
  },
  {
    // 21/10/2026, Martín: «En cada columna… debes poner en los 3 puntos una opción de "Tipo de etapa" para poder decidir si
    // es una etapa de reunión, o las otras que tenemos». La misma regla que la pantalla (lib/etapa-tipo-server.ts).
    id: 'cambiar_tipo_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar el tipo de una etapa',
    descripcion: 'PROPONE cambiar el tipo de una etapa del CRM (queda pendiente hasta el «sí»): etapa, reunion o nutricion, lo mismo que «⋯» › «Tipo de etapa» de la columna. Reunión: quien pase por ahí lleva la fecha y la asistencia, y se le puede vincular un evento (vincular_evento_etapa); nutricion la pasa a la banda Nutrición. Quienes ya están en la etapa no se mueven. La entrada, el cierre y las terminales no cambian de tipo. La etapa por su key (de ver_funnel) o su nombre; con embudoId, la de otro CRM. Solo el administrador.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 80, descripcion: 'la key de la etapa (de ver_funnel) o su nombre.' },
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: [...TIPOS_ETAPA], descripcion: 'etapa, reunion o nutricion.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'el tipo de la etapa en el pipeline del funnel (y su banda: Nutrición o el recorrido)',
  },
  // ── Editar las etapas de un CRM (23/10/2026, P0-6 de la auditoría de la API) ─────────────────────────────────
  // Lo mismo que el «⋯» de cada columna y el pop-up de etapas, por la MISMA función (`editarEtapa`,
  // lib/etapas-crm-server.ts). Todas por chat y sólo el admin, como cambiar_tipo_etapa. Lo que no se borra (las terminales,
  // la entrada) lo decide `porQueNoSeElimina`, la misma que frena la pantalla; los leads de una etapa que se quita se
  // cuentan con `conteosDelEmbudo`, el conteo del pop-up.
  {
    id: 'renombrar_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Renombrar una etapa',
    descripcion: 'PROPONE cambiarle el nombre a una etapa del CRM (queda pendiente hasta el «sí»), lo mismo que el lápiz de la columna. Vale también para las terminales (Ganado, Perdido, Descalificado, No responde) y las columnas de nutrición. Los leads no se mueven. Si el nombre nuevo dice reunión, puede quedar marcada como Reunión (se cambia con cambiar_tipo_etapa). La etapa por su key (de ver_funnel) o su nombre; con embudoId, la de otro CRM. Solo el administrador.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 80, descripcion: 'la key de la etapa (de ver_funnel) o su nombre.' },
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: MAX_LABEL_ETAPA, descripcion: 'el nombre nuevo.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    escribe: 'el nombre de la etapa en el pipeline del funnel (o en sus nombres, si es una terminal o una nutrición)',
  },
  {
    id: 'agregar_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Agregar una etapa',
    descripcion: 'PROPONE agregar una etapa al recorrido del CRM (queda pendiente hasta el «sí»), lo mismo que «Agregar etapa» del «⋯» de una columna. Con despuesDe va después de esa; sin él, antes de la etapa donde se cierra la venta. Nace como etapa (cambiar_tipo_etapa la hace Reunión o Nutrición). Devuelve su key. Un nombre que ya tiene otra etapa de ese CRM se rechaza. Se quita con eliminar_etapa. Solo el administrador.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: MAX_LABEL_ETAPA, descripcion: 'el nombre de la etapa nueva.' },
      { nombre: 'despuesDe', tipo: 'string', max: 80, descripcion: 'la etapa después de la cual va (key o nombre). Sin ella, antes del cierre.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    escribe: 'una etapa nueva en el pipeline del funnel',
  },
  {
    id: 'eliminar_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Quitar una etapa',
    descripcion: 'PROPONE quitar una etapa del recorrido del CRM (queda pendiente hasta el «sí»), lo mismo que su tacho en el pop-up de etapas. El resumen dice cuántos leads tiene: no se borran, pasan a la etapa que les dan sus datos (agenda, asistencia, pago) o a la primera. Las terminales (Ganado, Perdido, Descalificado, No responde) y la etapa de entrada no se quitan, sólo se renombran; una columna de nutrición del catálogo se quita con columna_nutricion_crm. Solo el administrador.',
    parametros: [{ nombre: 'etapa', tipo: 'string', obligatorio: true, max: 80, descripcion: 'la key de la etapa (de ver_funnel) o su nombre.' }, { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' }],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    escribe: 'saca la etapa del pipeline del funnel (los leads no se tocan)',
  },
  {
    id: 'ordenar_etapas', area: 'crm', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Ordenar las etapas',
    descripcion: 'PROPONE ordenar las etapas del recorrido del CRM (queda pendiente hasta el «sí»), lo mismo que arrastrarlas en el pop-up de etapas. orden: las etapas en el orden nuevo, por key o nombre; las que no se nombran quedan al final en el orden que tenían, y la de entrada sigue primera. Las terminales no se ordenan: van siempre al final. Solo el administrador.',
    parametros: [
      { nombre: 'orden', tipo: 'string[]', obligatorio: true, max: 60, descripcion: 'las etapas en el orden nuevo (keys de ver_funnel o nombres).' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    escribe: 'el orden de las etapas en el pipeline del funnel',
  },
  {
    id: 'plazo_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Ponerle plazo a una etapa',
    descripcion: 'PROPONE ponerle un plazo en días a una etapa del CRM (queda pendiente hasta el «sí»): si un lead pasa más que eso en la etapa sin moverse, MaKo te avisa. dias 0 saca el plazo. Las terminales y la etapa donde se cierra la venta no llevan plazo. La etapa por su key (de ver_funnel) o su nombre; con embudoId, la de otro CRM. Solo el administrador.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 80, descripcion: 'la key de la etapa (de ver_funnel) o su nombre.' },
      { nombre: 'dias', tipo: 'number', obligatorio: true, entero: true, minimo: 0, maximo: PLAZO_MAX_DIAS, descripcion: 'cuántos días; 0 lo saca.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    escribe: 'el plazo de la etapa en el funnel (data.umbrales.porEtapa)',
  },
  {
    id: 'columna_nutricion_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Quitar o devolver una nutrición',
    descripcion: 'PROPONE quitar (activa false) o devolver (activa true) una columna de nutrición del catálogo del CRM (queda pendiente hasta el «sí»), lo mismo que su tacho en el pop-up de etapas. Quitarla apaga las nutriciones que llegan a ella; los leads que estén ahí no se borran. Para devolverla hace falta su key, que dice la respuesta al quitarla. Una nutrición creada como etapa se quita con eliminar_etapa. Solo el administrador.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', obligatorio: true, max: 80, descripcion: 'la key de la etapa (de ver_funnel) o su nombre.' },
      { nombre: 'activa', tipo: 'boolean', obligatorio: true, descripcion: 'false la quita; true la devuelve.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    escribe: 'las nutriciones apagadas del funnel (data.suppressed)',
  },
  // ── Los contactos de un grupo de WhatsApp, al CRM (23/10/2026, Martín en la llamada: «una automatización que te agrega de un
  //    grupo de WhatsApp, te pone todos los números y los contactos en tu CRM»). Lo mismo que la pantalla (app/crm/grupo-wa-server.ts).
  //    Sólo el admin: los números de un grupo son datos personales. ⚠️ SÓLO EN LA APP (la revisión de privacidad, 23/10/2026):
  //    por WhatsApp el rol es siempre 'admin' (lib/mako-doer-in.ts), así que cualquiera que le escriba a la línea pasaba la
  //    puerta. Antes del bloque de cobros: ese tiene que quedar último, antes de `armar_tab_ficha` (tests/crm-vincular-22-10).
  {
    id: 'grupos_whatsapp', area: 'crm', tipo: 'lectura',
    titulo: 'Grupos de WhatsApp de la línea',
    descripcion: 'Los grupos de WhatsApp en los que está una línea del negocio (su id, su nombre y cuántos son), para traer sus contactos al CRM con traer_contactos_de_grupo. Sin `linea`, la de por defecto. Solo el administrador.',
    parametros: [{ nombre: 'linea', tipo: 'string', max: 80, descripcion: 'la línea de WhatsApp del negocio (su instancia); sin esto, la de por defecto.' }],
    salida: 'json', canales: ['app'], costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'traer_contactos_de_grupo', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Traer contactos de un grupo de WhatsApp',
    descripcion: 'PROPONE traer al CRM a los participantes de un grupo de WhatsApp de la línea (queda pendiente hasta el «sí»). Crea un lead por cada número nuevo, con la etiqueta de origen (por defecto, el nombre del grupo). A los que ya son leads del CRM no los toca: ni los suma a este funnel ni los etiqueta (nunca duplica). No manda ningún mensaje: sólo deja elegir etapas sin automatización activa. Los que WhatsApp no deja ver su número no se traen. El grupo sale de grupos_whatsapp. Solo el administrador.',
    parametros: [
      { nombre: 'grupo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el grupo: su id (de grupos_whatsapp) o su nombre.' },
      { nombre: 'etapa', tipo: 'string', max: 80, descripcion: 'la etapa del funnel (su clave o su nombre); sin esto, «Tibio» si la hay, si no la primera sin automatización.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el funnel del CRM (de productos_del_lead o ver_funnel); sin esto, «Prospección» si lo hay, si no el principal.' },
      { nombre: 'etiqueta', tipo: 'string', max: 40, descripcion: 'la etiqueta de origen («Formación de Jan»); sin esto, el nombre del grupo.' },
      { nombre: 'linea', tipo: 'string', max: 80, descripcion: 'la línea de WhatsApp del negocio; sin esto, la de por defecto.' },
    ],
    canales: ['app'], costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'crea un lead por cada número nuevo del grupo, con su etiqueta de origen y su historial (a los que ya son leads no los toca)',
  },
  // 24/10/2026 (el Cerebro: «traer ahora no puede impedir completar los nombres después»): el listado del grupo no trae
  // nombres, y volver a traer no toca a los que ya están. (La pantalla ya no tiene «Completar nombres»: desde el 26/10/2026 los
  // nombres van solos dentro de «Extraer», por la extensión. Esta acción sigue para el chat de MaKo, con lo que sabe la línea.)
  {
    id: 'completar_nombres_de_grupo', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Completar nombres de un grupo',
    descripcion: 'PROPONE ponerle el nombre que WhatsApp ya conoce a los participantes de un grupo de WhatsApp que ya son leads y tienen su número por nombre (el listado del grupo no trae nombres: los traídos nacen así). No crea ni mueve a nadie y no manda ningún mensaje; un nombre que escribió una persona no se toca. Se puede repetir más adelante: quien escriba deja su nombre. El grupo sale de grupos_whatsapp. Solo el administrador.',
    parametros: [
      { nombre: 'grupo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el grupo: su id (de grupos_whatsapp) o su nombre.' },
      { nombre: 'linea', tipo: 'string', max: 80, descripcion: 'la línea de WhatsApp del negocio; sin esto, la de por defecto.' },
    ],
    canales: ['app'], costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'el nombre de los leads del grupo que tenían su número por nombre (cada cambio queda en su historial)',
  },
  // «Completar desde mi WhatsApp» (25/10/2026): corre en el NAVEGADOR (la extensión lee el WhatsApp Web de la persona), así
  // que por la API no se dispara. Esto dice qué haría, con los números del grupo, y cómo se dispara.
  {
    id: 'ver_completar_desde_whatsapp', area: 'crm', tipo: 'lectura',
    titulo: 'Ver completar desde mi WhatsApp',
    descripcion: 'De los traídos de un grupo de WhatsApp: cuántos tienen teléfono y a cuántos se los encuentra por su identificador en el grupo, para completarlos con lo que la persona ya ve en su WhatsApp Web (nombre, empresa, grupos en común). Eso corre en su navegador con la extensión de MaKo: se dispara desde el CRM, tildándolos y tocando Completar, Desde mi WhatsApp. Esta lectura no toca el WhatsApp de nadie. Solo el administrador.',
    parametros: [{ nombre: 'grupo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el nombre del grupo del que vinieron, como en grupos_whatsapp.' }],
    // Sólo el chat de MaKo, como grupos_whatsapp y sus vecinas: lo de un grupo de WhatsApp no sale por HTTP.
    salida: 'json', canales: ['app'], costo: 'gratis', gating: TAB_ADMIN,
  },
  // ── «Invitar al curso al ganar» (23/10/2026, P0-4 de la auditoría de la API) ─────────────────────────
  // El interruptor del «⋯» de la columna Ganado (app/crm/curso-al-ganar-actions.ts): prendido, quien pasa a Ganado en
  // ese CRM recibe sola la invitación al curso de su producto. Cierra el par venta → acceso sin que nadie invite a mano
  // («no vender sin entregar»). Al final del área, antes del bloque de cobros (que va pegado a `armar_tab_ficha`), y sin
  // «lead» ni «etapa» en las descripciones: en un empate de relevancia no le gana el presupuesto a las de antes.
  {
    id: 'ver_curso_al_ganar', area: 'crm', tipo: 'lectura',
    titulo: 'Ver la invitación al ganar',
    descripcion: 'Por cada CRM del negocio (o sólo el de embudoId): si está prendida «Invitar al curso al ganar», que le manda sola la invitación al curso a quien pasa a Ganado, y si su producto tiene un curso con clases (sin clases no se puede prender). Lo cambia cambiar_curso_al_ganar.',
    parametros: [{ nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, todos.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'cambiar_curso_al_ganar', aTerceros: true, area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar la invitación al ganar',
    descripcion: 'PROPONE prender o apagar «Invitar al curso al ganar» en un CRM (queda pendiente hasta el «sí»): prendida, cada persona que pase a Ganado ahí recibe sola la invitación por email al curso de su producto. A los que ya están en Ganado no les llega nada. Prender exige que el producto tenga clases; apagar, nada. Sin embudoId, el CRM principal. Solo el administrador.',
    parametros: [
      { nombre: 'prendido', tipo: 'boolean', obligatorio: true, descripcion: 'true la prende; false la apaga.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'el interruptor «Invitar al curso al ganar» de ese CRM en la configuración del negocio: prendido, cada cliente que pase a Ganado recibe la invitación al curso por email',
  },
  // ── «Vincular cobro» por MaKo (22/10/2026) ────────────────────────────────────────
  // `plata: true` en las tres que escriben (revisión del 23/10/2026): deciden si un pago gana el trato y arma su plan de
  // pagos. Por WhatsApp, un «ok, después lo veo» no las confirma: sólo un «sí» (tests/confirmacion-terceros.test.ts).
  // Martín: «Que MaKo pueda hacer todo eso y que quede en la API de MaKo... Así el chat de MaKo crea, edita y vincula
  // eventos y cobros sin problemas». Las MISMAS funciones del pop-up (lib/cobro-etapa-server.ts, de Cobros); crear o
  // editar el producto es `guardar_producto`. Al final del área, antes de `armar_tab_ficha` (AGENTS.md: una op nueva no
  // puede dejar afuera a las de antes en el presupuesto), y sin las palabras que el clasificador suma a todo un tipo de pedido.
  {
    id: 'ver_cobro_etapa', area: 'crm', tipo: 'lectura',
    titulo: 'Qué cobra Ganado en un CRM',
    descripcion: 'Los productos vinculados a Ganado de un CRM (quien paga uno pasa a Ganado ahí, con su plan de pagos), por qué cuentas de Stripe o Mercado Pago cobra cada uno, las cuentas conectadas, los productos del catálogo que se pueden sumar y los precios de Stripe que se pueden traer. Paso previo a vincular_cobro_etapa. Solo el administrador.',
    parametros: [{ nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo (de productos_del_lead). Sin él, el CRM principal del negocio.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'vincular_cobro_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', plata: true,
    titulo: 'Vincular un producto a Ganado',
    descripcion: 'PROPONE vincular un producto del catálogo a Ganado de un CRM (queda pendiente hasta el «sí»): quien lo pague por esas cuentas pasa a Ganado ahí, con su plan de pagos. Un producto cobra en un solo CRM. Producto y cuentas salen de ver_cobro_etapa. Solo el administrador.',
    parametros: [
      { nombre: 'productoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el producto (de ver_cobro_etapa o listar_productos).' },
      // O un precio de Stripe (23/10/2026): se trae al catálogo con su precio y se vincula (lib/stripe-catalogo.ts, de Cobros).
      { nombre: 'precioStripe', tipo: 'string', max: 80, descripcion: 'en vez del producto, un precio de Stripe (de ver_cobro_etapa).' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal del negocio.' },
      { nombre: 'cuentas', tipo: 'string[]', max: 20, descripcion: 'las cuentas por las que cobra (sus id de ver_cobro_etapa, como stripe:principal). Sin ellas, todas las conectadas.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'guarda el vínculo del producto con Ganado de ese CRM (cobro_etapa_vinculos): desde ahí, quien lo pague por esas cuentas pasa a Ganado con su plan de pagos',
  },
  {
    id: 'cuentas_cobro_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', plata: true,
    titulo: 'Cuentas de cobro en Ganado',
    descripcion: 'PROPONE fijar por qué cuentas de Stripe o Mercado Pago cobra un producto ya vinculado a Ganado (queda pendiente hasta el «sí»). La lista que se pasa es la NUEVA y entera; vacía no se acepta (eso es desvincular_cobro_etapa). El vínculo sale de ver_cobro_etapa. Solo el administrador.',
    parametros: [
      { nombre: 'vinculoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el vínculo (de ver_cobro_etapa).' },
      { nombre: 'cuentas', tipo: 'string[]', obligatorio: true, max: 20, descripcion: 'las cuentas por las que cobra desde ahora (sus id de ver_cobro_etapa).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'fija las cuentas del vínculo (cobro_etapa_vinculos.cuentas): un pago por una cuenta que salió ya no pasa a Ganado ahí',
  },
  {
    id: 'desvincular_cobro_etapa', area: 'crm', tipo: 'accion', confirmacion: 'chat', plata: true,
    titulo: 'Quitar un producto de Ganado',
    descripcion: 'PROPONE sacar un producto de Ganado de un CRM (queda pendiente hasta el «sí»): sus pagos ya no pasan a Ganado ahí. Lo ya cobrado queda igual. El vínculo sale de ver_cobro_etapa. Solo el administrador.',
    parametros: [{ nombre: 'vinculoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el vínculo (de ver_cobro_etapa).' }],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'borra el vínculo del producto con Ganado (cobro_etapa_vinculos); los cobros y planes ya hechos no se tocan',
  },
  // ── EN BLOQUE (28/10/2026, tickets #21 y #22 de Leila: los 394 de «Contacto nuevo») ─────────────────────────────
  // UNA confirmación para todos, no 394: `preparar` congela los ids (la columna entera, paginada, o los que se nombran) y el
  // resumen dice cuántos y quiénes; `ejecutar` los pasa con las piezas de la barra del tablero (lib/crm-bloque-server.ts).
  // Lentas (`lenta`): en el chat siguen por detrás. Lo que no llega en el plazo se dice («quedan N»).
  {
    id: 'pasar_en_bloque_otra_columna', area: 'crm', tipo: 'accion', confirmacion: 'chat', lenta: true,
    titulo: 'Pasar varios a otra columna',
    descripcion: 'PROPONE pasar EN BLOQUE varios leads a otra columna del mismo CRM, con UNA confirmación para todos (queda pendiente hasta el «sí»): la columna entera de origen (columna, con embudoId si no es el CRM principal) o los ids (leadIds). Para descalificar o perder en bloque, el destino es Descalificado o Perdido, con un motivo. Lo que la columna pida y falte queda pendiente en cada ficha. No manda mensajes. Solo el administrador.',
    parametros: [
      { nombre: 'destino', tipo: 'string', obligatorio: true, max: 80, descripcion: 'la columna adonde van: su key (de ver_funnel) o su nombre.' },
      { nombre: 'columna', tipo: 'string', max: 80, descripcion: 'la columna de origen ENTERA (todos los que están ahí): su key o su nombre. Sin esto, leadIds.' },
      { nombre: 'leadIds', tipo: 'string[]', max: 5000, descripcion: 'los ids de los leads (de buscar_leads o listar_leads), si no es la columna entera.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM, por el id de su embudo. Sin él, el CRM principal.' },
      { nombre: 'motivo', tipo: 'string', max: 300, descripcion: 'el motivo de descalificar o perder («No calificado — sin presupuesto»), uno para todos.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'mueve cada lead a la columna, con su historial (a un agregado, en su fila de ese CRM), como la barra en bloque del tablero',
  },
  {
    id: 'pasar_en_bloque_otro_funnel', area: 'crm', tipo: 'accion', confirmacion: 'chat', lenta: true,
    titulo: 'Pasar varios a otro funnel',
    descripcion: 'PROPONE pasar EN BLOQUE leads de un CRM a OTRO, con UNA confirmación para todos (queda pendiente hasta el «sí»): salen del de origen y entran al de destino en la columna que se dice (sin ella, la misma si el destino la tiene, si no la de entrada). Los que ya pagaron en el origen no se pasan (sus pagos son de ahí); los que ya agendaron, sólo con incluirAgendados. El resumen dice cuántos de cada uno. No manda mensajes. Solo el administrador.',
    parametros: [
      { nombre: 'haciaEmbudoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el CRM de destino, por el id de su embudo (de productos_del_lead o ver_funnel).' },
      { nombre: 'columna', tipo: 'string', max: 80, descripcion: 'la columna de origen ENTERA (todos los que están ahí): su key o su nombre. Sin esto, leadIds.' },
      { nombre: 'leadIds', tipo: 'string[]', max: 5000, descripcion: 'los ids de los leads, si no es la columna entera.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM de origen. Sin él, el CRM principal.' },
      { nombre: 'destino', tipo: 'string', max: 80, descripcion: 'la columna del CRM de destino donde caen: su key o su nombre.' },
      { nombre: 'incluirAgendados', tipo: 'boolean', descripcion: 'pasar también a los que ya agendaron una reunión (por defecto, no).' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'saca a cada lead del CRM de origen y lo deja en el de destino (si el origen era su casa, la casa pasa a ser el destino), con su historial',
  },
  {
    id: 'mandar_en_bloque_a_papelera', area: 'crm', tipo: 'accion', confirmacion: 'chat', lenta: true,
    titulo: 'Mandar varios a la papelera',
    descripcion: 'PROPONE mandar EN BLOQUE leads a la papelera del CRM, con UNA confirmación para todos (queda pendiente hasta el «sí»): salen del CRM con su historial y sus pagos, y nadie recibe ningún mensaje. Durante 30 días se recuperan tal cual con recuperar_de_papelera_crm (la lista, con ver_papelera_crm); después se borran para siempre. La columna entera (columna, con embudoId) o los ids (leadIds). Solo el administrador.',
    parametros: [
      { nombre: 'columna', tipo: 'string', max: 80, descripcion: 'la columna ENTERA (todos los que están ahí): su key o su nombre. Sin esto, leadIds.' },
      { nombre: 'leadIds', tipo: 'string[]', max: 5000, descripcion: 'los ids de los leads, si no es la columna entera.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM de la columna. Sin él, el CRM principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'saca a cada lead del CRM y guarda su foto 30 días en la papelera (leads_papelera); se recupera con recuperar_de_papelera_crm',
  },
  {
    id: 'ver_papelera_crm', area: 'crm', tipo: 'lectura',
    titulo: 'Ver la papelera del CRM',
    descripcion: 'Los leads que se eliminaron y todavía se pueden recuperar (30 días): su id, nombre, de qué CRM y columna salieron, quién los eliminó y cuántos días les quedan. Para recuperarlos, recuperar_de_papelera_crm.',
    parametros: [{ nombre: 'buscar', tipo: 'string', max: 80, descripcion: 'un nombre, teléfono o email para filtrar.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'ver_nombres_del_crm', area: 'crm', tipo: 'lectura',
    titulo: 'Ver cómo se saluda a los leads',
    descripcion: 'Cuántos leads quedan sin nombre para saludar (su mensaje sale sin nombre) y qué primeras palabras se repiten en la base («Kun Fabiola Pedraza»), con un ejemplo de cómo sale. Úsala antes de una campaña con {{nombre}}.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'marcar_palabra_no_nombre', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Marcar palabra que no es nombre',
    descripcion: 'PROPONE marcar (o desmarcar) una palabra que en este negocio no es un nombre, como un lugar con que se agenda a los contactos: {{nombre}} la salta (queda pendiente hasta el «sí»). No cambia ningún lead.',
    parametros: [
      { nombre: 'palabra', tipo: 'string', obligatorio: true, max: 60, descripcion: 'la palabra, como está en el nombre.' },
      { nombre: 'noEs', tipo: 'boolean', descripcion: 'false para volver a tratarla como un nombre. Por defecto, true.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'cambia la lista de palabras que {{nombre}} salta en este negocio',
  },
  {
    id: 'ver_bajas_de_leads', area: 'crm', tipo: 'lectura',
    titulo: 'Ver lo que se borró del CRM',
    descripcion: 'Quién, cuándo, cuántos y por qué camino se borraron leads de este negocio (eliminar, unificar, un duplicado automático). Queda para siempre, también después de que la papelera purga. Sirve para contestar «¿qué pasó con estos leads?». Sólo trae ids; se registra desde el 30/10/2026.',
    parametros: [{ nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'lo que pasó con UN lead, por su id.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'recuperar_de_papelera_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat', lenta: true,
    titulo: 'Recuperar de la papelera',
    descripcion: 'PROPONE devolver leads de la papelera del CRM tal cual estaban (sus mismos ids, pagos, funnels, etiquetas y mensajes), con UNA confirmación (queda pendiente hasta el «sí»). Los ids salen de ver_papelera_crm; con todos=true, todos los de la papelera. Uno que volvió a llegar con sus mismos datos queda en la papelera y se dice. Solo el administrador.',
    parametros: [
      { nombre: 'leadIds', tipo: 'string[]', max: 5000, descripcion: 'los ids de los leads (de ver_papelera_crm).' },
      { nombre: 'todos', tipo: 'boolean', descripcion: 'todos los de la papelera.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'vuelve a crear cada lead con todo lo que tenía y lo saca de la papelera (leads_papelera)',
  },
  // ── AGREGAR EN BLOQUE A OTRO CRM, SIN SACARLOS DEL SUYO (4/11/2026) ─────────────────────────────────────────────
  // La campaña de email de Mauricio: «un CRM nuevo "Email Marketing" con esos leads», a todos «menos lo que están en
  // ganado». `pasar_en_bloque_otro_funnel` no sirve: los SACA del origen. Ésta es `agregarLoteAProducto` (lib/lead-funnel.ts),
  // la de la barra del tablero. Antes de `armar_tab_ficha`, que va última a propósito.
  {
    id: 'agregar_en_bloque_a_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat', lenta: true,
    titulo: 'Agregar varios a otro CRM',
    descripcion: 'PROPONE sumar EN BLOQUE leads a otro CRM, en su columna de entrada, con UNA confirmación para todos (queda pendiente hasta el «sí»). NO los saca de donde están: siguen en su CRM de siempre. Los ids (leadIds, hasta 5.000) o todos los del negocio (todos), menos los que estén en excluirEstados (ganado) y, con soloConEmail, los que no tienen email. Los que ya están en ese CRM se saltean. No manda nada. Solo el administrador.',
    parametros: [
      { nombre: 'haciaEmbudoId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el CRM donde se suman, por el id de su embudo (de ver_funnel o crear_crm).' },
      { nombre: 'leadIds', tipo: 'string[]', max: 5000, descripcion: 'los ids de los leads. Sin esto, todos.' },
      { nombre: 'todos', tipo: 'boolean', descripcion: 'todos los leads del negocio (con los filtros de abajo).' },
      { nombre: 'excluirEstados', tipo: 'string[]', max: 5, descripcion: 'los estados que NO se suman: ganado, perdido, descalificado, no_responde o abierto.' },
      { nombre: 'soloConEmail', tipo: 'boolean', descripcion: 'sumar sólo a los que tienen email.' },
    ],
    canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'suma cada lead al CRM (una fila en lead_funnel, en su columna de entrada) con su historial; no lo saca del suyo',
  },
  // ── EL PRIMER CONTACTO (5/11/2026): lo que Martín le prometió a Código Inmobiliario el 30/10. Antes de `armar_tab_ficha`, que
  //    va última a propósito. El id y el título no repiten las palabras de todo el área («lead», «etapa», «mover»): las lleva el
  //    parámetro, que no puntúa.
  {
    id: 'tiempo_primer_contacto', area: 'crm', tipo: 'lectura',
    titulo: 'Cuánto tardan en contactar',
    descripcion: 'Cuánto tardó una persona del negocio en escribirle o llamar a cada persona nueva desde que entró al CRM (WhatsApp, email, Instagram, Messenger o una llamada), SIN contar los mensajes automáticos: la mediana, cuántos en la primera hora, los sin contactar y los que más esperaron. «No se sabe» = mensajes de antes de que MaKo separara lo automático (5/11/2026). Sirve para contestar «los leads no sirven». Sin dias, los últimos 30.',
    parametros: [
      { nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 90, descripcion: 'los leads que entraron en los últimos N días (por defecto, 30).' },
      { nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el primer contacto de UN lead, por su id.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  // ── MIGRAR DESDE OTRO CRM (6/11/2026, la llamada con Thiago: una agencia con 27 clientes en España) ─────────────────
  // Lo que Martín le prometió: se guardan el id del CRM viejo, la fecha original y las UTM; migrar dos veces no repite a
  // nadie; y los migrados entran QUIETOS (ningún mensaje, ninguna automatización: lib/migracion-leads.ts). Cada contacto
  // NACE en su etapa: moverlos después en bloque dispararía el evento de etapa de cada uno.
  // ⚠️ Sólo por la API (`http`): un lote de 200 no se pega en un chat. Y el id y el título no llevan «lead» ni «etapa»,
  //    que el clasificador suma a todo pedido del CRM (`RELEVANCIA_CRM`): las palabras van en los parámetros.
  //    Antes de `armar_tab_ficha`, que va última a propósito.
  {
    id: 'migrar_contactos', area: 'crm', tipo: 'accion', confirmacion: 'chat', lenta: true,
    titulo: 'Migrar contactos de otro CRM',
    descripcion: 'PROPONE pasar a MaKo hasta 200 contactos de OTRO CRM por pedido (GoHighLevel, HubSpot, un CSV), con UNA confirmación para todos. Cada uno lleva su id del CRM anterior (idExterno): volver a mandar el lote saltea a los que ya entraron, así que repetirlo es seguro. Se guardan la fecha en que se creó allá y las UTM. Cada contacto nace en su etapa abierta (por su key o su nombre; sin etapa, en la de entrada). Entran QUIETOS: no reciben ningún mensaje ni entran a ninguna automatización por haber llegado; sólo un hecho nuevo (moverlo a mano, que reserve, que conteste) los hace entrar. Ganado, Perdido y las demás finales no se migran por esta vía: vuelven en descartados. Las conversaciones del CRM anterior no se traen. Solo el administrador.',
    parametros: [
      {
        nombre: 'contactos', tipo: 'object[]', obligatorio: true, max: 200, descripcion: 'los contactos del lote (hasta 200).',
        campos: [
          { nombre: 'idExterno', tipo: 'string', obligatorio: true, max: 200, descripcion: 'el id que tiene en el CRM anterior.' },
          { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre y apellido.' },
          { nombre: 'email', tipo: 'string', max: 200, descripcion: 'email.' },
          { nombre: 'telefono', tipo: 'string', max: 40, descripcion: 'teléfono con código de país.' },
          { nombre: 'instagram', tipo: 'string', max: 200, descripcion: 'usuario de Instagram (@usuario o el link del perfil).' },
          { nombre: 'empresa', tipo: 'string', max: 200, descripcion: 'empresa.' },
          { nombre: 'etapa', tipo: 'string', max: 80, descripcion: 'la etapa donde nace en el CRM de destino, por su key o su nombre (de ver_funnel). Sin ella, la de entrada.' },
          { nombre: 'fechaOriginal', tipo: 'string', max: 40, descripcion: 'cuándo se creó en el CRM anterior: una fecha ISO (2025-03-14) o un timestamp.' },
          { nombre: 'utm_source', tipo: 'string', max: 200, descripcion: 'utm_source de origen.' },
          { nombre: 'utm_medium', tipo: 'string', max: 200, descripcion: 'utm_medium de origen.' },
          { nombre: 'utm_campaign', tipo: 'string', max: 200, descripcion: 'utm_campaign de origen.' },
          { nombre: 'utm_content', tipo: 'string', max: 200, descripcion: 'utm_content de origen.' },
        ],
      },
      { nombre: 'crmAnterior', tipo: 'string', obligatorio: true, max: 80, descripcion: 'el nombre del CRM de donde vienen («GoHighLevel», «HubSpot», «Excel»): el mismo id en dos CRM viejos son dos personas.' },
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM de MaKo donde entran (de ver_funnel o tipos_de_crm). Sin él, el principal.' },
    ],
    canales: ['http'], costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'crea cada contacto como un lead quieto (origen «Migrado de otro CRM») en su etapa, con su id del CRM anterior; no le escribe a nadie',
  },
  // ── «¿Qué vas a crear hoy?» de una tab de la ficha (16/10/2026) ──────────────────
  // ⚠️ AL FINAL DE LA LISTA A PROPÓSITO: con un mensaje que no la nombra, el presupuesto del turno de WhatsApp
  //    (12.000 caracteres, lib/doer-herramientas.ts) corta por orden de declaración, y declarada antes dejaba
  //    afuera a las heredadas. Es lo mismo que hace la pantalla (app/api/crm/ficha/armar): MaKo arma la tab ANTES
  //    de proponerla, con la red barata de la casa (lib/ficha/ia-generar.ts), y lo que se confirma es lo que se guarda.
  {
    id: 'armar_tab_ficha', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Armar una tab de la ficha',
    descripcion: 'PROPONE armar UNA tab de la ficha del lead de un CRM (Resumen, Reuniones, Pagos o Tracking) con lo que se pide en palabras («lo que tengo que hacer y su contacto, en grande»): MaKo elige los bloques ANTES de proponerla y el resumen dice cuáles. Cambia la tab para todos los leads de ese CRM. Solo el administrador. Sin embudoId, el CRM principal.',
    parametros: [
      { nombre: 'embudoId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el CRM (de productos_del_lead). Sin él, el principal.' },
      { nombre: 'tab', tipo: 'string', obligatorio: true, enum: [...TABS_FICHA], descripcion: 'la tab que se arma.' },
      { nombre: 'pedido', tipo: 'string', obligatorio: true, max: 600, descripcion: 'qué quiere ver en esa tab, en palabras.' },
    ],
    canales: TODOS, costo: 'ia', lenta: true, gating: TAB_ADMIN,
    reversible: true, escribe: 'guarda la tab armada en la ficha del CRM (funnels.data.ficha); cambia lo que ven todos sus leads',
  },
  // EL RETARGETING DE LOS FUNNELS SIN VSL (13/11/2026, lib/retargeting.ts): cada lunes MaKo revisa las charlas de WhatsApp de los leads, los
  // marca con etiquetas del CRM y, sólo con el interruptor del negocio, mantiene dos públicos de Meta. Lo usa el piloto de Marketing CoPilot.
  {
    id: 'ver_retargeting', area: 'crm', tipo: 'lectura',
    titulo: 'Cómo va el retargeting',
    descripcion: 'Lo que dejó la última revisión semanal del retargeting de los funnels sin VSL: cuántos leads no respondieron, no siguieron, no compraron, no califican, compraron, siguen conversando o agendaron; cuántos dudosos quedaron sin revisar (la IA del negocio no los alcanzó a leer); cuántas charlas de WhatsApp con movimiento en 7 días no son de ningún lead; y los dos públicos de Meta («MaKo · No avanzaron», para el anuncio de retargeting, y «MaKo · Compraron», para excluir), con su id de Meta, cuántas personas tienen y si el negocio los prendió. Sin datos de ningún lead.',
    parametros: [],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: TAB,
  },
  {
    id: 'revisar_retargeting', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Revisar el retargeting ahora',
    descripcion: 'PROPONE correr ahora la revisión del retargeting que corre sola cada lunes: MaKo lee las charlas de WhatsApp de los leads (menos los de un funnel VSL; la IA del negocio sólo lee las que contestaron, quedaron quietas y tienen mensajes nuevos), les pone la etiqueta del CRM que corresponde («Retargeting: no respondió», «… no siguió», «… no compró», «… no califica» o «… compró») sin moverlos de etapa, y si el negocio prendió los públicos de Meta, los actualiza. Con enSeco arma todo y no llama a Meta.',
    parametros: [{ nombre: 'enSeco', tipo: 'boolean', rotulo: 'En seco', descripcion: 'true para armar todo sin llamar a Meta (las etiquetas sí se ponen). Default false.' }],
    canales: ['whatsapp', 'app'], costo: 'ia', lenta: true, gating: TAB_ADMIN,
    reversible: true, escribe: 'las etiquetas de retargeting de los leads revisados y una línea en su historial; con los públicos prendidos, agrega o saca personas de dos públicos de su cuenta de Meta',
  },
  {
    id: 'configurar_retargeting', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Prender los públicos de retargeting',
    descripcion: 'PROPONE prender o apagar los públicos de Meta del retargeting. Prendidos, la próxima revisión crea en la cuenta de Meta del negocio (por su conexión de Zernio o por su token) «MaKo · No avanzaron» y «MaKo · Compraron», y los mantiene cada lunes con los teléfonos y emails de esos leads (Meta los recibe con hash). Apagados, MaKo no toca Meta.',
    parametros: [{ nombre: 'publicosMeta', tipo: 'boolean', rotulo: 'Públicos de Meta', descripcion: 'true para prenderlos, false para apagarlos.', obligatorio: true }],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'el ajuste del retargeting del negocio (retargeting.config); no toca Meta hasta la próxima revisión',
  },
  {
    id: 'pasar_chats_al_crm', area: 'crm', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Pasar charlas sin lead al CRM',
    descripcion: 'PROPONE crear un lead por cada charla de WhatsApp con movimiento en los últimos 7 días que no es de ningún lead (cuántas son lo dice ver_retargeting, chatsSinLead), con la misma alta de una charla de Chats: el nombre de la agenda del negocio, el origen «WhatsApp» y el tope del plan. Si el negocio tiene varios funnels hay que decir en cuál (funnelId); sin él, la respuesta trae la lista para elegir. Lo pide el dueño: MaKo no crea leads solo.',
    parametros: [{ nombre: 'funnelId', tipo: 'number', rotulo: 'Funnel', descripcion: 'El funnel donde entran (de listar_funnels). Sin él, el del negocio si hay uno solo.' }],
    canales: ['whatsapp', 'app'], costo: 'gratis', lenta: true, gating: TAB_ADMIN,
    reversible: false, escribe: 'un lead nuevo por cada charla sin lead, con el origen «WhatsApp»',
  },
];
