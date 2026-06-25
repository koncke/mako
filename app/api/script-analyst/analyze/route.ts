// =============================================================================
// POST /api/script-analyst/analyze — re-analiza el guion de UN anuncio
// =============================================================================
// Body: { ad_id }. Vuelve a correr Claude sobre el transcript de ese anuncio y
// pisa su fila en script_analyses. Lo usa el botón "Re-analizar" del detalle.
// =============================================================================

import type { NextRequest } from 'next/server';
import { analyzeOne } from '@/lib/script-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { ad_id?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const adId = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
  if (!adId) {
    return Response.json({ ok: false, error: 'ad_id requerido' }, { status: 400 });
  }

  try {
    const status = await analyzeOne(adId);
    console.log(`[script-analyst:analyze] ad_id=${adId} status=${status}`);
    return Response.json({ ok: true, ad_id: adId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[script-analyst:analyze] error ad_id=${adId}: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
