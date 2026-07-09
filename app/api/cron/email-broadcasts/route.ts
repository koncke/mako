// =============================================================================
// Cron: broadcasts de email programados — POR WORKSPACE
// =============================================================================
// Itera los workspaces ACTIVOS y, en los que tienen envío de email habilitado
// (setting envio_email_enabled; el dueño hereda el env), procesa los broadcasts
// en estado 'programado' cuya fecha venció. Un workspace con el envío apagado
// deja sus programados intactos (salen cuando lo active — no se "queman" como
// simulado). ?force=1&ws=N procesa ese workspace igual (modo simulado, para
// probar la máquina a mano). Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { procesarBroadcastsProgramados } from '@/lib/email-marketing';
import { envioEmailHabilitado } from '@/lib/envio-flags';
import { listarWorkspaces, runWithWorkspace, OWNER_WS } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const unauth = checkAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const wsParam = Number(url.searchParams.get('ws'));
  const wsExplicito = Number.isFinite(wsParam) && wsParam > 0 ? wsParam : null;

  const tStart = Date.now();
  try {
    const activos = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
    const activosIds = new Set(activos.map((w) => w.id));

    // Forzado manual: un solo workspace ACTIVO (default dueño), aunque tenga el
    // envío apagado (los envíos quedan 'simulado' — lo decide enviarBroadcast).
    if (force) {
      const ws = wsExplicito ?? OWNER_WS;
      if (!activosIds.has(ws)) return Response.json({ ok: false, error: `workspace ${ws} inexistente o pausado` }, { status: 404 });
      const r = await runWithWorkspace(ws, () => procesarBroadcastsProgramados());
      return Response.json({ ok: true, ws, modo: 'forzado', ...r, ms: Date.now() - tStart });
    }

    const objetivo = wsExplicito ? activos.filter((w) => w.id === wsExplicito) : activos;

    const resultados: Array<{ ws: number; modo: string; [k: string]: unknown }> = [];
    for (const w of objetivo) {
      try {
        const r = await runWithWorkspace(w.id, async () => {
          if (!(await envioEmailHabilitado())) return { ws: w.id, modo: 'off (programados esperan)' };
          const proc = await procesarBroadcastsProgramados();
          return { ws: w.id, modo: 'envío real', ...proc };
        });
        resultados.push(r);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron:email-broadcasts] ws ${w.id} error: ${msg}`);
        resultados.push({ ws: w.id, modo: 'error', error: msg });
      }
    }
    // Todos fallaron → 500 para que el monitoreo del cron dispare.
    const errores = resultados.filter((r) => r.modo === 'error').length;
    const todoFallo = resultados.length > 0 && errores === resultados.length;
    return Response.json(
      { ok: !todoFallo, total: resultados.length, errores, workspaces: resultados, ms: Date.now() - tStart },
      { status: todoFallo ? 500 : 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:email-broadcasts] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
