// =============================================================================
// /api/onboarding/plan-arranque — el plan propio del cliente, al cerrar el onboarding
// =============================================================================
// POST → { ok, id, url, n } | { ok:true, skip:true } | { ok:false, error }
//
// Corre UNA vez, al terminar el wizard: recién ahí están guardados el diagnóstico, el
// archivero, los avatares, las razones y el lead magnet, que es todo el material del
// que sale el plan. Por eso NO va colgado de /api/onboarding (esa ruta no declara
// maxDuration y esto tarda decenas de segundos), sino acá, con sus 120s propios.
//
// No inserta tareas: deja un borrador y devuelve el link a /plan/revisar/<id>. El
// candado del ref hace que llamarlo dos veces devuelva el mismo borrador, no dos.
// =============================================================================

import { runWithWorkspace, getCapaActual } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { resolverWsAdmin } from '@/lib/archivero';
import { crearBorradorPlanArranque } from '@/lib/todo-seed-ia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    // El gate por CAPA, no un `if` nuevo: es el mismo interruptor que ya decide si a
    // esta capa le corresponde un tablero sembrado (hoy solo 'completo'). Devuelve ok
    // igual para que el wizard siga de largo sin tratarlo como un error.
    if (!capaDef(await getCapaActual()).seedBoardVsl) return Response.json({ ok: true, skip: true });
    try {
      const r = await crearBorradorPlanArranque();
      if (!r.ok) {
        // Que falle NO puede frenar el onboarding: el cliente igual entra a la app y
        // `seedTodoBoardSiVacio` le siembra el piso factual en la primera visita a /plan.
        console.warn(`[api:plan-arranque] ws ${ws}: ${r.error}`);
        return Response.json({ ok: false, error: r.error }, { status: 200 });
      }
      console.log(`[api:plan-arranque] ws ${ws}: ${r.n} tareas → ${r.id}`);
      return Response.json({ ok: true, id: r.id, url: `/plan/revisar/${r.id}`, n: r.n });
    } catch (e) {
      console.error(`[api:plan-arranque] ws ${ws}: ${msg(e)}`);
      return Response.json({ ok: false, error: msg(e) }, { status: 200 });
    }
  });
}
