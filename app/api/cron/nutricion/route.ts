// =============================================================================
// Cron: motor de nutrición (VSL funnel) — Hito 0 (dry-run)
// =============================================================================
// Cada corrida: (1) inscribe leads que cayeron en la cohorte de una secuencia
// activa, (2) procesa los envíos vencidos. Hito 0 NO envía por ningún canal —
// los canales (Resend / Chatwoot) llegan en hitos siguientes.
//
// Modos:
//   - default        → dry-run puro: computa y muestra, NO escribe nada.
//   - ?commit=1       → persiste inscripciones y avanza la máquina; los envíos
//                       se registran como 'simulado' (sin canal real todavía).
//
// El cron programado en vercel.json corre sin querystring → siempre dry-run.
// Auth: Bearer ${CRON_SECRET} (mismo patrón que los demás crons).
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  planificarInscripciones,
  planificarEnvios,
  comprometerInscripciones,
  comprometerEnviosSimulados,
} from '@/lib/nutricion';

export const dynamic = 'force-dynamic';

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

  const commit = new URL(request.url).searchParams.get('commit') === '1';

  try {
    if (!commit) {
      const [inscribiria, enviaria] = await Promise.all([
        planificarInscripciones(),
        planificarEnvios(),
      ]);
      return Response.json({
        ok: true,
        modo: 'dry-run',
        inscribiria_count: inscribiria.length,
        enviaria_count: enviaria.length,
        inscribiria,
        enviaria,
      });
    }

    const inscriptas = await comprometerInscripciones();
    const procesados = await comprometerEnviosSimulados();
    return Response.json({
      ok: true,
      modo: 'commit (simulado)',
      inscriptas,
      procesados,
      nota: 'Hito 0: no se envió por ningún canal real. El envío real llega con Resend/Chatwoot.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:nutricion] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
