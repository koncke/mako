// =============================================================================
// GET /api/ads-analyst/quadrant?dias=N — puntos del cuadrante por ventana
// =============================================================================
// Filtro de fecha PROPIO del gráfico (no de toda la tab): recalcula hook rate y
// retención al CTA de cada guion en los últimos N días. Sin `dias` → histórico
// completo. La puerta es ../puerta.ts (sólo el admin): el middleware sólo pide sesión.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getQuadrantData } from '@/lib/ads-analyst';
import { hoyEnTijuana } from '@/lib/date-utils';
import { soloAdminAdsAnalyst } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** YYYY-MM-DD de hace `dias` días respecto de `hastaIso` (UTC, sin libs). */
function isoNDiasAntes(hastaIso: string, dias: number): string {
  const d = new Date(`${hastaIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const cerrada = await soloAdminAdsAnalyst();
  if (cerrada) return cerrada;
  const dias = Number(req.nextUrl.searchParams.get('dias'));
  try {
    let desde: string | undefined;
    let hasta: string | undefined;
    if (Number.isFinite(dias) && dias > 0) {
      hasta = hoyEnTijuana();
      desde = isoNDiasAntes(hasta, dias);
    }
    const points = await getQuadrantData(desde, hasta);
    return Response.json({ ok: true, dias: desde ? dias : null, desde: desde ?? null, hasta: hasta ?? null, count: points.length, points });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-analyst:quadrant] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
