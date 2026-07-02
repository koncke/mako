// =============================================================================
// /api/retro — retrospectivas (pipeline v3)
// =============================================================================
// GET  → { retros }
// POST { action: 'generar', ... } → STREAM NDJSON de RetroStreamEvent:
//        {t:'plan',fases,tabs} → {t:'fase'}/{t:'step'} … → {t:'done',retro}|{t:'error'}.
//        Siempre profundidad máxima (el wizard ya no la pide).
// POST { action: 'plan', id, itemId, op, motivo? } → { ok, reporte } (aceptar
//        crea el experimento real + sus tareas encadenadas en To-do).
// POST { action: 'borrar', id } → { ok }
// =============================================================================

import type { NextRequest } from 'next/server';
import { listRetros, borrarRetro, periodoDefault, periodoHistorico } from '@/lib/retro';
import { generarRetroV3, aplicarPlan, type PlanOp, type OpcionesRetroV3 } from '@/lib/retro-pipeline';
import type { RetroStreamEvent } from '@/lib/retro-reporte';
import { esFechaValida } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// La retro completa (diagnóstico paralelo + cruces + cerebro + verificación) puede
// pasar los 5 min: 300 mataba la función a mitad del cerebro y el stream moría sin
// error. 800 es el máximo de Pro con fluid compute; además el pipeline tiene un
// presupuesto interno (salta la verificación si va justo). Si el deploy fallara por
// límite del plan, bajar a 300.
export const maxDuration = 800;

export async function GET() {
  try {
    return Response.json({ ok: true, retros: await listRetros() });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

type Body = {
  action?: string; id?: number; desde?: string; hasta?: string; historico?: boolean;
  perspectiva?: string; areas?: string[];
  itemId?: string; op?: PlanOp; motivo?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  if (body.action === 'borrar') {
    const id = Number(body.id);
    if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
    try { await borrarRetro(id); return Response.json({ ok: true }); }
    catch (err) { return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 }); }
  }

  if (body.action === 'plan') {
    const id = Number(body.id);
    const itemId = String(body.itemId ?? '');
    const op = body.op;
    const OPS: PlanOp[] = ['aceptar', 'posponer', 'descartar', 'deshacer'];
    if (!Number.isFinite(id) || !itemId || !op || !OPS.includes(op)) {
      return Response.json({ ok: false, error: 'id, itemId y op (aceptar|posponer|descartar|deshacer) requeridos' }, { status: 400 });
    }
    try {
      const reporte = await aplicarPlan(id, itemId, op, body.motivo);
      return Response.json({ ok: true, reporte });
    } catch (err) {
      return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  if (body.action !== 'generar') return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });

  // Período (histórico o rango).
  let desde: string, hasta: string;
  if (body.historico) {
    ({ desde, hasta } = await periodoHistorico());
  } else {
    const def = periodoDefault();
    desde = body.desde && esFechaValida(body.desde) ? body.desde : def.desde;
    hasta = body.hasta && esFechaValida(body.hasta) ? body.hasta : def.hasta;
  }
  if (desde > hasta) return Response.json({ ok: false, error: 'rango de fechas inválido' }, { status: 400 });

  const opts: OpcionesRetroV3 = {
    perspectiva: body.perspectiva,
    areas: Array.isArray(body.areas) ? (body.areas as OpcionesRetroV3['areas']) : undefined,
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: RetroStreamEvent) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { /* cerrado */ } };
      try {
        const retro = await generarRetroV3(desde, hasta, opts, send);
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
