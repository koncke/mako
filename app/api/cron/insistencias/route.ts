// =============================================================================
// CRON: las insistencias que vencieron (cada 15 min)
// =============================================================================
// Un aviso con insistencia sale una vez por el camino normal y deja una fila viva
// (mig 0180). Este cron es el que la hace volver: cada 15 minutos mira qué venció y
// lo manda de nuevo, hasta el techo o hasta que alguien escriba «ok» en el grupo.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: ese helper itera los workspaces que tienen
// una INTEGRACIÓN conectada, y acá no hay ninguna que corresponda — la insistencia sale
// por el grupo de MaKo, que puede ser WhatsApp oficial o no oficial. Filtrar por
// cualquiera de las dos dejaría clientes sin sus avisos. Se pregunta al revés, que
// además es más barato: la tabla dice QUIÉN tiene algo vencido, y se corre sólo esos.
// Mismo criterio que `tracking-vigilante`, que tampoco lo usa y explica por qué.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { drenarInsistencias } from '@/lib/insistencias';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    // Crudo y sin scope a propósito: es la ÚNICA lectura cross-workspace, y sirve
    // para saber a quién hay que visitar. Todo lo que toca datos va adentro del
    // runWithWorkspace de abajo.
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('insistencias')
      .select('workspace_id')
      .is('cerrada_at', null)
      .lte('proxima_at', new Date().toISOString())
      .limit(500);
    if (error) {
      console.error('[cron:insistencias]', error.message);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const wss = [...new Set((data ?? []).map((r) => (r as { workspace_id: number }).workspace_id))];
    if (!wss.length) return Response.json({ ok: true, workspaces: 0, enviadas: 0 });

    let enviadas = 0, cerradas = 0;
    const fallos: number[] = [];
    for (const ws of wss) {
      // Un workspace que falla no corta a los demás: su insistencia queda viva y
      // vuelve en el tick siguiente.
      try {
        const r = await runWithWorkspace(ws, () => drenarInsistencias());
        enviadas += r.enviadas;
        cerradas += r.cerradas;
      } catch (e) {
        fallos.push(ws);
        console.error(`[cron:insistencias] ws${ws}:`, e instanceof Error ? e.message : String(e));
      }
    }
    const ok = fallos.length < wss.length;
    return Response.json({ ok, workspaces: wss.length, enviadas, cerradas, fallos }, { status: ok ? 200 : 500 });
  } catch (e) {
    console.error('[cron:insistencias]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
