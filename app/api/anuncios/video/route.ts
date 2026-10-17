// =============================================================================
// GET /api/anuncios/video?ad_id=N — el reproductor del video de UN anuncio, para verlo sin salir de la hoja (#860)
// =============================================================================
// Contesta { ok, reproductor, permalink }: `reproductor` es el src del plugin de video de facebook.com (el único que se
// probó que reproduce sin sesión de Facebook y se deja poner en un iframe: lib/anuncio-video.ts dice qué se midió);
// null = el anuncio no tiene video (es de imagen) o Meta no lo dio. `permalink`, para «Verlo en Facebook».
//
// QUIÉN: la misma puerta que /api/ad-insights (`guardAdsWs`: quien administra el workspace), con el token DEL workspace.
// No escribe nada. El fallo de Meta viene ADENTRO del cuerpo (AGENTS.md: `res.ok` no es «salió bien»).
// =============================================================================

import type { NextRequest } from 'next/server';
import { credWs, integracionConectada } from '@/lib/credenciales';
import { guardAdsWs } from '@/lib/ads-guard';
import { srcDelReproductor, videoDelCreativo } from '@/lib/anuncio-video';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';
const TOPE_MS = 15_000;

export async function GET(req: NextRequest) {
  const no = await guardAdsWs();
  if (no) return no;
  const adId = req.nextUrl.searchParams.get('ad_id');
  if (!adId || !/^\d{5,25}$/.test(adId)) return Response.json({ ok: false, error: 'ad_id inválido' }, { status: 400 });
  if (!(await integracionConectada('meta'))) return Response.json({ ok: true, reproductor: null, permalink: null });

  const ver = process.env.META_API_VERSION;
  const token = await credWs('META_ACCESS_TOKEN'); // el del workspace actual
  if (!ver || !token) return Response.json({ ok: false, error: 'Meta no configurado' }, { status: 500 });

  const leer = async (path: string, fields: string): Promise<Record<string, unknown>> => {
    const u = new URL(`${GRAPH}/${ver}/${path}`);
    u.searchParams.set('fields', fields);
    u.searchParams.set('access_token', token);
    const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(TOPE_MS) });
    const b = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) throw new Error('Meta no contestó');
    const e = b.error as { message?: string } | undefined;
    if (e) throw new Error(e.message ?? 'Meta devolvió un error');
    return b;
  };

  try {
    const ad = await leer(adId, 'creative{video_id,object_story_spec}');
    const video = videoDelCreativo(ad.creative);
    if (!video) return Response.json({ ok: true, reproductor: null, permalink: null });
    const v = await leer(video, 'embed_html,permalink_url');
    const p = typeof v.permalink_url === 'string' ? v.permalink_url : null;
    const permalink = p ? (p.startsWith('http') ? p : `https://www.facebook.com${p}`) : null;
    return Response.json({ ok: true, reproductor: srcDelReproductor(v.embed_html), permalink });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
