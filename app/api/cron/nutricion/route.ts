// =============================================================================
// Cron: motor de nutrición (VSL funnel) — POR WORKSPACE
// =============================================================================
// Cada corrida itera los workspaces ACTIVOS y, dentro de cada uno: (1) inscribe
// leads que cayeron en la cohorte de una secuencia activa, (2) procesa los
// envíos vencidos con rate-limiting anti-baneo (ventana horaria, tope
// diario/por-corrida POR WORKSPACE, 1 msg/lead cada 20h).
//
// El envío real se decide por workspace con lib/envio-flags.ts (setting
// envio_whatsapp_enabled / envio_email_enabled; el dueño hereda el env si no
// tiene setting). Un workspace SIN ningún canal habilitado no se toca (modo
// 'off': no inscribe ni consume pasos — los flags globales de deploy ya no
// comprometen a todos los clientes a la vez).
//
// Modos manuales (para probar la máquina):
//   ?dry=1[&ws=N]     → dry-run del workspace N (default dueño): lista qué
//                       inscribiría/enviaría, sin escribir.
//   ?commit=1[&ws=N]  → fuerza el commit del workspace N (default dueño) aunque
//                       no tenga canales habilitados; los pasos de canales
//                       apagados avanzan como 'simulado' (semántica histórica).
//   &ignorar_ventana=1 → ignora la ventana horaria (tests).
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  planificarInscripciones,
  planificarEnvios,
  comprometerInscripciones,
  procesarEnvios,
} from '@/lib/nutricion';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { listarWorkspaces, runWithWorkspace, OWNER_WS } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

type ResultadoWs = { ws: number; modo: string; [k: string]: unknown };

export async function GET(request: NextRequest) {
  const unauth = checkAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  const ignorarVentana = url.searchParams.get('ignorar_ventana') === '1';
  const wsParam = Number(url.searchParams.get('ws'));
  const wsExplicito = Number.isFinite(wsParam) && wsParam > 0 ? wsParam : null;

  try {
    const activos = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
    const activosIds = new Set(activos.map((w) => w.id));
    // Los modos manuales también exigen un workspace ACTIVO (no operar pausados).
    const resolverManual = (): number | Response => {
      const ws = wsExplicito ?? OWNER_WS;
      if (!activosIds.has(ws)) return Response.json({ ok: false, error: `workspace ${ws} inexistente o pausado` }, { status: 404 });
      return ws;
    };

    // ── Modo manual: dry-run de UN workspace (default dueño) ──────────────────
    if (url.searchParams.get('dry') === '1') {
      const ws = resolverManual();
      if (ws instanceof Response) return ws;
      const [inscribiria, enviaria] = await runWithWorkspace(ws, () =>
        Promise.all([planificarInscripciones(), planificarEnvios()]),
      );
      return Response.json({
        ok: true, ws, modo: 'dry-run',
        inscribiria_count: inscribiria.length, enviaria_count: enviaria.length,
        inscribiria, enviaria,
      });
    }

    // ── Modo manual: commit forzado de UN workspace (default dueño) ───────────
    if (url.searchParams.get('commit') === '1') {
      const ws = resolverManual();
      if (ws instanceof Response) return ws;
      const r = await runWithWorkspace(ws, async () => {
        const inscriptas = await comprometerInscripciones();
        const proc = await procesarEnvios({ ignorarVentana, simularApagados: true });
        return { inscriptas, ...proc };
      });
      return Response.json({ ok: true, ws, modo: 'commit (forzado, apagados=simulado)', ...r });
    }

    // ── Corrida normal del cron: todos los workspaces activos ─────────────────
    const objetivo = wsExplicito ? activos.filter((w) => w.id === wsExplicito) : activos;

    const resultados: ResultadoWs[] = [];
    for (const w of objetivo) {
      try {
        const r = await runWithWorkspace(w.id, async (): Promise<ResultadoWs> => {
          const [waOn, emailOn] = await Promise.all([envioWhatsappHabilitado(), envioEmailHabilitado()]);
          if (!waOn && !emailOn) return { ws: w.id, modo: 'off' };
          const inscriptas = await comprometerInscripciones();
          const proc = await procesarEnvios({ ignorarVentana });
          return { ws: w.id, modo: `commit (wa:${waOn ? 'on' : 'off'} email:${emailOn ? 'on' : 'off'})`, inscriptas, ...proc };
        });
        resultados.push(r);
      } catch (err) {
        // Un workspace que falla no corta a los demás.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron:nutricion] ws ${w.id} error: ${msg}`);
        resultados.push({ ws: w.id, modo: 'error', error: msg });
      }
    }

    // Si TODOS los workspaces fallaron, el cron debe reportar fallo (500) para
    // que el monitoreo de Vercel lo marque — con 200 nadie se entera.
    const errores = resultados.filter((r) => r.modo === 'error').length;
    const todoFallo = resultados.length > 0 && errores === resultados.length;
    return Response.json(
      { ok: !todoFallo, total: resultados.length, errores, workspaces: resultados },
      { status: todoFallo ? 500 : 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:nutricion] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
