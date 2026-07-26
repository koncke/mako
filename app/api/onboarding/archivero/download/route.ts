// =============================================================================
// /api/onboarding/archivero/download?id= — descarga un archivo del archivero
// =============================================================================
// getFile va por getTenantDb (scopeado por workspace), así que un admin no puede
// bajar un archivo de otro inquilino (IDOR cerrado). Devuelve un redirect a una URL
// firmada de corta vida con Content-Disposition de descarga.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { getFile, urlDescarga, resolverWsAdmin } from '@/lib/archivero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'No autorizado.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'Falta id.' }, { status: 400 });
  return runWithWorkspace(ws, async () => {
    try {
      const f = await getFile(id);
      if (!f) return Response.json({ ok: false, error: 'Archivo no encontrado.' }, { status: 404 });
      const url = await urlDescarga(f.storage_path, f.nombre);
      if (!url) return Response.json({ ok: false, error: 'No se pudo generar la descarga.' }, { status: 500 });
      return Response.redirect(url, 302);
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
