// =============================================================================
// api-mako/areas/email.def — las operaciones del área `email` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// email.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Qué NO está acá, a propósito:
//   · listar_secuencias_nutricion / proponer_toggle_nutricion → área chatbot.
//   · Desconectar el dominio: sólo desde /email. Conectarlo y fijar el remitente SÍ están (4/11/2026,
//     `conectar_dominio_email` y `fijar_remitente_email`, al final): la lógica se mudó a lib/email-dominio.ts.
//   · Generar el copy con IA: vive inline en app/api/email/generar/route.ts.
//   · Dar de baja a un lead: no hay función scopeada por lead en lib/.
//
// ⚠️ SEGMENTOS_EMAIL copia los `value` de SEGMENTOS (lib/email-marketing.ts), que no
// se puede importar acá (arrastra server-only). El runner vuelve a validar con
// esSegmentoValido(): si la lib suma un segmento, el enum lo rechaza hasta que se
// agregue acá — falla cerrado, nunca manda a un segmento que no existe.
//
// ⚠️ Y FALLAR CERRADO NO ALCANZA SI `listar_segmentos_email` LO MUESTRA: ese listado
// sale de SEGMENTOS entero, así que un segmento que falta acá aparece con sus leads y
// después el enum lo rechaza en las cuatro que lo piden (contar, leads, crear y
// editar un broadcast). Pasó con el residuo
// (#790): MaKo listaba «Sin agenda, +45 días» con 884 leads y no podía armar el
// borrador. tests/nutricion-residuo.test.ts cruza las dos listas.
// =============================================================================

import { SEGMENTO_RESIDUO } from '@/lib/nutricion-residuo';
import type { OperacionDef, Parametro } from '../tipos';

const SEGMENTOS_EMAIL = ['activos', 'no-agenda', 'no-paga', 'no-show', 'post-agenda', 'ganados', SEGMENTO_RESIDUO] as const;

const TAB = { tab: 'email' } as const;
const TAB_ADMIN = { tab: 'email', rolMinimo: 'admin' } as const;
// El Newsletter (29/10/2026): su tab abre con `requireRolWs([])`, así que cada operación pide el admin (AGENTS.md, «Una
// capacidad nueva de MaKo se DECLARA en el registro de la API»). Una EDICIÓN es un broadcast: programarla, probarla y
// enviarla van por las de broadcast, con su id.
// ⚠️ `soloPlataforma` mientras esté en PRONTO (la revisión del 30/10/2026, M1): `tab` deja pasar al admin de cualquier negocio
// con capa completo o agencia. Se saca junto con la puerta de la tab (app/newsletters/puerta.ts), en el go-live del email.
const TAB_NEWSLETTER = { tab: 'newsletters', rolMinimo: 'admin', soloPlataforma: true } as const;
/** Las etapas del CRM del newsletter a las que se le escribe (lib/newsletter-reglas.ts; la baja no). */
const ETAPAS_NEWSLETTER_API = ['lead', 'nl_lee', 'nl_dormido', 'ganado'] as const;
const CANALES_TODOS = ['whatsapp', 'app', 'http'] as const;
const CANALES_SIN_HTTP = ['whatsapp', 'app'] as const;

const idSecuencia = (desc = 'id de la secuencia de email (de listar_secuencias_email).'): Parametro =>
  ({ nombre: 'id', tipo: 'number', descripcion: desc, obligatorio: true, entero: true, minimo: 1 });
// `fijoAlRevisar` (15/10/2026): en /mako/revisar el título es el del broadcast de cuando se propuso; cambiar el id ahí
// programaba o mandaba OTRO envío bajo el título del primero (docs/hallazgos-api-mako.md).
const idBroadcast: Parametro = { nombre: 'id', tipo: 'number', descripcion: 'id del broadcast (de listar_broadcasts).', obligatorio: true, entero: true, minimo: 1, fijoAlRevisar: true };
const segmento = (obligatorio: boolean): Parametro => ({
  nombre: 'segmento', tipo: 'string', enum: SEGMENTOS_EMAIL, ...(obligatorio ? { obligatorio: true } : {}),
  descripcion: 'Segmento del CRM: activos (abiertos o ganados), no-agenda, no-paga (confirmaron sin primer pago), no-show (no asistieron a R1), post-agenda (asistieron a R1), ganados o residuo-formularios (abiertos que nunca agendaron, sin pago, de hace más de 45 días). Siempre leads con email y sin baja.',
});

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ────────────────────────────────────────────────────────────────
  {
    id: 'kpis_email', area: 'email', tipo: 'lectura',
    titulo: 'KPIs del canal email',
    descripcion: 'Los números generales del email del negocio: suscriptores activos y nuevos en 30 días, tasa de apertura y de clic de los últimos 30 días (secuencias y broadcasts juntos) y emails registrados este mes. Dice además si el envío real está prendido: con el envío apagado todo se registra «simulado» y la apertura sale en 0 sin que eso sea un problema del copy. Úsala cuando pregunten cómo viene el email en general. No pide parámetros.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_secuencias_email', area: 'email', tipo: 'lectura',
    titulo: 'Secuencias de email con stats',
    descripcion: 'Lista las secuencias de email del negocio (las que tienen TODOS sus pasos por email) con id, nombre, etapa, trigger, si está activa o archivada, inscriptos y, por cada paso, delay, asunto, un recorte del cuerpo y cuántos se enviaron, abrieron y clickearon. Úsala para saber qué secuencias de email existen y cómo rinde cada email antes de proponer editarlas. Para el copy completo de una, usa ficha_secuencia_email.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ficha_secuencia_email', area: 'email', tipo: 'lectura',
    titulo: 'Detalle de una secuencia de email',
    descripcion: 'Una secuencia de email por id, con cada paso completo (delay en horas, asunto, preheader, cuerpo, condición) y sus envíos, aperturas y clics. Úsala cuando pregunten qué dice un email puntual o antes de proponer editar_pasos_secuencia_email, que exige mandar la lista completa de pasos. Necesita el id de listar_secuencias_email.',
    parametros: [idSecuencia()], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_etapas_email', area: 'email', tipo: 'lectura',
    titulo: 'Etapas válidas de una secuencia',
    descripcion: 'El catálogo de etapas con las que se puede etiquetar una secuencia de email (value y nombre visible). Úsala antes de crear una secuencia o de cambiarle la etapa, para no inventar un valor. Si el trigger es «etapa_actual», la etapa es la clave de una etapa del funnel del negocio y no tiene que estar en esta lista.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_triggers_email', area: 'email', tipo: 'lectura',
    titulo: 'Triggers válidos de una secuencia',
    descripcion: 'El catálogo de disparadores de una secuencia (la cohorte de leads que el motor inscribe: formulario sin agendar, no asistió a R1, post pago, etc.), con su nombre en lenguaje del dueño. Úsala para explicar cuándo se dispara una secuencia o antes de crear o cambiar el trigger de una.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_broadcasts', area: 'email', tipo: 'lectura',
    titulo: 'Broadcasts de email',
    descripcion: 'Los broadcasts (envíos puntuales a un segmento) del negocio, más recientes primero: asunto, segmento, estado (borrador, programado, enviando, enviado o cancelado), fecha programada (solo en los programados) o de envío, destinatarios (null hasta que se envía) y enviados, abiertos y clics. Úsala cuando pregunten qué se mandó, qué está programado o cómo rindió un envío. Para el copy completo, usa ficha_broadcast.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ficha_broadcast', area: 'email', tipo: 'lectura',
    titulo: 'Detalle de un broadcast',
    descripcion: 'Un broadcast por id con su copy completo (asunto, preheader, cuerpo), segmento, estado, fechas y stats. Úsala antes de proponer editarlo, programarlo, enviarlo o borrarlo. Necesita el id de listar_broadcasts.',
    parametros: [idBroadcast], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_newsletter', area: 'email', tipo: 'lectura',
    titulo: 'El newsletter del negocio',
    descripcion: 'El newsletter: cada cuánto sale y de qué trata, su CRM de suscriptos (cuántos hay en Suscripto, Lee, Dormido, Dado de baja y Compró), las ediciones (id, asunto, estado, fecha, y enviados, aperturas, clics y bajas de las que salieron), la fecha que MaKo propone para la próxima y si el envío real está prendido. Úsala cuando pregunten por el newsletter, sus suscriptos o cómo rindió una edición. Una edición es un broadcast: con su id, ficha_broadcast trae el copy entero.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_NEWSLETTER,
  },
  {
    id: 'listar_segmentos_email', area: 'email', tipo: 'lectura',
    titulo: 'Segmentos de broadcast con conteo',
    descripcion: 'Los segmentos a los que se puede mandar un broadcast, con su descripción y cuántos leads caen hoy en cada uno (con email y sin baja), y si hoy se le puede mandar un broadcast (hasta 1.000 leads). Es el mismo filtro que usa el envío. Úsala para contestar «¿a cuántos les llegaría?» o antes de elegir segmento. No pide parámetros.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'contar_segmento_email', area: 'email', tipo: 'lectura',
    titulo: 'Cuántos leads tiene un segmento',
    descripcion: 'El número exacto de destinatarios de UN segmento (leads con email, sin baja, que cumplen el filtro), con el mismo filtro que usa el envío. Úsala cuando solo importa un segmento; para verlos todos juntos usa listar_segmentos_email.',
    parametros: [segmento(true)], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'leads_de_segmento_email', area: 'email', tipo: 'lectura',
    titulo: 'Leads de un segmento',
    descripcion: 'Quiénes recibirían un broadcast a ese segmento: id, nombre, email y empresa de cada lead, con el total real y cuántos quedaron afuera del recorte. Úsala solo cuando pidan nombres concretos; para el número usa contar_segmento_email.',
    parametros: [
      segmento(true),
      { nombre: 'limite', tipo: 'number', descripcion: 'Cuántos leads devolver como máximo (1 a 200; por defecto 50).', entero: true, minimo: 1, maximo: 200 },
    ],
    salida: 'json', canales: CANALES_SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'estado_email', area: 'email', tipo: 'lectura',
    titulo: 'Estado del canal email',
    descripcion: 'LA GUÍA del email del negocio: en qué paso está (`paso`: sin_cuenta, la_de_mako, clave_solo_envio, sin_dominio, dns_pendiente, sin_seguimiento, sin_remitente, envio_apagado, listo), qué tiene que hacer AHORA (`que_hacer`, para decírselo), la operación que sigue (`siguiente`) y, si falta pegar su clave de Resend, el link al lugar de MaKo donde se pega (`link_conectar`; la clave nunca se pide por el chat). Cada negocio manda con SU cuenta de Resend, que es gratis. Trae también el dominio, sus registros DNS y su estado, el remitente y el envío real. Úsala PRIMERO ante cualquier pedido de email, y de nuevo después de cada paso.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'externo', gating: { ...TAB_ADMIN, integracion: 'email' },
  },
  {
    id: 'remitente_email', area: 'email', tipo: 'lectura',
    titulo: 'Remitente actual del email',
    descripcion: 'Con qué nombre y dirección salen los emails del negocio («De:») y si el negocio tiene remitente PROPIO (`propio`; sin él no sale nada y `sandbox` es true: el email de MaKo no es el de un negocio). La `nota` dice por qué. Úsala para confirmar la firma antes de un envío o para explicar por qué un mail no le llega a nadie. No pide parámetros.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'envio_email_habilitado', area: 'email', tipo: 'lectura',
    titulo: 'Envío real de email prendido',
    descripcion: 'Si el interruptor de envío real de email del negocio está prendido. Apagado, las secuencias y los broadcasts se registran como «simulado» y no sale nada. Úsala antes de proponer enviar o programar un broadcast, o para explicar por qué nadie recibe los mails.',
    parametros: [], salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'historial_email_lead', area: 'email', tipo: 'lectura',
    titulo: 'Emails que recibió un lead',
    descripcion: 'Los últimos emails registrados para un lead, de secuencias y de broadcasts: estado (enviado, simulado, fallo, saltado), fecha, si abrió y si hizo clic, y el error si falló. Úsala cuando pregunten si a alguien ya se le escribió por email o antes de proponer un envío que lo incluye. Necesita el id del lead (de buscar_leads).',
    parametros: [
      { nombre: 'leadId', tipo: 'number', descripcion: 'id del lead (de buscar_leads).', obligatorio: true, entero: true, minimo: 1 },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cuántos envíos de cada origen devolver como máximo (1 a 100; por defecto 30).', entero: true, minimo: 1, maximo: 100 },
    ],
    salida: 'json', canales: CANALES_SIN_HTTP, costo: 'gratis', gating: TAB,
  },
  {
    id: 'bajas_email', area: 'email', tipo: 'lectura',
    titulo: 'Leads dados de baja del email',
    descripcion: 'Los leads marcados como baja de email (se dieron de baja por el link, rebotaron o marcaron spam): id, nombre y email, con el total. No hay registro del motivo. Úsala para explicar por qué alguien no aparece en un segmento o no recibe las secuencias.',
    parametros: [
      { nombre: 'limite', tipo: 'number', descripcion: 'Cuántos leads devolver como máximo (1 a 200; por defecto 50).', entero: true, minimo: 1, maximo: 200 },
    ],
    salida: 'json', canales: CANALES_SIN_HTTP, costo: 'gratis', gating: TAB,
  },

  // ── Acciones por chat ───────────────────────────────────────────────────────
  {
    id: 'crear_secuencia_email', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una secuencia de email',
    descripcion: 'Propone crear una secuencia de email nueva, PAUSADA y con un paso vacío. No manda nada: después se escriben los pasos con editar_pasos_secuencia_email y se activa con proponer_toggle_nutricion (área chatbot). Valida etapa y trigger contra listar_etapas_email y listar_triggers_email. Hoy no se puede borrar una secuencia desde MaKo: cada una que se cree queda en la lista.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', descripcion: 'Nombre visible de la secuencia. Vacío: «Nueva secuencia de email».', max: 120 },
      { nombre: 'etapa', tipo: 'string', descripcion: 'Etapa (value de listar_etapas_email, o clave de etapa del funnel si el trigger es etapa_actual). Vacío: nutri.', max: 60 },
      { nombre: 'trigger', tipo: 'string', descripcion: 'Trigger (value de listar_triggers_email). Vacío: manual, que no inscribe a nadie solo.', max: 60 },
      { nombre: 'etiquetaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'Con el trigger etiqueta_puesta, OBLIGATORIO: la etiqueta del CRM que lo dispara (id de listar_etiquetas, área crm). Sin ella la secuencia no se dispararía nunca.' },
      { nombre: 'funnelId', tipo: 'number', entero: true, minimo: 1, descripcion: 'opcional: el CRM cuyos leads inscribe (su embudoId), también los sumados con agregar_en_bloque_a_crm. Sin trigger, va por etapa_actual; sin etapa, en su columna de entrada.' },
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'inserta una fila pausada en nutricion_secuencias con un paso de email vacío (con funnelId, su CRON queda en ese CRM)',
  },
  {
    id: 'editar_meta_secuencia_email', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Renombrar o reubicar una secuencia',
    descripcion: 'Propone cambiar el nombre, la etapa y/o el trigger de una secuencia de email identificada por id; solo toca los campos que se manden. Cambiar el trigger (o la etapa con el trigger etapa_actual) cambia a qué cohorte inscribe el motor: en una secuencia ACTIVA se rechaza, primero hay que pausarla con proponer_toggle_nutricion (área chatbot); renombrar sí se puede siempre. Necesita el id de listar_secuencias_email.',
    parametros: [
      idSecuencia(),
      { nombre: 'nombre', tipo: 'string', descripcion: 'Nombre nuevo.', max: 120 },
      { nombre: 'etapa', tipo: 'string', descripcion: 'Etapa nueva (value de listar_etapas_email, o clave de etapa del funnel si el trigger es etapa_actual).', max: 60 },
      { nombre: 'trigger_tipo', tipo: 'string', descripcion: 'Trigger nuevo (value de listar_triggers_email).', max: 60 },
      { nombre: 'etiquetaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'Con el trigger etiqueta_puesta, OBLIGATORIO: la etiqueta del CRM que lo dispara (id de listar_etiquetas, área crm). Se puede mandar sola para cambiar la etiqueta de una secuencia que ya se dispara por etiqueta.' },
      { nombre: 'funnelId', tipo: 'number', entero: true, minimo: 1, descripcion: 'opcional: el CRM cuyos leads inscribe (su embudoId), también los sumados a él. Con etapa_actual, la etapa es una columna de ese CRM.' },
      { nombre: 'sinCrm', tipo: 'boolean', descripcion: 'opcional: true para que vuelva a mirar todos los CRM (sólo la casa de cada lead).' },
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'actualiza nombre, etapa, trigger_tipo y/o el CRM (funnel_id) de la secuencia en nutricion_secuencias',
  },
  {
    id: 'cancelar_programacion_broadcast', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cancelar la programación de un broadcast',
    descripcion: 'Propone sacar un broadcast de «programado» y devolverlo a borrador sin fecha, para que el envío automático no lo mande. Solo sirve antes de que venza: con el envío real prendido, uno vencido ya no se toca porque el envío automático puede estar tomándolo. Necesita el id de listar_broadcasts.',
    parametros: [idBroadcast],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'pasa el broadcast en email_broadcasts de programado a borrador y le borra la fecha programada',
  },
  {
    id: 'verificar_dominio_envio', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Verificar el dominio de envío',
    descripcion: 'Propone pedirle a Resend que vuelva a revisar los registros DNS del dominio de envío ya cargado en el negocio, y devuelve el estado fresco. Úsala cuando el dueño diga que ya cargó los registros. Sin efecto si los DNS todavía no están; la verificación puede tardar minutos. No pide parámetros: usa el dominio del negocio.',
    parametros: [],
    canales: CANALES_TODOS, costo: 'externo', gating: { ...TAB_ADMIN, integracion: 'email' },
    reversible: true, escribe: 'dispara la verificación del dominio en Resend (no escribe en la base)',
  },

  // ── El Newsletter (29/10/2026) ──────────────────────────────────────────────
  {
    id: 'configurar_newsletter', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Configurar el newsletter',
    descripcion: 'Propone fijar cada cuánto sale el newsletter del negocio, de qué trata y cuántas ediciones seguidas sin abrir pasan a alguien a «Dormido». Con la frecuencia y el tema puestos, crea el CRM «Newsletter» de los suscriptos si todavía no existe (etapas Suscripto, Lee, Dormido, Dado de baja y Compró). Solo toca lo que se mande. No manda nada. El newsletter NO es una automatización: las ediciones se crean con crear_edicion_newsletter.',
    parametros: [
      { nombre: 'frecuencia', tipo: 'string', enum: ['semanal', 'quincenal', 'mensual'], descripcion: 'Cada cuánto sale: semanal, quincenal (cada 15 días) o mensual.' },
      { nombre: 'tema', tipo: 'string', max: 200, descripcion: 'De qué trata, con las palabras del negocio («Consejos de mi rubro», «Novedades de la clínica»).' },
      { nombre: 'dormido_tras', tipo: 'number', entero: true, minimo: 1, maximo: 12, descripcion: 'Cuántas ediciones seguidas sin abrir pasan a un suscripto a «Dormido». Sin mandar: 3.' },
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_NEWSLETTER,
    reversible: true, escribe: 'guarda newsletter.config en app_settings y, la primera vez, crea el CRM «Newsletter» en funnels (sin producto)',
  },

  // ── Acciones por pantalla ───────────────────────────────────────────────────
  {
    id: 'crear_edicion_newsletter', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear una edición del newsletter',
    descripcion: 'Propone crear una edición del newsletter en BORRADOR, para todo el CRM «Newsletter» (menos las bajas) o para una etapa. No manda nada: después se prueba con enviar_prueba_broadcast, se programa con programar_broadcast (queda en el Calendario) o se envía con enviar_broadcast, con el id que devuelve. Sale desde el dominio del negocio. Pide el newsletter configurado (configurar_newsletter).',
    parametros: [
      { nombre: 'asunto', tipo: 'string', descripcion: 'Asunto. Acepta {nombre}, {empresa}, {nombre_completo}, {apellido}.', obligatorio: true, max: 200 },
      { nombre: 'preheader', tipo: 'string', descripcion: 'Texto de vista previa.', max: 200 },
      { nombre: 'cuerpo', tipo: 'string', descripcion: 'Cuerpo en texto plano, con las mismas variables que el asunto.', obligatorio: true, max: 20000 },
      { nombre: 'etapa', tipo: 'string', enum: ETAPAS_NEWSLETTER_API, descripcion: 'Sólo a una etapa del CRM: lead (Suscripto), nl_lee (Lee), nl_dormido (Dormido) o ganado (Compró). Sin mandar: a todos menos las bajas.' },
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_NEWSLETTER,
    reversible: true, escribe: 'inserta un broadcast en estado borrador en email_broadcasts con el segmento del CRM del newsletter',
  },
  {
    id: 'editar_pasos_secuencia_email', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Reescribir los emails de una secuencia',
    descripcion: 'Propone reemplazar la lista COMPLETA de pasos de una secuencia de email (delay, asunto, preheader y cuerpo de cada uno): lo que no viaje se borra, así que primero lee los pasos con ficha_secuencia_email y manda todos. Si la secuencia está activa, el copy nuevo sale en el próximo envío; si está pausada, se activa con proponer_toggle_nutricion (área chatbot). Reordenar pasos corre las estadísticas históricas al paso equivocado. Deja un link para revisar y confirmar.',
    parametros: [
      idSecuencia(),
      {
        nombre: 'pasos', tipo: 'object[]', obligatorio: true, max: 30,
        descripcion: 'Todos los pasos, en orden. El orden de la lista es el orden de envío.',
        campos: [
          { nombre: 'delay_horas', tipo: 'number', descripcion: 'Horas desde la inscripción o el paso anterior (con ancla reunion: horas ANTES de la reunión).', obligatorio: true, entero: true, minimo: 0, maximo: 8760 },
          { nombre: 'asunto', tipo: 'string', descripcion: 'Asunto del email. Acepta {nombre}, {empresa}, {nombre_completo}, {apellido}.', obligatorio: true, max: 200 },
          { nombre: 'preheader', tipo: 'string', descripcion: 'Texto de vista previa que se ve al lado del asunto.', max: 200 },
          { nombre: 'cuerpo', tipo: 'string', descripcion: 'Cuerpo en texto plano (los links se vuelven clicables solos). Acepta las mismas variables que el asunto.', obligatorio: true, max: 20000 },
          { nombre: 'ancla', tipo: 'string', descripcion: '«reunion» para que el delay cuente hacia atrás desde la próxima reunión del lead.', enum: ['reunion'] },
          { nombre: 'requiere', tipo: 'string', descripcion: 'Condición para que el paso salga. Sin condición, sale siempre.', enum: ['respondio', 'sin_respuesta', 'ya_contactado', 'primer_contacto'] },
        ],
      },
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
    reversible: false, escribe: 'reemplaza el JSON de pasos de la secuencia en nutricion_secuencias (todos por email)',
  },
  {
    id: 'crear_broadcast', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear un borrador de broadcast',
    descripcion: 'Propone crear un broadcast en estado BORRADOR con asunto, preheader, cuerpo y segmento. No manda nada: después se prueba (enviar_prueba_broadcast), se programa o se envía. Deja un link para revisar el copy y confirmar.',
    parametros: [
      { nombre: 'asunto', tipo: 'string', descripcion: 'Asunto. Acepta {nombre}, {empresa}, {nombre_completo}, {apellido}.', obligatorio: true, max: 200 },
      { nombre: 'preheader', tipo: 'string', descripcion: 'Texto de vista previa.', max: 200 },
      { nombre: 'cuerpo', tipo: 'string', descripcion: 'Cuerpo en texto plano, con las mismas variables que el asunto.', obligatorio: true, max: 20000 },
      segmento(false),
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'inserta un broadcast en estado borrador en email_broadcasts',
  },
  {
    id: 'editar_broadcast', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Editar un broadcast',
    descripcion: 'Propone cambiar asunto, preheader, cuerpo y/o segmento de un broadcast que todavía no se envió; solo toca lo que se mande y no cambia el estado. Ojo: un broadcast programado sale con el copy nuevo. Necesita el id de listar_broadcasts. Deja un link para revisar y confirmar.',
    parametros: [
      idBroadcast,
      { nombre: 'asunto', tipo: 'string', descripcion: 'Asunto nuevo.', max: 200 },
      { nombre: 'preheader', tipo: 'string', descripcion: 'Preheader nuevo.', max: 200 },
      { nombre: 'cuerpo', tipo: 'string', descripcion: 'Cuerpo nuevo, en texto plano.', max: 20000 },
      segmento(false),
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
    reversible: true, escribe: 'actualiza asunto, preheader, cuerpo y/o segmento del broadcast en email_broadcasts',
  },
  {
    id: 'programar_broadcast', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Programar un broadcast',
    descripcion: 'Propone dejar un broadcast programado para una fecha y hora. El envío automático corre solo a las :00 y :30 entre las 13:00 y las 23:30 UTC: lo manda a todo su segmento en el primer turno igual o posterior a la fecha (fuera de esa ventana, sale al día siguiente a las 13:00 UTC), si el envío real está prendido; apagado, espera. El resumen muestra la hora real de salida. Segmentos de más de 1.000 leads se rechazan (hoy el envío no los alcanza enteros). Es un envío masivo diferido que gasta cuota de Resend. Se puede deshacer con cancelar_programacion_broadcast hasta que empiece a salir. Deja un link para revisar y confirmar.',
    parametros: [
      idBroadcast,
      { nombre: 'programado_at', tipo: 'string', descripcion: 'Fecha y hora de envío en ISO 8601 con zona horaria (ej. 2026-09-20T15:00:00-06:00). Tiene que ser futura.', obligatorio: true, max: 40 },
    ],
    canales: CANALES_TODOS, costo: 'dinero', gating: TAB_ADMIN,
    reversible: true, escribe: 'pasa el broadcast a programado con su fecha en email_broadcasts; al vencer se envía por Resend',
  },
  {
    id: 'enviar_broadcast', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Enviar un broadcast ahora',
    descripcion: 'Propone mandar YA un broadcast en borrador a todo su segmento (hasta 1.000 leads: un segmento más grande se rechaza, porque hoy el envío no lo alcanza entero; saltea a quien recibió un email en las últimas 20 h). Uno programado se rechaza: primero cancelar_programacion_broadcast. Es irreversible y gasta cuota de Resend. Solo se puede con el envío real prendido y un remitente propio: con el envío apagado se rechaza, porque marcaría el broadcast como enviado sin mandar nada y ya no se podría reenviar. Deja un link para revisar segmento, conteo y copy antes de confirmar.',
    parametros: [idBroadcast],
    canales: CANALES_TODOS, costo: 'dinero', gating: { ...TAB_ADMIN, integracion: 'email' }, lenta: true,
    reversible: false, escribe: 'manda el email por Resend a cada lead del segmento, registra cada envío en email_broadcast_envios y marca el broadcast enviado',
  },
  {
    id: 'enviar_prueba_broadcast', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Mandar prueba de un broadcast',
    descripcion: 'Propone mandar el broadcast a UNA dirección de prueba, con asunto «[PRUEBA] …» y variables de ejemplo. No cambia el estado del broadcast, pero manda un email real aunque el envío real esté apagado. Con remitente sandbox solo llega al dueño de la cuenta de Resend. Deja un link para revisar la dirección y confirmar.',
    parametros: [
      idBroadcast,
      { nombre: 'emailPrueba', tipo: 'string', descripcion: 'Dirección de email que recibe la prueba, exacta.', obligatorio: true, max: 254 },
    ],
    canales: CANALES_TODOS, costo: 'externo', gating: { ...TAB_ADMIN, integracion: 'email' },
    reversible: false, escribe: 'manda un email de prueba por Resend (no escribe en la base)',
  },
  {
    id: 'eliminar_broadcast', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Borrar un broadcast',
    descripcion: 'Propone borrar un broadcast que todavía no se envió (borrador, cancelado o programado sin vencer). Uno enviado o enviándose no se borra: se perdería el registro de sus envíos, aperturas y clics. Para frenar uno programado es mejor cancelar_programacion_broadcast. Deja un link para revisar y confirmar.',
    parametros: [idBroadcast],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: false, escribe: 'borra la fila del broadcast en email_broadcasts',
  },
  {
    id: 'activar_envio_real_email', area: 'email', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Prender o apagar el envío real',
    descripcion: 'Propone cambiar el interruptor de envío real de email del negocio. Prendido, los pasos de email de las secuencias activas (también las que mezclan WhatsApp y email) y los broadcasts programados, incluidos los vencidos, salen de verdad desde la próxima corrida y gastan cuota de Resend: esos emails no se deshacen, apagar solo frena los siguientes; apagado, todo queda «simulado». Prender exige el email conectado (dominio verificado y remitente propio; revisa estado_email). Apagar siempre se puede. Deja un link para revisar y confirmar.',
    parametros: [
      { nombre: 'on', tipo: 'boolean', descripcion: 'true = envío real; false = simulado.', obligatorio: true },
    ],
    canales: CANALES_TODOS, costo: 'dinero', gating: TAB_ADMIN,
    reversible: false, escribe: 'guarda envio_email_enabled del negocio en app_settings; prendido, los envíos siguientes salen por Resend',
  },
  // ── El dominio y el remitente, por la API (4/11/2026) ───────────────────────────────────────────────────────────
  // La campaña de email de Mauricio desde su Claude: lo primero que pide es su dominio, y sólo se conectaba en /email.
  // La lógica es la de la pantalla (lib/email-dominio.ts). Al final del área: una nueva no le saca el lugar a otra.
  {
    id: 'conectar_dominio_email', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Conectar el dominio de envío',
    descripcion: 'Propone dar de alta el dominio propio del negocio (minegocio.com) en SU cuenta de Resend, y devuelve los registros DNS que hay que cargar en su proveedor (GoDaddy, Cloudflare…). Prende el seguimiento de aperturas y clics y conecta los eventos de su cuenta con MaKo. Si ya había otro, lo reemplaza. Pide su clave de Resend ya pegada en MaKo (estado_email dice cómo). Un dominio de MaKo o de otro negocio no se puede. Después: verificar_dominio_envio y fijar_remitente_email.',
    parametros: [
      { nombre: 'dominio', tipo: 'string', obligatorio: true, max: 253, descripcion: 'el dominio, sin https:// ni @ (minegocio.com).' },
    ],
    canales: CANALES_TODOS, costo: 'externo', gating: TAB_ADMIN,
    reversible: false, escribe: 'da de alta el dominio en la cuenta de Resend del negocio, le prende el seguimiento de aperturas y clics, crea en su cuenta el webhook hacia MaKo, y guarda resend_domain, resend_domain_id y el secreto de ese webhook',
  },
  {
    id: 'fijar_remitente_email', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Fijar el remitente',
    descripcion: 'Propone con qué nombre y dirección salen los correos del negocio («De:», Mauricio <hola@minegocio.com>) y, si se pide, adónde llegan las respuestas de los leads (responderA: puede ser un Gmail). Exige el dominio verificado (estado_email).',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 80, descripcion: 'el nombre que ven los leads.' },
      { nombre: 'local', tipo: 'string', obligatorio: true, max: 64, descripcion: 'lo de antes del @ (hola, mauricio).' },
      { nombre: 'responderA', tipo: 'string', max: 254, descripcion: 'opcional: la dirección donde llegan las respuestas.' },
      { nombre: 'sinResponderA', tipo: 'boolean', descripcion: 'opcional: true para que las respuestas vuelvan al remitente.' },
    ],
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
    reversible: true, escribe: 'guarda resend_from (el «De:») y resend_reply_to (adónde van las respuestas) del negocio',
  },
  {
    id: 'conectar_seguimiento_email', area: 'email', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Conectar el seguimiento',
    descripcion: 'Propone conectar los avisos de la cuenta de Resend del negocio con MaKo: quién abre, hace clic o rebota. Sin eso las tarjetas del CRM no siguen al email y los rebotes no frenan el envío. conectar_dominio_email ya lo hace; esto es para un dominio de antes o si ahí falló. Es idempotente.',
    parametros: [],
    canales: CANALES_TODOS, costo: 'externo', gating: TAB_ADMIN,
    reversible: false, escribe: 'crea (o reusa) en la cuenta de Resend del negocio el webhook hacia MaKo, y guarda su secreto en el negocio',
  },
];
