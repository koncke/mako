// =============================================================================
// Cron: CRM automático (MaKo mueve el lead solo) — POR WORKSPACE
// =============================================================================
// Evalúa las reglas de auto-transición (lib/crm-auto.ts) sobre los workspaces
// activos. El commit se decide POR WORKSPACE con el setting crm_auto_enabled
// (lib/envio-flags.ts: cliente sin setting = apagado fail-closed; el dueño
// hereda el env CRM_AUTO_ENABLED) — prender un cliente no compromete al resto.
//
// Modos:
//   - default            → cada workspace con su flag: ON aplica de verdad
//                          (mueve el lead + confirmaciones), OFF se reporta 'off'.
//   - &ws=N              → restringe la corrida a ese workspace.
//   - ?dry=1[&ws=N]      → dry-run: computa y MUESTRA lo que MaKo haría, sin
//                          tocar ningún lead.
//   - ?commit=1&ws=N     → fuerza el commit de UN workspace ignorando su flag
//                          (piloto). Sin ws explícito se rechaza: el commit
//                          forzado de todos los inquilinos a la vez era el
//                          foot-gun que este modo reemplaza.
//
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
  const wsParam = Number(url.searchParams.get('ws'));
  const soloWs = Number.isFinite(wsParam) && wsParam > 0 ? wsParam : undefined;

  try {
    if (url.searchParams.get('dry') === '1') {
      const evals = await evaluarAutoTodos();
      const filtrados = soloWs ? evals.filter((e) => e.ws === soloWs) : evals;
      const total = filtrados.reduce((a, e) => a + (e.acciones?.length ?? 0), 0);
      return Response.json({ ok: true, modo: 'dry-run', acciones_total: total, workspaces: filtrados });
    }

    const forzar = url.searchParams.get('commit') === '1';
    if (forzar && !soloWs) {
      return Response.json(
        { ok: false, error: 'commit=1 exige &ws=N: el commit forzado aplica a UN workspace, nunca a todos.' },
        { status: 400 },
      );
    }

    const res = await aplicarAutoTodos(undefined, { soloWs, forzar });
    if (soloWs && res.length === 0) {
      return Response.json({ ok: false, error: `workspace ${soloWs} inexistente o pausado` }, { status: 404 });
    }
    const auto = res.reduce((a, e) => a + (e.auto ?? 0), 0);
    const confirmaciones = res.reduce((a, e) => a + (e.confirmaciones ?? 0), 0);
    const errores = res.filter((r) => !r.ok).length;
    const todoFallo = res.length > 0 && errores === res.length;
    return Response.json(
      {
        ok: !todoFallo,
        modo: forzar ? `commit forzado (ws ${soloWs})` : 'por-workspace (flag crm_auto_enabled)',
        aplicadas_auto: auto,
        confirmaciones_creadas: confirmaciones,
        workspaces: res,
      },
      { status: todoFallo ? 500 : 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:crm-automatico] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
