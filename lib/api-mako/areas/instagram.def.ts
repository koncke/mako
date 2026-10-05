// =============================================================================
// api-mako/areas/instagram.def — las operaciones del área `instagram` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// instagram.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// La tab /instagram corre sobre Zernio (un envoltorio de la API de Meta) y es SOLO
// del admin del workspace (requireRolWs([])): todo lleva rolMinimo 'admin'.
//
// ⚠️ Los DMs y las conversaciones de personas NO salen por http: `canales` sin
// 'http' a propósito (bandeja, hilos, borradores, envío).
//
// ⚠️ NINGUNA operación manda un DM sin que una persona vea el texto. El envío es
// `enviar_borrador_dm_instagram`, de pantalla, y SOLO dentro de la ventana de 24 h:
// fuera de ella el DM sale con el tag HUMAN_AGENT, que Meta castiga a nivel de la
// APP (todos los clientes) si lo usa algo automatizado. Ese caso se manda desde la
// bandeja de /instagram. El texto que sale lo fija el CÓDIGO en la propuesta
// (proponer() propio), no lo que haya en la base al confirmar.
// `generar_borrador_dm_instagram` se NIEGA con la auto-respuesta prendida y la
// ventana abierta (al proponer y al confirmar): ahí generarBorradorIg envía sola.
//
// ⚠️ estado_conexion_instagram y conversaciones_inbox_zernio son lecturas que, con
// la decisión de Zernio tomada, ESCRIBEN (ensureProfile / upsertRouting): ver la
// cabecera de instagram.run.ts.
//
// Afuera, y por qué (detalle en la cosecha):
//   · publicar ahora / programar / subir media: la lógica vive entera en
//     crearPublicacionAction (≈100 líneas, con ctxAdmin de sesión); no hay lib.
//     PENDIENTE: extraer lib/ig-publicar.ts → publicarPost(ws, input) y exponer
//     publicar/programar como `pantalla` + admin, sin http. Hasta entonces un
//     borrador guardado desde MaKo no se puede programar desde MaKo.
//   · conectar Instagram (OAuth) y elegir la cuenta de Zernio de la plataforma:
//     decisiones de onboarding que se toman en el navegador, sin deshacer.
//   · listar cuentas/profiles de Zernio: listAccounts materializa la decisión de
//     cuenta (ESCRIBE) y listProfiles con la key de plataforma revela otros clientes.
//   · ensayo del DM, crear un DM desde texto libre, automatizaciones de comentarios,
//     envío directo (sendDm), vincular lead: no existen como función con gate.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const APP: ['whatsapp', 'app'] = ['whatsapp', 'app'];
const TODOS: ['whatsapp', 'app', 'http'] = ['whatsapp', 'app', 'http'];

const GATING = { tab: 'instagram', rolMinimo: 'admin' } as const;
const GATING_ZERNIO = { tab: 'instagram', rolMinimo: 'admin', integracion: 'zernio' } as const;

const CONVERSACION_ID: Parametro = { nombre: 'conversacionId', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id local de la conversación de Instagram (de listar_conversaciones_instagram).' };
const BORRADOR_ID: Parametro = { nombre: 'borradorId', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del mensaje en estado borrador (el que tiene estado «borrador» en mensajes_conversacion_instagram).' };
const PUBLICACION_ID: Parametro = { nombre: 'publicacionId', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id local de la publicación (de listar_publicaciones_instagram).' };

const ESTADOS_POST = ['borrador', 'programado', 'publicando', 'publicado', 'parcial', 'error'] as const;

export const DEFS: readonly OperacionDef[] = [
  // ═══════════════════════════ LECTURAS — conexión y configuración ═══════════
  {
    id: 'estado_conexion_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Estado de conexión de Instagram',
    descripcion: 'Dice si el canal de Instagram está listo: si hay key de Zernio utilizable, cómo quedó la decisión de cuenta de Zernio (propia, plataforma o sin resolver) y la cuenta de Instagram conectada (@usuario). Úsala ANTES de hablar de publicar o de DMs: sin cuenta conectada no hay a dónde publicar ni desde dónde contestar. Si la decisión de Zernio está sin resolver no consulta Zernio y devuelve cuenta null.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: GATING_ZERNIO,
  },
  {
    id: 'estado_zernio_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Cuenta de Zernio del workspace',
    descripcion: 'Solo la decisión del paso «Conexión con Zernio», sin llamar a Zernio: «propia» (el negocio pegó su API key), «plataforma» (usa la cuenta de MaKo) o null (sin resolver), y si la plataforma tiene cuenta disponible. Sirve para diagnosticar por qué el canal no anda cuando Zernio no responde; para el estado completo usa estado_conexion_instagram.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'config_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Respuesta automática de DMs',
    descripcion: 'Dice si MaKo contesta SOLA los DMs de Instagram (flag de auto-respuesta, apagado por defecto) y si el paso de ensayo del onboarding está hecho. Pregúntalo antes de generar un borrador: con la auto-respuesta prendida y la ventana de 24 h vigente, el borrador se ENVÍA al lead sin que nadie lo lea.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'estado_onboarding_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Onboarding de la tab Instagram',
    descripcion: 'Los pasos del onboarding de /instagram (conexión con Zernio, cuenta de Instagram, contexto del negocio, ensayo de respuesta) con cuáles están hechos y cuándo. Los dos primeros se derivan de señales reales al abrir la tab. Úsala para saber si puedes ofrecer el canal o si primero hay que terminar de configurarlo en /instagram.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },

  // ═══════════════════════════ LECTURAS — DMs (sin http) ═════════════════════
  {
    id: 'listar_conversaciones_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Bandeja de DMs de Instagram',
    descripcion: 'Las conversaciones de DM del negocio (espejo local que alimenta el webhook de Zernio), de la más reciente a la más vieja: @usuario, último texto que se cruzó, cuántos borradores de MaKo esperan aprobación y si la ventana de 24 h de Meta sigue abierta. Para «¿a quién le debo contestar?» usa soloConBorrador; para «¿a quién le puedo escribir hoy?», soloVentanaVigente. Lee las 100 conversaciones más recientes y lo dice.',
    parametros: [
      { nombre: 'soloConBorrador', tipo: 'boolean', descripcion: 'true = solo las que tienen un borrador de MaKo esperando aprobación.' },
      { nombre: 'soloVentanaVigente', tipo: 'boolean', descripcion: 'true = solo las que tienen la ventana de 24 h de Meta abierta.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántas devolver como máximo (default 30).' },
    ],
    salida: 'json', canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'mensajes_conversacion_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Hilo de una conversación de Instagram',
    descripcion: 'Los mensajes más recientes de una conversación de DM, en orden cronológico: entrantes, enviados, borradores pendientes (con su id para enviarlos, editarlos o descartarlos) y envíos con error (el error de Zernio queda a la vista). Los adjuntos solo traen el tipo: para verlos usa mensajes_conversacion_zernio. Necesita el conversacionId de listar_conversaciones_instagram.',
    parametros: [
      CONVERSACION_ID,
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 300, descripcion: 'cuántos mensajes traer, los más recientes (default 60, máximo 300).' },
    ],
    salida: 'json', canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'conversaciones_inbox_zernio', area: 'instagram', tipo: 'lectura',
    titulo: 'Inbox vivo de Zernio',
    descripcion: 'El inbox de Instagram leído en vivo de Zernio (no el espejo local), paginado: nombre del participante, último mensaje, no leídos, si sigue a la cuenta, y el conversacionId local cuando la conversación también está en el espejo. Úsala cuando el espejo no alcanza (conversaciones anteriores a conectar la cuenta). Esas conversaciones viejas vienen ya leídas y no tienen webhook: no las trates como mensajes nuevos.',
    parametros: [
      { nombre: 'status', tipo: 'string', enum: ['active', 'archived'], descripcion: 'active (default de Zernio) o archived.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'conversaciones por página (default 30).' },
      { nombre: 'cursor', tipo: 'string', max: 500, descripcion: 'siguiente_cursor de la página anterior, tal cual.' },
    ],
    salida: 'json', canales: APP, costo: 'externo', gating: GATING_ZERNIO,
  },
  {
    id: 'mensajes_conversacion_zernio', area: 'instagram', tipo: 'lectura',
    titulo: 'Mensajes vivos con adjuntos',
    descripcion: 'Los mensajes de una conversación leídos en vivo de Zernio, con lo que el espejo local no tiene: el enlace renovable de cada adjunto (audio, imagen, video que mandó el lead), el estado de entrega y las reacciones. No marca nada como leído. Necesita el conversacionId LOCAL (de listar_conversaciones_instagram o conversaciones_inbox_zernio).',
    parametros: [
      CONVERSACION_ID,
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'mensajes por página (default 30).' },
      { nombre: 'cursor', tipo: 'string', max: 500, descripcion: 'siguiente_cursor de la página anterior, tal cual.' },
    ],
    salida: 'json', canales: APP, costo: 'externo', gating: GATING_ZERNIO,
  },

  // ═══════════════════════════ LECTURAS — publicaciones ══════════════════════
  {
    id: 'listar_publicaciones_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Publicaciones de Instagram',
    descripcion: 'Las publicaciones del planificador de /instagram: tipo (feed, reel, story, carrusel), caption, cuánta media lleva, estado (borrador, programado, publicando, publicado, parcial, error), fecha programada, fecha de publicación y el error si falló. Sirve para «¿qué tengo programado esta semana?» o «¿por qué no salió el reel?». Filtra sobre las 100 más recientes. El estado local puede estar viejo si el webhook no llegó: contrástalo con estado_publicacion_zernio.',
    parametros: [
      { nombre: 'estado', tipo: 'string', enum: ESTADOS_POST, descripcion: 'solo las que están en este estado.' },
      { nombre: 'tipo', tipo: 'string', enum: ['feed', 'reel', 'story', 'carrusel'], descripcion: 'solo este formato.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántas devolver como máximo (default 30).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'estado_publicacion_zernio', area: 'instagram', tipo: 'lectura',
    titulo: 'Estado vivo de una publicación',
    descripcion: 'Lee en Zernio, ahora mismo, el estado de una publicación que ya se mandó a programar o publicar: estado general, fecha programada y, por plataforma, si salió, cuándo y el enlace al post. No escribe nada: para dejar el estado local al día usa refrescar_publicacion_instagram. Un borrador local nunca pasó por Zernio y no tiene estado vivo.',
    parametros: [PUBLICACION_ID],
    salida: 'json', canales: TODOS, costo: 'externo', gating: GATING_ZERNIO,
  },
  {
    id: 'preview_media_instagram', area: 'instagram', tipo: 'lectura',
    titulo: 'Ver la media de una publicación',
    descripcion: 'Devuelve un enlace temporal (5 minutos) para ver un archivo de media de una publicación, guardado en el almacenamiento privado del negocio. Úsala para mostrarle a la persona la media de una publicación (p. ej. antes de hablar de programarla o para revisar qué salió). El path sale del campo media de listar_publicaciones_instagram y empieza con el número del workspace; uno de otro workspace se rechaza. No guardes el enlace: pídelo de nuevo cuando haga falta.',
    parametros: [{ nombre: 'path', tipo: 'string', max: 300, obligatorio: true, descripcion: 'path del archivo tal cual aparece en media[].path (p. ej. «12/3f2c….jpg»).' }],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },

  // ═══════════════════════════ ACCIONES — DMs (chat, sin http) ═══════════════
  {
    id: 'generar_borrador_dm_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Redactar respuesta a un DM',
    descripcion: 'Pide a MaKo que redacte (o rehaga) el borrador de respuesta de una conversación cuyo último mensaje es del lead, con el mismo motor del Chatbot: si el mensaje no encaja en la secuencia activa en modo asistido, no redacta y avisa al dueño. Reemplaza el borrador pendiente si ya había uno (el texto anterior se pierde). Nunca envía: con la auto-respuesta prendida y la ventana de 24 h abierta se niega, porque ahí la respuesta sale sola; para rehacerla hay que apagar antes la auto-respuesta (revisa config_instagram).',
    escribe: 'crea o reemplaza el borrador en ig_mensajes y avisa al dueño; no envía el DM',
    parametros: [CONVERSACION_ID],
    canales: APP, costo: 'ia', lenta: true, gating: GATING,
  },
  {
    id: 'editar_borrador_dm_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Corregir un borrador de DM',
    descripcion: 'Cambia el texto de un borrador de DM que sigue pendiente, sin enviarlo: queda en la bandeja de /instagram con el texto nuevo. Úsala cuando la persona dicta una corrección («dile que el precio es otro»). Necesita el borradorId (de mensajes_conversacion_instagram). Un mensaje ya enviado no se edita.',
    escribe: 'pisa ig_mensajes.texto del borrador (solo si sigue en estado borrador)',
    parametros: [BORRADOR_ID, { nombre: 'texto', tipo: 'string', max: 1000, obligatorio: true, descripcion: 'el texto completo nuevo del DM, no vacío (Instagram corta cerca de 1000 caracteres).' }],
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'descartar_borrador_dm_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Descartar un borrador de DM',
    descripcion: 'Borra un borrador de DM pendiente que no se va a mandar. Solo toca mensajes en estado borrador: uno recibido o enviado no se borra. No queda rastro del borrador descartado. Después, generar_borrador_dm_instagram puede redactar otro. Necesita el borradorId (de mensajes_conversacion_instagram).',
    escribe: 'borra la fila del borrador en ig_mensajes',
    parametros: [BORRADOR_ID],
    canales: APP, costo: 'gratis', gating: GATING,
  },

  // ═══════════════════════════ ACCIONES — DMs (pantalla) ═════════════════════
  {
    id: 'enviar_borrador_dm_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Enviar un borrador de DM',
    descripcion: 'PROPONE enviar al lead un borrador de DM pendiente, opcionalmente con el texto corregido. Es un mensaje real a una persona: se confirma en una pantalla que muestra el texto completo y editable, nunca por el chat. Sale exactamente el texto de esa pantalla, aunque el borrador cambie después en la base. Solo dentro de la ventana de 24 h de Meta; fuera de ella el envío se hace desde la bandeja de /instagram. Necesita el borradorId (de mensajes_conversacion_instagram).',
    escribe: 'guarda en el borrador el texto confirmado, envía el DM por Zernio a Instagram y marca el borrador como enviado (o error, con el motivo)',
    parametros: [BORRADOR_ID, { nombre: 'texto', tipo: 'string', max: 1000, descripcion: 'texto final corregido; si no viene, la propuesta copia el texto actual del borrador y es ese el que se muestra y se envía.' }],
    canales: APP, costo: 'externo', gating: GATING_ZERNIO,
  },

  // ═══════════════════════════ ACCIONES — publicaciones ══════════════════════
  {
    id: 'crear_borrador_publicacion_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Guardar borrador de publicación',
    descripcion: 'PROPONE guardar un reel, carrusel o story como BORRADOR en el planificador de /instagram, con su caption y notas de producción opcionales. No publica ni toca Zernio: la media y la fecha se completan después en /instagram. Se confirma en una pantalla porque la caption es texto largo que conviene leer y corregir. Cada propuesta confirmada crea un borrador nuevo, y hoy ese borrador no se borra ni se edita desde MaKo ni desde /instagram: no la propongas dos veces. Para un post de feed no aplica.',
    escribe: 'crea una fila en contenido_posts en estado borrador, sin media (las notas van anexadas al final de la caption)',
    parametros: [
      { nombre: 'tipo', tipo: 'string', enum: ['reel', 'carrusel', 'story'], obligatorio: true, descripcion: 'formato de la publicación.' },
      { nombre: 'caption', tipo: 'string', max: 2200, obligatorio: true, descripcion: 'el texto del post (Instagram admite hasta 2200 caracteres).' },
      { nombre: 'notas', tipo: 'string', max: 4000, descripcion: 'notas de producción (guion, escenas); se anexan a la caption con un rótulo que pide borrarlas antes de publicar.' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'cancelar_programacion_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Cancelar una publicación programada',
    descripcion: 'Cancela una publicación PROGRAMADA: la borra de Zernio para que no salga y la deja como borrador local (conserva caption y media). Solo funciona con publicaciones en estado programado; si Zernio ya la publicó, no se puede y se actualiza el estado. Un post ya publicado no se despublica desde MaKo. No se deshace: para volver a programarla hay que armar el post de nuevo en /instagram. Necesita el publicacionId.',
    escribe: 'borra el post programado en Zernio y pasa contenido_posts a borrador (sin zernio_post_id ni fecha)',
    parametros: [PUBLICACION_ID],
    canales: TODOS, costo: 'externo', gating: GATING_ZERNIO,
  },
  {
    id: 'refrescar_publicacion_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Sincronizar estado de una publicación',
    descripcion: 'Relee la publicación en Zernio y deja el estado local al día (publicado, error, parcial y fecha de publicación) sin esperar el webhook. Solo para publicaciones en «publicando» o «programado»: úsala cuando una lleva rato en «publicando» o sigue «programado» pasada la hora. Si el post ya está en error, no la uses: el motivo detallado ya está en listar_publicaciones_instagram. Si solo quieres mirar el estado vivo sin escribir, usa estado_publicacion_zernio. Necesita el publicacionId.',
    escribe: 'actualiza estado, publicado_at y error de la fila en contenido_posts (conserva el motivo de fallo que ya tenía)',
    parametros: [PUBLICACION_ID],
    canales: TODOS, costo: 'externo', gating: GATING_ZERNIO,
  },

  // ═══════════════════════════ ACCIONES — configuración ══════════════════════
  {
    id: 'prender_auto_respuesta_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Prender la auto-respuesta de DMs',
    descripcion: 'PROPONE prender la respuesta automática de DMs de Instagram: cada borrador que MaKo redacta para un DM entrante se ENVÍA solo mientras la ventana de 24 h esté abierta, sin que nadie lo lea. Se confirma en pantalla porque convierte el canal en un bot que le escribe a personas reales, y la pantalla avisa si el ensayo del onboarding no está hecho. Revisa antes config_instagram.',
    escribe: 'guarda el flag ig_auto_respuesta del workspace en app_settings en true',
    parametros: [],
    canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'apagar_auto_respuesta_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Apagar la auto-respuesta de DMs',
    descripcion: 'Apaga la respuesta automática de DMs de Instagram: desde ahí cada borrador que MaKo redacta espera que una persona lo envíe desde la bandeja. Es el modo por defecto y el de menor riesgo. Úsala cuando la persona quiere revisar cada respuesta antes de que salga, o antes de rehacer un borrador con generar_borrador_dm_instagram.',
    escribe: 'guarda el flag ig_auto_respuesta del workspace en app_settings en false',
    parametros: [],
    canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'marcar_paso_onboarding_instagram', area: 'instagram', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Marcar paso del onboarding',
    descripcion: 'Da por hecho el paso «Contexto del negocio» del onboarding de /instagram, cuando la persona ya revisó lo que MaKo sabe de su negocio. Exige los pasos anteriores (Zernio y cuenta conectada). El paso de ensayo NO se marca desde aquí: existe para que alguien vea una respuesta real en /instagram antes de prender la auto-respuesta.',
    escribe: 'marca el paso en app_settings (onboarding.tab.instagram y el registro compartido de pasos)',
    parametros: [{ nombre: 'paso', tipo: 'string', enum: ['ig_contexto'], obligatorio: true, descripcion: 'el paso a marcar: ig_contexto.' }],
    canales: TODOS, costo: 'gratis', gating: GATING,
  },
];
