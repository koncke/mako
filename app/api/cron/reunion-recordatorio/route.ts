// =============================================================================
// GET /api/cron/reunion-recordatorio — «en media hora entrás a la R1 con X»
// =============================================================================
// Corre seguido y manda el recordatorio de las reuniones que están por empezar,
// con el link al resumen del lead. El candado contra repetidos vive en la
// lógica (una marca por reunión), NO en la frecuencia de este cron — así
// cambiar el schedule no duplica avisos. Ver lib/reunion-recordatorio.ts.
//
// Itera los workspaces con Calendly conectado: la fecha con hora (junta_1_at /
// junta_2_at) la deja ese webhook, y sin ella no hay a qué hora avisar.
//
// Auth por CRON_SECRET (Vercel Cron manda Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { mandarRecordatoriosDeReunion } from '@/lib/reunion-recordatorio';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  const t0 = Date.now();
  try {
    const workspaces = await correrPorWorkspace('calendly', async (ws) => {
      const res = await mandarRecordatoriosDeReunion(ws);
      // Solo se logea cuando hubo ALGO en la ventana: este cron corre cada 10
      // minutos y una línea por corrida vacía son ~100 líneas de ruido por día,
      // que es como se pierde el log que sí importa.
      if (res.miradas > 0) {
        console.log(`[cron:reunion-recordatorio] ws=${ws} miradas=${res.miradas} avisados=${res.avisados} yaAvisadas=${res.yaAvisadas} err=${res.errores}`);
      }
      return res;
    });
    return Response.json({ ok: true, workspaces, ms: Date.now() - t0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:reunion-recordatorio] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
