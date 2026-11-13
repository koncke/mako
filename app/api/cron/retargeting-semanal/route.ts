// =============================================================================
// /api/cron/retargeting-semanal — los lunes, MaKo revisa las charlas de WhatsApp de los leads (13/11/2026, lib/retargeting.ts)
// =============================================================================
// Leila, en la llamada del 13/11: «que lo haga una vez por semana, no constantemente». Corre en los negocios que venden por
// WhatsApp (con charlas enlazadas a leads en los últimos 7 días), uno por uno: un negocio que falla no corta a los demás.
// Meta, sólo en los que prendieron sus públicos (`configurar_retargeting`). Auth: Bearer CRON_SECRET.
//   ?dry=1   → en seco: arma todo y no llama a Meta (las etiquetas sí).
//   ?ws=N    → sólo ese negocio.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { revisarRetargeting } from '@/lib/retargeting';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Los negocios con charlas de WhatsApp enlazadas a un lead en 7 días: los demás no tienen qué revisar. */
async function conCharlas(): Promise<Set<number>> {
  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await getSupabaseServer().from('wa_mensajes').select('workspace_id').not('lead_id', 'is', null).gt('wa_timestamp', desde).limit(20_000);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ workspace_id: number }>).map((r) => Number(r.workspace_id)));
}

export async function GET(req: NextRequest) {
  const fail = checkCronAuth(req);
  if (fail) return fail;
  const t0 = Date.now();
  const url = new URL(req.url);
  const enSeco = url.searchParams.get('dry') === '1';
  const wsParam = Number(url.searchParams.get('ws'));
  const wsExplicito = Number.isSafeInteger(wsParam) && wsParam > 0 ? wsParam : null;

  let objetivo: number[];
  try {
    const activos = (await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id);
    const conAlgo = wsExplicito ? null : await conCharlas();
    objetivo = wsExplicito ? activos.filter((id) => id === wsExplicito) : activos.filter((id) => conAlgo!.has(id));
  } catch (e) {
    console.error(`[cron:retargeting-semanal] no pude listar los negocios: ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
  if (wsExplicito && !objetivo.length) return Response.json({ ok: false, error: `el negocio ${wsExplicito} no existe o está pausado` }, { status: 404 });

  const resultados: Array<Record<string, unknown>> = [];
  for (const ws of objetivo) {
    // Con el tope de la función cerca, los que faltan quedan para la semana que viene (y se dice cuáles).
    if (Date.now() - t0 > 250_000) { resultados.push({ ws, modo: 'sin_tiempo' }); continue; }
    try {
      const r = await runWithWorkspace(ws, () => revisarRetargeting(ws, { enSeco }));
      resultados.push({ ws, modo: 'revisado', segmentos: r.segmentos, sinRevisar: r.sinRevisar, cambios: r.cambios, meta: r.publicosMeta.prendido ? r.publicosMeta.via : 'apagado', aviso: r.publicosMeta.aviso });
    } catch (e) {
      console.error(`[cron:retargeting-semanal] ws ${ws}: ${msg(e)}`);
      resultados.push({ ws, modo: 'error', error: msg(e).slice(0, 300) });
    }
  }
  const errores = resultados.filter((r) => r.modo === 'error').length;
  const todoFallo = resultados.length > 0 && errores === resultados.length;
  return Response.json({ ok: !todoFallo, enSeco, total: resultados.length, errores, negocios: resultados, ms: Date.now() - t0 }, { status: todoFallo ? 500 : 200 });
}
