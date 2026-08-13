// =============================================================================
// GET /api/cron/alerta-critica — la guardia que no se calla
// =============================================================================
// Dos cosas, en este orden, y las dos hacían falta:
//
//   1. MIRAR. `registrarEstadoMeta` solo corría dentro del cron HORARIO, así que
//      entre que la cuenta se frenaba y que quedaba registrada podía pasar
//      una hora entera. Acá se relee cada 10 minutos.
//   2. INSISTIR. Mientras haya un incidente crítico abierto, MaKo vuelve a
//      avisar según la cadencia de lib/alerta-critica.ts, hasta que se resuelva.
//
// El costo de mirar seguido es UNA llamada liviana a la Graph API por workspace
// conectado. Contra una cuenta frenada que nadie ve durante horas, no se discute.
//
// Auth por CRON_SECRET (Vercel Cron manda Authorization: Bearer …).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { getMetaAccountHealth } from '@/lib/meta-health';
import { registrarEstadoMeta } from '@/lib/meta-health-history';
import { insistirAlertasCriticas } from '@/lib/alerta-critica';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  const t0 = Date.now();
  try {
    const workspaces = await correrPorWorkspace('meta', async (ws) => {
      // Refrescar el estado. Si Meta no contesta NO se corta: los incidentes ya
      // abiertos tienen que seguir persiguiendo igual — que la API esté caída no
      // hace que la cuenta haya vuelto a entregar.
      try {
        await registrarEstadoMeta(await getMetaAccountHealth());
      } catch (e) {
        console.error(`[cron:alerta-critica] ws=${ws} no se pudo leer Meta: ${e instanceof Error ? e.message : String(e)}`);
      }
      const res = await insistirAlertasCriticas(ws);
      // Se logea solo cuando hay algo: este cron corre 144 veces por día y una
      // línea por corrida vacía tapa la que importa.
      if (res.criticos || res.resueltos || res.errores) {
        console.log(`[cron:alerta-critica] ws=${ws} abiertos=${res.abiertos} criticos=${res.criticos} avisados=${res.avisados} resueltos=${res.resueltos} err=${res.errores}`);
      }
      return res;
    });
    return Response.json({ ok: true, workspaces, ms: Date.now() - t0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:alerta-critica] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
