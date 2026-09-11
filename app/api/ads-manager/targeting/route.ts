// =============================================================================
// GET /api/ads-manager/targeting — pickers de segmentación (desde Meta)
// =============================================================================
// ?kind=audiences            → públicos personalizados (retargeting incluir/excluir)
// ?kind=interests&q=<texto>  → intereses con su id real (los que Meta acepta)
// ?kind=leadforms            → formularios instantáneos existentes (lead ads)
// ?kind=lugares&q=<texto>&pais=<ISO-2> → país, provincia, ciudad, CP, barrio, localidad,
//                              partido o DMA — el buscador de Ads Manager
// ?kind=alcance&geo=<json>   → { min, max, frase } de { geo_locations,
//                              excluded_geo_locations }. VALIDA: un choque o un
//                              radio inválido vuelve con rechazoGeo:true
// ?kind=cuenta               → { currency, country } de la cuenta: lo que la UI
//                              necesita para no adivinar moneda ni país
// =============================================================================

import type { NextRequest } from 'next/server';
import { guardAdsWs } from '@/lib/ads-guard';
import { listCustomAudiences, searchInterests, listLeadForms, listCustomConversions, listPixels, listPixelEvents, searchLugares, alcanceGeo, cuentaMeta, metaErrorEnvelope } from '@/lib/meta-ads-create';
import { explicarErrorGeo } from '@/lib/meta-geo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Lee la cuenta de Meta GLOBAL del dueño (env) → solo el dueño, como sus hermanos.
  // Sin esto, un cliente logueado de otro workspace veía públicos/formularios/
  // pixeles/conversiones de la agencia.
  const no = await guardAdsWs(); if (no) return no;
  const kind = req.nextUrl.searchParams.get('kind');
  const q = req.nextUrl.searchParams.get('q') ?? '';
  try {
    if (kind === 'audiences') return Response.json({ ok: true, items: await listCustomAudiences() });
    if (kind === 'interests') return Response.json({ ok: true, items: await searchInterests(q) });
    if (kind === 'leadforms') return Response.json({ ok: true, items: await listLeadForms() });
    if (kind === 'conversions') return Response.json({ ok: true, items: await listCustomConversions() });
    if (kind === 'pixels') return Response.json({ ok: true, items: await listPixels() });
    if (kind === 'pixelevents') return Response.json({ ok: true, items: await listPixelEvents(req.nextUrl.searchParams.get('pixel') ?? '') });
    // `pais` = ISO-2 de la cuenta: sus lugares van primero (ver searchLugares).
    if (kind === 'lugares') return Response.json({ ok: true, items: await searchLugares(q, (req.nextUrl.searchParams.get('pais') ?? '').toUpperCase() || null) });
    if (kind === 'alcance') {
      let geo: unknown;
      try { geo = JSON.parse(req.nextUrl.searchParams.get('geo') ?? ''); } catch { geo = null; }
      if (!geo || typeof geo !== 'object') return Response.json({ ok: false, error: 'geo inválido' }, { status: 400 });
      return Response.json({ ok: true, alcance: await alcanceGeo(geo as Parameters<typeof alcanceGeo>[0]) });
    }
    if (kind === 'cuenta') return Response.json({ ok: true, cuenta: await cuentaMeta() });
    return Response.json({ ok: false, error: 'kind inválido (audiences | interests | leadforms | conversions | pixels | pixelevents | lugares | alcance | cuenta)' }, { status: 400 });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:targeting] ${env.message}`);
    // Un rechazo de SEGMENTACIÓN (lugares que se pisan, radio fuera de rango) no es
    // una falla del servidor: es algo que el usuario corrige. Se marca aparte para
    // que la pantalla bloquee por eso y no por un 403 o un corte de red.
    const geo = explicarErrorGeo(env.error_subcode);
    return Response.json({ ok: false, error: geo ?? env.message, code: env.code, error_subcode: env.error_subcode, rechazoGeo: !!geo }, { status: geo ? 400 : env.status });
  }
}
