// =============================================================================
// Cron: cerrar los tickets cuyo arreglo ya está en producción, y avisarle a cada cliente
// =============================================================================
// Martín (17/10/2026): «cuando el arreglo está en producción, el ticket se cierra solo y al usuario le llega el aviso
// por donde lo levantó». Cada 15 minutos:
//   1. los tickets en curso que nombra una bitácora DE ESTE DEPLOY (`tickets: [n]` en un hito) pasan a «Resuelto»;
//   2. a cada cliente con algo nuevo sin avisar (resuelto, cerrado, o una pregunta del equipo) le llega el aviso.
// Cómo y por qué, en lib/tickets-cierre.ts. Sin tickets abiertos, son dos consultas y nada más.
//
//   GET /api/cron/tickets   (Auth: Bearer ${CRON_SECRET})
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { avisarPendientes, cerrarLosDesplegados } from '@/lib/tickets-cierre';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const no = checkCronAuth(req);
  if (no) return no;
  try {
    const cerrados = await cerrarLosDesplegados();
    const avisos = await avisarPendientes();
    if (cerrados.length || avisos.avisados || avisos.fallidos) {
      console.log(`[cron:tickets] cerrados ${cerrados.join(', ') || '—'} · avisados ${avisos.avisados} · sin avisar ${avisos.fallidos}`);
    }
    return Response.json({ ok: true, cerrados, ...avisos });
  } catch (e) {
    // La mig 0311 sin aplicar no es un error del cron: no hay tickets todavía.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron:tickets] ${msg}`);
    return Response.json({ ok: false, error: msg.slice(0, 300) }, { status: 500 });
  }
}
