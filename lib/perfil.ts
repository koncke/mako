// =============================================================================
// Perfil del usuario + preferencias de notificaciones
// =============================================================================
// La app es de UN solo usuario (Mauricio), con gate por contraseña COMPARTIDA
// por env (no hay tabla de usuarios). Por eso el "perfil" y las preferencias se
// guardan como pares clave/valor en app_settings:
//   - perfil    → user_nombre / user_email / user_telefono / user_timezone / …
//   - prefs     → notification_prefs (un solo JSON)
// No hay "cambiar contraseña": el login es una clave global de entorno.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from './settings';

// ── Perfil ────────────────────────────────────────────────────────────────────
export type Perfil = {
  nombre: string;
  email: string;      // destino de los reportes por email
  telefono: string;   // WhatsApp destino de los reportes (E.164, ej. +5216861234567)
  cargo: string;
  empresa: string;
  web: string;
  bio: string;
  timezone: string;
  avatarUrl: string;
};

export const DEFAULT_PERFIL: Perfil = {
  nombre: 'Mauricio Bustos',
  email: '',
  telefono: '',
  cargo: 'Fundador',
  empresa: '',
  web: '',
  bio: '',
  timezone: 'America/Tijuana',
  avatarUrl: '',
};

// clave de perfil → clave en app_settings
const PERFIL_KEYS: Record<keyof Perfil, string> = {
  nombre: 'user_nombre',
  email: 'user_email',
  telefono: 'user_telefono',
  cargo: 'user_cargo',
  empresa: 'user_empresa',
  web: 'user_web',
  bio: 'user_bio',
  timezone: 'user_timezone',
  avatarUrl: 'user_avatar_url',
};

export async function getPerfil(): Promise<Perfil> {
  const out = { ...DEFAULT_PERFIL };
  await Promise.all(
    (Object.keys(PERFIL_KEYS) as Array<keyof Perfil>).map(async (k) => {
      const v = await getSetting(PERFIL_KEYS[k]);
      if (v !== null) out[k] = v;
    }),
  );
  return out;
}

/** Guarda solo los campos presentes (upsert por clave). Devuelve el perfil final. */
export async function setPerfil(patch: Partial<Perfil>): Promise<Perfil> {
  await Promise.all(
    (Object.keys(patch) as Array<keyof Perfil>)
      .filter((k) => k in PERFIL_KEYS)
      .map((k) => setSetting(PERFIL_KEYS[k], String(patch[k] ?? '').trim())),
  );
  return getPerfil();
}

// ── Preferencias de notificaciones ────────────────────────────────────────────
// Por cada reporte, qué canales de PUSH usar. El centro de notificaciones in-app
// (la campanita) SIEMPRE registra todo; los canales son avisos extra.
export type CanalPrefs = {
  activo: boolean;
  wa: boolean;
  telegram: boolean;
  email: boolean;
};

export type NotifPrefs = {
  horario: CanalPrefs;   // "lo urgente", cada hora 8–21h Tijuana
  diario: CanalPrefs;    // digest de la mañana
  semanal: CanalPrefs;   // lunes
  secciones: {
    semaforo: boolean;
    ads: boolean;
    wins: boolean;
    pendientes: boolean;
  };
};

export const DEFAULT_PREFS: NotifPrefs = {
  horario: { activo: true, wa: true, telegram: false, email: false },
  diario: { activo: true, wa: true, telegram: false, email: true },
  semanal: { activo: true, wa: true, telegram: false, email: true },
  secciones: { semaforo: true, ads: true, wins: true, pendientes: true },
};

const PREFS_KEY = 'notification_prefs';

function mergeCanal(base: CanalPrefs, over: unknown): CanalPrefs {
  const o = (over ?? {}) as Partial<CanalPrefs>;
  return {
    activo: typeof o.activo === 'boolean' ? o.activo : base.activo,
    wa: typeof o.wa === 'boolean' ? o.wa : base.wa,
    telegram: typeof o.telegram === 'boolean' ? o.telegram : base.telegram,
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
