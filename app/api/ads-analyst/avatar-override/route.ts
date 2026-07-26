// =============================================================================
// POST /api/ads-analyst/avatar-override — corrige a mano el avatar de un ad
// =============================================================================
// Body: { ad_id, avatar }. Escribe avatar_override (sobrevive al re-análisis).
// avatar=null (o vacío) limpia el override y vuelve a la clasificación de la IA.
// =============================================================================

import type { NextRequest } from 'next/server';
import { setAvatarOverride } from '@/lib/ads-analyst';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { ad_id?: string; avatar?: string | null };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const adId = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
  if (!adId) {
    return Response.json({ ok: false, error: 'ad_id requerido' }, { status: 400 });
  }
  const avatar = typeof body.avatar === 'string' && body.avatar.trim() ? body.avatar.trim() : null;

  try {
    await setAvatarOverride(adId, avatar);
    console.log(`[ads-analyst:avatar-override] ad_id=${adId} avatar=${avatar ?? '(auto)'}`);
    return Response.json({ ok: true, ad_id: adId, avatar });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-analyst:avatar-override] error ad_id=${adId}: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
