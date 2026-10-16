// =============================================================================
// CRON: «Re-priorizar todo» sigue aunque nadie tenga el tablero abierto (cada minuto)
// =============================================================================
// 16/10/2026, decisión 9 de «hacer el kanban un kanban». El pedido, textual (Martín): «eso puede
// correr en segundo plano y no impedir que el usuario siga utilizando todo». Mientras la pestaña
// está abierta, el sondeo del tablero empuja cada tanda en `after()`; si se cierra, o si el trabajo
// lo arrancó MaKo por WhatsApp, lo que lo termina es esto.
//
// ⚠️ PREGUNTA A LA TABLA, NO ITERA WORKSPACES (el criterio de `flujo-corridas`): un minuto sin
// trabajos cuesta UNA consulta, que es el caso normal. Y nunca procesa una tanda que otro tiene
// tomada: tomar es un compare-and-set sobre `vuelta` (lib/plan-repriorizar.ts).
//
// El reloj: 300 s de techo. No arranca una tanda con menos de 75 s por delante (cortada a mitad se
// repite entera), así que cada corrida hace las tandas que entren y deja el resto a la siguiente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { drenarRepriorizaciones } from '@/lib/plan-repriorizar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const inicio = Date.now();
  try {
    const r = await drenarRepriorizaciones({ hasta: inicio + 280_000 });
    // Los DOS números: «no había nada» y «había y no avancé» no son lo mismo.
    if (r.corriendo) console.log(`[cron plan-repriorizar] ${r.corriendo} corriendo · ${r.tandas} tanda(s) en ${Math.round((Date.now() - inicio) / 1000)}s`);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[cron plan-repriorizar]', error);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
