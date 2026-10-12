// =============================================================================
// POST /api/closing/sync — sincroniza llamadas de Fathom → closing_analyses
// =============================================================================
// Disparado desde «↻ Sincronizar» del bloque «Las llamadas» de la hoja Closing del Dashboard
// (app/dashboard/bloques/extra/BloquesClosing.tsx; hasta el 11/10/2026, desde la tab /closing). Procesa un
// lote con presupuesto de tiempo; devuelve cuántas quedaron pendientes para que la UI pueda volver a llamar.
//
// Puerta (../puerta.ts): admin o closer, el Dashboard en la capa y Fathom conectado. Hasta el 11/10 sólo
// pedía sesión y Fathom: un setter podía disparar análisis con IA con un `fetch` a mano.
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncClosingCalls } from '@/lib/closing';
import { puertaClosing } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const cerrada = await puertaClosing({ fathom: true });
  if (cerrada) return cerrada;
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
