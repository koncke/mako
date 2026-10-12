// =============================================================================
// api-mako/areas/equipo.def — las operaciones del área `equipo` (definiciones)
// =============================================================================
// La CUENTA: el perfil de la persona, el equipo del negocio (admin/closer/setter),
// cómo avisa MaKo (reportes, avisos de WhatsApp, destinatarios, pop-up y sonido),
// la zona horaria del negocio y las identidades fiscales. Tabs /perfil,
// /configuraciones y /equipo.
//
// SIN server-only y sin importar valores de módulos que lo tengan: esto lo importan
// los tests y el generador de la referencia. Los cuerpos van en equipo.run.ts,
// cruzados por id. Español neutro (lo lee el cliente).
//
// Cuatro decisiones que no se deducen leyendo las libs:
//
//  1. SIN `gating.tab`. /perfil y /configuraciones viven en el menú de la foto
//     (userNavKeys de lib/capas.ts), y la vista del registro (vista.ts) arma `tabs`
//     solo con navKeys: una capa `pm`, que SÍ ve Configuraciones, no vería ninguna
//     operación de este archivo. El rol (rolMinimo) es el gate que corresponde.
//  2. POR HTTP NO SALE nada con datos del equipo ni del negocio que identifiquen a
//     personas: emails, teléfonos, destinatarios, identidades fiscales, el perfil.
//  3. LO QUE ES DE UNA PERSONA (perfil, pop-up y sonido) sale SOLO por la app y
//     SOLO como lectura: por WhatsApp y HTTP no hay sesión, y getPerfil resuelve
//     «la persona» desde la cookie. editar_perfil y configurar_notificaciones_inapp
//     SE SACARON del registro (16/09/2026): no tenían rolMinimo, pero las dos
//     pantallas donde se confirman (/mako/pendientes y /mako/revisar, ctxDeBandeja)
//     exigen admin y el runner exigía que confirmara quien propuso, así que un
//     closer nunca podía confirmar lo suyo; y el doer de la app entra solo con
//     lecturas (api-mako-diseno §4.2). Vuelven cuando la bandeja deje confirmar a un
//     no-admin lo que no lleva rolMinimo.
//  4. Invitar, cambiar el rol, eliminar a alguien y todo dato exacto (teléfono,
//     email, RFC) van por PANTALLA con rolMinimo admin.
// =============================================================================

import type { OperacionDef, Gating } from '../tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
/** Datos de personas (emails, teléfonos, razones sociales): sin HTTP. */
const SIN_HTTP = ['whatsapp', 'app'] as const;
/** Lo que es de la persona logueada: solo existe con una sesión. */
const SOLO_APP = ['app'] as const;
const ADMIN: Gating = { rolMinimo: 'admin' };

const REPORTES = ['horario', 'diario', 'semanal'] as const;
const ROLES_WS = ['admin', 'closer', 'setter'] as const;
const ID_MIEMBRO = { nombre: 'miembro_id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del miembro del equipo (de listar_equipo o buscar_miembro_equipo).' } as const;

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ────────────────────────────────────────────────────────────────
  {
    id: 'ver_perfil', area: 'equipo', tipo: 'lectura',
    titulo: 'Perfil de la persona',
    descripcion: 'El perfil de la persona que está usando la app: nombre, email de login, teléfono personal, cargo, empresa, web, bio, zona horaria personal y foto. Úsala cuando pregunten qué datos tiene cargados; para cambiarlos, la persona entra a su perfil en la app. Ese teléfono NO es el de los reportes ni el del grupo de WhatsApp, y la zona horaria personal no gobierna ningún horario del negocio. Un administrador de agencia viendo un negocio ajeno recibe el perfil del admin de ese negocio.',
    parametros: [],
    salida: 'json', canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'quien_soy', area: 'equipo', tipo: 'lectura',
    titulo: 'Quién pide y en qué negocio',
    descripcion: 'Quién está pidiendo y en qué contexto: el negocio (id, nombre, capa contratada), el canal, el rol con el que corre (admin o miembro) y, desde la app, el email, el rol dentro del negocio (admin, closer o setter) y si es una vista de agencia sobre un cliente. Úsala para decidir qué ofrecer antes de proponer algo. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis',
  },
  {
    id: 'ver_workspace', area: 'equipo', tipo: 'lectura',
    titulo: 'Datos del negocio',
    descripcion: 'Nombre, slug, estado (activo o pausado) y capa contratada del negocio actual, con las tabs que incluye esa capa. Úsala para nombrar el negocio en un mensaje o para saber si una tab está disponible antes de ofrecer algo de ella. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'ver_zona_horaria_workspace', area: 'equipo', tipo: 'lectura',
    titulo: 'Zona horaria del negocio',
    descripcion: 'La zona horaria IANA con la que MaKo calcula «hoy», las reuniones, el horario de oficina y los avisos de este negocio, la hora local actual en ella y de dónde salió (`origen`: persona, navegador, ip, calendario, meta, telefono o legado). Se detecta de la ubicación del equipo del negocio; lo que elige una persona gana. Si nunca se fijó, lo dice (`fijada: false`) y devuelve la que se usa mientras tanto (America/Tijuana). Úsala antes de proponer horarios o de fijar_zona_horaria_workspace. Los reportes del cron siguen anclados a Tijuana.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'listar_equipo', area: 'equipo', tipo: 'lectura',
    titulo: 'Miembros del equipo',
    descripcion: 'Las personas del negocio (nunca los administradores de la agencia): id, nombre, email, rol dentro del negocio (admin, closer o setter), estado (activo, invitado o suspendido), último login y cuándo se le mandó el mail de acceso (`aviso_de_acceso_enviado: null` = nunca se le avisó). Úsala para conseguir el id antes de cambiar un rol, reenviar una invitación, suspender o eliminar. Solo el administrador.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'buscar_miembro_equipo', area: 'equipo', tipo: 'lectura',
    titulo: 'Buscar un miembro del equipo',
    descripcion: 'Encuentra a una persona del equipo de ESTE negocio por su email exacto o por su nombre (todas las palabras dadas tienen que estar en el nombre de la cuenta). Si hay más de una coincidencia devuelve los candidatos para que la persona aclare. Úsala para resolver «Leila» o «el closer nuevo» a un id antes de una acción. Pasa email o nombre.',
    parametros: [
      { nombre: 'email', tipo: 'string', max: 320, descripcion: 'email exacto de la cuenta (no distingue mayúsculas).' },
      { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'nombre o parte del nombre, con al menos 3 letras por palabra.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'ver_preferencias_notificaciones', area: 'equipo', tipo: 'lectura',
    titulo: 'Qué avisa MaKo y por dónde',
    descripcion: 'Las preferencias de notificación del negocio: para cada reporte (horario, diario, semanal) si está activo y si sale por WhatsApp y por email, qué secciones llevan (semáforo de Meta, ads, wins, pendientes) y qué avisos de WhatsApp están apagados. Sin configurar nada, los tres reportes salen. Úsala antes de cambiar una preferencia o para explicar «¿por qué no me llegó el reporte?».',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'listar_avisos_disponibles', area: 'equipo', tipo: 'lectura',
    titulo: 'Avisos de WhatsApp que existen',
    descripcion: 'Todos los avisos que MaKo puede mandar al grupo de WhatsApp del negocio (id y título), con `en_configuraciones`: si figura en la pantalla Configuraciones › Notificaciones. Que no figure NO quiere decir que no llegue (el recordatorio de reunión llega y no figura). Son los ids que acepta configurar_aviso_whatsapp. Úsala antes de silenciar un aviso o para encontrar el id de «los recordatorios de reunión». Con `completo: true` agrega cuándo llega y la categoría.',
    parametros: [
      { nombre: 'completo', tipo: 'boolean', descripcion: 'true para sumar a cada aviso cuándo llega y su categoría.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'esta_aviso_activo', area: 'equipo', tipo: 'lectura',
    titulo: 'Si un aviso sale por WhatsApp',
    descripcion: 'Dice si un aviso concreto está prendido para este negocio (el interruptor que mira el envío de cualquier aviso; si nunca se tocó, está prendido) y si figura en la pantalla Configuraciones › Notificaciones. Úsala para explicar por qué un evento no llegó al grupo o antes de silenciarlo. Ojo: la agencia tiene además un apagador general por plantilla que esta lectura no ve.',
    parametros: [
      { nombre: 'aviso', tipo: 'string', max: 80, obligatorio: true, descripcion: 'id del aviso (de listar_avisos_disponibles), por ejemplo reunion-nuevo-agendado.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'ver_destinatarios_notificaciones', area: 'equipo', tipo: 'lectura',
    titulo: 'A quiénes llegan reportes y avisos',
    descripcion: 'Los teléfonos y emails del negocio que reciben los reportes y los avisos (el primer teléfono es el principal: con él se armó el grupo de WhatsApp de MaKo) y si el negocio ya tiene grupo. Úsala antes de agregar o quitar un destinatario, o para diagnosticar a quién le llega qué. Solo el administrador.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'ver_notificaciones_inapp', area: 'equipo', tipo: 'lectura',
    titulo: 'Pop-up y sonido de la persona',
    descripcion: 'Las preferencias de la persona logueada dentro de la app: interruptores generales de pop-up y de sonido, y el estado de cada notificación (mensaje de WhatsApp, WhatsApp de la empresa, plantilla resuelta, uso de IA). Son de quien está frente a la pantalla, no del negocio. Úsala para explicar por qué no le suena o no le aparece un aviso; se cambian en su perfil dentro de la app.',
    parametros: [],
    salida: 'json', canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'generar_reporte', area: 'equipo', tipo: 'lectura',
    titulo: 'Ver un reporte sin enviarlo',
    descripcion: 'Arma el texto del reporte tal como lo mandaría el cron, SIN enviarlo: horario = lo urgente (cuenta de Meta frenada, cuotas vencidas, fatiga, datos sin marcar); diario = semáforo de Meta, ads de ayer, wins y pendientes; semanal = ads, wins y cobranza de la semana pasada (lunes a domingo). Respeta las secciones configuradas. Fechas en hora de Tijuana. Úsala cuando pidan «pásame el resumen de hoy». Pega a Meta: puede tardar.',
    parametros: [
      { nombre: 'tipo', tipo: 'string', enum: REPORTES, obligatorio: true, descripcion: 'qué reporte armar: horario, diario o semanal.' },
    ],
    salida: 'texto', canales: SIN_HTTP, costo: 'externo', lenta: true, gating: ADMIN,
  },
  {
    id: 'ver_estado_plantilla_reporte', area: 'equipo', tipo: 'lectura',
    titulo: 'Plantilla de WhatsApp del reporte',
    descripcion: 'El estado en Meta de la plantilla «reporte_mako», la que abre la ventana de 24 horas para que el reporte diario llegue por WhatsApp: approved, pending, rejected (con el motivo), ausente o error (sin WhatsApp oficial conectado o Meta sin responder). Úsala para explicar por qué el reporte diario no llega por WhatsApp.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: { integracion: 'chatwoot' },
  },
  {
    id: 'listar_identidades_fiscales', area: 'equipo', tipo: 'lectura',
    titulo: 'Identidades fiscales del negocio',
    descripcion: 'Las razones sociales con las que factura el negocio (id, nombre, identificación fiscal como RFC, CUIT o NIT, domicilio, correo y cuál es la predeterminada), la predeterminada primero. Se eligen como «Facturado por» en cada deal del CRM. Úsala para conseguir el id antes de editar, marcar como predeterminada o borrar una. Solo el administrador.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'ver_estado_verificacion_contacto', area: 'equipo', tipo: 'lectura',
    titulo: 'Verificación del teléfono principal',
    descripcion: 'Si el teléfono principal de los avisos confirmó con un código que recibe los mensajes de MaKo (paso del onboarding) y cuál es. Úsala para diagnosticar «no me llegan los avisos»: un número sin verificar puede estar mal escrito. Solo el administrador.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },

  // ── Acciones por chat (una entidad, reversible o de bajo impacto) ────────────
  {
    id: 'fijar_zona_horaria_workspace', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Fijar la zona horaria del negocio',
    descripcion: 'PROPONE fijar la zona horaria IANA con la que MaKo calcula «hoy», las reuniones, el horario de oficina y los avisos de este negocio (queda pendiente hasta el «sí»). Queda como elegida por una persona: ninguna detección por ubicación la vuelve a cambiar. Úsala cuando las horas le aparecen en otra zona (un negocio en Cancún, en Buenos Aires, en Madrid). Revisa antes ver_zona_horaria_workspace. No cambia los reportes del cron, que siguen en hora de Tijuana.',
    escribe: 'app_settings mako.timezone y mako.timezone.origen del negocio',
    parametros: [
      { nombre: 'timezone', tipo: 'string', max: 60, obligatorio: true, descripcion: 'zona IANA válida, por ejemplo America/Cancun o America/Argentina/Buenos_Aires.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'configurar_reporte', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Prender o apagar un reporte',
    descripcion: 'PROPONE prender o apagar un reporte entero (horario, diario o semanal) o uno de sus canales (WhatsApp o email), queda pendiente hasta el «sí». Úsala para «no me mandes más el horario» o «el semanal también por email». Revisa antes ver_preferencias_notificaciones: si ya está así, lo dice y no propone nada.',
    escribe: 'app_settings notification_prefs (se relee y se cambia solo ese campo)',
    parametros: [
      { nombre: 'reporte', tipo: 'string', enum: REPORTES, obligatorio: true, descripcion: 'qué reporte: horario, diario o semanal.' },
      { nombre: 'campo', tipo: 'string', enum: ['activo', 'wa', 'email'], obligatorio: true, descripcion: 'activo = el reporte entero; wa = su envío por WhatsApp; email = su envío por email.' },
      { nombre: 'valor', tipo: 'boolean', obligatorio: true, descripcion: 'true prende, false apaga.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'configurar_seccion_reporte', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Elegir las secciones del reporte',
    descripcion: 'PROPONE prender o apagar una sección de los reportes del negocio (semáforo de la cuenta de Meta, ads, wins, pendientes), queda pendiente hasta el «sí». Úsala para «no me pongas los ads en el reporte» o «súmale los pendientes». Revisa antes ver_preferencias_notificaciones. Aplica a los tres reportes a la vez. Si ya está así, lo dice y no propone nada.',
    escribe: 'app_settings notification_prefs.secciones',
    parametros: [
      { nombre: 'seccion', tipo: 'string', enum: ['semaforo', 'ads', 'wins', 'pendientes'], obligatorio: true, descripcion: 'la sección: semaforo, ads, wins o pendientes.' },
      { nombre: 'valor', tipo: 'boolean', obligatorio: true, descripcion: 'true la incluye, false la saca.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'configurar_aviso_whatsapp', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Prender o apagar un aviso',
    descripcion: 'PROPONE silenciar o volver a prender un aviso concreto que MaKo manda al grupo de WhatsApp del negocio (lead nuevo de Meta, recordatorio de reunión, grabación lista, tracking apagado, objetivo en riesgo…), queda pendiente hasta el «sí». Apagarlo solo corta el WhatsApp. Pide antes listar_avisos_disponibles para el id: vale cualquiera de esa lista, figure o no en Configuraciones. Los reportes (horario, diario, semanal) no se apagan aquí: usa configurar_reporte. Si la agencia apagó esa plantilla, prenderlo aquí no la hace salir.',
    escribe: 'app_settings notification_prefs.avisos[id]',
    parametros: [
      { nombre: 'aviso', tipo: 'string', max: 80, obligatorio: true, descripcion: 'id del aviso (de listar_avisos_disponibles), por ejemplo reunion-recordatorio.' },
      { nombre: 'valor', tipo: 'boolean', obligatorio: true, descripcion: 'true sale por WhatsApp, false no sale.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'quitar_destinatario_notificaciones', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Sacar un destinatario de los reportes',
    descripcion: 'PROPONE sacar un teléfono o un email de la lista que recibe los reportes y avisos del negocio (queda pendiente hasta el «sí»). Tiene que ser uno de los que ya están (ver_destinatarios_notificaciones). Deja de recibir por ese canal pero NO sale del grupo de WhatsApp. El teléfono PRINCIPAL (el primero) no se quita por aquí: cambiarlo mueve a dónde llega la apertura diaria y quién es el dueño para MaKo, y volver a agregarlo lo deja al final; eso se hace en Configuraciones › Notificaciones. Pasa telefono o email.',
    escribe: 'app_settings notif_telefonos / notif_emails y sus espejos (nunca el teléfono principal)',
    parametros: [
      { nombre: 'telefono', tipo: 'string', max: 30, descripcion: 'uno de los teléfonos actuales, con lada.' },
      { nombre: 'email', tipo: 'string', max: 320, descripcion: 'uno de los emails actuales.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: ADMIN,
  },
  {
    id: 'reenviar_invitacion', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Reenviar el mail de acceso',
    descripcion: 'PROPONE volver a mandar el mail «Tu acceso a MaKo» a una persona del equipo que ya tiene cuenta (queda pendiente hasta el «sí»). Úsala cuando listar_equipo la muestra sin avisar o cuando dice que no le llegó. Si el mail no sale, la respuesta trae el link para pasárselo a mano. No aplica a cuentas suspendidas.',
    escribe: 'manda un email por Resend y marca usuarios.invitacion_enviada_at si salió',
    parametros: [ID_MIEMBRO],
    canales: SIN_HTTP, costo: 'externo', gating: ADMIN,
  },
  {
    id: 'suspender_miembro', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Suspender o reactivar un miembro',
    descripcion: 'PROPONE suspender (deja de poder usar MaKo) o reactivar a una persona del equipo por su id (queda pendiente hasta el «sí»). Rechaza suspender al único administrador activo del negocio y suspenderse a uno mismo. Suspender es reversible y preferible a eliminar_miembro.',
    escribe: 'usuarios.estado del miembro',
    parametros: [
      ID_MIEMBRO,
      { nombre: 'estado', tipo: 'string', enum: ['activo', 'suspendido'], obligatorio: true, descripcion: 'suspendido para cortarle el acceso, activo para devolvérselo.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'hacer_default_identidad_fiscal', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Elegir la identidad fiscal predeterminada',
    descripcion: 'PROPONE marcar una identidad fiscal existente como la predeterminada, la que se sugiere en «Facturado por» de cada deal (queda pendiente hasta el «sí»). Desmarca la anterior. El id sale de listar_identidades_fiscales.',
    escribe: 'identidades_fiscales.es_default (una sola por negocio)',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id de la identidad fiscal (de listar_identidades_fiscales).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },

  // ── Acciones por pantalla (datos exactos, altas, bajas) ──────────────────────
  {
    id: 'agregar_destinatario_notificaciones', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Sumar un destinatario a los reportes',
    descripcion: 'PROPONE sumar un teléfono (con lada) o un email a la lista que recibe los reportes y avisos del negocio, y deja un link para revisarlo y confirmarlo. Un teléfono nuevo se agrega al grupo de WhatsApp «MaKo <> cliente» (si es el primero, crea el grupo) y eso no se deshace quitándolo de la lista. Úsala para «que los reportes le lleguen también a mi contador». Pasa telefono o email.',
    escribe: 'app_settings notif_telefonos / notif_emails y sus espejos; agrega el número al grupo de WhatsApp de MaKo',
    parametros: [
      { nombre: 'telefono', tipo: 'string', max: 30, descripcion: 'teléfono con lada de país, por ejemplo 5215512345678.' },
      { nombre: 'email', tipo: 'string', max: 320, descripcion: 'email que recibe los reportes.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: ADMIN,
  },
  {
    id: 'invitar_miembro_equipo', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Invitar a alguien al equipo',
    descripcion: 'PROPONE crear la cuenta de una persona en el negocio con su rol (setter si no se dice; closer o admin) y mandarle el mail de acceso; deja un link para revisar el email y confirmar. Entra con Google usando EXACTAMENTE ese email. Un admin ve todo el negocio (integraciones, prompts, equipo). Rechaza emails que ya tienen cuenta en MaKo. Úsala para «suma a Juan como closer».',
    escribe: 'usuarios (nueva fila en estado invitado) y un email por Resend',
    parametros: [
      { nombre: 'email', tipo: 'string', max: 320, obligatorio: true, descripcion: 'email de Google con el que va a entrar, exacto.' },
      { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'nombre de la persona.' },
      { nombre: 'rol_ws', tipo: 'string', enum: ROLES_WS, descripcion: 'rol dentro del negocio: admin, closer o setter (setter si se omite).' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: ADMIN,
  },
  {
    id: 'cambiar_rol_miembro', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Cambiar el rol de un miembro',
    descripcion: 'PROPONE cambiar qué ve una persona del equipo y deja un link para confirmarlo: admin (todo el negocio, incluidas integraciones y equipo), closer (CRM, WhatsApp, Closing) o setter (CRM, WhatsApp, Email). Rechaza dejar al negocio sin un administrador activo. Aplica sin que la persona vuelva a entrar. Úsala para «pasa a Juan a closer». Pide antes listar_equipo o buscar_miembro_equipo para el id.',
    escribe: 'usuarios.rol_ws del miembro',
    parametros: [
      ID_MIEMBRO,
      { nombre: 'rol_ws', tipo: 'string', enum: ROLES_WS, obligatorio: true, descripcion: 'rol nuevo: admin, closer o setter.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'eliminar_miembro', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Eliminar un miembro del equipo',
    descripcion: 'PROPONE borrar la cuenta de una persona del negocio y deja un link para confirmarlo. Es irreversible (habría que invitarla de nuevo) y los leads donde figura como closer o setter no se reasignan. Rechaza eliminar al único administrador activo y eliminarse a uno mismo. Prefiere suspender_miembro. Úsala solo si piden borrar la cuenta; pide antes listar_equipo o buscar_miembro_equipo para el id.',
    escribe: 'usuarios (borra la fila del miembro)',
    parametros: [ID_MIEMBRO],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'guardar_identidad_fiscal', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Crear o editar una identidad fiscal',
    descripcion: 'PROPONE crear (sin id) o editar (con id) una razón social con la que factura el negocio: nombre, identificación fiscal (RFC, CUIT, NIT, EIN), domicilio, correo y si es la predeterminada; deja un link para revisar los datos exactos y confirmar. Úsala para «factura con otra razón social» o para corregir un RFC. Para editar, pide antes listar_identidades_fiscales y pasa su id. Al editar, los campos que no se pasan se conservan; para vaciar id_fiscal, domicilio o correo pasa un guion (-). Marcarla predeterminada desmarca la anterior.',
    escribe: 'identidades_fiscales (alta o edición; y es_default=false en las demás si se marca predeterminada)',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id a editar (de listar_identidades_fiscales); sin id se crea una nueva.' },
      { nombre: 'nombre', tipo: 'string', max: 200, obligatorio: true, descripcion: 'razón social o nombre con el que factura.' },
      { nombre: 'id_fiscal', tipo: 'string', max: 40, descripcion: 'identificación fiscal: RFC, CUIT, NIT, EIN… Un guion (-) la vacía.' },
      { nombre: 'domicilio', tipo: 'string', max: 400, descripcion: 'domicilio fiscal. Un guion (-) lo vacía.' },
      { nombre: 'correo', tipo: 'string', max: 320, descripcion: 'correo de facturación. Un guion (-) lo vacía.' },
      { nombre: 'es_default', tipo: 'boolean', descripcion: 'true para que sea la predeterminada en «Facturado por».' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'borrar_identidad_fiscal', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar una identidad fiscal',
    descripcion: 'PROPONE borrar una razón social del negocio y deja un link para confirmarlo. Los deals que la tenían en «Facturado por» quedan sin identidad. Para cambiar datos usa guardar_identidad_fiscal en vez de borrar y crear. El id sale de listar_identidades_fiscales.',
    escribe: 'identidades_fiscales (borra la fila)',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id de la identidad fiscal a borrar.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'asegurar_plantilla_reporte', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Mandar a aprobar la plantilla del reporte',
    descripcion: 'PROPONE crear la plantilla de WhatsApp «reporte_mako» (la que abre la ventana de 24 horas del reporte diario) y mandarla a aprobación de Meta; deja un link para confirmarlo. Úsala cuando ver_estado_plantilla_reporte diga ausente o rejected. Si ya está aprobada o pendiente, lo dice y no propone nada. Meta tarda horas o días en decidir.',
    escribe: 'whatsapp_template_drafts y la plantilla en la cuenta de WhatsApp Business del negocio en Meta',
    parametros: [],
    canales: TODOS, costo: 'externo', gating: { integracion: 'chatwoot', rolMinimo: 'admin' },
  },
];
