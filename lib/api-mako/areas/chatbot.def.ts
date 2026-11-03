// =============================================================================
// api-mako/areas/chatbot.def — las operaciones del área `chatbot` (definiciones)
// =============================================================================
// La tab /automations (key de nav `setting`): secuencias de mensajes, su estrategia,
// los hand-offs, las notas de voz del dueño, la guía de voz y el onboarding.
// SIN server-only y sin importar valores de módulos que lo tengan: esto lo
// importan los tests y el generador de la referencia. Los cuerpos van en
// chatbot.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Por qué sale o no por HTTP (el snapshot lo fija):
//   · SIN http → hand-offs (traen el mensaje literal de un lead), la biblioteca de
//     audios (la voz del dueño con URL firmada), la guía de voz (cita chats reales),
//     la muestra de leads evaluados, el plan del motor (leads concretos) y lo que
//     corre IA sobre una charla (gasta la cuota de IA del negocio).
//   · CON http → la estructura: secuencias, métricas, huecos, estado del canal,
//     catálogos y el estado del onboarding.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
// Catálogo PURO (sin server-only, ni él ni lo que importa): el enum sale de ahí para no desincronizarse.
import { CLAVES_AUDIO } from '@/lib/audios-paso';
// Puro y sin imports: las unidades de un horario son las del saneador del motor (`sanearCron`).
import { UNIDADES } from '@/lib/cron-aviso';
// Puro: los topes de una lista de partes son los mismos que los de un WhatsApp (lib/mensaje-partes.ts).
import { TOPE_PARTES, PAUSA_MAX_S } from '@/lib/mensaje-partes';
// Puro (lo importa la galería, un componente cliente): el enum de plantillas sale del catálogo para no desincronizarse.
import { PLANTILLAS } from '@/lib/plantillas-automatizaciones';

/** Los ids de la galería de Automations (las 13 de la undécima tanda), en el orden del embudo. */
const IDS_PLANTILLAS: readonly string[] = PLANTILLAS.map((p) => p.id);

const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;
const TAB = 'setting';

const pSecuenciaId: Parametro = { nombre: 'secuenciaId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id de la secuencia de mensajes (de listar_secuencias_nutricion).' };
const pOrden: Parametro = { nombre: 'orden', tipo: 'number', obligatorio: true, entero: true, minimo: 1, maximo: 50, descripcion: 'número del paso dentro de la secuencia, empezando en 1 (de ficha_secuencia_mensajes).' };
const pHistorial: Parametro = {
  nombre: 'historial', tipo: 'object[]', obligatorio: true, max: 30,
  descripcion: 'la conversación, del mensaje más viejo al más nuevo (hasta 30 turnos).',
  campos: [
    { nombre: 'de', tipo: 'string', obligatorio: true, enum: ['lead', 'negocio'], descripcion: 'quién escribió ese mensaje.' },
    { nombre: 'texto', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'el texto del mensaje.' },
  ],
};

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ───────────────────────────────────────────────────────────────
  {
    id: 'listar_secuencias_nutricion', area: 'chatbot', tipo: 'lectura',
    titulo: 'Listar las secuencias de mensajes',
    descripcion: 'Lista las secuencias de mensajes vigentes (no archivadas) del negocio con su id, nombre, etapa del funnel y si están activas o pausadas. Úsala para conseguir el secuenciaId antes de cualquier otra operación sobre una secuencia. «Activa» no garantiza que salgan mensajes: para eso mira también estado_canal_whatsapp_chatbot.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'ficha_secuencia_mensajes', area: 'chatbot', tipo: 'lectura',
    titulo: 'Ficha de una secuencia',
    descripcion: 'Todo sobre UNA secuencia de mensajes: sus pasos (canal, horas de espera, tipo texto, audio o archivo, condición, texto y cantidad de variantes; un mensaje de Instagram o Messenger, sus botones: id, titulo y «sigue» —la tarjeta a la que lleva el toque, por el puerto «btn:<id>»— o «link»; en una secuencia con ramas, también cada tarjeta de control —condición, espera, «Si responde», «Ir a»— con su id y a qué tarjeta sigue, y el AI Step con su objetivo y cada escenario con su libertad), su estrategia (objetivo, gancho, preguntas, criterio de calificación, escenarios previstos, desenlace, modo) y sus métricas de los últimos 30 días. Úsala cuando pregunten qué hace una secuencia paso a paso o cómo le va. Pide antes el secuenciaId con listar_secuencias_nutricion.',
    parametros: [pSecuenciaId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    // LOS ESCENARIOS DE «PROBAR» (14/10/2026): los mismos contactos de la barra de Probar (`escenariosDePrueba`).
    id: 'escenarios_secuencia', area: 'chatbot', tipo: 'lectura',
    titulo: 'Escenarios de prueba de una secuencia',
    descripcion: 'Los caminos distintos de UNA automatización por sus condiciones, los mismos que «Probar» muestra como contactos de su barra: cuándo cae cada uno (`cuando`: los hechos del lead que lo deciden, como «Su reunión sigue en pie»), qué sale en cada condición, en orden, y cuántos mensajes de WhatsApp le llegan por ese camino. Un mismo hecho vale lo mismo en todo el flujo, y dos caminos que mandan lo mismo son uno. El primero es el de un lead recién llegado por su CRON. Hasta 8; `faltan` dice cuántos quedaron afuera. Úsala para saber qué conviene probar antes de prenderla; el `numero` de cada uno es el que recibe probar_secuencia. Pide antes el secuenciaId con listar_secuencias_nutricion.',
    parametros: [pSecuenciaId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'metricas_chatbot', area: 'chatbot', tipo: 'lectura',
    titulo: 'Métricas del chatbot (30 días)',
    descripcion: 'Los KPIs del chatbot en los últimos 30 días: por secuencia, mensajes enviados por WhatsApp y por email, respuestas, aperturas y clics de email, inscriptos activos y completados; y la serie diaria de 30 días. Úsala para «cuántos mensajes salieron esta semana» o «cuántos contestaron». Las aperturas y clics existen solo para email; «respuestas» es la cantidad de inscripciones pausadas porque el lead contestó.',
    parametros: [{ nombre: 'secuenciaId', tipo: 'number', entero: true, minimo: 1, descripcion: 'opcional: solo las métricas de esa secuencia (de listar_secuencias_nutricion).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'huecos_secuencias', area: 'chatbot', tipo: 'lectura',
    titulo: 'Etapas sin automatización',
    descripcion: 'Las etapas de nutrición del funnel de este negocio en las que no arranca ninguna automatización: cuenta todos los CRON de cada una. Una pausada cuenta como cubierta (solo falta prenderla); una archivada no. Úsala para «qué parte de mi funnel está sin nutrir» o antes de proponer crear una automatización.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'listar_handoffs_pendientes', area: 'chatbot', tipo: 'lectura',
    titulo: 'Casos que MaKo no supo contestar',
    descripcion: 'Los mensajes de leads que no encajaron en ningún escenario previsto de su secuencia, por lo que MaKo no contestó y la inscripción quedó congelada: mensaje literal, motivo, lead, secuencia y fecha. Son conversaciones donde una persona tiene que responder. Úsala para «hay leads esperando respuesta». Trae los 50 más recientes sin resolver.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'estado_canal_whatsapp_chatbot', area: 'chatbot', tipo: 'lectura',
    titulo: 'Estado del WhatsApp de las secuencias',
    descripcion: 'Si el número de WhatsApp no oficial desde el que salen las secuencias está conectado, sin vincular, desconectado (desde cuándo y si el dispositivo quedó desvinculado) o desconocido (no se pudo leer, que NO es lo mismo que desconectado). Es el último estado registrado, no una prueba en vivo: puede decir conectado sobre una sesión que se cayó hace poco. Úsala antes de proponer activar una secuencia y cuando una secuencia activa no manda nada.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: { tab: TAB, integracion: 'evolution' },
  },
  {
    id: 'contexto_etapa', area: 'chatbot', tipo: 'lectura',
    titulo: 'Situación y objetivo de una etapa',
    descripcion: 'Para una etapa del funnel estándar: en qué situación está el lead, qué objetivo conviene para su secuencia (agendar, preparar, reactivar, cualificar o confirmar el pago) y por qué. Úsala antes de proponer crear una secuencia o guardar su estrategia. Una etapa personalizada del editor del funnel no tiene contexto y devuelve null.',
    parametros: [{ nombre: 'etapa', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave de la etapa del funnel (de etapas_para_secuencia).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'etapas_para_secuencia', area: 'chatbot', tipo: 'lectura',
    titulo: 'Etapas donde colgar una secuencia',
    descripcion: 'Las etapas del funnel de este negocio donde se puede colgar una secuencia de mensajes (nutrición y pipeline; se excluyen las de salida), con su clave y su nombre. La etapa se pasa por su clave, que cambia de un negocio a otro.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'listar_objetivos_secuencia', area: 'chatbot', tipo: 'lectura',
    titulo: 'Objetivos disponibles para una secuencia',
    descripcion: 'Los cinco objetivos del catálogo (agendar, preparar, reactivar, cualificar, confirmar el pago) con su etiqueta, más los objetivos propios que el dueño escribió en este negocio. Un objetivo propio es descriptivo: el motor solo sabe cerrar y encadenar secuencias con los cinco del catálogo.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'listar_audios', area: 'chatbot', tipo: 'lectura',
    titulo: 'Notas de voz del dueño',
    descripcion: 'La biblioteca de notas de voz grabadas en este negocio: id, título, duración, transcripción (puede faltar) y un link para escucharla que vence en 12 horas; además qué audio cubre cada situación (bienvenida, apertura en frío, agendó…), el link del video de preparación y el público. Úsala para «qué audios tengo» y para conseguir el audioId antes de asignarlo.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'audios_requeridos', area: 'chatbot', tipo: 'lectura',
    titulo: 'Qué audios tiene que grabar',
    descripcion: 'Las situaciones para las que este negocio tiene que grabar una nota de voz, según las entradas de leads y el canal que declaró en su funnel, con el guion de cada una (qué decir, en orden) y si ya está grabada. Sin entradas declaradas devuelve una lista vacía a propósito: primero hay que declarar el funnel. Úsala para «qué me falta grabar».',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'guia_voz_negocio', area: 'chatbot', tipo: 'lectura',
    titulo: 'Cómo escribe y vende el negocio',
    descripcion: 'La guía de voz que usa MaKo para todo lo que escribe en nombre del negocio (tono, preguntas de cualificación, objeciones, cierre, patrón), qué bloques se dedujeron de sus chats reales con sus citas, qué bloques contestó el dueño a mano y qué bloques siguen sin saberse. Úsala para «MaKo ya sabe cómo escribo» y antes de responder_huecos_voz.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'escenarios_ensayo', area: 'chatbot', tipo: 'lectura',
    titulo: 'Casos de ensayo del negocio',
    descripcion: 'Los casos del ensayo del onboarding que aplican a este negocio (el lead no responde, pregunta el precio, no es tu cliente, quiere reprogramar…), filtrados por los audios que corresponden a su funnel y por si tiene video: título, qué define el dueño al responderlo, cómo termina bien y mal. Úsala junto con ensayo_hecho para saber qué falta ensayar.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'ensayo_hecho', area: 'chatbot', tipo: 'lectura',
    titulo: 'Casos que el dueño ya ensayó',
    descripcion: 'Por cada caso del ensayo que el dueño ya practicó: las respuestas que escribió, cuándo y cómo terminó (positivo, negativo o abierto). Úsala con escenarios_ensayo para «qué me falta ensayar». Es progreso del onboarding: las secuencias se arman desde los audios, no desde estas respuestas.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'simular_respuesta_setter', area: 'chatbot', tipo: 'lectura',
    titulo: 'Simular la respuesta del setter',
    descripcion: 'Dada una secuencia y una conversación cuyo último mensaje es del lead, MaKo contesta como el setter del negocio usando la estrategia de esa secuencia, la guía de voz y el funnel, y dice si la charla terminó bien o mal. Es un simulador: no envía ni guarda nada. Úsala para probar una secuencia antes de prenderla o para «qué le contestarías a esto». Los links se devuelven como [tu link de agenda]: no se reemplazan.',
    parametros: [pSecuenciaId, pHistorial],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', lenta: true, gating: { tab: TAB },
  },
  {
    id: 'evaluar_calificacion_charla', area: 'chatbot', tipo: 'lectura',
    titulo: 'Evaluar si un lead califica',
    descripcion: 'Clasifica una conversación contra el criterio de calificación de una secuencia: califica sí, no o null (null = la secuencia no tiene criterio o no hay evidencia; nunca descalifica por las dudas), con la razón. Solo evalúa los últimos 14 mensajes. No marca al lead ni guarda nada.',
    parametros: [pSecuenciaId, pHistorial],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', lenta: true, gating: { tab: TAB },
  },
  {
    id: 'muestra_para_criterio', area: 'chatbot', tipo: 'lectura',
    titulo: 'Leads ya evaluados del CRM',
    descripcion: 'Los leads que el dueño ya marcó como calificados o no calificados y los que cerraron, con sus respuestas del formulario de agenda (facturación, equipo, objetivo, inversión, decisor), sin nombres ni contactos. Es la materia prima para proponer el criterio de calificación de una secuencia. Se leen hasta «limite» leads por cada grupo y las combinaciones de respuestas repetidas se juntan en una fila: los conteos son de combinaciones distintas, no de leads.',
    parametros: [{ nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: 'cuántos leads traer por grupo (evaluados y cerrados). Default 60.' }],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'estado_onboarding_chatbot', area: 'chatbot', tipo: 'lectura',
    titulo: 'Progreso del onboarding del chatbot',
    descripcion: 'En qué paso quedó el onboarding del chatbot (recorrido completo) o de sus tramos de WhatsApp y de email: qué pasos están hechos y cuándo, cuáles faltan, cuáles son opcionales y si la tab ya está lista. Úsala para saber si el negocio ya configuró el agente antes de sugerir algo.',
    parametros: [{ nombre: 'tab', tipo: 'string', enum: ['setting', 'whatsapp', 'email'], descripcion: 'qué recorrido: setting (el chatbot completo, default), whatsapp o email.' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'plantillas_meta_de_secuencia', area: 'chatbot', tipo: 'lectura',
    titulo: 'Plantillas de Meta de una secuencia',
    descripcion: 'Para cada paso de WhatsApp oficial de una secuencia: el nombre de su plantilla y su estado en Meta (sin_enviar, pending, approved, rejected, paused…). El motor no manda un paso oficial hasta que su plantilla esté aprobada. Lee el catálogo local de plantillas, no consulta a Meta en vivo. Los pasos por el número no oficial y los de audio no llevan plantilla.',
    parametros: [pSecuenciaId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'plan_nutricion_hoy', area: 'chatbot', tipo: 'lectura',
    titulo: 'A quién le escribiría el chatbot',
    descripcion: 'Simulación del motor sin escribir nada: qué leads entrarían hoy a cada secuencia activa (con el horario del primer paso) y qué envíos están vencidos para la próxima corrida (lead, secuencia, paso, canal). No aplica el tope diario configurado, la pausa de 20 horas por lead, el horario de envío del negocio (si puso uno en Configuraciones; sin él, el motor manda a cualquier hora) ni si el envío del canal está habilitado: lo que de verdad sale puede ser menos. Una fila con reactiva: true no es un alta: es una inscripción que ya terminó y vuelve a correr porque el lead volvió a agendar. Úsala para «a quién le va a escribir el chatbot».',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', lenta: true, gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'inscripciones_lead', area: 'chatbot', tipo: 'lectura',
    titulo: 'Secuencias en las que está un lead',
    descripcion: 'Las secuencias en las que está o estuvo un lead: estado de la inscripción (activa, respondió, completada, cancelada, hand-off, no responde), cuántos pasos avanzó (incluye pasos omitidos y los que quedaron como borrador, no solo enviados), próximo envío, último envío y desenlace. Úsala para «le estamos escribiendo a Juan» o «en qué paso va». espera_toque: está parado en un DM con botones, esperando que toque uno (los títulos). Pide antes el leadId (buscar_leads). Un lead no vuelve a entrar SOLO a una secuencia en la que ya estuvo, salvo a la que prepara una reunión cuando vuelve a agendar para otro día (o, si no se sabe qué reunión preparaba, cuando la vez anterior no le llegó nada): ahí la MISMA inscripción vuelve a correr y su fecha de inscripción pasa a ser la nueva. A mano, con inscribir_lead_secuencia, sí vuelve a una que terminó.',
    parametros: [{ nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  // LA GALERÍA POR LA API (undécima tanda, docs/diseno-undecima-tanda.md §7): una plantilla por categoría. SIN http
  // (decisión de la tanda: ninguna operación nueva sale por HTTP).
  {
    id: 'listar_plantillas_automatizaciones', area: 'chatbot', tipo: 'lectura',
    titulo: 'Plantillas de automatizaciones',
    descripcion: 'Las plantillas de la galería de Automations, una por categoría del embudo (Un Lead Entró, Un Lead Agendó Llamada, Un Lead No Asistió…): su id, nombre, para qué sirve, el objetivo, por dónde sale (WhatsApp, email, Instagram, Messenger o «MaKo en WhatsApp», el aviso al grupo) y qué etapa pide al crearla, o si ya trae su CRON puesto. Úsala antes de crear_automatizacion_desde_plantilla.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'listar_secuencias_archivadas', area: 'chatbot', tipo: 'lectura',
    titulo: 'Listar las secuencias archivadas',
    descripcion: 'Las secuencias de mensajes archivadas de este negocio (listar_secuencias_nutricion no las muestra): id, nombre, clave, etapa, cuándo se archivaron y si estaban prendidas al archivarse. Úsala para conseguir el secuenciaId antes de desarchivar_secuencia. Trae las 200 archivadas más recientes.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },

  // ── Acciones por chat ──────────────────────────────────────────────────────
  {
    id: 'proponer_toggle_nutricion', aTerceros: true, area: 'chatbot', tipo: 'accion', confirmacion: 'chat', tipoPendiente: 'nutricion_toggle',
    titulo: 'Activar o pausar una secuencia',
    descripcion: 'PROPONE activar o pausar una secuencia de mensajes (deja la acción pendiente de confirmación; no la ejecuta). Activarla hace que el motor empiece a inscribir leads y a mandar pasos; pausarla frena inscripciones y envíos nuevos. Pide antes el secuenciaId con listar_secuencias_nutricion y, si es para activar, revisa estado_canal_whatsapp_chatbot.',
    parametros: [
      pSecuenciaId,
      { nombre: 'activa', tipo: 'boolean', obligatorio: true, descripcion: 'true para activar, false para pausar.' },
    ],
    reversible: true, escribe: 'cambia nutricion_secuencias.activa de la secuencia',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // ⛔ ACÁ IBA `crear_secuencia_mensajes` (dos pasos de esqueleto sin texto, el modelo lineal de antes; 0 usos medidos
  // por HTTP y 0 pendientes al 11/10/2026). Se RETIRÓ con la décima tanda (docs/diseno-automations-galeria-v2.md §4):
  // con las dos, el doer elige por relevancia y podía crear el esqueleto viejo. La reemplaza la de abajo.
  //
  // «PÍDESELO A MaKo» POR LA API (décima tanda, NUEVA AUTOMATIZACIÓN 8 y 9, 11/10/2026). Martín: «quiero que lo guardes
  // en la API... por el grupo de WhatsApp con MaKo si escribo o envio un audio pidiendo que cree una automatización, lo
  // haga llamando justamente a esta función» y «cada automatización nueva, debe tener una URL que se pueda abrir». La MISMA
  // función que la caja del modal (`crearFlujoConIA`, lib/flujo-ia-crear.ts).
  //   · `chat` y no `pantalla`: crea algo PAUSADO y gratis; la automatización misma es la pantalla editable.
  //   · CON `http` (25/10/2026, el Cerebro: «todo MaKo se debe poder utilizar por API», y Leandro arma con su Claude). Era
  //     SIN: tardaba minutos y /api/v1 corta a 60 s (AGENTS.md, regla 3). Hoy cada intento se acota al plazo (`hastaMs`):
  //     por HTTP el modelo tiene 40 s (`PLAZO_CREAR_HTTP_MS`) y, si no le alcanza, vuelve un error sin escribir nada.
  //   · `costo: 'ia'`: escribe con la IA del negocio.
  //   · Un flujo NO la corre (`preparar` lo rechaza y `accionesParaFlujo` la saca del lienzo).
  {
    id: 'crear_automatizacion_con_ia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una automatización con IA',
    // Ticket #47 (3/11/2026): «el WhatsApp del diagnóstico tiene que disparar una secuencia» y MaKo dijo que sólo podía
    // activar o pausar una que existe. Esta la CREA, con su disparador (una etiqueta también), pero no decía «secuencia».
    descripcion: 'PROPONE crear una automatización nueva (una secuencia de nutrición del lienzo de Automations) a partir de un pedido en palabras, con su disparador: una etapa, una etiqueta que se agrega al lead o un evento. MaKo arma el CRON, las tarjetas y el nombre; lo que contesta cuando el lead escribe va en UN AI Step con su objetivo y sus escenarios. Nace PAUSADA: no le escribe a nadie hasta que alguien la active. Si la persona mandó un audio, pasa la transcripción. Si falta un dato decisivo, el error trae UNA pregunta con opciones numeradas: hazla tal cual y vuelve a llamar con la respuesta en el parámetro que dice faltan, con el mismo pedido. Si dice cada cuánto sale («los martes a las 3»), arma un Recurrente con ESE horario. Por Instagram o Messenger arma también los botones del DM, y el recurso a cambio de seguir la cuenta. Usa la IA del negocio; por la API, si en 40 s no termina, da un error sin crear nada.',
    parametros: [
      { nombre: 'pedido', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'qué tiene que hacer, con las palabras de la persona.' },
      // DUODÉCIMA TANDA (§2.4): las respuestas a las preguntas de MaKo (`preguntaAntes`). El código las resuelve contra
      // las MISMAS opciones de la pregunta (`respuestaDeTexto`): el número, el nombre o «Elige tú»; otra cosa va al pedido.
      { nombre: 'canal', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿Por dónde le escribo?» (su número o nombre, o «Elige tú»).' },
      { nombre: 'producto', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿De qué producto?» (su número o nombre, o «Elige tú»).' },
      { nombre: 'evento', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿Qué hace la persona?» (su número o nombre, o «Elige tú»).' },
      // EL RECURRENTE (20/10/2026, lib/flujo-ia-recurrente.ts): el horario que faltaba y a quién le llega.
      { nombre: 'horario', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿Cuándo sale?» (el número de la opción, o la hora o el día en palabras, o «Elige tú»).' },
      { nombre: 'quien', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿A quién le llega?» (su número o nombre, o «Elige tú»).' },
    ],
    reversible: true, escribe: 'inserta una fila pausada en nutricion_secuencias con el flujo que arma la IA (y las etiquetas nuevas que nombre); si es un Recurrente, con «Cada vez que vuelve a entrar»',
    canales: TODOS, costo: 'ia', lenta: true, gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // Crear desde la GALERÍA (undécima tanda): la MISMA función que «＋ Nueva» (`crearDesdePlantilla`, lib/plantilla-crear.ts),
  // con las puertas de siempre. `chat`: crea algo PAUSADO y gratis, y la automatización misma es la pantalla editable.
  // SIN http (ninguna operación nueva sale por HTTP). Un flujo no la corre (`preparar` lo rechaza).
  {
    id: 'crear_automatizacion_desde_plantilla', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una automatización desde una plantilla',
    descripcion: 'PROPONE crear una automatización desde una plantilla de la galería de Automations: trae todas las tarjetas de su categoría y nace PAUSADA, sin escribirle a nadie hasta que alguien la active. Si la plantilla arranca en una etapa (o una etiqueta), pasa su nombre en etapa; si hay dos con ese nombre en distintos productos, pasa también el producto. Sin etapa, nace con el CRON a elegir. Pide antes el id con listar_plantillas_automatizaciones.',
    parametros: [
      { nombre: 'plantilla', tipo: 'string', obligatorio: true, enum: IDS_PLANTILLAS, descripcion: 'el id de la plantilla (de listar_plantillas_automatizaciones).' },
      { nombre: 'etapa', tipo: 'string', max: 120, descripcion: 'opcional: el nombre de la etapa del embudo (o de la etiqueta) donde arranca, como se ve en el CRM.' },
      { nombre: 'producto', tipo: 'string', max: 120, descripcion: 'opcional: el producto de esa etapa, sólo si hay varias etapas con ese nombre.' },
    ],
    reversible: true, escribe: 'inserta una fila pausada en nutricion_secuencias con las tarjetas de la plantilla (y su CRON, si se eligió la etapa)',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // «Duplicar» de los tres puntos de la lista de /automations (lib/secuencia-duplicar.ts, 09/10/2026), por la API (17/10/2026).
  // SIN http (ninguna operación de creación de automatizaciones sale por HTTP). Nace PAUSADA: una copia prendida le
  // mandaría el mismo mensaje DOS veces a cada lead que entra.
  {
    id: 'duplicar_automatizacion', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Duplicar una automatización',
    descripcion: 'PROPONE hacer una copia de una automatización vigente, como «Duplicar» en Automations: la copia se llama «Copia de …», tiene los mismos pasos y el mismo disparador y horario, y nace PAUSADA, sin escribirle a nadie hasta que alguien la active. No copia a los leads inscriptos ni sus envíos. Una automatización que archivaste no se duplica. Pide antes el secuenciaId con listar_secuencias_nutricion.',
    parametros: [pSecuenciaId],
    reversible: true, escribe: 'inserta una fila pausada en nutricion_secuencias con los mismos pasos, disparador y horario que la original (se deshace archivándola)',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'cambiar_espera_paso', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cambiar la espera de un paso',
    descripcion: 'PROPONE cambiar cuántas horas espera un paso de una secuencia antes de salir (desde el paso anterior, o antes de la reunión si el paso está anclado a ella). Si el paso es una tarjeta «Esperar», cambia lo que espera esa tarjeta. No reprograma los envíos ya calculados de los leads inscriptos. Pide antes el secuenciaId y el orden del paso con ficha_secuencia_mensajes.',
    parametros: [
      pSecuenciaId, pOrden,
      { nombre: 'delayHoras', tipo: 'number', obligatorio: true, entero: true, minimo: 0, maximo: 8760, descripcion: 'horas de espera del paso (0 a 8760).' },
    ],
    reversible: true, escribe: 'cambia pasos[orden].delay_horas en nutricion_secuencias',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'asignar_audio_paso', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Asignar un audio a un paso',
    descripcion: 'PROPONE convertir un paso de una secuencia en nota de voz con un audio de la biblioteca, o quitarle el audio para que vuelva a ser texto (omite audioId). Un paso de audio va siempre por WhatsApp no oficial y el texto del paso pasa a ser el pie que sale después del audio; a los leads que todavía no son clientes NO se les envía solo: queda como borrador para que alguien lo mande. Pide antes el audioId con listar_audios y el orden con ficha_secuencia_mensajes.',
    parametros: [
      pSecuenciaId, pOrden,
      { nombre: 'audioId', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del audio (de listar_audios). Omítelo para quitar el audio del paso.' },
    ],
    reversible: true, escribe: 'cambia pasos[orden].tipo, audio_id, canal y proveedor en nutricion_secuencias',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    // #869 (17/10/2026): el interruptor «Vista previa del link» de cada WhatsApp, también por MaKo.
    id: 'vista_previa_links_paso', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Vista previa de los links',
    descripcion: 'PROPONE que los links de un mensaje de WhatsApp de una secuencia salgan SIN la tarjeta de vista previa (como texto, más discreto) o vuelvan a salir con ella. Vale para lo que sale solo, para el borrador que espera a que alguien lo mande y para las pruebas. Sólo un WhatsApp no oficial. Pide antes el orden del paso con ficha_secuencia_mensajes.',
    parametros: [
      pSecuenciaId, pOrden,
      { nombre: 'vistaPrevia', tipo: 'boolean', obligatorio: true, descripcion: 'false para mandar los links sin la tarjeta; true para volver a mandarlos con ella.' },
    ],
    reversible: true, escribe: 'cambia pasos[orden].sin_vista_previa en nutricion_secuencias',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // CONFIGURACIONES DE UNA AUTOMATIZACIÓN (20/10/2026, Martín, 16/10 punto 5: «"configuraciones" ya no viva para todo
  // Automations, sino para cada chat»): su horario y su goteo, de WhatsApp y de email (lib/config-automatizacion.ts). Lo
  // mismo que la tuerca del título. Sin http, como las demás nuevas.
  {
    id: 'configuracion_automatizacion', area: 'chatbot', tipo: 'lectura',
    titulo: 'Configuración de una automatización',
    descripcion: 'El horario de oficina y el goteo (de WhatsApp y de email) de UNA automatización: el horario suyo si tiene, si no el del negocio (dice cuál vale y de dónde sale). Úsala cuando pregunten a qué hora manda una automatización o cuántos mensajes manda por día. Pide antes el secuenciaId con listar_secuencias_nutricion.',
    parametros: [pSecuenciaId],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'configurar_automatizacion', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Configurar una automatización',
    descripcion: 'PROPONE el horario de oficina o el GOTEO de UNA automatización (uno cada N minutos y hasta M por día, adentro del tope de la línea; UNO SOLO para todos sus canales —WhatsApp, email, Instagram y Messenger—, y cada canal cuenta sus mensajes), lo mismo que su tuerca en Automations. Sin horario propio, usa el del negocio. Pide antes el secuenciaId con listar_secuencias_nutricion.',
    parametros: [
      pSecuenciaId,
      { nombre: 'horario', tipo: 'string', enum: ['propio', 'negocio', 'sin_horario'], descripcion: 'opcional: «propio» (con desde, hasta y dias), «negocio» para volver al del negocio, o «sin_horario» para que mande a cualquier hora.' },
      { nombre: 'desde', tipo: 'number', minimo: 0, maximo: 23.5, descripcion: 'con horario propio: la hora en que abre (9.5 = 9:30).' },
      { nombre: 'hasta', tipo: 'number', minimo: 0.5, maximo: 24, descripcion: 'con horario propio: la hora en que cierra (21 = hasta las 20:59).' },
      { nombre: 'dias', tipo: 'string', max: 40, descripcion: 'con horario propio: los días separados por coma, 0 = domingo ("1,2,3,4,5"). Sin esto, todos.' },
      { nombre: 'goteoMinutos', tipo: 'number', entero: true, minimo: 1, maximo: 240, descripcion: 'opcional: el goteo, minutos entre dos mensajes por un mismo canal.' },
      { nombre: 'goteoArranqueDia', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'opcional: WhatsApp arranca con estos por día (con tope).' },
      { nombre: 'goteoArranqueSube', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'opcional: y sube esto cada día que llega al suyo.' },
      { nombre: 'sinArranque', tipo: 'boolean', descripcion: 'opcional: true lo saca.' },
      { nombre: 'goteoPorDia', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'opcional: el tope de mensajes en 24 h por canal (adentro del tope de la línea).' },
      { nombre: 'sinGoteo', tipo: 'boolean', descripcion: 'opcional: true para sacarle el goteo y el tope por día.' },
    ],
    reversible: true, escribe: 'guarda automatizacion.config:<id> en app_settings (el horario y el goteo de esa automatización, uno solo para todos sus canales)',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'desarchivar_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Desarchivar una secuencia',
    descripcion: 'PROPONE devolver una secuencia archivada al listado. Vuelve PAUSADA aunque estuviera prendida al archivarse: para que mande, hay que activarla aparte con proponer_toggle_nutricion. Las inscripciones que se cancelaron al archivarla NO vuelven, y esos leads no pueden reingresar a esa secuencia. Pide antes el secuenciaId con listar_secuencias_archivadas.',
    parametros: [{ ...pSecuenciaId, descripcion: 'id de la secuencia archivada (de listar_secuencias_archivadas).' }],
    reversible: true, escribe: 'pone nutricion_secuencias.archivada_at en null y activa en false, en la misma escritura',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'asignar_audio_situacion', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Asignar un audio a una situación',
    descripcion: 'PROPONE marcar un audio ya grabado como el de una situación del onboarding (bienvenida, apertura en frío, agendó…). Pisa el audio que tuviera esa situación, que igual sigue en la biblioteca. Un audio de una situación suena mal en otra: confírmalo con el título y la transcripción de listar_audios. Solo bienvenida, agenda_con_bienvenida y agenda_primer_contacto se convierten en secuencias automáticas; las demás situaciones quedan asignadas sin que ninguna secuencia las mande.',
    parametros: [
      { nombre: 'clave', tipo: 'string', obligatorio: true, enum: CLAVES_AUDIO, descripcion: 'la situación (de audios_requeridos).' },
      { nombre: 'audioId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del audio (de listar_audios).' },
    ],
    reversible: true, escribe: 'cambia el mapa situación → audio en app_settings (chat_agent.audios_clave)',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'guardar_publico_audios', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Guardar a quién le habla',
    descripcion: 'PROPONE guardar a quién le hablan los audios y mensajes del negocio (masculino, femenino o mixto), que ajusta cómo se escriben los guiones. Úsala cuando el dueño diga a quién le vende.',
    parametros: [{ nombre: 'publico', tipo: 'string', obligatorio: true, enum: ['masculino', 'femenino', 'mixto'], descripcion: 'el público del negocio.' }],
    reversible: true, escribe: 'cambia app_settings chat_agent.publico',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'agregar_objetivo_custom', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agregar un objetivo propio',
    descripcion: 'PROPONE sumar un objetivo escrito por el dueño a la lista de objetivos de secuencia del negocio, cuando ninguno de los cinco del catálogo describe lo que busca. Es descriptivo: el motor no sabe cerrar ni encadenar secuencias con él. Revisa antes listar_objetivos_secuencia para no repetirlo. Máximo 30.',
    parametros: [{ nombre: 'objetivo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el objetivo, en una frase corta.' }],
    reversible: false, escribe: 'agrega a app_settings chat_agent.objetivos_custom (no hay forma de borrarlo)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // Pedido del 08/10/2026: un paso «⚡ Acción» de un flujo (y el dueño por WhatsApp) tiene que
  // poder decir «mete a este lead en ESTA secuencia»; hasta ese día sólo se entraba por el
  // cohorte o por un evento. Las reglas están en lib/nutricion-inscripcion-manual.ts.
  // SIN http: le escribe a una persona real, y por HTTP no hay nadie mirando quién es.
  // reversible: false, aunque la fila se pueda cerrar: el primer mensaje puede salir en el acto
  // (la vía rápida de enrolarPorEvento) y un mensaje en el teléfono de alguien no se deshace.
  {
    id: 'inscribir_lead_secuencia', aTerceros: true, area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Meter un lead en una secuencia',
    descripcion: 'PROPONE inscribir a UN lead en UNA secuencia de mensajes elegida, aunque no cumpla la condición con la que esa secuencia inscribe sola (queda pendiente hasta el «sí»). El primer paso sale con su espera contada desde ahora (o antes de la reunión si está anclado a ella), en el horario de envío y con el tope diario. No duplica: si ya está en esa secuencia en curso, lo dice. Si ya la terminó (completada o sin respuesta), vuelve a arrancar desde el primer paso y le repite los mensajes. No reabre una inscripción cancelada (puede ser una baja), ni la de un lead que está contestando o que atiende una persona. La secuencia tiene que estar activa. Pide antes el leadId (buscar_leads) y el secuenciaId (listar_secuencias_nutricion); para ver dónde está, inscripciones_lead.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads).' },
      pSecuenciaId,
    ],
    reversible: false, escribe: 'inserta una inscripción activa en nutricion_inscripciones (o reactiva desde el primer paso la que ya terminó), deja historial del lead y dispara el primer envío si ya toca (desde un flujo lo manda el cron)',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // El espejo de la anterior (17/10/2026): lo que se inscribe por la API se puede sacar. SIN http, igual que inscribir
  // (abrirlo es una decisión que regenera tests/api-mako-http.snapshot.txt). reversible: false: queda CANCELADA, que
  // no se vuelve a abrir (puede ser una baja); la decisión y la escritura, en lib/nutricion-salida-manual.ts.
  {
    id: 'sacar_lead_de_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Sacar un lead de una secuencia',
    descripcion: 'PROPONE sacar a UN lead de UNA secuencia en la que está en curso (queda pendiente hasta el «sí»): deja de recibir sus mensajes desde ahora. Su inscripción queda cancelada, como cuando se archiva la secuencia, y NO se vuelve a abrir ni con inscribir_lead_secuencia ni por la entrada automática (una cancelada puede ser una baja); los mensajes que ya salieron no se retiran. Corta también la de un lead que está contestando o que atiende una persona. Si ya terminó la secuencia, ya estaba cancelada o no está en ella, lo dice y no cambia nada. Pide antes el leadId (buscar_leads) y el secuenciaId (listar_secuencias_nutricion); para ver dónde está, inscripciones_lead.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads).' },
      pSecuenciaId,
    ],
    reversible: false, escribe: 'cancela su inscripción en nutricion_inscripciones (estado cancelada, sin próximo envío), descarta sus borradores pendientes de esa secuencia y deja historial del lead',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // «Empezar de nuevo» (23/10/2026, #289 del ws1): mover el lead a la etapa no reinicia una inscripción viva, y «Frenar» la
  // cierra para siempre. La misma decisión que inscribir (`decidirInscripcionManual` con `empezarDeNuevo`); la ficha del
  // lead tiene su botón (lib/automatizaciones-del-lead.ts). SIN http, como inscribir y sacar; y nunca desde un flujo (un
  // paso que reinicia su propia automatización es un bucle).
  {
    id: 'empezar_de_nuevo_lead_secuencia', aTerceros: true, area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Empezar de nuevo una secuencia',
    descripcion: 'PROPONE que UN lead vuelva a empezar desde el primer paso UNA secuencia en la que está EN CURSO o en la que contestó (queda pendiente hasta el «sí»). Lo que ya le salió le puede volver a salir. Mover el lead a la etapa de la secuencia NO la reinicia: esto sí. No reabre una inscripción cancelada (puede ser una baja) ni la de un lead que atiende una persona; si no está en esa secuencia, usa inscribir_lead_secuencia. No se usa desde una automatización. Pide antes el leadId (buscar_leads) y el secuenciaId (listar_secuencias_nutricion); para ver dónde está, inscripciones_lead.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads).' },
      pSecuenciaId,
    ],
    reversible: false, escribe: 'reactiva su inscripción en nutricion_inscripciones desde el primer paso (desliga los envíos y borradores de la corrida anterior, sin borrarlos), deja historial del lead y dispara el primer envío si ya toca',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // LA DIFUSIÓN (28/10/2026, pedido de Martín por Leila): un mensaje a muchos leads, como UNA automatización de una sola vez
  // (lib/difusion.ts). La hoja del CRM la arma con sus tarjetas; esto es lo que MaKo propone con UNA confirmación («mandale a
  // los 394 de Contacto nuevo…»). SIN http: le escribe a muchos, y el que lo pide tiene que ver el ritmo antes del «sí».
  {
    id: 'difundir_a_leads', aTerceros: true, area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Mandar un mensaje a muchos leads (difusión)',
    descripcion: 'PROPONE mandar UN mensaje a varios leads a la vez —los de una columna del CRM (etapa) o una lista de ids— por WhatsApp (sólo por QR), email y/o Instagram (queda pendiente hasta el «sí»). Crea una automatización de una sola vez con ese mensaje, con goteo (de a uno cada N minutos) y tope por día en cada canal, y la deja en Automations con sus métricas. A cada lead le llega por los canales que tiene: el resumen dice a cuántos por cada canal y quién queda afuera y por qué (sin teléfono, dado de baja del email, sin conversación de Instagram en las últimas 24 h). Pide antes la etapa (listar etapas del CRM) o los leadIds (buscar_leads). Para UN lead, usa una automatización o el chat.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', descripcion: 'la columna del CRM (la clave de la etapa). Con esto van TODOS los que están hoy en ella (abiertos). Esto o leadIds.' },
      { nombre: 'funnelId', tipo: 'number', entero: true, minimo: 1, descripcion: 'el embudo de esa etapa, si el negocio tiene varios.' },
      { nombre: 'leadIds', tipo: 'string[]', max: 500, descripcion: 'ids de los leads (de buscar_leads), hasta 500. Esto o etapa.' },
      { nombre: 'canales', tipo: 'string[]', obligatorio: true, max: 3, enum: ['whatsapp', 'email', 'instagram'], descripcion: 'por dónde: uno o varios.' },
      { nombre: 'mensaje', tipo: 'string', obligatorio: true, descripcion: 'el texto, TAL CUAL lo pidió la persona ({{nombre}} es el nombre del lead). Va en WhatsApp, en Instagram y como cuerpo del email.' },
      { nombre: 'asunto', tipo: 'string', descripcion: 'el asunto del email (obligatorio si va por email).' },
      { nombre: 'minutos', tipo: 'number', entero: true, minimo: 1, maximo: 240, descripcion: 'minutos entre un mensaje y el siguiente, en cada canal. Sin esto, 3.' },
      { nombre: 'porDia', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'tope de mensajes por día en cada canal (hasta 500). Sin esto, 40 (el de una línea de WhatsApp).' },
      { nombre: 'variantes', tipo: 'string[]', max: 8, descripcion: 'otras formas de decirlo por WhatsApp: a cada uno le toca una.' },
      { nombre: 'arranqueDia', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'WhatsApp arranca con estos por día. Sin esto, 20.' },
      { nombre: 'arranqueSube', tipo: 'number', entero: true, minimo: 1, maximo: 500, descripcion: 'y sube esto, hasta porDia. Sin esto, 20.' },
      { nombre: 'sinArranque', tipo: 'boolean', descripcion: 'true: con el tope desde el primer día.' },
    ],
    reversible: false, escribe: 'crea una automatización en nutricion_secuencias (A mano, prendida, con su goteo en app_settings) e inscribe a los leads elegidos en nutricion_inscripciones: les llega el mensaje por los canales que tienen',
    // ⚠️ SÓLO EN LA APP (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): por el grupo de WhatsApp el doer arma el rol
    // como 'admin' para cualquiera que escriba (lib/mako-doer-in.ts), y un setter o un closer lanzaba una difusión a toda una
    // columna. Es la regla de AGENTS.md «Traer leads de a muchos…»: lo que toca números de terceros en lote, sólo en la app.
    canales: ['app'], costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // «Volver a probar» (28/10/2026, ticket #19 de Leandro): «un lead no vuelve a entrar a una secuencia en la que ya estuvo»,
  // ¿cómo prueba el negocio de nuevo con su cuenta? La ficha del lead tiene su botón (lib/automatizaciones-del-lead.ts). No
  // le manda nada ahora: marca la inscripción terminada y lo próximo que arranca la secuencia la vuelve a correr, una vez.
  {
    id: 'volver_a_probar_lead_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Volver a probar una secuencia con un lead',
    descripcion: 'PROPONE que UN lead que YA TERMINÓ una secuencia (o contestó en ella) vuelva a entrar con lo PRÓXIMO que la arranca —otro comentario con la palabra clave, otro mensaje, moverlo de nuevo a la etapa—, una vez, aunque la secuencia sea de «Una sola vez» (queda pendiente hasta el «sí»). No le manda nada ahora: es para que el negocio pruebe su automatización otra vez con su propia cuenta. Para que le salga YA desde el primer paso, empezar_de_nuevo_lead_secuencia. No reabre una inscripción cancelada (puede ser una baja) ni la de un lead que atiende una persona. Pide antes el leadId (buscar_leads) y el secuenciaId (listar_secuencias_nutricion).',
    parametros: [
      { nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads).' },
      pSecuenciaId,
    ],
    reversible: false, escribe: 'marca su inscripción terminada en nutricion_inscripciones (desenlace volver_a_probar) para que el próximo evento la vuelva a correr, y deja historial del lead; no manda nada',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // El «Otra cosa» de «Si responde» (08/10/2026): lo que antes era el hand-off —«MaKo se calla y
  // te avisa»— es ahora una tarjeta ⚡ Acción con esta operación, que el conversor de las
  // secuencias de antes pone sola (lib/flujo-legado.ts → OP_AVISAR; el id es el MISMO literal,
  // y tests/flujo-motor-grafo.test.ts lo fija). Avisa al grupo de WhatsApp del negocio (el de
  // «MaKo <> cliente»), nunca al lead. Sale por HTTP: no lee nada de nadie, sólo deja un aviso en
  // el grupo del propio negocio.
  //
  // ⚠️ `partes` (undécima tanda, lib/mako-tarjeta.ts): la tarjeta «MaKo en WhatsApp» con las MISMAS opciones
  // que un WhatsApp (varios mensajes, la Voz de MaKo, archivos, pausas). `mensaje` sigue OBLIGATORIO: con
  // partes es su ESPEJO (los textos unidos, o «🎤 Nota de voz de MaKo»), que leen el feed, el push y todo lo
  // que no sabe de partes; el editor (`paramsDeMako`) lo escribe siempre.
  {
    id: 'avisar_al_equipo', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Avisar al equipo',
    descripcion: 'PROPONE mandar un aviso al grupo de WhatsApp del negocio (y al feed de la app) para que una persona se ocupe: «este lead escribió algo que hay que contestar», «llámalo». No le escribe al lead. Si pasas leadId, el aviso lleva su nombre, su teléfono y el link a su ficha, y no se repite para el mismo lead en 12 horas; con respuesta, lleva además lo que escribió el lead y no se repite para esa misma respuesta. Con partes, el aviso son esos mensajes en orden (textos, notas de voz con la Voz de MaKo y archivos de la biblioteca); desde una automatización salen tal cual, sin título ni firma. Úsala desde una automatización cuando el caso lo tiene que ver una persona.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'opcional: el lead del que se avisa (de buscar_leads). En una automatización, el del evento.' },
      { nombre: 'titulo', tipo: 'string', max: 120, descripcion: 'opcional: el título corto del aviso.' },
      { nombre: 'mensaje', tipo: 'string', obligatorio: true, max: 1000, descripcion: 'lo que tiene que saber el equipo, en una o dos frases. Con partes, el resumen que se ve en la app (los textos unidos).' },
      {
        nombre: 'partes', tipo: 'object[]', max: TOPE_PARTES,
        descripcion: `opcional: el aviso como varios mensajes, en orden (hasta ${TOPE_PARTES}). Una nota de voz tiene que ser la Voz de MaKo (no un audio del negocio); un archivo, de la biblioteca de archivos del chatbot.`,
        campos: [
          { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['texto', 'audio', 'media'], descripcion: 'texto, nota de voz (audio exige audio_id) o archivo (media exige media_id; el cuerpo es su pie).' },
          { nombre: 'cuerpo', tipo: 'string', max: 1000, descripcion: 'el texto del mensaje, o el pie del archivo. Admite los datos {{…}} del aviso al equipo.' },
          { nombre: 'audio_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id de un audio de la Voz de MaKo de este negocio, sólo si tipo es audio.' },
          { nombre: 'media_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del archivo de la biblioteca de archivos del chatbot, sólo si tipo es media.' },
          { nombre: 'pausa_s', tipo: 'number', entero: true, minimo: 1, maximo: PAUSA_MAX_S, descripcion: `opcional: segundos de espera antes de este mensaje (desde el segundo; hasta ${PAUSA_MAX_S}).` },
        ],
      },
      // La pone el MOTOR cuando el aviso sale de «Si responde» (lib/nutricion.ts →
      // correrAccionDeRespuesta): el texto literal del lead. Sin ella, el aviso de «Otra cosa» no
      // decía qué escribió y se deduplicaba por lead contra cualquier otro aviso de las 12 h.
      { nombre: 'respuesta', tipo: 'string', max: 1000, descripcion: 'opcional: lo que escribió el lead, textual. Va en el aviso, y el aviso no se repite para esa misma respuesta (en vez de para el mismo lead).' },
      // La tarjeta «MaKo en WhatsApp» en una automatización (15/10/2026, lib/mako-tarjeta.ts `FueraDeHorario`): qué hace
      // fuera del horario de oficina del negocio. La lee el motor, no la acción.
      { nombre: 'fueraDeHorario', tipo: 'string', enum: ['espera', 'igual'], descripcion: 'opcional, sólo en una automatización con horario de oficina: «espera» (lo de fábrica) la manda cuando abre; «igual», a cualquier hora.' },
      // «MaKo por email» (16/10/2026, lib/mako-tarjeta.ts `CanalMako`): en vez del grupo, un correo a los destinatarios
      // del negocio (Notificaciones), desde equipo@hola-mako.com. Un texto y su asunto.
      { nombre: 'canal', tipo: 'string', enum: ['grupo', 'email'], descripcion: 'opcional: «email» le escribe un correo al equipo del negocio (sus destinatarios de Notificaciones) en vez de mandarlo al grupo de WhatsApp. Por email va un solo texto, sin audio ni archivos, y con asunto. Sin elegir, el grupo.' },
      { nombre: 'asunto', tipo: 'string', max: 160, descripcion: 'el asunto del correo, obligatorio con canal «email». Admite los mismos datos {{…}} que el texto.' },
      // Sin grupo de MaKo (17/10/2026, lib/mako-tarjeta.ts `SinGrupo`): qué hace el aviso si el negocio no tiene grupo.
      { nombre: 'sinGrupo', tipo: 'string', enum: ['app', 'email'], descripcion: 'opcional, sólo por el grupo: qué pasa si el negocio NO tiene grupo de MaKo. «app» (lo de fábrica) lo deja en la campanita de la app y en el teléfono; «email» además le escribe un correo al equipo del negocio (sus destinatarios de Notificaciones).' },
    ],
    reversible: true, escribe: 'manda un aviso al grupo de WhatsApp del negocio (o, con canal «email», un correo a su equipo) y deja una notificación en la app (no toca al lead)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },

  // ── Acciones por pantalla ──────────────────────────────────────────────────
  {
    id: 'reabrir_onboarding_chatbot', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Reabrir el onboarding del chatbot',
    descripcion: 'PROPONE reabrir desde cero el onboarding del chatbot y devuelve un link para confirmarlo. La tab /automations vuelve a abrir en el recorrido, y los pasos que comparte con otras tabs (la conexión del número de WhatsApp, el email) se vuelven a pedir: no hay forma de volver a marcarlos sin rehacerlos. Úsala solo si el dueño pide rehacer la configuración del chatbot.',
    parametros: [],
    reversible: false, escribe: 'reinicia el estado del onboarding de la tab setting y suelta sus pasos del registro compartido en app_settings',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'guardar_estrategia_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Guardar la estrategia de una secuencia',
    descripcion: 'PROPONE cambiar la estrategia de una secuencia y devuelve un link para revisarla: objetivo, gancho, preguntas de cualificación, criterio de calificación, desenlace (qué cuenta como logrado, a qué etapa y a qué secuencia pasa el lead) y modo. Solo cambian los campos que pases; el resto se conserva. Si la secuencia todavía no tiene estrategia, el objetivo es obligatorio. El desenlace mueve leads de etapa solo desde el motor; en una secuencia armada con tarjetas (condiciones, esperas, «Si responde») el desenlace y el modo no se cambian por aquí: cuándo termina y qué pasa al responder son tarjetas del lienzo. Los escenarios se agregan con agregar_escenario_secuencia.',
    parametros: [
      pSecuenciaId,
      { nombre: 'objetivo', tipo: 'string', max: 120, descripcion: 'agendar, preparar, reactivar, cualificar, confirmar_pago o un objetivo propio (de listar_objetivos_secuencia).' },
      { nombre: 'gancho', tipo: 'string', max: 500, descripcion: 'qué se le ofrece al lead para que conteste.' },
      { nombre: 'lead_magnet_id', tipo: 'string', max: 80, descripcion: 'id del lead magnet que ofrece la secuencia (el leadMagnetId que devuelve crear_lead_magnet).' },
      { nombre: 'usa_lead_magnet', tipo: 'boolean', descripcion: 'true si la secuencia ofrece el lead magnet; false para que no mande ninguno.' },
      { nombre: 'preguntas', tipo: 'string', max: 3000, descripcion: 'preguntas de cualificación, UNA POR RENGLÓN y en el orden en que se hacen (máximo 10). Reemplaza la lista.' },
      {
        nombre: 'criterio', tipo: 'object', descripcion: 'reglas de calificación verificables en un chat. Cada lista que pases reemplaza la anterior.',
        campos: [
          { nombre: 'califica', tipo: 'string[]', max: 15, descripcion: 'señales de cliente ideal.' },
          { nombre: 'descalifica', tipo: 'string[]', max: 15, descripcion: 'señales que descalifican.' },
        ],
      },
      {
        nombre: 'desenlace', tipo: 'object', descripcion: 'cuándo termina la secuencia y a dónde va el lead. Solo cambian los campos que pases.',
        campos: [
          { nombre: 'logrado', tipo: 'string', enum: ['respondio', 'agendo', 'pago', 'ninguno'], descripcion: 'qué cuenta como objetivo cumplido.' },
          { nombre: 'logradoEtapa', tipo: 'string', max: 60, descripcion: 'clave de la etapa a la que pasa el lead si se logra (de etapas_para_secuencia).' },
          { nombre: 'logradoSecuencia', tipo: 'string', max: 120, descripcion: 'clave de la secuencia que arranca si se logra.' },
          { nombre: 'falloHoras', tipo: 'number', entero: true, minimo: 0, maximo: 8760, descripcion: 'horas sin respuesta después del último paso para darla por fallida. 0 = nunca.' },
          { nombre: 'falloEtapa', tipo: 'string', max: 60, descripcion: 'clave de la etapa a la que pasa el lead si falla.' },
          { nombre: 'falloSecuencia', tipo: 'string', max: 120, descripcion: 'clave de la secuencia que arranca si falla.' },
        ],
      },
      { nombre: 'modo', tipo: 'string', enum: ['asistido', 'automatico'], descripcion: 'asistido: cuando el lead responde, MaKo deja un borrador para aprobar; automatico: solo se pausa la secuencia.' },
      { nombre: 'notas', tipo: 'string', max: 1000, descripcion: 'notas libres del dueño sobre la secuencia.' },
    ],
    reversible: false, escribe: 'reemplaza nutricion_secuencias.estrategia (con los campos no enviados conservados; sin historial de versiones)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'editar_pasos_secuencia_mensajes', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Editar los pasos de una secuencia',
    descripcion: 'PROPONE reescribir la lista de pasos de una secuencia (texto, canal, espera, condición) y devuelve un link para revisarla. Sólo en una secuencia SIN ramas (sin condiciones, sin «Si responde», sin «Ir a»): una con ramas se edita en el lienzo de /automations, y por aquí contesta un error. La lista que pases REEMPLAZA a la actual en ese orden: un paso que no esté se borra. Dentro de cada paso, un campo que omitas se conserva del paso que hoy ocupa esa posición, y las variantes ya generadas se mantienen. En un paso de WhatsApp oficial con plantilla aprobada, cambiar el texto NO cambia lo que recibe el lead: sigue saliendo la plantilla aprobada con el texto anterior. Un paso de audio a un lead que todavía no es cliente queda como borrador para que alguien lo mande. Un [corchete] distinto de [tu link …] deja el paso sin salir nunca. Lee antes ficha_secuencia_mensajes.',
    parametros: [
      pSecuenciaId,
      {
        nombre: 'pasos', tipo: 'object[]', obligatorio: true, max: 20, descripcion: 'los pasos, en el orden en que salen (máximo 20).',
        campos: [
          { nombre: 'canal', tipo: 'string', enum: ['whatsapp', 'email'], descripcion: 'por dónde sale el paso.' },
          { nombre: 'delay_horas', tipo: 'number', entero: true, minimo: 0, maximo: 8760, descripcion: 'horas de espera desde el paso anterior (o antes de la reunión si está anclado).' },
          { nombre: 'cuerpo', tipo: 'string', max: 4000, descripcion: 'el texto del mensaje; en un paso de audio, el pie que sale después. Admite {{nombre}} y {{empresa}}.' },
          { nombre: 'asunto', tipo: 'string', max: 200, descripcion: 'asunto (solo email).' },
          { nombre: 'preheader', tipo: 'string', max: 200, descripcion: 'texto de vista previa (solo email).' },
          { nombre: 'tipo', tipo: 'string', enum: ['texto', 'audio', 'media'], descripcion: 'texto, nota de voz (audio exige audio_id) o archivo (media exige media_id: foto, video o documento, sólo por WhatsApp no oficial; el texto es el pie).' },
          { nombre: 'audio_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del audio (lo da la biblioteca de audios, solo por WhatsApp o en la app), solo si tipo es audio.' },
          { nombre: 'media_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del archivo de la biblioteca de archivos del chatbot, solo si tipo es media.' },
          { nombre: 'requiere', tipo: 'string', enum: ['respondio', 'sin_respuesta', 'ya_contactado', 'primer_contacto', 'ninguno'], descripcion: 'condición para que el paso salga; «ninguno» la quita. «sin_respuesta» hoy no la evalúa el motor.' },
          { nombre: 'proveedor', tipo: 'string', enum: ['oficial', 'no_oficial'], descripcion: 'WhatsApp oficial (plantilla de Meta) o no oficial (el número vinculado).' },
          { nombre: 'ancla', tipo: 'string', enum: ['reunion', 'ninguno'], descripcion: 'reunion: la espera cuenta como horas ANTES de la próxima reunión del lead; «ninguno» quita el ancla.' },
        ],
      },
    ],
    reversible: false, escribe: 'reemplaza nutricion_secuencias.pasos (sin historial de versiones)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // EL TEXTO Y LOS BOTONES DE UN DM (25/10/2026, lib/botones-social.ts; el texto, lib/botones-api.ts). Leandro configura con su Claude por la API (memoria
  // api-mako-con-cada-feature: ya le pasó con Instagram), y los botones sólo existían en el lienzo. De PANTALLA como
  // editar_pasos: cambia lo que le llega al lead y por dónde sigue el flujo. CON http: es lo que usa el Claude de un cliente.
  // Se guarda por la misma puerta (`publicarPasos`, con `camposDelFlujo`), y nunca deja algo que no se podría publicar.
  {
    id: 'cambiar_botones_mensaje', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Botones de un DM de Instagram',
    descripcion: 'SÓLO para un DM de Instagram o Messenger (los demás mensajes, con editar_pasos_secuencia_mensajes): PROPONE cambiar sus botones (hasta 3) o su texto, aunque haya ramas, y devuelve un link para revisarlo. Sin botones, se quedan; sin texto, también. La lista que pases REEMPLAZA a la actual; [] los saca. Cada botón tiene un título (hasta 20 letras) y hace UNA cosa: «sigue» (el id de otra tarjeta del mismo lienzo, aunque sea de antes) o «link» (https). Un botón que ya estaba conserva su id con el mismo título. Un DM con botones de «sigue» y sin otra flecha espera el toque. Con «en_comentario» true su texto se publica debajo del comentario, a la vista de todos, en vez de ir por privado. El recurso a cambio de seguir la cuenta: «Obtener recurso» lleva a una condición «Sigue tu Instagram»; el link va SÓLO en el DM del sí, y el del no lleva «Ya te sigo», que vuelve a esa condición. Lee antes ficha_secuencia_mensajes.',
    parametros: [
      pSecuenciaId,
      { nombre: 'tarjeta', tipo: 'string', obligatorio: true, max: 80, descripcion: 'el id del DM (de ficha_secuencia_mensajes).' },
      {
        nombre: 'botones', tipo: 'object[]', vaciaEsValor: true, max: 3, descripcion: 'opcional: hasta 3, en orden; [] los saca.',
        campos: [
          { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 20, descripcion: 'lo que dice (hasta 20 letras).' },
          { nombre: 'sigue', tipo: 'string', max: 80, descripcion: 'el id de la tarjeta a la que lleva el toque.' },
          { nombre: 'link', tipo: 'string', max: 500, descripcion: 'o la dirección https que abre.' },
        ],
      },
      { nombre: 'texto', tipo: 'string', max: 1000, descripcion: 'opcional: el texto nuevo (con botones, Instagram corta en 640). Admite {{nombre}}.' },
      // Ticket #17 de Leandro (28/10/2026): la respuesta PÚBLICA al comentario, un dato del mismo DM.
      { nombre: 'en_comentario', tipo: 'boolean', descripcion: 'opcional: true = su texto se publica debajo del comentario que disparó el flujo, a la vista de todos (con un CRON de comentario; sólo texto, sin botones); false = vuelve a ir por mensaje privado.' },
    ],
    reversible: true, escribe: 'reemplaza el texto, los botones o la respuesta en el comentario de ese mensaje en nutricion_secuencias.pasos (sin historial de versiones)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // LOS CRON DE UNA AUTOMATIZACIÓN (sexta tanda, segunda pasada, 09/10/2026): hasta acá la API los
  // LEÍA (`ficha_secuencia_mensajes` trae `disparadores`) y no había cómo cambiarlos sin la pantalla.
  // De PANTALLA y no de chat: cambiar qué la dispara cambia A QUIÉN le escribe, y en una activa la
  // próxima corrida inscribe a la cohorte nueva (el mismo criterio que el trigger de email, diseño §3).
  // SIN http: exponerlo a un token es otra decisión (el snapshot). Se guarda por la MISMA puerta que
  // la pantalla (`guardarDisparadores`, lib/disparadores-guardar.ts). `ignorar` y `cron.dias` van como
  // TEXTOS porque el validador no tiene listas de números; el runner los convierte.
  {
    id: 'cambiar_crons_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Cambiar los CRON de una automatización',
    descripcion: 'PROPONE reemplazar la lista de CRON de una automatización (lo que la hace arrancar: una etapa de un producto, una etiqueta, un evento de Instagram, Messenger o el email que llega, o un Recurrente con su horario). La lista que pases REEMPLAZA a la actual y arranca por CUALQUIERA de sus CRON; el primero es el principal. Cambia a quién le escribe: en una automatización activa, la próxima corrida inscribe con los CRON nuevos. Lee antes ficha_secuencia_mensajes (su campo disparadores tiene la forma de cada CRON: pasa el mismo id para conservar la próxima ocurrencia de un horario que no cambia). Un evento de Instagram o Messenger necesita su subtipo; «grupo_mako» sólo vale con horario.',
    parametros: [
      pSecuenciaId,
      {
        nombre: 'crons', tipo: 'object[]', obligatorio: true, max: 10, descripcion: 'los CRON, el principal primero (hasta 10).',
        campos: [
          { nombre: 'id', tipo: 'string', max: 24, descripcion: 'opcional: el id del CRON (de ficha_secuencia_mensajes), para conservar la próxima ocurrencia de su horario.' },
          { nombre: 'trigger_tipo', tipo: 'string', obligatorio: true, max: 60, descripcion: 'qué lo dispara: etapa_actual, entrega_actual, etiqueta_puesta, etiqueta_agregada, etiqueta_quitada, instagram, messenger, email_recibido, pago, grupo_mako, o un trigger de listar_triggers_email (área email).' },
          { nombre: 'etapa', tipo: 'string', max: 60, descripcion: 'con etapa_actual o entrega_actual: la clave de la etapa (de etapas_para_secuencia).' },
          { nombre: 'etapas', tipo: 'string[]', max: 20, descripcion: 'opcional: varias etapas del mismo kanban (la primera es la de etapa).' },
          { nombre: 'funnel_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'con etapa_actual: el embudo del producto (sin él, la etapa de cualquier producto).' },
          { nombre: 'producto_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'con entrega_actual: el producto cuya entrega se mira.' },
          { nombre: 'etiqueta_id', tipo: 'number', entero: true, minimo: 1, descripcion: 'con etiqueta_puesta: la etiqueta (de listar_etiquetas, área crm).' },
          { nombre: 'ignorar', tipo: 'string[]', max: 50, descripcion: 'con etiqueta_agregada o etiqueta_quitada: los ids de las etiquetas que NO la disparan, como textos ("12", "15").' },
          { nombre: 'subtipo', tipo: 'string', max: 30, descripcion: 'con instagram, messenger, email_recibido o pago: el evento. Instagram: comentario, historia, dm, en_vivo, ref. Messenger: comentario, dm, ref, qr. Email: recibido. Pago: aprobado, rechazado, reembolsado, suscripcion_cancelada.' },
          { nombre: 'grupo', tipo: 'boolean', descripcion: 'con horario: además (o en vez) de la cohorte, le escribe al grupo de WhatsApp de MaKo del negocio.' },
          // Ticket #17 de Leandro (28/10/2026): las palabras clave del CRON de comentario, como ManyChat.
          // ⚠️ CORTAS A PROPÓSITO (ticket #29, 29/10/2026): alargadas, las herramientas no entraban en el presupuesto del turno
          // (tests/ops-center-bateria). Cómo se comparan, con ejemplos, está en la guía de /docs (app/api-mako/Articulos.tsx).
          { nombre: 'palabras', tipo: 'string[]', max: 20, descripcion: 'con subtipo comentario o en_vivo: arranca sólo si el comentario tiene una de estas palabras (sin mayúsculas ni acentos). Vacía = cualquier comentario.' },
          { nombre: 'coincidencia', tipo: 'string', enum: ['contiene', 'exacta'], descripcion: 'con palabras: contiene (la palabra está en el comentario, default) o exacta (el comentario es la palabra).' },
          // Ticket #25 (29/10/2026): la publicación o el Reel. Corta, como las de arriba; la guía de /docs lo explica.
          { nombre: 'publicacion', tipo: 'string', max: 300, descripcion: 'con subtipo comentario: el link o el id de la publicación o Reel. Vacío = cualquiera.' },
          {
            nombre: 'cron', tipo: 'object', descripcion: 'opcional: el horario de un Recurrente. Con horario, el CRON no arranca por el evento: sale en cada ocurrencia, a los que están en la cohorte.',
            campos: [
              { nombre: 'unidad', tipo: 'string', obligatorio: true, enum: UNIDADES.map((u) => u.key), descripcion: 'cada cuánto: hora, dia, semana, mes o anio.' },
              { nombre: 'cada', tipo: 'number', entero: true, minimo: 1, maximo: 99, descripcion: 'cada cuántas unidades (default 1).' },
              { nombre: 'hora', tipo: 'number', entero: true, minimo: 0, maximo: 23, descripcion: 'la hora, en la zona del negocio (default 9).' },
              { nombre: 'minuto', tipo: 'number', entero: true, minimo: 0, maximo: 59, descripcion: 'el minuto (default 0).' },
              { nombre: 'diaSemana', tipo: 'number', entero: true, minimo: 0, maximo: 6, descripcion: 'con semana: el día (0 = domingo).' },
              { nombre: 'dias', tipo: 'string[]', max: 7, descripcion: 'con semana: varios días, como textos ("2", "4" = martes y jueves).' },
              { nombre: 'diaMes', tipo: 'number', entero: true, minimo: 1, maximo: 31, descripcion: 'con mes o anio: el día del mes.' },
              { nombre: 'mes', tipo: 'number', entero: true, minimo: 1, maximo: 12, descripcion: 'con anio: el mes.' },
              { nombre: 'desde', tipo: 'string', max: 10, descripcion: 'opcional: desde qué día sale (AAAA-MM-DD).' },
            ],
          },
        ],
      },
    ],
    reversible: false, escribe: 'reemplaza nutricion_secuencias.disparadores y las columnas del CRON principal (trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id, cron); en una automatización activa, la próxima corrida inscribe con los CRON nuevos',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'agregar_escenario_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Agregar un caso previsto',
    descripcion: 'PROPONE agregar a una secuencia un caso previsto (qué puede contestar el lead y cómo responderle) y devuelve un link para revisarlo. Un mensaje del lead que no encaja en ningún caso hace que MaKo no conteste y avise. Si ya hay un caso con el mismo título, lo reemplaza. Si la automatización tiene un AI Step, el caso entra ADENTRO como un escenario más de su objetivo (hasta 10): sale solo si contestaSolo y no habla de plata; si no, queda para aprobar; sin cómo responder, sólo te avisa. Si tiene la tarjeta «Si responde» de siempre, entra como una rama nueva con un «MaKo contesta» que usa tu guía (máximo 30); si no tiene ninguna, la secuencia tiene que tener estrategia guardada. Un caso que salió de un hand-off se enseña resolviendo ese hand-off (solo por WhatsApp o en la app).',
    parametros: [
      pSecuenciaId,
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'cómo se llama el caso: «Pregunta el precio».' },
      { nombre: 'cuando', tipo: 'string', obligatorio: true, max: 600, descripcion: 'cuándo aplica, en palabras del negocio. Es lo que lee el clasificador.' },
      { nombre: 'comoResponder', tipo: 'string', max: 1000, descripcion: 'qué contestar: la guía del borrador, no el texto literal.' },
      { nombre: 'contestaSolo', tipo: 'boolean', descripcion: 'true: si el mensaje encaja en este caso, MaKo le contesta solo en vez de dejar un borrador. Sólo para casos que no tocan plata (confirmar, cambiar el día): una respuesta que habla de precio o trae un link sin completar queda en borrador igual. Default false.' },
    ],
    reversible: true, escribe: 'agrega el escenario al AI Step (o a «Si responde») de nutricion_secuencias.pasos, o a estrategia.escenarios si no tiene ninguno',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'resolver_handoff', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Enseñar el caso de un hand-off',
    descripcion: 'PROPONE resolver un hand-off enseñándole a MaKo el caso (título, cuándo aplica y cómo responder) y devuelve un link para revisarlo. Al confirmar se suma el caso a la secuencia (aunque esté archivada; si tiene un AI Step, como un escenario más adentro; si tiene la tarjeta «Si responde» de siempre, como una rama nueva), el hand-off queda resuelto y la inscripción del lead vuelve a correr. Si la secuencia no tiene estrategia, el caso no se guarda en ningún lado (solo se resuelve); si ya tiene 30 casos, no se propone. Pide antes el handoffId con listar_handoffs_pendientes.',
    parametros: [
      { nombre: 'handoffId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del hand-off (de listar_handoffs_pendientes).' },
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'cómo se llama el caso.' },
      { nombre: 'cuando', tipo: 'string', obligatorio: true, max: 600, descripcion: 'cuándo aplica, en palabras del negocio.' },
      { nombre: 'comoResponder', tipo: 'string', max: 1000, descripcion: 'qué contestar: la guía del borrador.' },
    ],
    reversible: false, escribe: 'agrega el escenario al AI Step o a «Si responde» de la secuencia (o a su estrategia), marca chat_agent_handoffs.resuelto_at y reactiva la inscripción',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'archivar_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Archivar una secuencia',
    descripcion: 'PROPONE archivar UNA secuencia y devuelve un link para revisarlo: deja de listarse, de inscribir y de enviar, y sus inscripciones vivas se CANCELAN. Esos leads no pueden volver a entrar a esa secuencia nunca, aunque se desarchive. Su etapa vuelve a quedar sin secuencia. Para solo frenarla un rato, usa proponer_toggle_nutricion.',
    parametros: [pSecuenciaId],
    reversible: false, escribe: 'pone nutricion_secuencias.archivada_at y cancela sus nutricion_inscripciones vivas',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'probar_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Probar una secuencia en vivo',
    descripcion: 'PROPONE mandar los mensajes de UN escenario de una secuencia (el camino que recorre un lead por sus condiciones), en orden y marcados [PRUEBA], al teléfono y al email del dueño cargados en Perfil (nunca a un lead), y devuelve un link para confirmarlo. Si tiene más de un escenario, pasa su número (de escenarios_secuencia); con uno solo, no hace falta. Sirve para ver y escuchar la secuencia como la recibe un lead. No toca inscripciones ni métricas. Los pasos de WhatsApp exigen el número vinculado; los de Instagram y Messenger no se prueban en vivo.',
    parametros: [pSecuenciaId, { nombre: 'escenario', tipo: 'number', entero: true, minimo: 1, maximo: 8, descripcion: 'el número del escenario (de escenarios_secuencia). Obligatorio si la secuencia tiene más de uno.' }],
    reversible: false, escribe: 'envía mensajes reales por WhatsApp y email al contacto del dueño y marca estrategia.probada_at',
    canales: SIN_HTTP, costo: 'externo', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'guardar_link_video', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Guardar el link del video',
    descripcion: 'PROPONE guardar el link del video de preparación que acompaña a la bienvenida y a los audios post-agenda, y devuelve un link para revisarlo. Es un dato exacto que sale escrito a desconocidos: tiene que empezar con http:// o https://. No cambia las secuencias ya armadas hasta rearmarlas desde los audios (solo por WhatsApp o en la app).',
    parametros: [{ nombre: 'linkVideo', tipo: 'string', obligatorio: true, max: 500, descripcion: 'la URL completa del video.' }],
    reversible: true, escribe: 'cambia app_settings chat_agent.link_video',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'crear_lead_magnet', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear un lead magnet',
    descripcion: 'PROPONE sumar un lead magnet (nombre y enlace) a los entregables del negocio y devuelve un link para revisarlo. Al confirmar devuelve su leadMagnetId, que se cuelga de una secuencia con guardar_estrategia_secuencia (lead_magnet_id). El motor no entrega archivos: el lead magnet viaja como enlace dentro del texto. El enlace tiene que empezar con http:// o https://.',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 120, descripcion: 'nombre del lead magnet.' },
      { nombre: 'enlace', tipo: 'string', obligatorio: true, max: 500, descripcion: 'la URL completa donde está el material.' },
    ],
    reversible: false, escribe: 'agrega un entregable en app_settings (lib/entregable)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'borrar_audio', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Borrar una nota de voz',
    descripcion: 'PROPONE borrar una nota de voz de la biblioteca y devuelve un link para confirmarlo. Es irreversible: se borran la fila y el archivo, y se saca de las situaciones que cubría. Si algún paso de una secuencia vigente la usa, no se propone: primero hay que quitársela al paso con asignar_audio_paso. Pide antes el audioId con listar_audios.',
    parametros: [{ nombre: 'audioId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del audio (de listar_audios).' }],
    reversible: false, escribe: 'borra la fila de setting_audios, su archivo en storage y su entrada en chat_agent.audios_clave',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'responder_huecos_voz', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Completar la guía de voz',
    descripcion: 'PROPONE guardar lo que el dueño contó sobre cómo vende (tono, preguntas, objeciones, cierre, patrón) para completar la guía de voz, y devuelve un link para revisarlo. Esa guía gobierna todo lo que MaKo escribe en nombre del negocio. Solo cambian los bloques que pases; hace falta al menos uno. Mira antes los huecos con guia_voz_negocio.',
    parametros: [
      { nombre: 'tono', tipo: 'string', max: 600, descripcion: 'cómo escribe: registro, largo de los mensajes, emojis.' },
      { nombre: 'preguntas', tipo: 'string', max: 600, descripcion: 'qué pregunta para saber si alguien le sirve como cliente.' },
      { nombre: 'objeciones', tipo: 'string', max: 600, descripcion: 'qué objeciones le hacen antes de comprar y cómo responde.' },
      { nombre: 'cierre', tipo: 'string', max: 600, descripcion: 'cómo propone el siguiente paso.' },
      { nombre: 'patron', tipo: 'string', max: 600, descripcion: 'el orden en que suele escribir una conversación de venta.' },
    ],
    reversible: false, escribe: 'cambia mako.chat_agent.voz.manual y recompone mako.voz_guia en app_settings',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'armar_secuencias_de_audios', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Armar secuencias desde los audios',
    descripcion: 'PROPONE crear o rearmar las secuencias automáticas del onboarding (bienvenida y post-agenda) a partir de los audios grabados y del link de video guardado, y devuelve un link para confirmarlo. Solo usa los audios de bienvenida, agenda_con_bienvenida y agenda_primer_contacto. Las nuevas nacen pausadas. Las que ya existían NO cambian de estado y se rearman con los audios actuales: si ya son de tarjetas sólo cambia el audio de cada tarjeta (el texto, las ramas y las variantes quedan); si todavía son una lista de antes se reescriben y pierden sus cambios de texto y variantes. Sobre el estado: si estaban activas mandan los pasos nuevos en el acto, y si estaban archivadas se desarchivan (y vuelven a enviar si estaban prendidas). La bienvenida solo inscribe leads de formularios de Meta.',
    parametros: [],
    reversible: false, escribe: 'inserta o reescribe pasos de las secuencias chat-agent-* en nutricion_secuencias y archiva la post-agenda vieja',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'destilar_voz', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Destilar la voz desde anuncios',
    descripcion: 'PROPONE que MaKo reescriba la guía de voz del negocio leyendo las transcripciones de sus anuncios y el perfil de marca, y devuelve un link para confirmarlo. Usa IA (cuota del negocio). PISA la guía actual, incluida la que salió del análisis de chats del onboarding: no se mezclan. Úsala solo si el dueño lo pide.',
    parametros: [],
    reversible: false, escribe: 'reemplaza app_settings mako.voz_guia',
    canales: SIN_HTTP, costo: 'ia', lenta: true, gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'enviar_plantilla_meta_paso', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Mandar a Meta la plantilla',
    descripcion: 'PROPONE convertir el texto de un paso de WhatsApp oficial en plantilla de Meta y mandarla a aprobar, y devuelve un link para confirmarlo. Usa IA y consume el cupo de plantillas de la cuenta de Meta (la cuenta se lee del inbox de Chatwoot del negocio). Si ya hay una plantilla con ese nombre aprobada o en revisión, no la reenvía ni la reemplaza, aunque el texto del paso haya cambiado. Solo pasos de WhatsApp oficial con texto; revisa antes plantillas_meta_de_secuencia.',
    // El paso que se manda queda FIJO al revisar (`fijoAlRevisar`, 15/10/2026): sólo en esta acción, no en `pOrden` (en otra
    // puede ser un valor que se corrige).
    parametros: [{ ...pSecuenciaId, fijoAlRevisar: true }, { ...pOrden, fijoAlRevisar: true }],
    reversible: false, escribe: 'crea la plantilla en meta_templates, la envía a Meta y la vincula al paso en nutricion_secuencias',
    canales: SIN_HTTP, costo: 'ia', lenta: true, gating: { tab: TAB, rolMinimo: 'admin', integracion: 'chatwoot' },
  },
  // LA PRUEBA A/B DE UNA AUTOMATIZACIÓN (tanda A3, lib/pruebas/automatizacion.ts; Martín: «Todo, todo siempre tiene que ir
  // a la API»). Ver, empezar y detener. La tarjeta «A/B TEST» se arma en el lienzo (sus ramas y porcentajes); lo que gana lo
  // decide el juez en código (lib/pruebas/juez.ts), nunca quien llama.
  // ⚠️ AL FINAL DEL ÁREA y sin «automatización» en el id ni en el título (25/10/2026): a igual puntaje el chat de MaKo trae la
  // declarada antes, y con las tres arriba «Hacé que la automatización de reactivación salga los martes a las 15» se quedaba
  // sin cambiar_crons_secuencia (tests/ops-center-clasificador-app). Tampoco «flujo» ni «pedido»: los trae la pista del
  // clasificador. docs/hallazgos-api-mako.md («Una operación nueva le saca el lugar a otra por un EMPATE…»).
  {
    id: 'ver_prueba_ab', area: 'chatbot', tipo: 'lectura',
    titulo: 'Ver la prueba A/B',
    descripcion: 'La prueba de la tarjeta «A/B TEST»: si corre, el día, cuánta gente entró a cada rama y cuántos lograron el objetivo, y cómo terminó («Ganó B», «Empate: quedó A», «Todavía no se sabe»). Mientras corre no hay ganador: MaKo decide una sola vez, cuando junta la gente del plan. Sin prueba corriendo, todos van a la rama A. Las ramas (letra, porcentaje, a qué tarjeta sigue) están en ficha_secuencia_mensajes.',
    parametros: [pSecuenciaId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    id: 'empezar_prueba_ab', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Empezar la prueba A/B',
    descripcion: 'PROPONE empezar la prueba de la tarjeta «A/B TEST» y devuelve un link para revisarla. Corre sobre lo PUBLICADO: la tarjeta guardada, con sus ramas sumando 100 y cada una llevando a algo. Antes MaKo calcula cuánta gente hace falta por rama para ver el salto (efecto) y cuántos días tarda con el ritmo de los últimos 30; con poca gente lo dice («No llega en 60 días»). Mide «Respondió» (o «Agendó», si ése es el objetivo) y cuida que no bajen las agendas.',
    parametros: [
      pSecuenciaId,
      { nombre: 'efecto', tipo: 'number', minimo: 0.1, maximo: 5, descripcion: 'opcional: el salto que quiere poder ver, relativo (0.8 = de 10 % a 18 %). Sin esto, 0.8.' },
    ],
    reversible: true, escribe: 'inserta la prueba en pruebas y sus ramas en prueba_variantes (corriendo); los leads que llegan a la tarjeta se reparten desde ahí',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  {
    id: 'detener_prueba_ab', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Detener la prueba A/B',
    descripcion: 'PROPONE detener la prueba de la tarjeta «A/B TEST»: desde ahí todos van a la rama A y no se declara ganador. Los que ya estaban en otra rama terminan su camino.',
    parametros: [pSecuenciaId],
    reversible: false, escribe: 'pasa la prueba a detenida en pruebas',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // EL TEXTO DE UN WHATSAPP O UN EMAIL EN UN FLUJO CON RAMAS (25/10/2026, el Cerebro: «ciérralo… Usa la misma puerta
  // (`publicarPasos`) y la misma ruta por tarjeta»): editar_pasos rechaza las ramas, y por la API no había cómo cambiar un texto
  // en un flujo de verdad. Lo que se puede saber sin escribir, en `textoParaGuardar` (lib/botones-api.ts). De PANTALLA como
  // editar_pasos. AL FINAL y corta (AGENTS.md): «Cambiá el segundo mensaje…» trae editar_pasos, y ésta si entra.
  {
    id: 'cambiar_texto_mensaje', area: 'chatbot', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Texto de una tarjeta con ramas',
    descripcion: 'PROPONE cambiar el texto (o el asunto de un email) de UNA tarjeta de WhatsApp o email, aunque haya ramas, y devuelve un link para revisarlo. Suelta las variantes del texto anterior. Una nota de voz, un archivo, uno de varias partes, el WhatsApp oficial o un email con diseño se cambian en el lienzo; un DM, con cambiar_botones_mensaje. El id de la tarjeta, en ficha_secuencia_mensajes.',
    parametros: [
      pSecuenciaId,
      { nombre: 'tarjeta', tipo: 'string', obligatorio: true, max: 80, descripcion: 'el id de la tarjeta (de ficha_secuencia_mensajes).' },
      { nombre: 'texto', tipo: 'string', max: 4000, descripcion: 'opcional: el texto nuevo. Admite {{nombre}} y {{empresa}}.' },
      { nombre: 'asunto', tipo: 'string', max: 200, descripcion: 'opcional, sólo email: el asunto nuevo.' },
    ],
    reversible: true, escribe: 'reemplaza el texto (o el asunto) de esa tarjeta en nutricion_secuencias.pasos y le quita las variantes del texto anterior (sin historial de versiones)',
    canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // «VER QUIÉNES» DE MÉTRICAS (31/10/2026): los leads detrás de un número de la tab.
  // ⚠️ VA AL FINAL DEL ÁREA, Y SIN «automatización» NI «flujo» EN EL TÍTULO Y EN LA DESCRIPCIÓN (AGENTS.md: «Una operación
  // nueva va AL FINAL de su área, y su id, título y descripción no repiten las palabras de todas las del área»). Nació
  // declarada 3.ª y con esas palabras: EMPATABA en 3 puntos con `cambiar_crons_secuencia` en cualquier pedido de
  // automatizaciones (la pista del clasificador es «crear automatizacion con ia flujo pedido», lib/mako-intencion.ts), y a
  // igual puntaje gana la declarada antes — el CRON está declarado 48.º. El CRON pesa ~4.100 caracteres y entra de una sola
  // vez o no entra, así que quedaba afuera por 431 caracteres y «Hacé que la automatización de reactivación salga todos los
  // martes a las 15» dejaba de traerlo: MaKo contestaba «no puedo» de algo que sí puede.
  // Las palabras del área van en los PARÁMETROS, que NO puntúan (lib/api-mako/registro.ts, `ordenarPorRelevancia`).
  {
    id: 'quienes_de_automatizacion', area: 'chatbot', tipo: 'lectura',
    titulo: 'Quiénes están detrás de un número',
    descripcion: 'Los leads detrás de un número de las Métricas, en los últimos 30 días: quiénes respondieron, quiénes siguen adentro o quiénes entraron. Úsala para seguir a los que contestaron.',
    parametros: [
      { nombre: 'secuenciaId', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'la automatización (de listar_secuencias_nutricion).' },
      { nombre: 'cual', tipo: 'string', obligatorio: true, enum: ['respondieron', 'en_curso', 'entraron'], descripcion: 'cuál número.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
];
