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
/** Lo que la plataforma decide SOBRE los negocios (el 2FA obligatorio): un negocio no lo ve. */
const PLATAFORMA: Gating = { rolMinimo: 'admin', soloPlataforma: true };
const NEGOCIO_2FA = { nombre: 'negocio_id', tipo: 'number', entero: true, minimo: 1, rotulo: 'Negocio', descripcion: 'un solo negocio (su id, de ver_exigencia_2fa). Sin esto, todos los negocios.' } as const;

const REPORTES = ['horario', 'diario', 'semanal'] as const;
const ROLES_WS = ['admin', 'closer', 'setter'] as const;
const ID_MIEMBRO = { nombre: 'miembro_id', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'id del miembro del equipo (de listar_equipo o buscar_miembro_equipo).' } as const;

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ────────────────────────────────────────────────────────────────
  {
    id: 'ver_perfil', area: 'equipo', tipo: 'lectura',
    titulo: 'Perfil de la persona',
    descripcion: 'El perfil de la persona que está usando la app: nombre, email de login, teléfono personal, cargo, empresa, web, bio, zona horaria personal y foto. Úsala cuando pregunten qué datos tiene cargados; para cambiarlos, editar_mi_perfil. Ese teléfono NO es el de los reportes ni el del grupo de WhatsApp, y la zona horaria personal no gobierna ningún horario del negocio (sólo su «No molestar» en el celular). Un administrador de agencia viendo un negocio ajeno recibe el perfil del admin de ese negocio.',
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
    descripcion: 'Todos los avisos que MaKo puede mandar al grupo de WhatsApp del negocio (id y título), con `en_configuraciones`: si figura en la pantalla Settings › Notificaciones. Que no figure NO quiere decir que no llegue (el recordatorio de reunión llega y no figura). Son los ids que acepta configurar_aviso_whatsapp. Úsala antes de silenciar un aviso o para encontrar el id de «los recordatorios de reunión». Con `completo: true` agrega cuándo llega y la categoría.',
    parametros: [
      { nombre: 'completo', tipo: 'boolean', descripcion: 'true para sumar a cada aviso cuándo llega y su categoría.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'esta_aviso_activo', area: 'equipo', tipo: 'lectura',
    titulo: 'Si un aviso sale por WhatsApp',
    descripcion: 'Dice si un aviso concreto está prendido para este negocio (el interruptor que mira el envío de cualquier aviso; si nunca se tocó, está prendido) y si figura en la pantalla Settings › Notificaciones. Úsala para explicar por qué un evento no llegó al grupo o antes de silenciarlo. Ojo: la agencia tiene además un apagador general por plantilla que esta lectura no ve.',
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
    descripcion: 'Las preferencias de la persona logueada dentro de la app: interruptores generales de pop-up y de sonido, y el estado de cada notificación (mensaje de WhatsApp, WhatsApp de la empresa, plantilla resuelta, uso de IA). Son de quien está frente a la pantalla, no del negocio. Úsala para explicar por qué no le suena o no le aparece un aviso; se cambian con configurar_notificaciones_inapp.',
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
    descripcion: 'PROPONE silenciar o volver a prender un aviso concreto que MaKo manda al grupo de WhatsApp del negocio (lead nuevo de Meta, recordatorio de reunión, grabación lista, tracking apagado, objetivo en riesgo…), queda pendiente hasta el «sí». Apagarlo solo corta el WhatsApp. Pide antes listar_avisos_disponibles para el id: vale cualquiera de esa lista, figure o no en Configuraciones. Los reportes (horario, diario, semanal) no se apagan aquí: usa configurar_reporte.',
    escribe: 'app_settings mako.plantillas.store[id] (enabled y canales.wa)',
    parametros: [
      { nombre: 'aviso', tipo: 'string', max: 80, obligatorio: true, descripcion: 'id del aviso (de listar_avisos_disponibles), por ejemplo reunion-recordatorio.' },
      { nombre: 'valor', tipo: 'boolean', obligatorio: true, descripcion: 'true sale por WhatsApp, false no sale.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'quitar_destinatario_notificaciones', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Sacar un destinatario de los reportes',
    descripcion: 'PROPONE sacar un teléfono o un email de la lista que recibe los reportes y avisos del negocio (queda pendiente hasta el «sí»). Tiene que ser uno de los que ya están (ver_destinatarios_notificaciones). Deja de recibir por ese canal pero NO sale del grupo de WhatsApp. El teléfono PRINCIPAL (el primero) no se quita por aquí: cambiarlo mueve a dónde llega la apertura diaria y quién es el dueño para MaKo, y volver a agregarlo lo deja al final; eso se hace en Settings › Notificaciones. Pasa telefono o email.',
    escribe: 'app_settings notif_telefonos / notif_emails y sus espejos (nunca el teléfono principal)',
    parametros: [
      { nombre: 'telefono', tipo: 'string', max: 30, descripcion: 'uno de los teléfonos actuales, con lada.' },
      { nombre: 'email', tipo: 'string', max: 320, descripcion: 'uno de los emails actuales.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: ADMIN,
  },
  {
    id: 'reenviar_invitacion', aTerceros: true, area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
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
  // ── El 2FA obligatorio (14/10/2026): sólo la plataforma ─────────────────────────
  {
    id: 'ver_exigencia_2fa', area: 'equipo', tipo: 'lectura',
    titulo: 'Ver quién exige el 2FA',
    descripcion: 'Lee, por negocio, desde cuándo exige el segundo factor (2FA) y cuántos de sus usuarios todavía no lo activaron: ésos no van a poder entrar, pasada la fecha, hasta activarlo. Sólo la plataforma. Úsala antes de exigir_2fa_desde o dejar_de_exigir_2fa.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'exigir_2fa_desde', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Exigir el 2FA desde una fecha',
    descripcion: 'PROPONE exigir el segundo factor (2FA) a los usuarios de los negocios desde un día y una hora EN LA HORA DE CADA NEGOCIO (queda pendiente hasta el «sí»; en una automatización corre directo). Desde ese momento, quien no lo tenga activado no entra: su sesión deja de valer y, al volver a entrar, el login le pide activarlo. A quien ya lo tiene no lo toca, y nadie de ese negocio puede quitarse su último método. Para «el 21/10 a las 24:00» van fecha 2026-10-21 y hora 24:00. Revisa antes ver_exigencia_2fa. Sólo la plataforma.',
    escribe: 'workspaces.mfa_obligatorio_desde de cada negocio',
    parametros: [
      { nombre: 'fecha', tipo: 'string', max: 10, obligatorio: true, rotulo: 'Día', descripcion: 'el día, AAAA-MM-DD (por ejemplo 2026-10-21), en la hora de cada negocio.' },
      { nombre: 'hora', tipo: 'string', max: 5, rotulo: 'Hora', descripcion: 'la hora, HH:MM de 00:00 a 24:00 (24:00 = el final del día). Sin hora: 24:00.' },
      NEGOCIO_2FA,
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'dejar_de_exigir_2fa', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Dejar de exigir el 2FA',
    descripcion: 'PROPONE dejar de exigir el segundo factor (2FA) en los negocios que lo exigen (queda pendiente hasta el «sí»). Quien no lo tiene vuelve a poder entrar sin él; a quien lo tiene no le cambia nada. Es la salida si la exigencia se programó mal. Sólo la plataforma.',
    escribe: 'workspaces.mfa_obligatorio_desde = null',
    parametros: [NEGOCIO_2FA],
    canales: SIN_HTTP, costo: 'gratis', gating: PLATAFORMA,
  },
  {
    id: 'asegurar_plantilla_reporte', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Mandar a aprobar la plantilla del reporte',
    descripcion: 'PROPONE crear la plantilla de WhatsApp «reporte_mako» (la que abre la ventana de 24 horas del reporte diario) y mandarla a aprobación de Meta; deja un link para confirmarlo. Úsala cuando ver_estado_plantilla_reporte diga ausente o rejected. Si ya está aprobada o pendiente, lo dice y no propone nada. Meta tarda horas o días en decidir.',
    escribe: 'whatsapp_template_drafts y la plantilla en la cuenta de WhatsApp Business del negocio en Meta',
    parametros: [],
    canales: TODOS, costo: 'externo', gating: { integracion: 'chatwoot', rolMinimo: 'admin' },
  },
  // ── Settings por la API (25/10/2026) ──────────────────────────────────────────
  // Martín, 25/10: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Lo que Settings deja ver
  // o cambiar y no tenía operación: el perfil propio (escribir), el nombre del negocio, los avisos al celular con «No molestar»,
  // el pop-up y el sonido (escribir), el horario de envío y el estado de la seguridad (leer). (El criterio de reuniones salió con
  // «General» el 26/10/2026: sin pantalla y sin API; quien lo tenía lo sigue usando con su valor.) Lo de la
  // PERSONA es SOLO_APP, como ver_perfil y ver_notificaciones_inapp: sin una sesión no hay de quién es. Lo que NO va, y por qué,
  // en docs/settings/referencia.md («La API»).
  {
    id: 'ver_avisos_celular', area: 'equipo', tipo: 'lectura',
    titulo: 'Avisos al celular de la persona',
    descripcion: 'Qué avisos le llegan al celular a la persona logueada (los push de MaKo instalada en el teléfono): el interruptor general, cada aviso prendido o apagado, el horario de «No molestar» (en la zona horaria de su perfil) y cuántos teléfonos suyos reciben avisos. Son de quien está frente a la pantalla, no del negocio. Úsala antes de cambiar uno o para explicar «¿por qué no me llegó al celular?».',
    parametros: [],
    salida: 'json', canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'ver_mi_seguridad', area: 'equipo', tipo: 'lectura',
    titulo: 'Cómo entra la persona a MaKo',
    descripcion: 'El estado de la seguridad de la persona logueada: si tiene la verificación en 2 pasos con la app, cuántas llaves de acceso, si creó su contraseña, el código por WhatsApp o el correo de respaldo, cuántos códigos de recuperación le quedan y cuántos dispositivos recordados. Sólo lee: nada de esto se cambia por la API (se cambia en Settings › Seguridad, con la sesión de la persona). Úsala para «¿tengo el 2FA prendido?».',
    parametros: [],
    salida: 'json', canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'ver_horario_envio', area: 'equipo', tipo: 'lectura',
    titulo: 'Horario de oficina del negocio',
    descripcion: 'El horario de oficina DEL NEGOCIO: el que usan las automatizaciones que no tienen uno propio (cada una lo cambia en su tuerca de Automations). si está prendido, de qué hora a qué hora, qué días, y la zona horaria del negocio. Apagado = escriben a cualquier hora. Úsala antes de cambiarlo o para explicar por qué un mensaje salió (o no) a cierta hora.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'editar_mi_perfil', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cambiar datos del perfil',
    descripcion: 'PROPONE cambiar datos del perfil de la persona logueada (queda pendiente hasta el «sí»): nombre, cargo, teléfono personal, empresa, sitio web, «sobre ti» o su zona horaria personal (la que mide su «No molestar»). Pasa sólo lo que cambia; «-» vacía un campo. El correo no se cambia (es el del acceso) y la foto se sube en Settings › Perfil. Revisa antes ver_perfil. Mirando a un cliente, es el perfil del cliente, como en la pantalla.',
    escribe: 'usuarios.nombre y usuarios.perfil (teléfono, cargo, empresa, web, bio, zona) de la persona',
    parametros: [
      { nombre: 'nombre', tipo: 'string', max: 80, descripcion: 'nombre y apellido.' },
      { nombre: 'cargo', tipo: 'string', max: 80, descripcion: 'cargo, por ejemplo CEO. «-» lo vacía.' },
      { nombre: 'telefono', tipo: 'string', max: 25, descripcion: 'teléfono personal CON código de país (+52…). «-» lo vacía.' },
      { nombre: 'empresa', tipo: 'string', max: 120, descripcion: 'empresa (dato personal; el nombre del negocio se cambia con renombrar_negocio). «-» lo vacía.' },
      { nombre: 'web', tipo: 'string', max: 200, descripcion: 'sitio web. «-» lo vacía.' },
      { nombre: 'bio', tipo: 'string', max: 1000, descripcion: '«sobre ti», a qué se dedica. «-» lo vacía.' },
      { nombre: 'timezone', tipo: 'string', max: 60, descripcion: 'zona horaria personal IANA, por ejemplo America/Monterrey.' },
    ],
    canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'renombrar_negocio', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cambiar el nombre del negocio',
    descripcion: 'PROPONE cambiar el nombre del negocio, el que se ve en toda la app (queda pendiente hasta el «sí»). Es el mismo que se cambia en Settings › Perfil › Nombre del negocio. Revisa antes quien_soy (dice el nombre actual).',
    escribe: 'workspaces.nombre del negocio',
    parametros: [
      { nombre: 'nombre', tipo: 'string', max: 80, obligatorio: true, descripcion: 'el nombre nuevo del negocio.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'configurar_aviso_celular', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Prender o apagar un aviso al celular',
    descripcion: 'PROPONE prender o apagar los avisos al celular de la persona logueada (queda pendiente hasta el «sí»): sin `aviso`, el interruptor general; con `aviso`, uno solo (sus ids salen de ver_avisos_celular). No toca los avisos al grupo de WhatsApp del negocio (eso es configurar_aviso_whatsapp). Revisa antes ver_avisos_celular.',
    escribe: 'usuarios.perfil.notifPush de la persona',
    parametros: [
      { nombre: 'aviso', tipo: 'string', max: 80, descripcion: 'id de un aviso (de ver_avisos_celular). Sin esto, todos los avisos al celular.' },
      { nombre: 'valor', tipo: 'boolean', obligatorio: true, descripcion: 'true le llega, false no.' },
    ],
    canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'fijar_no_molestar', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'No molestar en el celular',
    descripcion: 'PROPONE el horario de «No molestar» de la persona logueada: entre `desde` y `hasta` (en la zona horaria de su perfil) no le llegan avisos al celular, y lo que cae adentro no se manda después. `desde` mayor que `hasta` cruza la medianoche (22 a 8). Con `apagar: true` lo saca. Queda pendiente hasta el «sí». Revisa antes ver_avisos_celular.',
    escribe: 'usuarios.perfil.notifPush.silencio de la persona',
    parametros: [
      { nombre: 'desde', tipo: 'number', minimo: 0, maximo: 23.5, descripcion: 'hora en que empieza, en medias horas (22 = 22:00, 22.5 = 22:30).' },
      { nombre: 'hasta', tipo: 'number', minimo: 0, maximo: 23.5, descripcion: 'hora en que termina, en medias horas (8 = 08:00).' },
      { nombre: 'apagar', tipo: 'boolean', descripcion: 'true saca el «No molestar».' },
    ],
    canales: SOLO_APP, costo: 'gratis',
  },
  {
    id: 'configurar_notificaciones_inapp', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Pop-up y sonido de la persona',
    descripcion: 'PROPONE prender o apagar el pop-up o el sonido de la persona logueada dentro de la app (queda pendiente hasta el «sí»): sin `notificacion`, el interruptor general; con ella, uno solo (ids de ver_notificaciones_inapp). Apagar el sonido general apaga el de cada una. Revisa antes ver_notificaciones_inapp.',
    escribe: 'usuarios.perfil.notifInApp de la persona',
    parametros: [
      { nombre: 'campo', tipo: 'string', enum: ['popup', 'sonido'], obligatorio: true, descripcion: 'popup = el aviso que salta; sonido = su sonido.' },
      { nombre: 'valor', tipo: 'boolean', obligatorio: true, descripcion: 'true prende, false apaga.' },
      { nombre: 'notificacion', tipo: 'string', max: 40, descripcion: 'id de una notificación (de ver_notificaciones_inapp). Sin esto, el interruptor general.' },
    ],
    canales: SOLO_APP, costo: 'gratis',
  },
  // ── El grupo del negocio dentro de la app (3/11/2026, lib/grupo-app.ts) ──
  // ⛔ `ver_grupo` SÓLO POR LA APP. Por WhatsApp, cualquiera del grupo (N3, `rol: admin`) le sacaría al grupo de WhatsApp lo escrito sólo en la app: el requisito 5, y expone a quien escribió creyendo que lo leía
  // sólo ese grupo. Por HTTP, tampoco: «conversaciones de personas no salen por HTTP» (AGENTS.md y la decisión 2 de arriba). `escribir_en_grupo` sí sale por HTTP, con token `ejecutar`: no devuelve datos de nadie.
  // Un invitado no llega a ninguna: su turno corre sin herramientas (lib/mako-doer-in.ts).
  {
    id: 'ver_grupo', area: 'equipo', tipo: 'lectura',
    titulo: 'Ver el grupo de MaKo',
    descripcion: 'El grupo del negocio dentro de la app: su nombre, quiénes están y por qué (administran, su agencia, invitados) y los últimos mensajes con su autor. Un invitado que todavía no abrió el grupo sale con su email, sin nombre: el nombre diría que esa cuenta existe.',
    parametros: [
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos mensajes traer, los últimos (30 si se omite).' },
    ],
    salida: 'json', canales: SOLO_APP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'invitar_al_grupo', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Invitar a alguien al grupo',
    descripcion: 'PROPONE invitar a una persona al grupo del negocio por su email exacto, también si es de otro negocio, y deja un link para confirmar. Ve lo que cae en el grupo desde hoy, también avisos de ventas y cobros, y puede hablar con MaKo ahí; no entra al resto del negocio. No crea cuentas: si el email no tiene cuenta en MaKo, queda anotado, le llega el email, y entra al grupo la primera vez que entre a MaKo con ese email. Nunca dice si esa cuenta existe.',
    escribe: 'grupo_invitados, un email a la persona, y un aviso al teléfono si tiene cuenta',
    parametros: [
      { nombre: 'email', tipo: 'string', max: 320, obligatorio: true, descripcion: 'el email exacto de la persona.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: ADMIN,
  },
  {
    id: 'sacar_del_grupo', area: 'equipo', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Sacar a alguien del grupo',
    descripcion: 'PROPONE sacar del grupo del negocio a una persona invitada y deja un link para confirmar. Deja de ver el grupo en el acto. Quien entra por administrar el negocio o su agencia no se saca.',
    escribe: 'grupo_invitados',
    parametros: [
      { nombre: 'email', tipo: 'string', max: 320, obligatorio: true, descripcion: 'el email exacto de la persona invitada.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'escribir_en_grupo', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: false, aTerceros: true,
    titulo: 'Escribir en el grupo',
    descripcion: 'PROPONE escribir un mensaje en el grupo del negocio dentro de la app, firmado por MaKo (queda pendiente hasta el «sí»). Le suena a quienes están en el grupo. NO sale por WhatsApp.',
    escribe: 'grupo_mensajes, y un aviso al celular de quienes están en el grupo',
    parametros: [
      { nombre: 'texto', tipo: 'string', max: 4000, obligatorio: true, descripcion: 'el mensaje, tal como se va a leer.' },
    ],
    canales: ['app', 'http'], costo: 'gratis', gating: ADMIN,
  },
  {
    id: 'configurar_horario_envio', area: 'equipo', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cambiar el horario de oficina',
    descripcion: 'PROPONE el horario en que las automatizaciones le escriben a los contactos del negocio (queda pendiente hasta el «sí»). `activo: false` = a cualquier hora. Pasa sólo lo que cambia; lo demás queda como está. La zona es la del negocio (fijar_zona_horaria_workspace). Revisa antes ver_horario_envio.',
    escribe: 'app_settings del horario de envío del negocio',
    parametros: [
      { nombre: 'activo', tipo: 'boolean', descripcion: 'true = sólo en el horario; false = a cualquier hora.' },
      { nombre: 'desde', tipo: 'number', minimo: 0, maximo: 23.5, descripcion: 'hora en que abre, en medias horas (9 = 09:00).' },
      { nombre: 'hasta', tipo: 'number', minimo: 0.5, maximo: 24, descripcion: 'hora en que cierra, en medias horas (21 = 21:00).' },
      { nombre: 'dias', tipo: 'string[]', enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'], descripcion: 'los días en que escribe. Reemplaza los de antes.' },
    ],
    canales: TODOS, costo: 'gratis', gating: ADMIN,
  },
];
