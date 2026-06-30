// =============================================================================
// /api/experimentos — vista + ciclo de vida de los experimentos
// =============================================================================
// GET  → la vista completa (activos con medición en vivo, propuestos, aprendizajes).
// POST { action: crear | iniciar | cerrar | descartar | eliminar, ... }
//   - crear     { ...NuevoExperimento }  (arrancar:true por defecto → mide baseline)
//   - iniciar   { id }                   (propuesto → activo, mide baseline)
//   - cerrar    { id }                   (mide resultado y MaKo dicta veredicto + aprendizaje)
//   - descartar { id }
//   - eliminar  { id }
// Gated por el login del dashboard (middleware).
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  getExperimentosView,
  crearExperimento,
  iniciarExperimento,
  cerrarExperimento,
  descartarExperimento,
  eliminarExperimento,
  type NuevoExperimento,
} from '@/lib/experimentos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120; // cerrar/crear miden contra el dato real + Claude

export async function GET() {
  try {
    return Response.json({ ok: true, view: await getExperimentosView() });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');
  const id = Number(body.id);

  try {
    if (action === 'crear') {
      const input = body.experimento as NuevoExperimento | undefined;
      if (!input || !input.metrica || !input.hipotesis) {
        return Response.json({ ok: false, error: 'faltan datos del experimento' }, { status: 400 });
      }
      const exp = await crearExperimento(input);
      return Response.json({ ok: true, experimento: exp });
    }

    if (action === 'iniciar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      return Response.json({ ok: true, experimento: await iniciarExperimento(id) });
    }

    if (action === 'cerrar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      return Response.json({ ok: true, experimento: await cerrarExperimento(id) });
    }

    if (action === 'descartar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await descartarExperimento(id);
      return Response.json({ ok: true });
    }

    if (action === 'eliminar') {
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await eliminarExperimento(id);
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
