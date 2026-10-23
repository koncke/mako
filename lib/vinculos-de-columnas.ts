// =============================================================================
// Qué etapas de un CRM ya tienen su vínculo: el evento de una de reunión y el cobro de Ganado (22/10/2026)
// =============================================================================
// Martín, 22/10/2026: «una etapa de tipo Reunión sin evento vinculado muestra un warning en el ⋯ de la columna y en el
// botón "Vincular evento". Lo mismo una etapa Ganado sin cobro». El tablero (app/crm/page.tsx) lo pide en su primera ola:
// son lecturas de la base (los vínculos, y qué pasarelas tienen sus claves cargadas), nunca la API de Calendly, Cal.com,
// Stripe ni Mercado Pago (eso es lo lento del pop-up). Ganado «cobra» si algún vínculo tiene una cuenta todavía
// conectada (`cobraDeVerdad`).
// Nunca tira: sin poder leer, `null`, y la pantalla no avisa nada (un aviso que miente es peor que ninguno).
// =============================================================================

import { leerVinculos } from '@/lib/agenda-evento-etapa-server';
import { vinculosDeEtapa } from '@/lib/cobro-etapa-server';
import { cuentasDePasarelas } from '@/lib/cobro-etapa';
import { pasarelasConectadas } from '@/lib/cobros';
import { getWorkspaceActual } from '@/lib/workspace';

import { cobraDeVerdad, type VinculadosDelCrm } from '@/lib/vinculos-de-columnas-reglas';
export type { VinculadosDelCrm };

export async function vinculadosDelCrm(funnelId: number | null): Promise<VinculadosDelCrm | null> {
  if (funnelId == null) return null;
  try {
    const [{ vinculos }, cobros, conectadas] = await Promise.all([
      leerVinculos(), vinculosDeEtapa(funnelId, 'ganado'),
      getWorkspaceActual().then((ws) => { if (ws == null) throw new Error('sin negocio'); return pasarelasConectadas(ws); }).then(cuentasDePasarelas),
    ]);
    return {
      eventos: [...new Set(vinculos.filter((v) => v.funnelId === funnelId).map((v) => v.etapa))],
      cobro: cobraDeVerdad(cobros, conectadas),
    };
  } catch {
    return null;
  }
}
