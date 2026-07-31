// =============================================================================
// guion-angulos-store — override editable del catálogo de ángulos de guion
// =============================================================================
// El catálogo default vive en lib/guion-angulos.ts (datos puros). El super-admin
// lo edita desde /admin: el override es GLOBAL de la plataforma (todos los
// workspaces generan guiones con la misma biblioteca), así que vive en los
// settings del OWNER_WS — igual que la voz de MaKo (mako.voz.instancia).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';
import { ANGULOS_GUION_DEFAULT, normalizarAngulosGuion, type AnguloGuion } from './guion-angulos';

const KEY = 'mako.guion_angulos';

/** El catálogo vigente: el override del super-admin si existe, si no el default. */
export async function getAngulosGuion(): Promise<AnguloGuion[]> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSetting(KEY));
  if (!raw) return ANGULOS_GUION_DEFAULT;
  try {
    const parsed = normalizarAngulosGuion(JSON.parse(raw));
    return parsed.length ? parsed : ANGULOS_GUION_DEFAULT;
  } catch { return ANGULOS_GUION_DEFAULT; }
}

/** Guarda el catálogo completo (el editor de /admin manda la lista entera). */
export async function setAngulosGuion(v: unknown): Promise<AnguloGuion[]> {
  const limpio = normalizarAngulosGuion(v);
  if (!limpio.length) throw new Error('El catálogo no puede quedar vacío.');
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY, JSON.stringify(limpio)));
  return limpio;
}

/** Vuelve al catálogo default (borra el override). */
export async function resetAngulosGuion(): Promise<AnguloGuion[]> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY, ''));
  return ANGULOS_GUION_DEFAULT;
}
