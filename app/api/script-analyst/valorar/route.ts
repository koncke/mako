// =============================================================================
// POST /api/script-analyst/valorar — valora un GUION NUEVO (sin datos)
// =============================================================================
// Body: { guion, dur? }. Corre Claude comparando el guion contra el perfil real
// de la cuenta (lo que ya rinde) y devuelve una valoración. NO persiste nada
// (no es un ad de Meta). Gateado por el middleware del dashboard.
// =============================================================================

import type { NextRequest } from 'next/server';
import { valorarGuion } from '@/lib/script-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { guion?: string; dur?: number };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const guion = typeof body.guion === 'string' ? body.guion.trim() : '';
  if (guion.length < 80) {
    return Response.json({ ok: false, error: 'Pegá el guion completo (mínimo unas líneas) para poder valorarlo.' }, { status: 400 });
  }
  const dur = Number.isFinite(Number(body.dur)) && Number(body.dur) > 0 ? Number(body.dur) : undefined;

  try {
    const res = await valorarGuion(guion, dur);
    if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 500 });
    return Response.json({ ok: true, valoracion: res.valoracion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[script-analyst:valorar] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
