// =============================================================================
// GET /api/branding/descargar?id=<assetId> — baja una pieza del material
// =============================================================================
// El id va en la QUERY y NUNCA en el path con extensión. Motivo concreto: el
// matcher de proxy.ts excluye del gate de login CUALQUIER path terminado en
// .png/.jpg/.svg/.webp/.gif, incluido /api/loquesea/foo.png. Una URL "linda"
// tipo /api/branding/asset/logo.png quedaría abierta a internet EN SILENCIO.
//
// Los bytes no pasan por Vercel: se autoriza, se firma 120 s y se redirige.
// getAsset lee por getTenantDb, así que un id de otro workspace da 404 solo.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getAsset, urlDescarga } from '@/lib/branding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });

  try {
    const asset = await getAsset(id);
    if (!asset) return NextResponse.json({ ok: false, error: 'no existe' }, { status: 404 });

    const url = await urlDescarga(asset.storage_path, asset.archivo);
    if (!url) return NextResponse.json({ ok: false, error: 'no se pudo firmar' }, { status: 500 });

    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
