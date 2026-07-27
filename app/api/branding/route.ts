// =============================================================================
// GET /api/branding — catálogo del material de marca (solo super-admin)
// =============================================================================
// Devuelve la ficha de cada pieza + la URL FIRMADA DE LA MINIATURA (no del
// original). Las miniaturas se firman en UN solo batch: el loop secuencial de
// firmas ya colgó una vista en este repo.
//
// Nunca se devuelve una URL firmada del archivo original: para eso está
// /api/branding/descargar, que autoriza en el momento y firma por 120 s.

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { listarAssets, urlsPreview } from '@/lib/branding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const assets = await listarAssets();
    // Qué se firma como preview: la miniatura si existe (los gráficos pesan 39 MB
    // en total y por eso la tienen), y si no, el original — pero SOLO cuando es
    // una imagen chica, como los íconos. Sin esto los íconos mostraban un cartel
    // que decía "PNG" en vez del ícono.
    const CHICO = 400 * 1024;
    const paraFirmar = assets
      .map((a) => a.thumb_path || (a.mime.startsWith('image/') && a.bytes <= CHICO ? a.storage_path : null))
      .filter((p): p is string => !!p);
    const firmadas = await urlsPreview(paraFirmar);

    return NextResponse.json({
      ok: true,
      assets: assets.map((a) => {
        const path = a.thumb_path || (a.mime.startsWith('image/') && a.bytes <= CHICO ? a.storage_path : null);
        return {
          id: a.id, seccion: a.seccion, grupo: a.grupo, archivo: a.archivo, titulo: a.titulo,
          mime: a.mime, bytes: a.bytes, embed: a.panda_embed,
          thumb: path ? firmadas[path] ?? null : null,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
