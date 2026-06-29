// =============================================================================
// Avatares de los anuncios — vocabulario EDITABLE (única fuente de verdad)
// =============================================================================
// El AVATAR es el público objetivo del anuncio: dos guiones del mismo ángulo
// pueden apuntarle a avatares distintos. Es específico de cada cliente (no hay
// defaults universales), así que arranca VACÍO: hasta que el usuario defina
// avatares, la IA no clasifica avatar y la UI no lo muestra.
// Se guarda como JSON en app_settings (key 'script_avatares'): lista de
// { key, label, color, desc? }. Mismo patrón tolerante que script-angles.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from './settings';

export type Avatar = { key: string; label: string; color: string; desc?: string };

const SETTING_KEY = 'script_avatares';

/** Normaliza una etiqueta a un slug estable (minúsculas, sin acentos ni espacios). */
export function avatarKey(s: string): string {
  return String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'avatar';
}

function sanitize(list: unknown): Avatar[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Avatar[] = [];
  for (const a of list) {
    const o = (a ?? {}) as Record<string, unknown>;
    const key = avatarKey(String(o.key ?? o.label ?? ''));
    const label = String(o.label ?? '').trim();
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, color: typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#6B675C', desc: o.desc ? String(o.desc).trim() : undefined });
  }
  return out;
}

/** Lista de avatares vigente (vacía si el cliente todavía no definió ninguno). */
export async function getAvatares(): Promise<Avatar[]> {
  try {
    const raw = await getSetting(SETTING_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Guarda la lista de avatares (CRUD = editar la lista entera). Puede quedar vacía. */
export async function setAvatares(list: unknown): Promise<Avatar[]> {
  const clean = sanitize(list);
  await setSetting(SETTING_KEY, JSON.stringify(clean));
  return clean;
}
