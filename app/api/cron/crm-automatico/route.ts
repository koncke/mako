// =============================================================================
// Cron: CRM automático (MaKo mueve el lead solo)
// =============================================================================
// Evalúa las reglas de auto-transición (lib/crm-auto.ts) sobre todos los
// workspaces activos.
//
// Modos:
//   - default          → dry-run: computa y MUESTRA lo que MaKo haría, sin tocar
//                         ningún lead. Seguro para inspeccionar en producción.
//   - ?commit=1         → fuerza el commit a mano (para probar la máquina).
//   - CRM_AUTO_ENABLED=true → el cron programado aplica de verdad.
//
// La FASE DE APLICACIÓN (mover el lead + resolver Fathom/WhatsApp + red de
// confirmación no-cerrable) se cablea en el siguiente paso; hasta entonces el
// commit reporta el plan sin ejecutarlo. Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { evaluarAutoTodos } from '@/lib/crm-auto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauth = checkCronAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  const enabled = process.env.CRM_AUTO_ENABLED === 'true';
  const commit = enabled || url.searchParams.get('commit') === '1';

  try {
    const evals = await evaluarAutoTodos();
    const total = evals.reduce((a, e) => a + (e.acciones?.length ?? 0), 0);
    return Response.json({
      ok: true,
      modo: commit ? 'commit (aplicación aún no cableada — reporta el plan)' : 'dry-run',
      acciones_total: total,
      workspaces: evals,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:crm-automatico] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
