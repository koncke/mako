// =============================================================================
// api-mako/areas/cs.def — las operaciones del área `cs` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// cs.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// TODO el área es `soloWs1`: las dos pantallas de /customer-success cortan con
// esWorkspaceDueno() porque las 44 clases son el temario de Mauricio, no un molde.
// Y soloWs1 exige además rol admin: las server actions de la pantalla NO lo miran
// (un closer del ws1 puede emitir una llave de escritura); el registro no hereda eso.
//
// Qué sale por HTTP y qué no, decidido:
//   · SÍ: el temario, los videos del programa, el estado de Whop y las dos
//     operaciones de mantenimiento de Whop. PERO el temario trae, en `atoro`,
//     `puntos` y `graba`, casos de clientes reales de Mauricio con detalles de su
//     negocio (TEXX, HMO, Baja Teriyaki, Patricia). Decidido: por HTTP esos tres
//     campos NO salen (el runner los omite con ctx.canal === 'http'), con el mismo
//     criterio que dejó ver_casos_historicos fuera. Que vayan a terminar en un video
//     no los vuelve públicos hoy. Lo que sí sale es la estructura: módulos, clases,
//     preguntas del formulario y si están en Whop.
//   · NO: todo lo que nombra o describe a un cliente (cartera con teléfono y email,
//     su tarea, sus bloques, sus links, el avance de alumnos con email), los casos
//     históricos (nombran clientes reales de Mauricio) y el banco de material
//     (trae nombres de otros clientes metidos en las piezas).
//
// Qué NO está aquí, a propósito (ver el retorno de la corrida):
//   · emitir_link_tarea: el único camino es crearShare + mandarElLink, que manda
//     DIRECTO por enviarYEspejar (sin cola de borradores). La excepción del click
//     de Mauricio no la hereda un agente, el token no puede volver al modelo, y si
//     el envío falla el token se pierde con el share ya creado.
//   · reescribir_bloques_junta / reescribir_bloque_cliente: necesitan la «cabecera»
//     de Fathom (resumen + action items) y no hay función que la arme desde una
//     reunión sin correr la extracción entera; la cabecera no se persiste. Pedirla
//     como parámetro es que el modelo la transcriba. La corrida automática
//     (lib/reunion-auto.ts) ya lo hace en las juntas de entrega.
//   · contestar o aprobar un bloque, registrar avance a mano: solo el cliente.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;
const CS = { soloWs1: true, tab: 'customer-success' } as const;
const CS_ADMIN = { soloWs1: true, tab: 'customer-success', rolMinimo: 'admin' } as const;
const CS_WHOP = { soloWs1: true, tab: 'customer-success', integracion: 'whop' } as const;

const leadId: Parametro = {
  nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del lead ganado que es cliente del programa (de ver_cartera_cs).',
};
const claseId: Parametro = {
  nombre: 'claseId', tipo: 'string', max: 12,
  descripcion: 'id de clase del temario, forma «m<módulo>c<clase>» (por ejemplo «m7c1»). Sale de ver_programa_cs; no es el rótulo «7.1».',
};
const moduloId: Parametro = {
  nombre: 'moduloId', tipo: 'string', max: 6,
  descripcion: 'id de módulo del temario, forma «m<número>» (por ejemplo «m4»). Sale de ver_programa_cs.',
};

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas de clientes (sin HTTP: datos de personas) ────────────────────────
  {
    id: 'ver_cartera_cs', area: 'cs', tipo: 'lectura',
    titulo: 'Ver la cartera de clientes',
    descripcion: 'La pregunta del lunes del programa de Mauricio: a quién le debe algo el consultor y quién le debe algo a él. Lista los clientes (leads ganados) agrupados por de quién es la pelota —«tuya» (le toca al consultor), «suya» (le toca al cliente), «al-dia»— con la razón en una frase, semana del contrato, estado en el programa, última sesión, cuotas vencidas, bloques contestados y links vivos. Por default solo activos y pausados, como la pantalla. Úsala antes de ver_cliente_cs para conseguir el leadId.',
    parametros: [
      { nombre: 'cancha', tipo: 'string', enum: ['tuya', 'suya', 'al-dia'], descripcion: 'solo los clientes de esa cancha.' },
      { nombre: 'incluirCerrados', tipo: 'boolean', descripcion: 'true suma los graduados y los dados de baja (por default quedan afuera).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_cliente_cs', area: 'cs', tipo: 'lectura',
    titulo: 'Ver el detalle de un cliente',
    descripcion: 'Todo lo de la ENTREGA de un cliente del programa, para tener a mano antes de una sesión: por qué está en su cancha, qué dice el contrato (qué es, qué se le prometió, garantía, sesiones pactadas, duración y arranque con su fuente), en qué va del programa, el último bloque que tocó, sesiones, cuotas vencidas y contacto. La historia de la VENTA no está aquí: vive en el CRM. Necesita el leadId de ver_cartera_cs.',
    parametros: [leadId],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_tarea_cliente', area: 'cs', tipo: 'lectura',
    titulo: 'Ver la tarea de un cliente',
    descripcion: 'El temario cruzado con lo que ESTE cliente contestó, igual a lo que él ve en su link: por clase, el estado del bloque (pendiente, contestada, revisada_ia = MaKo propuso una mejora y espera su ok, aprobada), cuántas obligatorias faltan, si vio la clase en Whop, lo que contestó y lo que propuso MaKo (recortado a 700 caracteres, 250 por WhatsApp). Por default omite las clases sin ningún movimiento: con las 44 la salida es grande. Solo muestra la vuelta general (sin área). Necesita el leadId.',
    parametros: [
      leadId,
      { nombre: 'soloConMovimiento', tipo: 'boolean', descripcion: 'false trae también las clases pendientes que ni vio (son muchas y vacías). Default true.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_bloque_cliente', area: 'cs', tipo: 'lectura',
    titulo: 'Ver un bloque de un cliente',
    descripcion: 'Un solo bloque de la tarea de un cliente, para preparar la sesión sobre él: la pregunta de la clase, lo que contestó campo por campo y en prosa, la propuesta de MaKo si la hay, de qué reunión salió y las fechas de visto, contestado, revisado y aprobado. Si el cliente nunca tocó el bloque lo dice (no es un error). Necesita leadId y claseId.',
    parametros: [
      leadId,
      { ...claseId, obligatorio: true },
      { nombre: 'area', tipo: 'string', max: 80, descripcion: 'solo en los módulos que se repiten por área: el nombre del área. Vacío = la vuelta general.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_links_cliente', area: 'cs', tipo: 'lectura',
    titulo: 'Ver los links de un cliente',
    descripcion: 'Cuántos links personales de la tarea tiene vivos un cliente, cuándo se emitieron, cuántas visitas tuvo cada uno, cuándo entró por última vez y si alguno ya venció. Más de uno vivo es una anomalía. NUNCA devuelve el link: el token no se puede volver a leer. Necesita el leadId.',
    parametros: [leadId],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_avance_whop', area: 'cs', tipo: 'lectura',
    titulo: 'Ver el avance en Whop',
    descripcion: 'Los alumnos del curso del programa en Whop con cuántas lecciones completó cada uno y cuáles (traducidas a clase del temario), cruzados con el cliente del CRM por email exacto. Sirve para verificar si un evento de avance se perdió. Pega a Whop y puede tardar. El avance que ya llegó por webhook está en ver_tarea_cliente.',
    parametros: [
      { nombre: 'cursoId', tipo: 'string', max: 80, descripcion: 'id del curso en Whop. Sin esto se busca el curso «Sistema Negocio que Escala™» por título.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'externo', gating: CS_WHOP, lenta: true,
  },
  {
    id: 'ver_casos_historicos', area: 'cs', tipo: 'lectura',
    titulo: 'Ver casos de otros clientes',
    descripcion: 'Dónde se trabaron otros clientes de Mauricio en un bloque y cómo se resolvió (atoro, resuelto, error), con la lección para la próxima vez y la fuente. Material SOLO para preparar la sesión del consultor: nombra clientes reales y nunca se le muestra a otro cliente. Con claseId trae los casos de ese bloque; con cliente, los de ese cliente; sin nada, la lista de bloques que tienen casos.',
    parametros: [
      claseId,
      { nombre: 'cliente', tipo: 'string', max: 80, descripcion: 'parte del nombre del cliente histórico (por ejemplo «TEXX»).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_material_banco', area: 'cs', tipo: 'lectura',
    titulo: 'Ver cobertura del material',
    descripcion: 'El banco de videos y documentos que mandó Mauricio, cruzado contra los módulos de SU DOCUMENTO (0 a 12): nivel de cobertura por módulo (nada, anexo, parcial, clase), piezas que sirven, qué falta grabar, defectos a arreglar antes de publicar, módulos en cero y sus tareas pendientes. OJO: la numeración del documento no es la del temario cargado; la divergencia viene en la respuesta. Con numero trae un solo módulo.',
    parametros: [
      { nombre: 'numero', tipo: 'number', entero: true, minimo: 0, maximo: 12, descripcion: 'número de módulo del DOCUMENTO de Mauricio (0 a 12), no del temario cargado.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },

  // ── Lecturas del programa (salen por HTTP: no traen personas) ────────────────
  {
    id: 'ver_programa_cs', area: 'cs', tipo: 'lectura',
    titulo: 'Ver el temario del programa',
    descripcion: 'El temario del programa de Mauricio. Sin parámetros: los módulos (fase, quién contesta —dueño o líder de área—, si se repite por área) con sus clases resumidas (id, rótulo, pregunta, si está cargada en Whop); son unos 9 KB, y por WhatsApp va sin la pregunta. Con moduloId: ese módulo con el atoro de cada clase. Con claseId: una clase completa con las preguntas del formulario y los puntos a grabar. Por la API no vienen atoros, puntos ni de qué va el video (nombran clientes reales). Úsala para conseguir un claseId.',
    parametros: [moduloId, claseId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_grabaciones_programa', area: 'cs', tipo: 'lectura',
    titulo: 'Ver los videos del programa',
    descripcion: 'La lista de videos del programa: cada video agrupa una o más clases del mismo módulo (compartir el video no fusiona la tarea), con de qué va cada uno y cuáles destraban los atoros más caros. Los puntos a cubrir en orden vienen solo con moduloId; sin él son unos 10 KB y por WhatsApp van sin «de qué va». Por la API no vienen los puntos ni de qué va (nombran clientes reales). NO sabe qué video ya está grabado: ese dato no existe.',
    parametros: [moduloId],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_estado_whop', area: 'cs', tipo: 'lectura',
    titulo: 'Ver la conexión con Whop',
    descripcion: 'Si Whop está conectado en este negocio, a qué cuenta de Whop quedó conectada la key (para notar una key equivocada) y cuántas lecciones del curso están mapeadas a clases del temario. Nunca devuelve la key. Úsala cuando el avance de los alumnos no llega o antes de sincronizar el programa.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: CS_WHOP,
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────────
  {
    id: 'marcar_estado_cliente_cs', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Marcar estado de un cliente',
    descripcion: 'Cambia el estado de un cliente dentro del programa: activo, graduado (terminó bien), baja (se fue antes) o pausado. Es una DECISIÓN del consultor, no un cálculo: pasarse del plazo del contrato no es haber terminado. Para una baja pide el motivo antes de proponerla. Graduado y baja lo sacan de la vista principal de la cartera. No toca la etapa del lead en el CRM.',
    escribe: 'el estado (y el motivo, si viene) del cliente en cs_clientes',
    parametros: [
      leadId,
      { nombre: 'estado', tipo: 'string', enum: ['activo', 'graduado', 'baja', 'pausado'], obligatorio: true, descripcion: 'el estado nuevo dentro del programa.' },
      { nombre: 'motivo', tipo: 'string', max: 500, descripcion: 'por qué. Obligatorio para una baja. Sin motivo se conserva el que había.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'revocar_links_tarea_cs', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Cortar el link de un cliente',
    descripcion: 'Revoca todos los links vivos de la tarea de un cliente: deja de poder entrar al instante. Sus respuestas no se tocan. No se puede deshacer para esos links: para devolverle el acceso hay que emitirle uno nuevo desde la pantalla de Customer Success. Necesita el leadId.',
    escribe: 'revocado_at en cada link vivo de la tarea del cliente (shares)',
    parametros: [leadId],
    canales: SIN_HTTP, costo: 'gratis', gating: CS_ADMIN,
  },
  {
    id: 'reconstruir_mapa_lecciones_whop', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Reparar el mapa de lecciones',
    descripcion: 'Vuelve a armar el mapa entre las lecciones de Whop y las clases del temario preguntándole a Whop por los títulos. Úsala cuando el avance de los alumnos llega como «lección desconocida». Si la reconstrucción falla a mitad y no mejora el mapa, no pisa el que había. Son unas 14 consultas a Whop.',
    escribe: 'el mapa lección→clase del workspace (setting mako.whop.lecciones)',
    parametros: [],
    canales: TODOS, costo: 'externo', gating: CS_WHOP,
  },

  // ── Acciones en pantalla ──────────────────────────────────────────────────────
  {
    id: 'sincronizar_programa_whop', area: 'cs', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Sincronizar el programa a Whop',
    descripcion: 'Carga el temario en Whop: crea la experiencia, el curso (oculto), un capítulo por módulo y una lección por clase si no existen, reescribe el cuerpo de las lecciones que cambiaron (pisa lo editado a mano en Whop) y guarda el mapa lección→clase. Idempotente por título. Masivo: decenas de consultas seguidas, puede pasar del minuto; si se corta, correrla de nuevo completa lo que faltó. No publica el curso.',
    escribe: 'experiencia, curso, capítulos y lecciones en Whop, y el mapa lección→clase del workspace',
    parametros: [],
    canales: TODOS, costo: 'externo', gating: { ...CS_WHOP, rolMinimo: 'admin' }, lenta: true,
  },
  {
    id: 'avisar_bloques_para_aprobar', area: 'cs', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/whatsapp', reversible: true,
    titulo: 'Avisarle que tiene algo para aprobar',
    descripcion: 'Deja en la cola de borradores de WhatsApp un mensaje para el cliente: que MaKo le dejó mejoradas las respuestas de lo que hablaron, con la lista de bloques, para que entre a su link y apruebe. NO manda nada: lo manda una persona desde /whatsapp. Sin clases, avisa de todos los bloques que esperan su ok. Si ya hay un aviso igual pendiente, devuelve ese.',
    escribe: 'una fila pendiente en wa_borradores con origen mako',
    parametros: [
      leadId,
      { nombre: 'clases', tipo: 'string[]', max: 44, descripcion: 'claseIds a nombrar; cada uno tiene que estar en revisada_ia (esperando su ok). Vacío = todos los que esperan.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { ...CS, integracion: 'evolution' },
  },
  {
    id: 'recordar_tarea_sin_contestar', area: 'cs', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/whatsapp', reversible: true,
    titulo: 'Recordarle una tarea sin contestar',
    descripcion: 'Deja en la cola de borradores de WhatsApp un recordatorio para un cliente que VIO una o más clases en Whop y no contestó la tarea: la lista de bloques y que está en el mismo link de siempre. Al que ni abrió la clase no le corresponde este mensaje. NO manda nada: lo manda una persona desde /whatsapp. Sin clases, recuerda todas las vistas sin contestar.',
    escribe: 'una fila pendiente en wa_borradores con origen mako',
    parametros: [
      leadId,
      { nombre: 'clases', tipo: 'string[]', max: 44, descripcion: 'claseIds a nombrar; cada uno tiene que estar visto y sin contestar. Vacío = todos los que cumplen eso.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { ...CS, integracion: 'evolution' },
  },
];
