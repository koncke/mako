// =============================================================================
// Ángulos de los guiones — vocabulario EDITABLE (única fuente de verdad)
// =============================================================================
// Se guarda como un JSON en app_settings (key 'script_angles'): lista de
// { key, label, color, desc? }. Si no está seteado o no parsea, cae a
// DEFAULT_ANGLES (los 5 originales) — mismo patrón tolerante que getFunnel.
// Tanto la UI (chips/filtros/cuadrante) como el prompt de Claude derivan de acá.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from './settings';

export type Angle = { key: string; label: string; color: string; desc?: string };

export const DEFAULT_ANGLES: Angle[] = [
  { key: 'visionario', label: 'Visionario', color: '#2F6DDB', desc: 'pinta el futuro/transformación, "esto es lo que pasa cuando…"' },
  { key: 'capataz', label: 'Capataz', color: '#C8870C', desc: 'directo, instructivo, "te implemento / te explico cómo"' },
  { key: 'dolor', label: 'Dolor', color: '#CF4E29', desc: 'arranca por el problema/fricción ("otra mañana persiguiendo leads…")' },
  { key: 'testimonio', label: 'Testimonio', color: '#3B6D11', desc: 'cliente o dueño contando su experiencia en primera persona' },
  { key: 'oferta', label: 'Oferta', color: '#7C4DD6', desc: 'foco en la oferta/urgencia/cupos (retargeting tibio)' },
];

const SETTING_KEY = 'script_angles';

/** Normaliza una etiqueta a un slug estable (minúsculas, sin acentos ni espacios). */
export function angleKey(s: string): string {
  return String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'angulo';
}

function sanitize(list: unknown): Angle[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Angle[] = [];
  for (const a of list) {
    const o = (a ?? {}) as Record<string, unknown>;
    const key = angleKey(String(o.key ?? o.label ?? ''));
    const label = String(o.label ?? '').trim();
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, color: typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#6B675C', desc: o.desc ? String(o.desc).trim() : undefined });
  }
  return out;
}

/** Lista de ángulos vigente (custom o, si no hay, los default). */
export async function getAngles(): Promise<Angle[]> {
  try {
    const raw = await getSetting(SETTING_KEY);
    if (!raw) return DEFAULT_ANGLES;
    const parsed = sanitize(JSON.parse(raw));
    return parsed.length ? parsed : DEFAULT_ANGLES;
  } catch {
    return DEFAULT_ANGLES;
  }
}

/** Guarda la lista de ángulos (CRUD = editar la lista entera). */
export async function setAngles(list: unknown): Promise<Angle[]> {
  const clean = sanitize(list);
  if (!clean.length) throw new Error('La lista de ángulos no puede quedar vacía.');
  await setSetting(SETTING_KEY, JSON.stringify(clean));
  return clean;
}
