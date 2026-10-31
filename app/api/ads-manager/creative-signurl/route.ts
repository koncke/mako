// =============================================================================
// POST /api/ads-manager/creative-signurl — URL firmada para subir un creativo
// =============================================================================
// El navegador sube el archivo DIRECTO a Supabase Storage (esquivando el límite de body del serverless de Vercel, ~4.5MB).
// Esta ruta crea la URL firmada de subida (y el bucket si falta). Body: { filename, content_type } → { ok, path, signedUrl }.
// Lo usa «Subir creativos» del Media Buyer (app/ads-manager/creativeUpload.ts → subirAlStaging): el servidor le da a Zernio
// una URL firmada del archivo (lib/media-buyer/subir.ts).
//
// ⚠️ Es la ÚNICA ruta que queda de app/api/ads-manager (27/10/2026): las otras quince eran del Ads Manager que se borró el
// 25/10 y no las llamaba ninguna pantalla. Con ellas se fue `creative-upload`, que era la que BARRÍA el staging en cada
// subida: el barrido vino acá (`barrerStagingViejo`, en `after()`), porque cada subida empieza firmando. Sin él, nada más
// limpia ese bucket (lib/ads-staging.ts). La firma y el barrido viven en lib/ads-staging-firma.ts: los usa también la API de
// MaKo (`preparar_subida_media_buyer`).
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { guardAdsWs } from '@/lib/ads-guard';
import { barrerStagingViejo, firmarSubidaDeStaging } from '@/lib/ads-staging-firma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Fase 1: firmar la subida es el primer paso del tooling de creativos que
  // termina empujando a la cuenta de Meta global del dueño.
  const no = await guardAdsWs(); if (no) return no;

  let body: { filename?: string; content_type?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    // El formato del nombre vive en lib/ads-staging.ts: el barrido lee la hora del nombre. La firma, en lib/ads-staging-firma.ts
    // (la misma que usa la API de MaKo).
    const r = await firmarSubidaDeStaging(String(body.filename ?? 'creativo'), { crearBucket: true });
    if (!r.ok) return Response.json(r, { status: 500 });
    after(() => barrerStagingViejo());
    return Response.json(r);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-manager:creative-signurl] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
