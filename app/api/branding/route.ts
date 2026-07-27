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
    const thumbs = await urlsPreview(assets.map((a) => a.thumb_path).filter((p): p is string => !!p));
    return NextResponse.json({
      ok: true,
      assets: assets.map((a) => ({
        id: a.id, seccion: a.seccion, grupo: a.grupo, archivo: a.archivo, titulo: a.titulo,
        mime: a.mime, bytes: a.bytes, embed: a.panda_embed,
        thumb: a.thumb_path ? thumbs[a.thumb_path] ?? null : null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
