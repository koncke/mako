'use server';

// =============================================================================
// Las landings del workspace, cada una con SU configuración
// =============================================================================
// La decisión (normalizar, deduplicar, migrar el formato viejo, no pisar la
// config al renombrar) vive en `lib/landing-config.ts`, sin `server-only`, para
// poder testearla. Acá queda el acceso al setting, el analizador y el gate.

import { revalidatePath } from 'next/cache';
import { getSetting, setSetting } from '@/lib/settings';
import { requireRolWs } from '@/lib/tab-access';
import { CONFIG_KEY, conLanding, landingDe, parsearConfig, sinLanding, type LandingConfig } from '@/lib/landing-config';
import { analizarLanding, type AnalisisLanding } from '@/lib/landing-analisis';
import { PAGINAS_KEY, parsearPaginas } from '@/lib/landing-paginas';
import { getOrCreateLandingToken, landingSnippet } from '@/lib/landing-token';
import { clarityProjectId } from '@/lib/clarity';
import { getWorkspaceActual } from '@/lib/workspace';

export type LandingsResult = { ok: true; landings: LandingConfig[] } | { ok: false; error: string };

async function leer(): Promise<LandingConfig[]> {
  await requireRolWs([], { nav: 'integraciones' });
  const nuevo = parsearConfig(await getSetting(CONFIG_KEY));
  if (nuevo.length) return nuevo;
  // ⚠️ MIGRACIÓN PEREZOSA. Mientras nadie haya guardado en el formato nuevo, se
  // leen las páginas viejas. Así el despliegue no deja a nadie con la lista
  // vacía, y la primera vez que toque algo queda migrado — sin un script que
  // haya que acordarse de correr, que es como se migran a medias las cosas.
  return parsearConfig(JSON.stringify(parsearPaginas(await getSetting(PAGINAS_KEY))));
}

export async function getLandingsAction(): Promise<LandingConfig[]> {
  return leer().catch(() => []);
}

/** Agrega o actualiza una landing. `anterior` convierte «guardar» en «editar». */
export async function guardarLandingAction(
  url: string,
  parcial: { clarityProjectId?: string } = {},
  anterior?: string | null,
): Promise<LandingsResult> {
  try {
    const nuevas = conLanding(await leer(), url, parcial, anterior);
    if (!nuevas) return { ok: false, error: 'Esa dirección no parece una página web.' };
    await setSetting(CONFIG_KEY, JSON.stringify(nuevas));
    revalidatePath('/integraciones');
    return { ok: true, landings: nuevas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

export async function borrarLandingAction(url: string): Promise<LandingsResult> {
  try {
    const nuevas = sinLanding(await leer(), url);
    await setSetting(CONFIG_KEY, JSON.stringify(nuevas));
    revalidatePath('/integraciones');
    return { ok: true, landings: nuevas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo borrar.' };
  }
}

export type AnalisisResult = {
  ok: boolean;
  error: string | null;
  piezas: string[];
  tokenPixel: string | null;
  versionPixel: number | null;
  clarityProjectId: string | null;
  /** El proyecto que ESTA landing tiene declarado en MaKo, para poder comparar. */
  clarityGuardado: string | null;
  /** Los videos que la PÁGINA tiene, con su URL. Es lo que permite verlos sin
   *  esperar a que un visitante reproduzca uno. */
  videos: Array<{ id: string; url: string; tipo: string }>;
};

/**
 * Analiza UNA landing para armar los pasos de su prueba.
 *
 * ⚠️ El `Set` no sobrevive a un server action —se serializa como `{}`— así que
 * las piezas viajan como array. Es el tipo de detalle que en desarrollo no se ve
 * y en producción deja la lista vacía sin ningún error.
 */
export async function analizarLandingAction(url: string): Promise<AnalisisResult> {
  await requireRolWs([], { nav: 'integraciones' });
  const guardadas = await leer().catch(() => [] as LandingConfig[]);
  const a: AnalisisLanding = await analizarLanding(url);
  return {
    ok: a.ok,
    error: a.error,
    piezas: [...a.piezas],
    tokenPixel: a.tokenPixel,
    versionPixel: a.versionPixel,
    clarityProjectId: a.clarityProjectId,
    clarityGuardado: landingDe(guardadas, url)?.clarityProjectId ?? null,
    videos: a.videos.map((v) => ({ id: v.id, url: v.url, tipo: v.tipo })),
  };
}

/**
 * El código a copiar para UNA landing.
 *
 * ⚠️ El snippet NO es del workspace: es de la página. Lo que cambia es el bloque
 * de Clarity, y cambia porque un proyecto de Clarity es por SITIO — dos landings
 * del mismo cliente son dos proyectos, y emitir el mismo id en las dos mezcla las
 * grabaciones de ambas en una sola lista donde ya no se sabe cuál es cuál.
 *
 * El id de la landing gana sobre el del workspace; sin id propio, hereda. La
 * herencia es a propósito: el caso normal es una sola página, y ahí pedir que se
 * configure dos veces lo mismo es pedir el error.
 */
export async function snippetDeLandingAction(url: string | null): Promise<string | null> {
  await requireRolWs([], { nav: 'integraciones' });
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  const propio = url ? (await leer().catch(() => [] as LandingConfig[]).then((l) => landingDe(l, url)?.clarityProjectId ?? null)) : null;
  const pid = propio ?? (await clarityProjectId(ws).catch(() => null));
  return landingSnippet(await getOrCreateLandingToken(ws), pid);
}
