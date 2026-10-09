// =============================================================================
// Perfil personal (por usuario) + config de reportes/notificaciones (por workspace)
// =============================================================================
// Multi-inquilino: el PERFIL es de la PERSONA (nombre, foto, cargo, bio…) y vive
// en su fila de `usuarios` (columnas nombre/email/foto_url + jsonb `perfil`).
// Antes vivía en app_settings por-workspace y se compartía entre todos.
//
// La CONFIG DE REPORTES (a qué email/WhatsApp van los reportes del cron) y las
// preferencias de notificaciones son por-WORKSPACE: los crons (sin sesión →
// workspace dueño) las leen de app_settings. Se mantienen las keys de siempre.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getSetting, setSetting } from './settings';
import { getUsuarioActual } from './auth';
import { buscarUsuarioPorEmail } from './usuarios';
import { getWorkspace, getWorkspaceActual, runWithWorkspace } from './workspace';
import { contextoDeAgencia } from './agencia';
import { deQuienEsElPerfil, titularDelCliente } from './perfil-sujeto';
import { DEFAULT_IN_APP, normalizarInApp, type NotifInApp } from './notif-catalogo';

// ── Perfil personal (por usuario) ─────────────────────────────────────────────
export type Perfil = {
  nombre: string;
  email: string;      // el email de login (solo lectura acá)
  telefono: string;
  cargo: string;
  empresa: string;
  web: string;
  bio: string;
  timezone: string;
  avatarUrl: string;
};

export const DEFAULT_PERFIL: Perfil = {
  nombre: '', email: '', telefono: '', cargo: '', empresa: '', web: '', bio: '',
  timezone: 'America/Tijuana', avatarUrl: '',
};

// Campos que viven en el jsonb `perfil` de la fila usuarios (el resto son columnas).
type PerfilExtra = Pick<Perfil, 'telefono' | 'cargo' | 'empresa' | 'web' | 'bio' | 'timezone'>;
const EXTRA_KEYS: Array<keyof PerfilExtra> = ['telefono', 'cargo', 'empresa', 'web', 'bio', 'timezone'];

/**
 * De quién es el perfil que se está mirando. Normalmente, el de la persona
 * logueada. Pero quien está VIENDO COMO cliente —el super admin parado en él, o una
 * agencia inspeccionando a uno de su cartera— está adentro de esa cuenta: ahí el
 * perfil que corresponde es el del cliente, no el suyo. Ver su propia foto adentro de
 * la cuenta ajena hace dudar de dónde estás parado, y peor: editarla escribiría sobre
 * su propio usuario creyendo tocar el del cliente.
 *
 * La decisión vive en `deQuienEsElPerfil` (lib/perfil-sujeto.ts, pura y con test). Acá
 * sólo se leen sus datos, y del SERVER: `getWorkspaceActual` y `contextoDeAgencia`,
 * nunca un `?ws=` leído a mano.
 */
type FilaPerfil = { id: number; nombre: string | null; email: string; foto_url: string | null; perfil?: unknown };

/**
 * Lo que la pantalla necesita saber además de los datos: si es el perfil de OTRO, de
 * qué cuenta, y si esa cuenta no tiene a nadie adentro (o no se pudo leer — son dos
 * hechos distintos y la pantalla no puede decir «nadie» cuando no miró).
 */
export type VistaPerfil =
  | { deOtro: false }
  | { deOtro: true; cuenta: string; sinNadie: boolean; sinLeer: boolean };

const PROPIA: VistaPerfil = { deOtro: false };

async function usuarioDelPerfil(): Promise<{ fila: FilaPerfil | null; vista: VistaPerfil }> {
  const sesion = await getUsuarioActual();
  if (!sesion || !sesion.email) return { fila: null, vista: PROPIA };

  const propio = await buscarUsuarioPorEmail(sesion.email).catch(() => null);
  const esSuperAdmin = sesion.rol === 'admin';
  const sujeto = deQuienEsElPerfil({
    esSuperAdmin,
    wsPropio: propio?.workspace_id ?? sesion.ws ?? null,
    wsActual: await getWorkspaceActual(),
    // La agencia: su cookie firmada + la cartera aprobada AHORA. Es el permiso, leído en
    // este request. El super admin no tiene cartera (y `contextoDeAgencia` lo devuelve null).
    clienteDeAgencia: esSuperAdmin ? null : await contextoDeAgencia(),
  });
  if (sujeto.tipo === 'propio') return { fila: propio, vista: PROPIA };

  // ⚠️ VISTA DE OTRO: NUNCA SE CAE A `propio`. Antes, sin nadie adentro (o con la lectura
  // caída) volvía el perfil de quien mira, y la pantalla lo dibujaba como si fuera el del
  // cliente. Ahora el vacío se dice, y la escritura no tiene a quién tocar.
  const cuenta = (await getWorkspace(sujeto.ws).catch(() => null))?.nombre ?? '';
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('id, nombre, email, foto_url, perfil, workspace_id, rol_ws')
    .eq('workspace_id', sujeto.ws).order('id', { ascending: true }).limit(50);
  if (error) return { fila: null, vista: { deOtro: true, cuenta, sinNadie: false, sinLeer: true } };
  const filas = (data ?? []) as Array<FilaPerfil & { workspace_id: number | null; rol_ws?: string | null }>;
  const fila = titularDelCliente(filas, sujeto.ws);
  return {
    fila,
    vista: { deOtro: true, cuenta: (fila?.nombre ?? '').trim() || cuenta, sinNadie: !fila, sinLeer: false },
  };
}

/** El perfil y de quién es. Lo usa /api/perfil para que la pantalla diga «Perfil de X». */
export async function leerPerfil(): Promise<{ perfil: Perfil; vista: VistaPerfil }> {
  const sesion = await getUsuarioActual();
  if (!sesion || !sesion.email) return { perfil: { ...DEFAULT_PERFIL }, vista: PROPIA };
  const { fila: u, vista } = await usuarioDelPerfil();
  if (!u) {
    // Sin fila: en el propio, la sesión (legacy/dev/maestra) con sus datos. En la vista de
    // otro, el NOMBRE DE LA CUENTA y nada más: ni el email ni la foto de quien mira, que es
    // exactamente lo que este archivo existe para no mostrar.
    return vista.deOtro
      ? { perfil: { ...DEFAULT_PERFIL, nombre: vista.cuenta }, vista }
      : { perfil: { ...DEFAULT_PERFIL, nombre: sesion.nombre || '', email: sesion.email }, vista };
  }
  const extra = ((u as { perfil?: Partial<PerfilExtra> }).perfil ?? {}) as Partial<PerfilExtra>;
  return {
    perfil: {
      ...DEFAULT_PERFIL,
      nombre: u.nombre || '',
      email: u.email,
      avatarUrl: u.foto_url ?? '',
      telefono: extra.telefono ?? '',
      cargo: extra.cargo ?? '',
      empresa: extra.empresa ?? '',
      web: extra.web ?? '',
      bio: extra.bio ?? '',
      timezone: extra.timezone ?? DEFAULT_PERFIL.timezone,
    },
    vista,
  };
}

/** Perfil de quien se está mirando (ver `usuarioDelPerfil`). Sesiones sin fila real → defaults. */
export async function getPerfil(): Promise<Perfil> {
  return (await leerPerfil()).perfil;
}

/**
 * Guarda el perfil que se está MIRANDO en su fila de usuarios. No toca el email de login.
 *
 * ⚠️ EL PERMISO SE RESUELVE ACÁ, EN CADA POST, y no lo trae la pantalla: es el mismo
 * `usuarioDelPerfil` que decide qué se lee, así que una agencia a la que le revocaron la
 * cartera vuelve a su propio perfil en el acto, y lo que llegue en el body no elige fila.
 */
export async function setPerfil(patch: Partial<Perfil>): Promise<Perfil> {
  // Escribe sobre el MISMO usuario que se está mirando: viendo como cliente, se
  // edita el perfil del cliente. Si no, se vería uno y se editaría otro.
  const { fila: u, vista } = await usuarioDelPerfil();
  // Vista de otro sin nadie adentro (o sin poder leer): no hay a quién escribirle, y
  // devolver «ok» sería un guardado falso.
  if (!u && vista.deOtro) throw new Error(vista.sinLeer ? 'No pude leer el perfil de esta cuenta.' : 'Esta cuenta todavía no tiene a nadie adentro.');
  if (!u) return getPerfil(); // break-glass: sin fila, no-op

  const cols: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) cols.nombre = String(patch.nombre).trim();
  if (patch.avatarUrl !== undefined) cols.foto_url = String(patch.avatarUrl).trim();

  // Se reescribe el jsonb entero, así que hay que arrancar de lo que ya había:
  // adentro no viven solo los campos del formulario (también `notifInApp`), y
  // partir de {} los borraría sin que nada avise.
  const extraPrev = ((u as { perfil?: Record<string, unknown> }).perfil ?? {}) as Record<string, unknown>;
  const extra: Record<string, unknown> = { ...extraPrev };
  for (const k of EXTRA_KEYS) if (patch[k] !== undefined) extra[k] = String(patch[k] ?? '').trim();
  cols.perfil = extra;

  const { error } = await getSupabaseServer().from('usuarios').update(cols).eq('id', u.id);
  if (error) throw new Error(`perfil: ${error.message}`);
  return getPerfil();
}

// ── Contacto de reportes (por workspace) ──────────────────────────────────────
// A dónde manda el cron los reportes del workspace. Vive en app_settings
// (por-workspace, default dueño). Mantiene las keys históricas.
export type ContactoReportes = { nombre: string; email: string; telefono: string };

export async function getContactoReportes(): Promise<ContactoReportes> {
  const [nombre, email, telefono] = await Promise.all([
    getSetting('user_nombre'), getSetting('user_email'), getSetting('user_telefono'),
  ]);
  return { nombre: nombre ?? '', email: email ?? '', telefono: telefono ?? '' };
}

export async function setContactoReportes(c: Partial<ContactoReportes>): Promise<void> {
  const tareas: Array<Promise<void>> = [];
  if (c.nombre !== undefined) tareas.push(setSetting('user_nombre', c.nombre.trim()));
  if (c.email !== undefined) tareas.push(setSetting('user_email', c.email.trim()));
  if (c.telefono !== undefined) tareas.push(setSetting('user_telefono', c.telefono.trim()));
  await Promise.all(tareas);
}

// ── Preferencias de notificaciones (por workspace) ────────────────────────────
// Config de los reportes del workspace (qué canales, qué secciones). La usan los
// crons; es del workspace, no personal.
export type CanalPrefs = {
  activo: boolean;
  wa: boolean;
  email: boolean;
};

export type NotifPrefs = {
  horario: CanalPrefs;
  diario: CanalPrefs;
  semanal: CanalPrefs;
  secciones: {
    semaforo: boolean;
    ads: boolean;
    wins: boolean;
    pendientes: boolean;
  };
  /**
   * Avisos sueltos de WhatsApp (id del catálogo → sale / no sale). Ausente = sale:
   * un aviso recién cableado tiene que llegar sin que nadie lo prenda a mano, y así
   * olvidarse de sumarlo a AVISOS_WA_EN_VIVO no lo silencia.
   */
  avisos: Record<string, boolean>;
  /**
   * JUNTAR LOS AVISOS NO URGENTES EN UNO POR DÍA (mig 0161 + lib/avisos-agrupables.ts).
   *
   * Sale del reporte del dueño del 22/09/2026: «las notificaciones de WhatsApp son
   * demasiadas». Con esto prendido, los avisos de la lista de agrupables esperan en
   * `avisos_cola` y salen juntos a la mañana; los urgentes (un lead, una reunión, la
   * cuenta de Meta frenada) siguen saliendo en el momento igual.
   *
   * ⚠️ El default es FALSE, o sea el comportamiento de hoy. Un campo que decide si un
   * mensaje sale cuando pasa o 18 horas después no puede cambiarle la vida a 50 clientes
   * porque alguien agregó una propiedad: el default es el que NO tiene consecuencias.
   */
  resumenDiario: boolean;
};

export const DEFAULT_PREFS: NotifPrefs = {
  horario: { activo: true, wa: true, email: false },
  diario: { activo: true, wa: true, email: true },
  semanal: { activo: true, wa: true, email: true },
  secciones: { semaforo: true, ads: true, wins: true, pendientes: true },
  avisos: {},
  resumenDiario: false,
};

const PREFS_KEY = 'notification_prefs';

function mergeCanal(base: CanalPrefs, over: unknown): CanalPrefs {
  const o = (over ?? {}) as Partial<CanalPrefs>;
  return {
    activo: typeof o.activo === 'boolean' ? o.activo : base.activo,
    wa: typeof o.wa === 'boolean' ? o.wa : base.wa,
    email: typeof o.email === 'boolean' ? o.email : base.email,
  };
}

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const raw = await getSetting(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  let parsed: Partial<NotifPrefs> = {};
  try {
    parsed = JSON.parse(raw) as Partial<NotifPrefs>;
  } catch {
    return DEFAULT_PREFS;
  }
  const sec = (parsed.secciones ?? {}) as Partial<NotifPrefs['secciones']>;
  const avisos: Record<string, boolean> = {};
  if (parsed.avisos && typeof parsed.avisos === 'object') {
    for (const [k, v] of Object.entries(parsed.avisos)) if (typeof v === 'boolean') avisos[k] = v;
  }
  return {
    horario: mergeCanal(DEFAULT_PREFS.horario, parsed.horario),
    diario: mergeCanal(DEFAULT_PREFS.diario, parsed.diario),
    semanal: mergeCanal(DEFAULT_PREFS.semanal, parsed.semanal),
    secciones: {
      semaforo: sec.semaforo ?? DEFAULT_PREFS.secciones.semaforo,
      ads: sec.ads ?? DEFAULT_PREFS.secciones.ads,
      wins: sec.wins ?? DEFAULT_PREFS.secciones.wins,
      pendientes: sec.pendientes ?? DEFAULT_PREFS.secciones.pendientes,
    },
    avisos,
    resumenDiario: typeof parsed.resumenDiario === 'boolean' ? parsed.resumenDiario : DEFAULT_PREFS.resumenDiario,
  };
}

export async function setNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await setSetting(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * ¿Este aviso sale por WhatsApp en este workspace? Lo consulta el choke point
 * (lib/avisos.ts) antes de despachar. Ausente = sí: ver el comentario del campo.
 */
/**
 * ¿En este workspace los avisos no urgentes esperan al resumen de la mañana?
 *
 * Un fallo leyendo la preferencia devuelve FALSE, o sea «que salga ahora»: si no se puede
 * saber, se prefiere el mensaje de más antes que el mensaje que no llega.
 */
export async function resumenAvisosActivo(ws: number): Promise<boolean> {
  try {
    const prefs = await runWithWorkspace(ws, () => getNotifPrefs());
    return prefs.resumenDiario === true;
  } catch {
    return false;
  }
}

/**
 * ¿Este aviso sale por WhatsApp?
 *
 * ⚠️ UN SOLO INTERRUPTOR POR MENSAJE. Antes había dos campos que apagaban lo
 * mismo y el usuario los leía como uno: este `prefs.avisos[tipo]` (el toggle de
 * la lista de Avisos) y el `enabled` de la plantilla (el punto verde de «Los
 * mensajes, como llegan»). Se consultaban EN CADENA, así que apagar cualquiera
 * silenciaba el aviso — y prender uno sin darse cuenta de que el otro estaba
 * apagado no hacía nada. Dos switches para un hecho es un switch que miente.
 *
 * Al quedar UNA pantalla, la verdad es `enabled`. Los apagados que vivían en
 * prefs se movieron al store con scripts/migrar-apagados-a-plantillas.mjs (5
 * filas, ws1 y ws13) ANTES de este cambio: leer el store con los apagados
 * todavía en prefs le habría vuelto a prender a un cliente lo que había
 * silenciado.
 *
 * `prefs.avisos` queda en el tipo por las preferencias viejas que puedan estar
 * guardadas, pero ya no lo lee nadie: un campo que decide algo tiene que tener
 * una pantalla donde verse, y ese toggle ya no existe.
 */
export async function avisoWaActivo(ws: number, tipo: string): Promise<boolean> {
  const e = await estadoAviso(ws, tipo);
  return e.activo && e.wa;
}

/** Cómo sale un aviso en ESTE workspace: si sale, por dónde y cada cuánto. */
export type EstadoAviso = { activo: boolean; wa: boolean; email: boolean; frecuenciaMin: number };

/**
 * El interruptor del aviso Y sus canales, en UNA sola lectura del store.
 *
 * Son dos preguntas distintas y hay que poder contestarlas por separado:
 * `activo` es «¿este mensaje existe para este negocio?» (lo apaga el interruptor
 * grande, y es lo que ya se veía en la pantalla), y `wa`/`email` es «¿por dónde me
 * llega?». Juntarlas en un booleano es lo que hacía imposible «éste sí, pero sólo
 * por mail»: el único camino era apagarlo entero.
 *
 * ⚠️ FAIL-OPEN, y sólo para WhatsApp. Si la lectura falla, el aviso sale por donde
 * salía siempre: un error nuestro leyendo una preferencia no puede silenciar el
 * mensaje que dice que los números dejaron de llegar. Pero NO se abre el email: ese
 * canal se prende a mano, y un fallo de lectura no es un permiso.
 */
export async function estadoAviso(ws: number, tipo: string): Promise<EstadoAviso> {
  // ⚠️ Y `frecuenciaMin` viaja en esta MISMA lectura, no en una función al lado. El
  // choke point pregunta «¿sale, por dónde y cada cuánto?» de una sola vez; partido en
  // dos consultas del mismo store, la segunda se olvida en el próximo despachador.
  //
  // El 0 del fail-open es «sin límite propio», o sea el comportamiento de siempre: un
  // error nuestro leyendo una preferencia no puede espaciar un mensaje.
  try {
    const { getPlantilla } = await import('./plantillas');
    const p = await runWithWorkspace(ws, () => getPlantilla(tipo));
    if (!p) return { activo: true, wa: true, email: false, frecuenciaMin: 0 };
    return { activo: p.enabled, wa: p.canales.wa, email: p.canales.email, frecuenciaMin: p.frecuenciaMin };
  } catch {
    return { activo: true, wa: true, email: false, frecuenciaMin: 0 };
  }
}

// ── Notificaciones dentro de la app (por USUARIO) ─────────────────────────────
// Pop-up y sonido pasan en el navegador de UNA persona: si viviera en
// app_settings, el que baja el volumen se lo baja a todo su equipo. Vive en el
// jsonb `perfil` de su fila de usuarios, junto al resto de lo suyo.
//
// A diferencia del perfil visible, acá NO se aplica el "viendo como cliente":
// el sonido es de quien está frente al teclado, no de la cuenta que está mirando.
const IN_APP_KEY = 'notifInApp';

async function filaPropia(): Promise<{ id: number; perfil: Record<string, unknown> } | null> {
  const sesion = await getUsuarioActual();
  if (!sesion?.email) return null;
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('id, perfil').eq('email', sesion.email.trim().toLowerCase()).maybeSingle();
  if (error || !data) return null;
  const fila = data as { id: number; perfil: unknown };
  return { id: fila.id, perfil: (fila.perfil && typeof fila.perfil === 'object' ? fila.perfil : {}) as Record<string, unknown> };
}

export async function getNotifInApp(): Promise<NotifInApp> {
  try {
    const u = await filaPropia();
    if (!u) return { ...DEFAULT_IN_APP };
    return normalizarInApp(u.perfil[IN_APP_KEY]);
  } catch {
    return { ...DEFAULT_IN_APP };
  }
}

/**
 * Guarda las preferencias in-app del usuario logueado.
 *
 * `guardado:false` = la sesión no tiene fila propia en `usuarios` (dev-login,
 * contraseña maestra, sesiones legacy). Se devuelve en vez de tragárselo: la
 * pantalla necesita poder decir "no se guardó" en lugar de mostrar un tilde verde
 * sobre algo que se pierde al recargar.
 */
export async function setNotifInApp(v: NotifInApp): Promise<{ inApp: NotifInApp; guardado: boolean }> {
  const u = await filaPropia();
  if (!u) return { inApp: normalizarInApp(v), guardado: false };
  const perfil = { ...u.perfil, [IN_APP_KEY]: normalizarInApp(v) };
  const { error } = await getSupabaseServer()
    .from('usuarios').update({ perfil, updated_at: new Date().toISOString() }).eq('id', u.id);
  if (error) throw new Error(`perfil: ${error.message}`);
  return { inApp: normalizarInApp(perfil[IN_APP_KEY]), guardado: true };
}
