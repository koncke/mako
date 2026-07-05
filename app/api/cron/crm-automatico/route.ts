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
// En commit MaKo APLICA: mueve el lead + resuelve Fathom/WhatsApp + deja las
// confirmaciones (modal bloqueante en /leads). En dry-run solo reporta el plan.
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { evaluarAutoTodos, aplicarAutoTodos } from '@/lib/crm-auto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauth = checkCronAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  const enabled = process.env.CRM_AUTO_ENABLED === 'true';
  const commit = enabled || url.searchParams.get('commit') === '1';

  try {
    if (commit) {
      const res = await aplicarAutoTodos();
      const auto = res.reduce((a, e) => a + (e.auto ?? 0), 0);
      const confirmaciones = res.reduce((a, e) => a + (e.confirmaciones ?? 0), 0);
      return Response.json({
        ok: true,
        modo: enabled ? 'commit (env CRM_AUTO_ENABLED)' : 'commit (?commit=1)',
        aplicadas_auto: auto,
        confirmaciones_creadas: confirmaciones,
        workspaces: res,
      });
    }

    const evals = await evaluarAutoTodos();
    const total = evals.reduce((a, e) => a + (e.acciones?.length ?? 0), 0);
    return Response.json({ ok: true, modo: 'dry-run', acciones_total: total, workspaces: evals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:crm-automatico] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
