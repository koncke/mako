// =============================================================================
// Los outliers de landings, leídos en el server: la competencia que el negocio sigue en Spy + el relevo (11/11/2026)
// =============================================================================
// El contrato y las reglas están en ./landing-outliers.ts. Copiado de ./video-outliers-servidor.ts: cada fuente se lee sola, y la
// que falla vuelve su motivo sin tapar a las otras.
//
// Una landing de Spy entra con su CAPTURA LARGA (la página entera, mirada antes de entrar: `capturaDe`, el manifiesto de
// ./landing-outliers-capturas.json). Sin captura no entra (11/11/2026, Martín: «viralidad.com, un recuadro negro con un logo» y la
// de Leila Hormozi, «sólo texto», no sirven), y la portada dice cuántas de tu competencia esperan la suya. Hasta ese día se pedía
// la página en cada visita para leer su `og:image`: ya no se pide nada afuera, y la portada no espera a ninguna página lenta.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { esLinkEnBio, unirOutliers, urlLimpia, type CaidaLandings, type OutlierLanding, type PortadaLandings } from './landing-outliers';
import { RELEVO_LANDINGS, capturaDe, imagenLarga } from './landing-outliers-datos';

const TOPE_COMPETIDORES = 60;

/** Las landings de los competidores que el negocio sigue en Spy (sin las de «link en la bio», que no son landings). */
export async function leerLandingsDeSpy(): Promise<{ ok: true; outliers: OutlierLanding[]; sinCaptura: number } | { ok: false; motivo: string }> {
  const db = await getTenantDb();
  const r = await db.from('spy_competidores').select('id, nombre, landing_url').not('landing_url', 'is', null).limit(TOPE_COMPETIDORES);
  if (r.error) return { ok: false, motivo: r.error.message.slice(0, 200) };
  const filas = ((r.data ?? []) as { id: number; nombre: string | null; landing_url: string | null }[])
    .filter((f) => f.landing_url && /^https?:\/\//i.test(f.landing_url) && !esLinkEnBio(f.landing_url));
  const outliers: OutlierLanding[] = [];
  let sinCaptura = 0;
  for (const f of filas) {
    const url = urlLimpia(f.landing_url as string);
    const c = capturaDe(url);
    if (!c) { sinCaptura++; continue; }
    outliers.push({
      id: `spy:${f.id}`, fuente: 'spy', url, titulo: c.titulo,
      quien: { nombre: (f.nombre ?? '').trim() || c.nombre, nicho: null, competidorId: f.id },
      tipo: c.tipo, porque: c.porque, imagen: imagenLarga(c.id), alto: c.alto, idioma: c.idioma,
    });
  }
  return { ok: true, outliers, sinCaptura };
}

export async function leerOutliersLandings(): Promise<PortadaLandings> {
  const caidas: CaidaLandings[] = [];
  let spy: OutlierLanding[] = [];
  let sinCaptura = 0;
  try {
    const r = await leerLandingsDeSpy();
    if (r.ok) { spy = r.outliers; sinCaptura = r.sinCaptura; }
    else caidas.push({ fuente: 'spy', nombre: 'tu competencia en Competitors Spy', motivo: r.motivo });
  } catch (e) {
    caidas.push({ fuente: 'spy', nombre: 'tu competencia en Competitors Spy', motivo: e instanceof Error && e.message ? e.message.slice(0, 200) : 'No respondió.' });
  }
  return { outliers: unirOutliers(spy, RELEVO_LANDINGS), caidas, sinCaptura };
}
