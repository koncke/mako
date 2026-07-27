// =============================================================================
// GET /api/compartido/archivo?t=<token>&id=<assetId>&v=thumb|full
// =============================================================================
// Sirve una pieza a alguien SIN LOGIN, validando el link compartido en CADA
// request. Dos decisiones deliberadas:
//
// 1. Las miniaturas se PROXEAN (no se devuelve URL firmada). Una URL firmada es
//    un bearer desligado del share: quien la copie la usa hasta que venza y
//    revocar el link NO la invalida. Proxeando, revocar corta al instante.
// 2. La descarga del original sí redirige a una URL firmada de 120 s, porque
//    son archivos de hasta 17 MB y no tiene sentido pasarlos por la función.
//
// El id SIEMPRE se valida contra el alcance del share con puedeVer() antes de
// firmar o leer nada: si no, un link acotado a una pieza bajaría las 179.

import { NextResponse, type NextRequest } from 'next/server';
import { getAssetDeWorkspace, leerBinario, urlDescarga } from '@/lib/branding';
import { resolverToken, puedeVer } from '@/lib/shares';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO = () => NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') || '';
  const id = req.nextUrl.searchParams.get('id') || '';
  const vista = req.nextUrl.searchParams.get('v') === 'thumb' ? 'thumb' : 'full';
  if (!t || !id) return NO();

  try {
    const acceso = await resolverToken(t);
    if (!acceso) return NO();                                   // no existe / revocado / vencido

    const asset = await getAssetDeWorkspace(acceso.share.workspace_id, id);
    if (!asset) return NO();
    if (!puedeVer(acceso.share, asset)) return NO();            // fuera del alcance: 404, igual que si no existiera

    if (vista === 'thumb') {
      const path = asset.thumb_path || asset.storage_path;
      const bin = await leerBinario(path);
      if (!bin) return NO();
      return new NextResponse(new Uint8Array(bin.buf), {
        status: 200,
        headers: {
          'Content-Type': bin.mime,
          // Privado y corto: si se revoca el link, el navegador vuelve a preguntar.
          'Cache-Control': 'private, max-age=60',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    const url = await urlDescarga(asset.storage_path, asset.archivo);
    if (!url) return NO();
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch {
    return NO();
  }
}
