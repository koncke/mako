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
import { getWorkspaceActual } from './workspace';

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

/** Perfil de la PERSONA logueada. Sesiones sin fila real (legacy/dev/maestra) → defaults. */
/**
 * De quién es el perfil que se está mirando. Normalmente, el de la persona
 * logueada. Pero un admin de agencia VIENDO COMO cliente está parado adentro de
 * esa cuenta: ahí el perfil que corresponde es el del cliente, no el suyo. Ver
 * su propia foto adentro de la cuenta ajena hace dudar de dónde estás parado, y
 * peor: editarla escribiría sobre su propio usuario creyendo tocar el del cliente.
 */
type FilaPerfil = { id: number; nombre: string | null; email: string; foto_url: string | null; perfil?: unknown };

async function usuarioDelPerfil(): Promise<FilaPerfil | null> {
  const sesion = await getUsuarioActual();
  if (!sesion || !sesion.email) return null;

  const propio = await buscarUsuarioPorEmail(sesion.email).catch(() => null);
  if (sesion.rol !== 'admin') return propio;

  // Admin: si está parado en un workspace que NO es el suyo, es una vista de
  // cliente. El perfil pasa a ser el del admin de ESE workspace.
  const ws = await getWorkspaceActual();
  if (ws == null || ws === propio?.workspace_id) return propio;
  try {
    const { data } = await getSupabaseServer()
      .from('usuarios').select('id, nombre, email, foto_url, perfil, workspace_id, rol_ws')
      .eq('workspace_id', ws).order('id', { ascending: true }).limit(20);
    const filas = (data ?? []) as Array<{ id: number; nombre: string | null; email: string; foto_url: string | null; perfil?: unknown; rol_ws?: string | null }>;
    return filas.find((u) => u.rol_ws === 'admin') ?? filas[0] ?? propio;
  } catch { return propio; }
}

export async function getPerfil(): Promise<Perfil> {
  const sesion = await getUsuarioActual();
  if (!sesion || !sesion.email) return { ...DEFAULT_PERFIL };
  const u = await usuarioDelPerfil();
  if (!u) return { ...DEFAULT_PERFIL, nombre: sesion.nombre || '', email: sesion.email };
  const extra = ((u as { perfil?: Partial<PerfilExtra> }).perfil ?? {}) as Partial<PerfilExtra>;
  return {
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
  };
}

/** Guarda el perfil de la PERSONA logueada en su fila usuarios. No toca el email de login. */
export async function setPerfil(patch: Partial<Perfil>): Promise<Perfil> {
  // Escribe sobre el MISMO usuario que se está mirando: viendo como cliente, se
  // edita el perfil del cliente. Si no, se vería uno y se editaría otro.
  const u = await usuarioDelPerfil();
  if (!u) return getPerfil(); // break-glass: sin fila, no-op

  const cols: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) cols.nombre = String(patch.nombre).trim();
  if (patch.avatarUrl !== undefined) cols.foto_url = String(patch.avatarUrl).trim();

  const extraPrev = ((u as { perfil?: Partial<PerfilExtra> }).perfil ?? {}) as Partial<PerfilExtra>;
  const extra: Partial<PerfilExtra> = { ...extraPrev };
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
};

export const DEFAULT_PREFS: NotifPrefs = {
  horario: { activo: true, wa: true, email: false },
  diario: { activo: true, wa: true, email: true },
  semanal: { activo: true, wa: true, email: true },
  secciones: { semaforo: true, ads: true, wins: true, pendientes: true },
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
  };
}

export async function setNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await setSetting(PREFS_KEY, JSON.stringify(prefs));
}
