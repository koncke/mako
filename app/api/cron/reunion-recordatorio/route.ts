// =============================================================================
// GET /api/cron/reunion-recordatorio — los recordatorios de la reunión
// =============================================================================
// Dos emisores, cada 10 minutos (vercel.json):
//
//   1. AL DUEÑO: «en media hora entrás a la R1 con X», con el link al resumen del lead.
//      Itera los workspaces con Calendly conectado. Ver lib/reunion-recordatorio.ts.
//   2. AL LEAD (06/10/2026): 24 h, 1 h y 15 min antes, con el link de la reunión, a los
//      negocios que lo PRENDIERON en /automations. Recorre TODOS los workspaces activos, no sólo
//      los de Calendly: Código Inmobiliario agenda por Cal.com, que también deja `junta_X_at`
//      (app/api/webhooks/calcom/route.ts llama a las mismas funciones). Cada uno corre adentro de
//      su `runWithWorkspace`, y el apagado sale en una lectura sin tocar los leads.
//
// El candado contra repetidos vive en la lógica (una marca por reunión, y por toque en el del
// lead), NO en la frecuencia de este cron — así cambiar el schedule no duplica mensajes.
//
// `?dry=1`: lista lo que el recordatorio al lead MANDARÍA, sin mandar ni marcar nada, y aunque
// el interruptor del negocio esté apagado. Es el paso de antes de prenderlo. Con `dry` tampoco
// sale el aviso al dueño: «sin mandar» es sin mandar NADA.
//
// Auth por CRON_SECRET (Vercel Cron manda Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { listarWorkspaces } from '@/lib/workspace';
import { mandarRecordatoriosDeReunion, mandarRecordatoriosAlLead, type ResultadoAlLead } from '@/lib/reunion-recordatorio';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Hasta cuándo se le escribe a un lead en esta corrida: cada envío retiene el HTTP hasta ~9 s. */
const TECHO_ENVIOS_MS = 95_000;

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  const dry = request.nextUrl.searchParams.get('dry') === '1';
  const t0 = Date.now();
  try {
    const workspaces = dry ? [] : await correrPorWorkspace('calendly', async (ws) => {
      const res = await mandarRecordatoriosDeReunion(ws);
      // Solo se logea cuando hubo ALGO en la ventana: este cron corre cada 10
      // minutos y una línea por corrida vacía son ~100 líneas de ruido por día,
      // que es como se pierde el log que sí importa.
      if (res.miradas > 0) {
        console.log(`[cron:reunion-recordatorio] ws=${ws} miradas=${res.miradas} avisados=${res.avisados} yaAvisadas=${res.yaAvisadas} err=${res.errores}`);
      }
      return res;
    });

    // El recordatorio al lead, negocio por negocio. Un workspace que falla no corta al resto.
    const activos = (await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id);
    const alLead: ResultadoAlLead[] = [];
    for (const ws of activos) {
      try {
        const r = await mandarRecordatoriosAlLead(ws, { dry, deadlineMs: t0 + TECHO_ENVIOS_MS });
        if (r.vencidos > 0 || r.errores.length) {
          console.log(`[cron:reunion-recordatorio] al lead ws=${ws} vencidos=${r.vencidos} enviados=${r.enviados} ya=${r.yaEnviados} sinTiempo=${r.sinTiempo} omitidos=${JSON.stringify(r.omitidos)} err=${r.errores.length}${dry ? ' (dry)' : ''}`);
        }
        // Sin `dry`, sólo vuelve lo que hizo algo: diez negocios apagados son diez renglones vacíos.
        if (dry || r.activo || r.errores.length) alLead.push(r);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[cron:reunion-recordatorio] al lead ws=${ws}: ${message}`);
        alLead.push({ ws, activo: false, envio: null, vencidos: 0, enviados: 0, yaEnviados: 0, omitidos: {}, sinTiempo: 0, errores: [message] });
      }
    }

    return Response.json({ ok: true, dry, workspaces, alLead, ms: Date.now() - t0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:reunion-recordatorio] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
