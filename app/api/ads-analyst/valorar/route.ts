// =============================================================================
// POST /api/ads-analyst/valorar — valora un GUION NUEVO (sin datos)
// =============================================================================
// Body: { guion, dur? }. Corre Claude comparando el guion contra el perfil real
// de la cuenta (lo que ya rinde) y devuelve una valoración. NO persiste nada
// (no es un ad de Meta). Gateado por el middleware del dashboard.
// =============================================================================

import type { NextRequest } from 'next/server';
import { valorarGuion, saveDraft, deleteDraft } from '@/lib/ads-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { guion?: string; dur?: number };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const guion = typeof body.guion === 'string' ? body.guion.trim() : '';
  if (guion.length < 80) {
    return Response.json({ ok: false, error: 'Pega el guion completo (mínimo unas líneas) para poder valorarlo.' }, { status: 400 });
  }
  const dur = Number.isFinite(Number(body.dur)) && Number(body.dur) > 0 ? Number(body.dur) : undefined;

  try {
    const res = await valorarGuion(guion, dur);
    if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 500 });
    // Guardar al historial. Si el guardado falla, NO perdemos la valoración.
    let saved = false;
    try { await saveDraft(guion, res.valoracion); saved = true; } catch (e) { console.error(`[ads-analyst:valorar] guardado falló: ${e instanceof Error ? e.message : String(e)}`); }
    return Response.json({ ok: true, valoracion: res.valoracion, saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-analyst:valorar] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
  try {
    await deleteDraft(id);
    return Response.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-analyst:valorar] delete error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
