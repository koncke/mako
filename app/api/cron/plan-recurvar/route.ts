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
//   2. `limpiarDependenciasColgadas` — barre las aristas que apuntan a algo borrado
//      (no hay FK posible: la PK de plan_tareas es compuesta).
//
// ⛔ ACÁ TAMBIÉN CORRÍA la derivación del score de los proyectos, y se sacó: reemplazaba el
// juicio del Perro por `max(tareas) + densidad`. Los proyectos NO se tocan desde un cron
// determinista — su prioridad es un juicio y sale del Perro. Ver app/plan/board/types.ts.
// =============================================================================

import { NextResponse } from 'next/server';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { recurvarPlanOwner, limpiarDependenciasColgadas, priorizarProyectosOwner } from '@/lib/plan-board';
import { avisarVencimientosDelPlan } from '@/lib/plan-avisos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  try {
    // El board del dueño vive en el workspace del SUPER-ADMIN, resuelto por CAPA. No es
    // OWNER_WS: OWNER_WS vale 1 y el 1 es Mauricio, un cliente, cuyo tablero es otro.
    const ws = await wsSuperAdmin();
    if (!ws) return NextResponse.json({ ok: false, error: 'sin workspace de super-admin' }, { status: 200 });
    const t = await runWithWorkspace(ws, () => recurvarPlanOwner());
    const colgadas = await runWithWorkspace(ws, () => limpiarDependenciasColgadas()).catch(() => 0);
    // Los proyectos los JUZGA el Perro (no una cuenta): el negocio cambia de fase, entran
    // clientes y se termina media hoja de ruta, y un ranking de hace un mes ya no dice nada.
    // `fallas` viaja en la respuesta a propósito — un cron que audita y se guarda el
    // resultado es un cron que no auditó.
    const p = await runWithWorkspace(ws, () => priorizarProyectosOwner('Repriorización diaria')).catch((e) => ({ movidos: 0, total: 0, norte: '', error: e instanceof Error ? e.message : String(e) } as Awaited<ReturnType<typeof priorizarProyectosOwner>>));
    // El aviso que faltaba: qué proyecto se vence o ya se venció. UN mensaje con todos
    // adentro, y solo si cambió algo desde el último — «las notificaciones de WhatsApp son
    // demasiadas» es la otra mitad del pedido, y un aviso por proyecto sería justo eso.
    const venc = await runWithWorkspace(ws, () => avisarVencimientosDelPlan(new Date().toISOString().slice(0, 10), ws))
      .catch((e) => ({ atrasados: 0, porVencer: 0, enviado: false, motivo: e instanceof Error ? e.message : String(e) }));
    console.log(`[cron plan-recurvar] vencimientos: ${venc.atrasados} atrasados · ${venc.porVencer} por vencer · ${venc.enviado ? 'avisado' : `sin avisar (${venc.motivo ?? '—'})`}`);
    console.log(`[cron plan-recurvar] ws${ws} · ${t.movidas}/${t.total} tareas · ${t.conDeadline} por fecha · ${t.quietas} por quietud · ${t.frenadas} frenadas · ${t.fijadas} fijadas a mano · proyectos ${p.movidos}/${p.total}${p.repetidos ? ` (${p.repetidos} se repiten y no compiten)` : ''} · norte «${p.norte}»${p.fallas ? `
${p.fallas}` : ''}`);
    return NextResponse.json({ ok: true, tareas: t, proyectos: p, colgadas, vencimientos: venc });
  } catch (err) {
    // Un cron que falla en silencio es un cron que nadie sabe que dejó de correr.
    console.error('[cron plan-recurvar]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
