// =============================================================================
// POST /api/image-editor/explorador — el resto de la portada de Image (13/11/2026)
// =============================================================================
// POST json {que: 'carruseles' | 'thumbnails'} → {ok, carruseles} o {ok, lista}. La página trae sólo lo que se ve primero
// (app/image-editor/carruseles/tanda.ts) y la pantalla pide acá el resto apenas se dibuja; las miniaturas de YouTube, al abrir
// «Thumbnails». Lee lo MISMO que la página (`leerExplorador`, `leerThumbnails`), en el negocio de la pestaña.
// La puerta es la del Image Editor (`puerta`), como «traer» y «replicar». Un fetch y no una server action: las acciones se encolan
// de a una (AGENTS.md) y esto corre mientras la persona ya mira la portada.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { leerThumbnails } from '@/lib/thumbnails/servidor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const sinCache = { 'cache-control': 'no-store' };

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const body = (await req.json().catch(() => null)) as { que?: unknown } | null;
  if (body?.que === 'thumbnails') {
    const t = await runWithWorkspace(p.ws, () => leerThumbnails());
    return t.ok
      ? Response.json({ ok: true, lista: t.thumbnails }, { headers: sinCache })
      : Response.json({ ok: false, error: 'No pude leer las miniaturas de YouTube.' }, { status: 500, headers: sinCache });
  }
  const e = await runWithWorkspace(p.ws, () => leerExplorador());
  return e.ok
    ? Response.json({ ok: true, carruseles: e.carruseles }, { headers: sinCache })
    : Response.json({ ok: false, error: 'No pude leer el resto de los ejemplos.' }, { status: 500, headers: sinCache });
}
