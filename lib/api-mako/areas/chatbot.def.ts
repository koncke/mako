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
    descripcion: 'Todo sobre UNA secuencia de mensajes: sus pasos (canal, horas de espera, tipo texto, audio o archivo, condición, texto y cantidad de variantes; en una secuencia con ramas, también cada tarjeta de control —condición, espera, «Si responde», «Ir a»— con su id y a qué tarjeta sigue, y el AI Step con su objetivo y cada escenario con su libertad), su estrategia (objetivo, gancho, preguntas, criterio de calificación, escenarios previstos, desenlace, modo) y sus métricas de los últimos 30 días. Úsala cuando pregunten qué hace una secuencia paso a paso o cómo le va. Pide antes el secuenciaId con listar_secuencias_nutricion.',
    parametros: [pSecuenciaId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: TAB },
  },
  {
    // LOS ESCENARIOS DE «PROBAR» (14/10/2026): los mismos contactos de la barra de Probar (`escenariosDePrueba`).
    id: 'escenarios_secuencia', area: 'chatbot', tipo: 'lectura',
    titulo: 'Escenarios de prueba de una secuencia',
    descripcion: 'Los caminos distintos de UNA automatización por sus condiciones, los mismos que «Probar» muestra como contactos de su barra: qué sale en cada condición, en orden, y cuántos mensajes de WhatsApp le llegan por ese camino. El primero es el de un lead recién llegado por su CRON. Hasta 8; `faltan` dice cuántas ramas quedaron afuera. Úsala para saber qué conviene probar antes de prenderla; el `numero` de cada uno es el que recibe probar_secuencia. Pide antes el secuenciaId con listar_secuencias_nutricion.',
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
    descripcion: 'Las secuencias en las que está o estuvo un lead: estado de la inscripción (activa, respondió, completada, cancelada, hand-off, no responde), cuántos pasos avanzó (incluye pasos omitidos y los que quedaron como borrador, no solo enviados), próximo envío, último envío y desenlace. Úsala para «le estamos escribiendo a Juan» o «en qué paso va». Pide antes el leadId (buscar_leads). Un lead no vuelve a entrar SOLO a una secuencia en la que ya estuvo, salvo a la que prepara una reunión cuando vuelve a agendar para otro día (o, si no se sabe qué reunión preparaba, cuando la vez anterior no le llegó nada): ahí la MISMA inscripción vuelve a correr y su fecha de inscripción pasa a ser la nueva. A mano, con inscribir_lead_secuencia, sí vuelve a una que terminó.',
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
    id: 'proponer_toggle_nutricion', area: 'chatbot', tipo: 'accion', confirmacion: 'chat', tipoPendiente: 'nutricion_toggle',
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
  //   · SIN `http`: tarda minutos y /api/v1 corta a 60 s (AGENTS.md, regla 3), y gasta la IA del negocio.
  //   · Un flujo NO la corre (`preparar` lo rechaza y `accionesParaFlujo` la saca del lienzo).
  {
    id: 'crear_automatizacion_con_ia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una automatización con IA',
    descripcion: 'PROPONE crear una automatización nueva a partir de un pedido en palabras: MaKo arma el CRON, las tarjetas y el nombre (lo mismo que «Pídeselo a MaKo» en Automations); lo que contesta cuando el lead escribe va en UN AI Step con su objetivo y sus escenarios. Nace PAUSADA: no le escribe a nadie hasta que alguien la active. Si la persona mandó un audio, pasa la transcripción. Si falta un dato decisivo, el error trae UNA pregunta con opciones numeradas: hazla tal cual en el grupo y vuelve a llamar con lo que conteste en el parámetro que dice faltan (canal, producto o evento), junto con el mismo pedido.',
    parametros: [
      { nombre: 'pedido', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'qué tiene que hacer, con las palabras de la persona.' },
      // DUODÉCIMA TANDA (§2.4): las respuestas a las preguntas de MaKo (`preguntaAntes`). El código las resuelve contra
      // las MISMAS opciones de la pregunta (`respuestaDeTexto`): el número, el nombre o «Elige tú»; otra cosa va al pedido.
      { nombre: 'canal', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿Por dónde le escribo?» (el número o el nombre de la opción, o «Elige tú»).' },
      { nombre: 'producto', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿De qué producto?» (el número o el nombre de la opción, o «Elige tú»).' },
      { nombre: 'evento', tipo: 'string', max: 500, descripcion: 'opcional: la respuesta a «¿Qué hace la persona?» (el número o el nombre de la opción, o «Elige tú»).' },
    ],
    reversible: true, escribe: 'inserta una fila pausada en nutricion_secuencias con el flujo que arma la IA (y las etiquetas nuevas que nombre)',
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: TAB, rolMinimo: 'admin' },
  },
  // Crear desde la GALERÍA (undécima tanda): la MISMA función que «＋ Nueva» (`crearDesdePlantilla`, lib/plantilla-crear.ts),
  // con las puertas de siempre. `chat`: crea algo PAUSADO y gratis, y la automatización misma es la pantalla editable.
  // SIN http (ninguna operación nueva sale por HTTP). Un flujo no la corre (`preparar` lo rechaza).
  {
    id: 'crear_automatizacion_desde_plantilla', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear una automatización desde una plantilla',
    descripcion: 'PROPONE crear una automatización desde una plantilla de la galería de Automations (lo mismo que elegirla en «＋ Nueva»): trae todas las tarjetas de su categoría y nace PAUSADA, sin escribirle a nadie hasta que alguien la active. Si la plantilla arranca en una etapa (o una etiqueta), pasa su nombre en etapa; si hay dos con ese nombre en distintos productos, pasa también el producto. Sin etapa, nace con el CRON a elegir. Pide antes el id con listar_plantillas_automatizaciones.',
    parametros: [
      { nombre: 'plantilla', tipo: 'string', obligatorio: true, enum: IDS_PLANTILLAS, descripcion: 'el id de la plantilla (de listar_plantillas_automatizaciones).' },
      { nombre: 'etapa', tipo: 'string', max: 120, descripcion: 'opcional: el nombre de la etapa del embudo (o de la etiqueta) donde arranca, como se ve en el CRM.' },
      { nombre: 'producto', tipo: 'string', max: 120, descripcion: 'opcional: el producto de esa etapa, sólo si hay varias etapas con ese nombre.' },
    ],
    reversible: true, escribe: 'inserta una fila pausada en nutricion_secuencias con las tarjetas de la plantilla (y su CRON, si se eligió la etapa)',
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
    id: 'inscribir_lead_secuencia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Meter un lead en una secuencia',
    descripcion: 'PROPONE inscribir a UN lead en UNA secuencia de mensajes elegida, aunque no cumpla la condición con la que esa secuencia inscribe sola (queda pendiente hasta el «sí»). El primer paso sale con su espera contada desde ahora (o antes de la reunión si está anclado a ella), en el horario de envío y con el tope diario. No duplica: si ya está en esa secuencia en curso, lo dice. Si ya la terminó (completada o sin respuesta), vuelve a arrancar desde el primer paso y le repite los mensajes. No reabre una inscripción cancelada (puede ser una baja), ni la de un lead que está contestando o que atiende una persona. La secuencia tiene que estar activa. Pide antes el leadId (buscar_leads) y el secuenciaId (listar_secuencias_nutricion); para ver dónde está, inscripciones_lead.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead (de buscar_leads).' },
      pSecuenciaId,
    ],
    reversible: false, escribe: 'inserta una inscripción activa en nutricion_inscripciones (o reactiva desde el primer paso la que ya terminó), deja historial del lead y dispara el primer envío si ya toca (desde un flujo lo manda el cron)',
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
    ],
    reversible: true, escribe: 'manda un aviso al grupo de WhatsApp del negocio y deja una notificación en la app (no toca al lead)',
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
    descripcion: 'PROPONE reemplazar la lista de CRON de una automatización (lo que la hace arrancar: una etapa de un producto, una etiqueta, un evento de Instagram, Messenger o el email que llega, o un Recurrente con su horario) y devuelve un link para revisarla. La lista que pases REEMPLAZA a la actual y arranca por CUALQUIERA de sus CRON; el primero es el principal. Cambia a quién le escribe: en una automatización activa, la próxima corrida inscribe con los CRON nuevos. Lee antes ficha_secuencia_mensajes (su campo disparadores tiene la forma de cada CRON: pasa el mismo id para conservar la próxima ocurrencia de un horario que no cambia). Un evento de Instagram o Messenger necesita su subtipo; «grupo_mako» sólo vale con horario. Hasta 10 CRON.',
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
    parametros: [pSecuenciaId, pOrden],
    reversible: false, escribe: 'crea la plantilla en meta_templates, la envía a Meta y la vincula al paso en nutricion_secuencias',
    canales: SIN_HTTP, costo: 'ia', lenta: true, gating: { tab: TAB, rolMinimo: 'admin', integracion: 'chatwoot' },
  },
];
