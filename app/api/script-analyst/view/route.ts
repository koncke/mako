// =============================================================================
// GET /api/script-analyst/view?ad_id=... — UNA ScriptView por anuncio
// =============================================================================
// La usa la pestaña "Guion" de la vista de detalle unificada cuando se abre
// desde Ads Manager (que tiene el SenalRecon pero no la ScriptView). Devuelve
// { ok, view: ScriptView | null } — null = el anuncio no está analizado todavía.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getScriptView } from '@/lib/script-analyst';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get('ad_id')?.trim() ?? '';
  if (!adId) {
    return Response.json({ ok: false, error: 'ad_id requerido' }, { status: 400 });
  }
  try {
    const view = await getScriptView(adId);
    return Response.json({ ok: true, view });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
