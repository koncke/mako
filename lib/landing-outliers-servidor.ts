// =============================================================================
// Los outliers de landings, leídos en el server: la competencia que el negocio sigue en Spy + el relevo (11/11/2026)
// =============================================================================
// El contrato y las reglas están en ./landing-outliers.ts. Copiado de ./video-outliers-servidor.ts: cada fuente se lee sola, y la
// que falla vuelve su motivo sin tapar a las otras.
//
// La imagen de una landing de Spy es la que la MISMA página publica para compartirse (`og:image`): la que WhatsApp o Facebook
// muestran de ella. Se pide con tope de tiempo y queda en la caché de Next un día. Del mismo pedido salen su titular y su bajada
// (11/11/2026: la tarjeta decía «lp.acquisition.com» sobre un cuadro gris): sin imagen, la tarjeta dibuja la página con ellos.
// =============================================================================

import 'server-only';
import { unstable_cache } from 'next/cache';
import { getTenantDb } from './workspace';
import { htmlDePagina } from './landing-fetch';
import {
  RELEVO_LANDINGS, cabeceraDePagina, esLinkEnBio, hostDeLanding, ogImagenDe, unirOutliers, urlLimpia,
  type CaidaLandings, type OutlierLanding, type PortadaLandings,
} from './landing-outliers';

const TOPE_COMPETIDORES = 30;
const PLAZO_IMAGEN_MS = 3500;

type Cabecera = { imagen: string | null; titulo: string | null; bajada: string | null };
const SIN_CABECERA: Cabecera = { imagen: null, titulo: null, bajada: null };

/**
 * Lo que la página publica para compartirse (su imagen, su titular y su bajada), por el pedido con barandas de ./landing-fetch.ts
 * (la URL la escribió una persona en Spy: sólo IP públicas, redirecciones revalidadas, tope de tamaño). Un día en caché por URL;
 * con tope de tiempo, para que la portada no espere a una página lenta.
 */
const cabeceraEnCache = (url: string) => unstable_cache(async (): Promise<Cabecera> => {
  const html = (await htmlDePagina(url, { talCual: true })).slice(0, 300_000);
  return { imagen: ogImagenDe(html, url), ...cabeceraDePagina(html) };
}, ['landing-outlier-cabecera', url], { revalidate: 86_400 })();

async function cabeceraDe(url: string): Promise<Cabecera> {
  try {
    return await Promise.race([
      cabeceraEnCache(url),
      new Promise<Cabecera>((r) => setTimeout(() => r(SIN_CABECERA), PLAZO_IMAGEN_MS)),
    ]);
  } catch { return SIN_CABECERA; }
}

/** Las landings de los competidores que el negocio sigue en Spy (sin las de «link en la bio», que no son landings). */
export async function leerLandingsDeSpy(): Promise<{ ok: true; outliers: OutlierLanding[] } | { ok: false; motivo: string }> {
  const db = await getTenantDb();
  const r = await db.from('spy_competidores').select('id, nombre, landing_url').not('landing_url', 'is', null).limit(TOPE_COMPETIDORES);
  if (r.error) return { ok: false, motivo: r.error.message.slice(0, 200) };
  const filas = ((r.data ?? []) as { id: number; nombre: string | null; landing_url: string | null }[])
    .filter((f) => f.landing_url && /^https?:\/\//i.test(f.landing_url) && !esLinkEnBio(f.landing_url));
  const outliers = await Promise.all(filas.map(async (f): Promise<OutlierLanding> => {
    const url = urlLimpia(f.landing_url as string);
    const nombre = (f.nombre ?? '').trim() || hostDeLanding(url);
    const c = await cabeceraDe(url);
    return {
      id: `spy:${f.id}`, fuente: 'spy', url, titulo: c.titulo ?? hostDeLanding(url), quien: { nombre, nicho: null, competidorId: f.id },
      tipo: 'sitio', porque: null, imagen: c.imagen, bajada: c.bajada, idioma: 'es',
    };
  }));
  return { ok: true, outliers };
}

export async function leerOutliersLandings(): Promise<PortadaLandings> {
  const caidas: CaidaLandings[] = [];
  let spy: OutlierLanding[] = [];
  try {
    const r = await leerLandingsDeSpy();
    if (r.ok) spy = r.outliers;
    else caidas.push({ fuente: 'spy', nombre: 'tu competencia en Competitors Spy', motivo: r.motivo });
  } catch (e) {
    caidas.push({ fuente: 'spy', nombre: 'tu competencia en Competitors Spy', motivo: e instanceof Error && e.message ? e.message.slice(0, 200) : 'No respondió.' });
  }
  return { outliers: unirOutliers(spy, RELEVO_LANDINGS), caidas };
}
