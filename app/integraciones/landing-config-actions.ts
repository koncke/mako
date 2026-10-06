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
import { mirarLanding } from '@/lib/landing-vigilancia';
import { urlsDe } from '@/lib/landing-config';
import { type Cambios } from '@/lib/landing-snapshot';
import { PAGINAS_KEY, parsearPaginas } from '@/lib/landing-paginas';
import { getOrCreateLandingToken, landingSnippet } from '@/lib/landing-token';
import { clarityProjectId } from '@/lib/clarity';
import { getWorkspaceActual } from '@/lib/workspace';
import { productosAsignables, type ProductoAsignable } from '@/lib/landing-funnel';

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

/**
 * Los productos que se le pueden asignar a una landing.
 *
 * Sale de `lib/landing-funnel.ts`, el MISMO modulo que usa la ruta del opt-in
 * para resolver a que CRM entra el lead: con dos lectores, la pantalla podria
 * ofrecer un producto al que el lead nunca llega.
 */
export async function getProductosAction(): Promise<ProductoAsignable[]> {
  try {
    await requireRolWs([], { nav: 'integraciones' });
    return await productosAsignables();
  } catch {
    return [];
  }
}

/**
 * Agrega o actualiza una landing. `anterior` convierte «guardar» en «editar».
 *
 * ⚠️ `funnelIds` sigue la misma regla que `clarityProjectId`: ausente es «no los
 * toques», y lo que DESASIGNA es la lista VACIA. Sin eso, corregirle la URL a una
 * landing le borraria los productos, porque `conLanding` reconstruye la fila campo
 * por campo.
 */
export async function guardarLandingAction(
  url: string,
  parcial: { clarityProjectId?: string; funnelIds?: number[] } = {},
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
  /**
   * Qué cambió en la página desde la última vez que la miramos.
   *
   * Viene vacío cuando no hay con qué comparar (primera lectura) y TAMBIÉN
   * cuando esta lectura falló: un timeout no puede producir «te sacaron el
   * video». La decisión vive en `mirarLanding`, no acá.
   */
  cambios: Cambios;
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
  // ⚠️ ACÁ SE RECUERDA LO QUE SE VIO, y por eso el análisis pasa por
  // `mirarLanding` y no por `analizarLanding` a secas. Es el único momento en
  // que alguien mira la página a pedido; si el resultado se tira, MaKo no tiene
  // con qué contestar «desde tu última prueba agregaste un video».
  //
  // La poda va con las URLs que el workspace declara HOY: una landing que el
  // cliente borró no tiene por qué seguir ocupando lugar en el snapshot.
  const { analisis: a, cambios } = await mirarLanding(url, urlsDe(guardadas));
  return {
    ok: a.ok,
    error: a.error,
    piezas: [...a.piezas],
    tokenPixel: a.tokenPixel,
    versionPixel: a.versionPixel,
    clarityProjectId: a.clarityProjectId,
    clarityGuardado: landingDe(guardadas, url)?.clarityProjectId ?? null,
    // `pieza` es la del catálogo de hosts (`video-wistia`, `video-drive`…); viaja
    // como `tipo` porque es el nombre con el que ya cruzaba al cliente, y ahí solo
    // se usan el id y la URL.
    videos: a.videos.map((v) => ({ id: v.id, url: v.url, tipo: v.pieza })),
    cambios,
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
