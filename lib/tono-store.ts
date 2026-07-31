// =============================================================================
// tono-store — persistencia del tono/personalidad (por workspace)
// =============================================================================
// Patrón fase-store.ts: la data pura vive en lib/tono.ts (la consume el wizard
// en el browser); acá solo la lectura/escritura server-side sobre app_settings.

import 'server-only';
import { getSetting, setSetting } from './settings';
import { normalizarTono, tonoTexto, TONO_VACIO, type Tono } from './tono';

const KEY = 'mako.tono';

export async function getTono(): Promise<Tono> {
  const raw = await getSetting(KEY);
  if (!raw) return TONO_VACIO;
  try { return normalizarTono(JSON.parse(raw)); } catch { return TONO_VACIO; }
}

export async function setTono(t: unknown): Promise<Tono> {
  const limpio = normalizarTono(t);
  await setSetting(KEY, JSON.stringify(limpio));
  return limpio;
}

/** El tono listo para inyectar en un prompt ('' si no está definido). */
export async function tonoNegocioTexto(): Promise<string> {
  return tonoTexto(await getTono());
}
