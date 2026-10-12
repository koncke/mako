// =============================================================================
// Cron: la red de seguridad de los cobros (Stripe y Mercado Pago), cada 30 minutos
// =============================================================================
// Los webhooks (app/api/webhooks/stripe y app/api/webhooks/mercadopago) son el camino rápido, y un
// aviso se puede perder: un deploy en el medio, un 200 que se contestó porque reintentar no lo
// arreglaba, lo que siguió en `after()` y se murió. Y hay un caso en que el aviso NO EXISTE: Mercado
// Pago no manda notificaciones a la notification_url de un pago de PRUEBA, así que probar el flujo
// entero depende de esto. El cron relee al proveedor los cobros pendientes de los últimos días y
// aplica lo que la pasarela ya confirmó, y reintenta las altas de MaKo que quedaron en error
// (`reconciliarCobros`, lib/cobros.ts: idempotente, repasar no duplica nada).
//
// Molde: app/api/cron/meta-leads-poll (la red de seguridad del webhook de Meta).
//
// QUIÉNES: los workspaces con una pasarela conectada (`workspacesConPasarela`, que lee las filas de
// ruteo 'stripe' y 'mercadopago'), cada uno adentro de SU `runWithWorkspace`: sin el contexto,
// getTenantDb y logLeadEvent caen al ws1 (Mauricio, un cliente). Uno que falla no corta al resto.
//
// vercel.json: `17,47 * * * *` (cada 30 minutos, corrido de los demás crons de media hora).
// Auth: Bearer ${CRON_SECRET} (lib/cron-auth.ts).

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { runWithWorkspace } from '@/lib/workspace';
import { reconciliarCobros, workspacesConPasarela } from '@/lib/cobros';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** No se arranca un workspace nuevo si quedan menos de esto: uno lento no puede pasar el maxDuration. */
const RESERVA_MS = 60_000;

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

type Resultado = { ws: number; ok: boolean; revisados?: number; cambiados?: number; errores?: number; error?: string };

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const t0 = Date.now();

  let workspaces: number[];
  try {
    workspaces = (await workspacesConPasarela()).sort((a, b) => a - b);
  } catch (e) {
    console.error('[cron:cobros-reconciliar] no pude leer los workspaces con pasarela:', msg(e));
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }

  // El orden ROTA cada media hora: si uno lento se come la corrida, la próxima arranca por otro y
  // nadie queda sin turno para siempre. Los que no entran salen en `sinTurno` (no se pierden en silencio).
  const giro = workspaces.length ? Math.floor(t0 / 1_800_000) % workspaces.length : 0;
  const orden = [...workspaces.slice(giro), ...workspaces.slice(0, giro)];

  const resultados: Resultado[] = [];
  const sinTurno: number[] = [];
  for (const ws of orden) {
    if (Date.now() - t0 > maxDuration * 1000 - RESERVA_MS) { sinTurno.push(ws); continue; }
    try {
      const r = await runWithWorkspace(ws, () => reconciliarCobros(ws));
      resultados.push({ ws, ok: true, ...r });
      if (r.cambiados || r.errores) {
        console.log(`[cron:cobros-reconciliar] ws=${ws} revisados=${r.revisados} cambiados=${r.cambiados} errores=${r.errores}`);
      }
    } catch (e) {
      console.error(`[cron:cobros-reconciliar] ws=${ws} falló:`, msg(e));
      resultados.push({ ws, ok: false, error: msg(e) });
    }
  }
  if (sinTurno.length) console.warn(`[cron:cobros-reconciliar] sin turno en esta corrida: ${sinTurno.join(', ')}`);

  return Response.json({ ok: true, workspaces: resultados, sinTurno, ms: Date.now() - t0 });
}
