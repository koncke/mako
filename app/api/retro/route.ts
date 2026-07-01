// =============================================================================
// /api/retro — retrospectivas de /experimentos (tab Retro)
// =============================================================================
// GET  → { retros }
// POST { action: 'generar', ... } → STREAM NDJSON: {t:'step',fase,label}\n … \n
//        {t:'done',retro} | {t:'error',error}. MaKo lee todas las áreas elegidas
//        y transmite el progreso en vivo.
// POST { action: 'borrar', id } → { ok }   (JSON normal)
// =============================================================================

import type { NextRequest } from 'next/server';
import { generarRetro, listRetros, borrarRetro, periodoDefault, periodoHistorico, type OpcionesRetro } from '@/lib/retro';
import { esFechaValida } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // profundidad profunda analiza área por área

export async function GET() {
  try {
    return Response.json({ ok: true, retros: await listRetros() });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

type GenBody = {
  action?: string; id?: number; desde?: string; hasta?: string; historico?: boolean;
  perspectiva?: string; profundidad?: OpcionesRetro['profundidad']; areas?: string[];
};

export async function POST(req: NextRequest) {
  let body: GenBody;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  if (body.action === 'borrar') {
    const id = Number(body.id);
    if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
    try { await borrarRetro(id); return Response.json({ ok: true }); }
    catch (err) { return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 }); }
  }

  if (body.action !== 'generar') return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });

  // Resolver período (histórico o rango).
  let desde: string, hasta: string;
  if (body.historico) {
    ({ desde, hasta } = await periodoHistorico());
  } else {
    const def = periodoDefault();
    desde = body.desde && esFechaValida(body.desde) ? body.desde : def.desde;
    hasta = body.hasta && esFechaValida(body.hasta) ? body.hasta : def.hasta;
  }
  if (desde > hasta) return Response.json({ ok: false, error: 'rango de fechas inválido' }, { status: 400 });

  const opts: OpcionesRetro = {
    perspectiva: body.perspectiva,
    profundidad: body.profundidad,
    areas: Array.isArray(body.areas) ? (body.areas as OpcionesRetro['areas']) : undefined,
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { /* cerrado */ } };
      try {
        const retro = await generarRetro(desde, hasta, opts, (p) => send({ t: 'step', ...p }));
        send({ t: 'done', retro });
      } catch (err) {
        send({ t: 'error', error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
