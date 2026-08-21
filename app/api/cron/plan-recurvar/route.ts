// =============================================================================
// /api/cron/plan-recurvar — el tablero se reparte SOLO, todos los días
// =============================================================================
// Existe por un hallazgo que casi se lleva puesta la feature entera:
// `recurvarPlanOwner` tenía UN llamador en todo el repo —adentro de
// `priorizarNuevasOwner`—, o sea que el tablero solo se re-repartía cuando ENTRABAN
// TAREAS NUEVAS. Con eso, dos reglas que dependen del calendario («vence en 3 días»,
// «39 días sin que nadie la mencione») no se hubieran movido nunca solas: el dueño
// habría visto una fecha vencerse sin que el tablero se enterara, y habría parecido que
// la feature no funciona.
//
// Cero tokens: son dos queries y aritmética. Lo que hace es:
//   1. `recurvarPlanOwner` — reparte las tareas abiertas sobre score_base + tiempo +
//      dependencias, y escribe `score`/`priority`. NUNCA toca `score_base`, así que es
//      idempotente y correrlo dos veces da lo mismo.
//   2. `recurvarProyectosOwner` — deriva el score de cada proyecto de sus tareas.
//   3. `limpiarDependenciasColgadas` — barre las aristas que apuntan a algo borrado
//      (no hay FK posible: la PK de plan_tareas es compuesta).
//
// El orden importa: los proyectos se derivan de las tareas ya repartidas.
// =============================================================================

import { NextResponse } from 'next/server';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { recurvarPlanOwner, recurvarProyectosOwner, limpiarDependenciasColgadas } from '@/lib/plan-board';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  try {
    // El board del dueño vive en el workspace del SUPER-ADMIN, resuelto por CAPA. No es
    // OWNER_WS: OWNER_WS vale 1 y el 1 es Mauricio, un cliente, cuyo tablero es otro.
    const ws = await wsSuperAdmin();
    if (!ws) return NextResponse.json({ ok: false, error: 'sin workspace de super-admin' }, { status: 200 });
    const t = await runWithWorkspace(ws, () => recurvarPlanOwner());
    const p = await runWithWorkspace(ws, () => recurvarProyectosOwner());
    const colgadas = await runWithWorkspace(ws, () => limpiarDependenciasColgadas()).catch(() => 0);
    console.log(`[cron plan-recurvar] ws${ws} · ${t.movidas}/${t.total} tareas · ${t.conDeadline} por fecha · ${t.quietas} por quietud · ${t.frenadas} frenadas · ${p.movidos}/${p.total} proyectos · norte «${p.norte}»`);
    return NextResponse.json({ ok: true, tareas: t, proyectos: p, colgadas });
  } catch (err) {
    // Un cron que falla en silencio es un cron que nadie sabe que dejó de correr.
    console.error('[cron plan-recurvar]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
