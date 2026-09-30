// =============================================================================
// CRON: las plantillas recurrentes generan su instancia del día (#813)
// =============================================================================
// «Que sea una tarea que se crea cada cierto tiempo» (Martín, 25/09/2026). La mig 0167
// guardó la RRULE y dejó escrito lo que faltaba: «Nada en este producto calcula la
// próxima ocurrencia: el día es una ETIQUETA». Esto es lo que la dispara.
//
// ⚠️ CORRE ANTES QUE `plan-recurvar` (09:00 contra 09:10). La instancia que nace hoy
// tiene que estar en el tablero cuando el reparto diario lo re-ordena: al revés, la
// tarjeta del día aparece sin score hasta el día siguiente — y una tarea que toca HOY
// abajo de todo es indistinguible de una que no toca.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: ese helper itera los workspaces que tienen una
// INTEGRACIÓN conectada, y acá no corresponde ninguna — una tarea recurrente no depende
// de Meta ni de Fathom. Se pregunta al revés, que además es lo único que escala: las
// TABLAS dicen quién tiene plantillas, y se visita sólo a esos. Mismo criterio que
// `avisos-programados` e `insistencias`.
//
// Cero tokens y cero IA: es una regla de calendario y dos inserts.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { generarRecurrentes } from '@/lib/plan-recurrentes-generar';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Quién tiene al menos una plantilla. Las DOS mitades del tablero: el del super admin
 *  vive en `plan_tareas` y el de cada cliente en `experimento_tareas`, y un cron que
 *  mire una sola deja a la mitad del producto sin generar nada. */
async function conPlantillas(): Promise<number[]> {
  // Crudo y sin scope a propósito: es la única lectura cross-workspace, y sólo sirve
  // para saber a quién visitar. Todo lo que toca datos va adentro del runWithWorkspace.
  const sb = getSupabaseServer();
  const ids = new Set<number>();
  for (const tabla of ['plan_tareas', 'experimento_tareas']) {
    const { data, error } = await sb.from(tabla).select('workspace_id').eq('recurrente', true).limit(2000);
    if (error) { console.error(`[cron:plan-recurrentes] ${tabla}: ${error.message}`); continue; }
    for (const r of data ?? []) ids.add((r as { workspace_id: number }).workspace_id);
  }
  return [...ids];
}

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const wss = await conPlantillas();
    if (!wss.length) return Response.json({ ok: true, workspaces: 0, creadas: 0 });

    let creadas = 0, conAbierta = 0, salteadas = 0, errores = 0;
    const fallos: number[] = [];
    for (const ws of wss) {
      // Un workspace que rompe no corta a los demás. Lo que se pierde es la instancia
      // de HOY de ese cliente; mañana el cron la vuelve a intentar, y el índice único
      // de la 0185 hace que reintentar no pueda duplicar nada.
      try {
        const r = await runWithWorkspace(ws, () => generarRecurrentes());
        creadas += r.creadas; conAbierta += r.conAbierta; salteadas += r.salteadas; errores += r.errores;
      } catch (e) {
        fallos.push(ws);
        console.error(`[cron:plan-recurrentes] ws${ws}:`, e instanceof Error ? e.message : String(e));
      }
    }
    const ok = fallos.length < wss.length;
    return Response.json({ ok, workspaces: wss.length, creadas, conAbierta, salteadas, errores, fallos }, { status: ok ? 200 : 500 });
  } catch (e) {
    console.error('[cron:plan-recurrentes]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
