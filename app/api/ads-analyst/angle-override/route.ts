// =============================================================================
// POST /api/ads-analyst/angle-override — corrige a mano el ángulo de un ad
// =============================================================================
// Body: { ad_id, angle }. Escribe angle_override (que sobrevive al re-análisis).
// angle=null (o vacío) limpia el override y vuelve a la clasificación de la IA.
// Lo usa el dropdown de ángulo del detalle (FunnelModal).
// =============================================================================

import type { NextRequest } from 'next/server';
import { setAngleOverride } from '@/lib/ads-analyst';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { ad_id?: string; angle?: string | null };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const adId = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
  if (!adId) {
    return Response.json({ ok: false, error: 'ad_id requerido' }, { status: 400 });
  }
  const angle = typeof body.angle === 'string' && body.angle.trim() ? body.angle.trim() : null;

  try {
    await setAngleOverride(adId, angle);
    console.log(`[ads-analyst:angle-override] ad_id=${adId} angle=${angle ?? '(auto)'}`);
    return Response.json({ ok: true, ad_id: adId, angle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-analyst:angle-override] error ad_id=${adId}: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
