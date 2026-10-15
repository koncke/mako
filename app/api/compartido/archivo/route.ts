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
// El id SIEMPRE se valida contra el share con puedeVerAsset() antes de firmar o
// leer nada: si no, un link acotado a una pieza bajaría las 179.
//
// ⚠️ Y EL RECURSO ANTES QUE EL ALCANCE (auditoría 14/10/2026). Hasta esa fecha
// se preguntaba sólo `puedeVer`, que con alcance 'todo' dice que sí sin mirar de
// qué es el share: el link público de Conocimientos —'todo', y se reparte a
// cualquiera— bajaba por id las piezas de la galería de marca. Sólo un share de
// marca sirve piezas de marca (`puedeVerAsset`, lib/shares.ts).

import { NextResponse, type NextRequest } from 'next/server';
import { getAssetDeWorkspace, leerBinario, urlDescarga } from '@/lib/branding';
import { resolverToken, esShareDeMarca, puedeVerAsset } from '@/lib/shares';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO = () => NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: NextRequest) {
  // Los ids se arman con el nombre del archivo (`${seccion}-${grupo}-${archivo}`), así que se pueden
  // adivinar: el tope corta una ráfaga de enumeración. Es alto a propósito: la galería pide una
  // miniatura por pieza (perezosas; hoy son 74) y un video por pieza animada, y no puede cortarle la
  // carga a quien la recorre entera. Es por instancia (lib/rate-limit.ts), igual que en el curso.
  if (!rateLimit(`compartido-archivo:ip:${clientIp(req)}`, 300, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const t = req.nextUrl.searchParams.get('t') || '';
  const id = req.nextUrl.searchParams.get('id') || '';
  const vista = req.nextUrl.searchParams.get('v') === 'thumb' ? 'thumb' : 'full';
  if (!t || !id) return NO();

  try {
    const acceso = await resolverToken(t);
    if (!acceso) return NO();                                   // no existe / revocado / vencido
    if (!esShareDeMarca(acceso.share)) return NO();             // otro recurso: ni se busca la pieza

    const asset = await getAssetDeWorkspace(acceso.share.workspace_id, id);
    if (!asset) return NO();
    if (!puedeVerAsset(acceso.share, asset)) return NO();       // fuera del alcance: 404, igual que si no existiera

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
