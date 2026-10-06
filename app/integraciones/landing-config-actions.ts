'use server';

// =============================================================================
// Las landings del workspace, cada una con SU configuración
// =============================================================================
// La decisión (normalizar, deduplicar, migrar el formato viejo, no pisar la
// config al renombrar) vive en `lib/landing-config.ts`, sin `server-only`, para
// poder testearla. Acá queda el acceso al setting, el analizador y el gate.

import { revalidatePath } from 'next/cache';
import { getSetting, setSetting } from '@/lib/settings';
import { REPLAY_CONFIG_KEY, parsearReplay } from '@/lib/replay-contrato';
import { requireRolWs } from '@/lib/tab-access';
import { CONFIG_KEY, conLanding, landingDe, sinLanding, type LandingConfig } from '@/lib/landing-config';
import { mirarLanding } from '@/lib/landing-vigilancia';
import { urlsDe } from '@/lib/landing-config';
import { type Cambios } from '@/lib/landing-snapshot';
import { landingsDelWorkspace } from '@/lib/landing-config-leer';
import { getOrCreateLandingToken, landingSnippet } from '@/lib/landing-token';
import { getWorkspaceActual } from '@/lib/workspace';
import { programarAnalisisDeclaradas } from '@/lib/landing-analyst-auto';

export type LandingsResult = { ok: true; landings: LandingConfig[] } | { ok: false; error: string };

async function leer(): Promise<LandingConfig[]> {
  await requireRolWs([], { nav: 'integraciones' });
  return landingsDelWorkspace();
}

// ⚠️ ACÁ HABÍA DOS ACTIONS DE LECTURA —`getLandingsAction` y `getProductosAction`—
// y se fueron el 06/10/2026 junto con su único motivo: el paso 1 y el paso 2 del
// Pixel las pedían al montarse, y como Next despacha las server actions DE A UNA,
// eran tres viajes en serie antes de la primera casilla. Ahora las dos listas las
// resuelve el server en `app/integraciones/page.tsx` y bajan por props. Lo que
// queda acá son las ESCRITURAS, que son lo único que de verdad tiene que ser una
// action. Si algo vuelve a necesitar leerlas desde el navegador, la pregunta es
// por qué no le llegan por props.

/**
 * Agrega o actualiza una landing. `anterior` convierte «guardar» en «editar».
 *
 * ⚠️ `funnelIds` ausente es «no los toques», y lo que DESASIGNA es la lista
 * VACIA. Sin eso, corregirle la URL a una
 * landing le borraria los productos, porque `conLanding` reconstruye la fila campo
 * por campo.
 */
export async function guardarLandingAction(
  url: string,
  parcial: { funnelIds?: number[] } = {},
  anterior?: string | null,
): Promise<LandingsResult> {
  try {
    const nuevas = conLanding(await leer(), url, parcial, anterior);
    if (!nuevas) return { ok: false, error: 'Esa dirección no parece una página web.' };
    await setSetting(CONFIG_KEY, JSON.stringify(nuevas));
    // Una página nueva en el Pixel se analiza sola, por detrás (pedido de Martín,
    // 06/10/2026). Es un cálculo —las declaradas sin análisis—, así que guardar los
    // productos de una página que ya está no dispara nada.
    await programarAnalisisDeclaradas();
    revalidatePath('/integraciones');
    return { ok: true, landings: nuevas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Prende o apaga la grabación de las visitas, para TODO el negocio.
 *
 * ⚠️ HASTA EL 06/10/2026 NO EXISTÍA, y estaba prometido: la v21 del Pixel le
 * anunció a cada cliente por WhatsApp que la grabación «llega APAGADA: se prende
 * una vez desde la app», y la única forma de prenderla era escribir el setting a
 * mano en la base. Con Clarity fuera del producto, este interruptor es lo que
 * reemplaza a «conectar Clarity»: sin él, ningún negocio podía tener grabaciones.
 *
 * ⚠️ ES DEL NEGOCIO, NO DE LA PÁGINA, a propósito y está escrito en el contrato
 * (lib/replay-contrato.ts): grabar personas es una decisión de quien tiene la
 * relación con ellas, y una por página permitiría prenderla en una sin darse cuenta.
 *
 * Se conserva el resto de la configuración (muestreo, retención): se lee, se toca
 * SOLO `activo` y se escribe entera. Un `{activo}` pelado borraría la retención que
 * alguien eligió, porque `parsearReplay` la volvería al default.
 */
export async function guardarGrabacionAction(activo: boolean): Promise<{ ok: true; activo: boolean } | { ok: false; error: string }> {
  try {
    await requireRolWs([], { nav: 'integraciones' });
    const actual = parsearReplay(await getSetting(REPLAY_CONFIG_KEY));
    const nueva = { ...actual, activo: activo === true };
    await setSetting(REPLAY_CONFIG_KEY, JSON.stringify(nueva));
    revalidatePath('/integraciones');
    return { ok: true, activo: nueva.activo };
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
    // `pieza` es la del catálogo de hosts (`video-wistia`, `video-drive`…); viaja
    // como `tipo` porque es el nombre con el que ya cruzaba al cliente, y ahí solo
    // se usan el id y la URL.
    videos: a.videos.map((v) => ({ id: v.id, url: v.url, tipo: v.pieza })),
    cambios,
  };
}

// ⚠️ ACÁ VIVÍA `snippetDeLandingAction`, el código a copiar POR PÁGINA, y se fue el
// 06/10/2026 con Clarity: lo único que cambiaba de una página a otra era el
// proyecto de Clarity que viajaba adentro. Sin eso, el código es el mismo para
// todas las páginas del negocio y lo resuelve el server en `page.tsx` — pedirlo
// por action era un viaje más en la cola serial de las server actions.
