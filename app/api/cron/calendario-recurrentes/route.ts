// =============================================================================
// Cron: las Publicaciones que se repiten (29/10/2026), cada 6 horas
// =============================================================================
// Martín, en la llamada con Thiago (29/10, [19:25]): «podés programarte publicaciones recurrentes». Por cada negocio con Zernio, le
// crea a cada Publicación con regla («Se repite», mig 0349) las veces de hoy a dos días, con su archivo copiado, y las programa
// en la red por el mismo camino que «Programar» (lib/calendario-recurrentes.ts → `programarPublicaciones`). Nada hacia atrás: con
// el cron caído, la vez que pasó no se publica tarde. Cada 6 horas y no una vez por día: una vez que falló (Zernio caído) se
// reintenta en el día, y como crea dos días adelante, ninguna llega justo.
//
// Auth: Bearer ${CRON_SECRET} (mismo patrón que meta-leads-poll).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { generarRecurrentes } from '@/lib/calendario-recurrentes';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;
  const tStart = Date.now();
  const workspaces = await correrPorWorkspace('zernio', async (ws) => {
    const r = await generarRecurrentes();
    if (r.moldes || r.sinMigracion) {
      console.log(`[cron:calendario-recurrentes] ws${ws} moldes=${r.moldes} creadas=${r.creadas} programadas=${r.programadas} incompletos=${r.incompletos} fallidas=${r.fallidas.length}${r.sinMigracion ? ' sin_migracion' : ''}`);
    }
    for (const f of r.fallidas.slice(0, 5)) console.warn(`[cron:calendario-recurrentes] ws${ws}: ${f}`);
    return r;
  });
  return Response.json({ ok: true, workspaces, ms: Date.now() - tStart });
}
