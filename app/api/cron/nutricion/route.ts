// =============================================================================
// Cron: motor de nutrición (VSL funnel)
// =============================================================================
// Cada corrida: (1) inscribe leads que cayeron en la cohorte de una secuencia
// activa, (2) procesa los envíos vencidos con rate-limiting anti-baneo (ventana
// horaria, tope diario/por-corrida, 1 msg/lead cada 20h).
//
// Modos:
//   - default        → dry-run puro: computa y muestra, NO escribe nada.
//   - ?commit=1       → persiste inscripciones y procesa envíos. El envío REAL
//                       por WhatsApp (Chatwoot) ocurre solo si
//                       NUTRICION_SEND_ENABLED=true; si no, avanza 'simulado'.
//   - ?commit=1&ignorar_ventana=1 → ignora la ventana horaria (tests).
//
// El cron de vercel.json corre sin querystring → dry-run. Para enviar de verdad
// hay que llamarlo con ?commit=1 (o ajustar el cron al ir a vivo).
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  planificarInscripciones,
  planificarEnvios,
  comprometerInscripciones,
  procesarEnvios,
} from '@/lib/nutricion';
import { listarWorkspaces, runWithWorkspace, OWNER_WS } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// Corre `fn` por cada workspace ACTIVO (cada uno scopeado por runWithWorkspace,
// así getTenantDb/getSecuenciasActivas resuelven las secuencias de ESE cliente).
// Antes el cron corría una sola vez en el contexto del dueño → la nutrición de
// los clientes nunca se ejecutaba.
async function porWorkspace<T>(fn: () => Promise<T>): Promise<Array<{ ws: number; ok: boolean; r?: T; error?: string }>> {
  let wss: Array<{ id: number; estado?: string }>;
  try { wss = (await listarWorkspaces()).filter((w) => w.estado === 'activo'); }
  catch { wss = [{ id: OWNER_WS }]; }
  const out: Array<{ ws: number; ok: boolean; r?: T; error?: string }> = [];
  for (const w of wss) {
    try { out.push({ ws: w.id, ok: true, r: await runWithWorkspace(w.id, fn) }); }
    catch (e) { out.push({ ws: w.id, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  }
  return out;
}

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

export async function GET(request: NextRequest) {
  const unauth = checkAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  // Envío real habilitado por canal (WhatsApp y/o Email). Cualquiera de los dos
  // hace que el cron programado commitee (inscribe + procesa). Cada canal decide
  // adentro si manda de verdad o avanza 'simulado'.
  const sendEnabled = process.env.NUTRICION_SEND_ENABLED === 'true' || process.env.EMAIL_SEND_ENABLED === 'true';
  // Antes de ir a vivo queda en dry-run para no consumir el backlog.
  // ?commit=1 fuerza el commit en modo simulado (para probar la máquina a mano).
  const commit = sendEnabled || url.searchParams.get('commit') === '1';

  try {
    if (!commit) {
      const workspaces = await porWorkspace(async () => {
        const [inscribiria, enviaria] = await Promise.all([planificarInscripciones(), planificarEnvios()]);
        return { inscribiria_count: inscribiria.length, enviaria_count: enviaria.length };
      });
      return Response.json({ ok: true, modo: 'dry-run', workspaces });
    }

    const workspaces = await porWorkspace(async () => {
      const inscriptas = await comprometerInscripciones();
      const proc = await procesarEnvios({ ignorarVentana: url.searchParams.get('ignorar_ventana') === '1' });
      return { inscriptas, ...proc };
    });
    return Response.json({ ok: true, modo: sendEnabled ? 'commit (envío real)' : 'commit (simulado)', workspaces });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:nutricion] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
