// =============================================================================
// POST /api/image-editor/carruseles/traer — «Traer tu outlier»: un carrusel de Instagram por su link (11/11/2026)
// =============================================================================
// POST json {texto} → {ok, carrusel, nuevo} o {ok:false, error}. Lo pide el buscador de los outliers cuando lo escrito es el link
// de una publicación (app/image-editor/carruseles/ExplorarCarruseles.tsx). Lee con Apify y guarda la publicación como del
// negocio: lib/carruseles/traer-servidor.ts, que dice todo lo demás.
//
// La puerta es la del Image Editor (`puerta`), como la de «leer» y «replicar». Un fetch y no una server action: las acciones se
// encolan de a una (AGENTS.md) y esto tarda lo que tarde Instagram (hasta un minuto).
// =============================================================================
import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { rateLimit } from '@/lib/rate-limit';
import { traerCarrusel } from '@/lib/carruseles/traer-servidor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;

const sinCache = { 'cache-control': 'no-store' };

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  if (!rateLimit(`image-editor:traer:${p.ws}`, 6, 60_000)) return Response.json({ ok: false, error: 'Demasiados pedidos. Espera un minuto.' }, { status: 429, headers: sinCache });
  const body = (await req.json().catch(() => null)) as { texto?: unknown } | null;
  const texto = typeof body?.texto === 'string' ? body.texto.slice(0, 500) : '';
  if (!texto.trim()) return Response.json({ ok: false, error: 'Pega el link de una publicación de Instagram.' }, { status: 400, headers: sinCache });
  const r = await runWithWorkspace(p.ws, () => traerCarrusel(p.ws, texto));
  return Response.json(r, { status: r.ok ? 200 : 422, headers: sinCache });
}
