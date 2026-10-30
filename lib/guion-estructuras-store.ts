// =============================================================================
// guion-estructuras-store — override editable del catálogo de estructuras
// =============================================================================
// Mismo patrón que guion-angulos-store: el catálogo es GLOBAL de la plataforma,
// el override del super-admin vive en los settings del OWNER_WS y pisa por
// completo los defaults de lib/guion-estructuras.ts, salvo las de reel y story de
// fábrica que no conoce (`conLasDeOrganicoNuevas`, 28/10/2026).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS } from './workspace';
import { ESTRUCTURAS_GUION_DEFAULT, normalizarEstructurasGuion, soloDeAnuncios, type EstructuraGuion } from './guion-estructuras';

const KEY = 'mako.guion_estructuras';

/**
 * Las de ANUNCIOS (las que ve el Ads Writer, su API y el estructurador de guiones pegados): las de reel y story del
 * Copywriter no se le ofrecen a un anuncio. Desde el 28/10/2026; antes eran todas, y todas eran de anuncios.
 */
export async function getEstructurasGuion(): Promise<EstructuraGuion[]> {
  return soloDeAnuncios(await getEstructurasTodas());
}

/** TODA la biblioteca (anuncios, reels y stories): la del Copywriter, con el override guardado (su pantalla de edición se fue el 29/10/2026). */
export async function getEstructurasTodas(): Promise<EstructuraGuion[]> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSetting(KEY));
  if (!raw) return ESTRUCTURAS_GUION_DEFAULT;
  try {
    const parsed = normalizarEstructurasGuion(JSON.parse(raw));
    return parsed.length ? conLasDeOrganicoNuevas(parsed) : ESTRUCTURAS_GUION_DEFAULT;
  } catch { return ESTRUCTURAS_GUION_DEFAULT; }
}

/**
 * Las de reel y story de fábrica (28/10/2026, el Copywriter) que un override GUARDADO ANTES no conoce, al final. Sin esto,
 * un negocio con la biblioteca editada no veía nunca las estructuras nuevas: el override pisa todo. Las de anuncios no
 * se suman (el super admin pudo haber borrado una a propósito). Para sacar una de orgánico, se APAGA (`activo: false`):
 * guardada así, el override ya la conoce y no vuelve.
 */
function conLasDeOrganicoNuevas(guardadas: EstructuraGuion[]): EstructuraGuion[] {
  const ids = new Set(guardadas.map((e) => e.id));
  return [...guardadas, ...ESTRUCTURAS_GUION_DEFAULT.filter((d) => d.tipos?.length && !d.tipos.includes('ad') && !ids.has(d.id))];
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
