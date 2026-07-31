// =============================================================================
// guion-estructuras-store — override editable del catálogo de estructuras
// =============================================================================
// Mismo patrón que guion-angulos-store: el catálogo es GLOBAL de la plataforma,
// el override del super-admin vive en los settings del OWNER_WS y pisa por
// completo los defaults de lib/guion-estructuras.ts.

import 'server-only';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';
import { ESTRUCTURAS_GUION_DEFAULT, normalizarEstructurasGuion, type EstructuraGuion } from './guion-estructuras';

const KEY = 'mako.guion_estructuras';

export async function getEstructurasGuion(): Promise<EstructuraGuion[]> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSetting(KEY));
  if (!raw) return ESTRUCTURAS_GUION_DEFAULT;
  try {
    const parsed = normalizarEstructurasGuion(JSON.parse(raw));
    return parsed.length ? parsed : ESTRUCTURAS_GUION_DEFAULT;
  } catch { return ESTRUCTURAS_GUION_DEFAULT; }
}

export async function setEstructurasGuion(v: unknown): Promise<EstructuraGuion[]> {
  const limpio = normalizarEstructurasGuion(v);
  if (!limpio.length) throw new Error('El catálogo no puede quedar vacío.');
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY, JSON.stringify(limpio)));
  return limpio;
}

export async function resetEstructurasGuion(): Promise<EstructuraGuion[]> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY, ''));
  return ESTRUCTURAS_GUION_DEFAULT;
}
