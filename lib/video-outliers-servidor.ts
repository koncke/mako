// =============================================================================
// Los outliers de video: el lector de la portada (server; 9/11/2026)
// =============================================================================
// Junta las FUENTES enchufadas (lib/video-outliers.ts tiene el contrato). Para sumar una: su módulo exporta una
// `FuenteOutliersVideo` y se agrega a `FUENTES_OUTLIERS_VIDEO`. Una fuente que tira no tumba la portada: queda como caída, con
// su motivo, y las demás se dibujan.
// =============================================================================

import 'server-only';
import { FUENTE_MAKO, juntarOutliers, type FuenteOutliersVideo, type LecturaFuente, type PortadaOutliers } from './video-outliers';

/** Las fuentes, en orden. La del chat «Outliers de reels y anuncios» entra acá. */
export const FUENTES_OUTLIERS_VIDEO: readonly FuenteOutliersVideo[] = [FUENTE_MAKO];

export async function leerOutliersVideo(fuentes: readonly FuenteOutliersVideo[] = FUENTES_OUTLIERS_VIDEO): Promise<PortadaOutliers> {
  const lecturas = await Promise.all(fuentes.map(async (fuente) => {
    let lectura: LecturaFuente;
    try { lectura = await fuente.leer(); } catch (e) {
      lectura = { ok: false, motivo: e instanceof Error && e.message ? e.message.slice(0, 200) : 'No respondió.' };
    }
    return { fuente, lectura };
  }));
  return juntarOutliers(lecturas);
}
