// =============================================================================
// GET /api/anuncios/video?ad_id=N — el reproductor del video de UN anuncio, para verlo sin salir de la hoja (#860)
// =============================================================================
// Contesta { ok, reproductor, video, permalink }: `reproductor` es el src del plugin de video de facebook.com (por el token de
// Meta: lib/anuncio-video.ts dice qué se midió); `video`, el .mp4 directo del anuncio (por la Zernio del negocio, 18/11/2026, O8);
// los dos null = el anuncio no tiene video (es de imagen) o Meta no lo dio. `permalink`, para «Verlo en Facebook».
//
// QUIÉN: la misma puerta que /api/ad-insights (`guardAdsWs`: quien administra el workspace), con la conexión DEL workspace por
// donde le corresponde (`canalMeta`, lib/anuncio-video-leer.ts). No escribe nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { guardAdsWs } from '@/lib/ads-guard';
import { videoDeAnuncio } from '@/lib/anuncio-video-leer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const no = await guardAdsWs();
  if (no) return no;
  const adId = req.nextUrl.searchParams.get('ad_id');
  if (!adId || !/^\d{5,25}$/.test(adId)) return Response.json({ ok: false, error: 'ad_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await videoDeAnuncio(adId)) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
