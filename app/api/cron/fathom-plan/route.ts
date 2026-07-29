// =============================================================================
// GET /api/cron/fathom-plan — las reuniones del equipo se leen solas
// =============================================================================
// Cada corrida mira las grabaciones nuevas de Fathom de cada workspace conectado,
// se queda con las de EQUIPO (las de ventas/entrega no son del plan de ejecución),
// saca los compromisos y deja un BORRADOR pendiente + un WhatsApp al grupo. No crea
// tareas: se confirman al entrar al plan (ver lib/reunion-auto).
//
// Auth por CRON_SECRET (Vercel Cron manda Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { procesarReunionesNuevas } from '@/lib/reunion-auto';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(request: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  try {
    const resultados = await correrPorWorkspace('fathom', async (ws) => {
      const res = await procesarReunionesNuevas(ws);
      console.log(
        `[cron:fathom-plan] ws=${ws} miradas=${res.miradas} equipo=${res.deEquipo} nuevas=${res.nuevas} ` +
        `borradores=${res.conTareas} tareas=${res.tareas} avisados=${res.avisados} sinAviso=${res.sinAviso} err=${res.errores}` +
        (res.avisoError ? ` · WhatsApp NO salió: ${res.avisoError}` : ''),
      );
      return res;
    });
    return Response.json({ ok: true, workspaces: resultados });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:fathom-plan] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
