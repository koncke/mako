// =============================================================================
// CRON: los mensajes agendados por TIEMPO que vencieron (cada 10 min)
// =============================================================================
// La mitad TIEMPO del pedido del 30/09/2026: «1 vez a la semana, al mes, al año,
// diariamente… Cada X horas». La otra mitad —ACCIÓN— ya corría por los cinco
// `EVENTOS` y sus choke points; esto es lo que faltaba.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: ese helper itera los workspaces que tienen
// una INTEGRACIÓN conectada, y acá no corresponde ninguna — un mensaje agendado sale
// por el grupo de MaKo, que puede ser WhatsApp oficial o no. Se pregunta al revés,
// que además es lo único que escala: la TABLA dice quién tiene algo vencido, y se
// visita sólo a esos. Mismo criterio que `insistencias` y `tracking-vigilante`.
//
// El diseño ingenuo —recorrer los 10 workspaces × 108 avisos activos cada 10 min—
// está medido y no entra: `estadoAviso` → `getPlantilla` → `leerStore` son dos
// lecturas de `app_settings` por workspace y por tick, secuenciales adentro de
// `runWithWorkspace`. Con la tabla, un tick sin nada agendado cuesta UNA consulta.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { drenarProgramados } from '@/lib/avisos-programados';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    // Crudo y sin scope a propósito: es la ÚNICA lectura cross-workspace, y sólo
    // sirve para saber a quién visitar. Todo lo que toca datos va adentro del
    // runWithWorkspace de abajo.
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('avisos_programados')
      .select('workspace_id')
      .lte('proxima_at', new Date().toISOString())
      .limit(500);
    if (error) {
      console.error('[cron:avisos-programados]', error.message);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const wss = [...new Set((data ?? []).map((r) => (r as { workspace_id: number }).workspace_id))];
    if (!wss.length) return Response.json({ ok: true, workspaces: 0, enviados: 0 });

    let enviados = 0, saltados = 0;
    const fallos: number[] = [];
    for (const ws of wss) {
      // Un workspace que falla no corta a los demás: su fila ya avanzó el horario,
      // así que lo que se pierde es UNA ocurrencia, no la serie.
      try {
        const r = await runWithWorkspace(ws, () => drenarProgramados());
        enviados += r.enviados;
        saltados += r.saltados;
      } catch (e) {
        fallos.push(ws);
        console.error(`[cron:avisos-programados] ws${ws}:`, e instanceof Error ? e.message : String(e));
      }
    }
    const ok = fallos.length < wss.length;
    return Response.json({ ok, workspaces: wss.length, enviados, saltados, fallos }, { status: ok ? 200 : 500 });
  } catch (e) {
    console.error('[cron:avisos-programados]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
