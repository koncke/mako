// =============================================================================
// POST /api/closing/sync — sincroniza llamadas de Fathom → closing_analyses
// =============================================================================
// Disparado desde el botón "Sincronizar" de /closing (gated por el login del
// dashboard vía middleware). Procesa un lote con presupuesto de tiempo; devuelve
// cuántas quedaron pendientes para que la UI pueda volver a llamar.
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncClosingCalls } from '@/lib/closing';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Fase 1: Fathom es la integración global del dueño → solo él sincroniza.
  if (!(await integracionConectada('fathom'))) return Response.json({ ok: false, error: 'solo el workspace dueño (Fase 1)' }, { status: 403 });
  let body: { max?: number; force?: boolean } = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  try {
    const res = await syncClosingCalls({ max: body.max, force: body.force });
    console.log(
      `[closing:sync] fathom=${res.total_fathom} ya=${res.ya_procesadas} cand=${res.candidatas} ` +
      `analizadas=${res.analizadas} ventas=${res.ventas} servicio=${res.servicio} otras=${res.otras} err=${res.errores} ` +
      `restantes=${res.restantes} ms=${res.ms}`,
    );
    return Response.json({ ok: true, ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[closing:sync] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
