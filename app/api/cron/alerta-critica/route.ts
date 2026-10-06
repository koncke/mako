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
import { vigilarVozMaKo } from '@/lib/canal-vigilante';
import { vigilarLineasClientes } from '@/lib/lineas-vigilante';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  const t0 = Date.now();

  // ⚠️ LA VOZ, ANTES QUE NADA. Este cron es «la guardia que no se calla», y el
  // 8/9/2026 se descubrió que llevaba SEIS DÍAS gritando contra un socket muerto:
  // la línea de WhatsApp de MaKo informaba «open» y no entraba ni salía un
  // mensaje. Se generaron avisos, se pagó la IA que los redactó, y ninguno llegó.
  //
  // Va primero y por EMAIL (ver lib/canal-vigilante.ts): una alarma sobre el canal
  // caído no puede viajar por ese canal. Y nunca tira: si la vigilancia falla, el
  // resto del cron tiene que correr igual.
  const voz = await vigilarVozMaKo().catch((e) => {
    console.error(`[cron:alerta-critica] no se pudo vigilar la voz: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  if (voz && !voz.viva) console.error(`[cron:alerta-critica] ⛔ LA VOZ DE MAKO ESTÁ CAÍDA (aviso: ${voz.aviso})`);

  // ⚠️ Y LAS LÍNEAS DE LOS CLIENTES, que hasta el 06/10/2026 no las miraba nadie: la del
  // ws1 estuvo muerta 26 días (03/09 → 29/09) sin un solo aviso. Ésta sí avisa por
  // WhatsApp —sale por la voz de MaKo al grupo del cliente, no por la línea caída— y sólo
  // al cliente (decisión del 06/10/2026). Va después de la voz: si la voz está caída, el
  // aviso no llega, y eso ya lo grita el mail de arriba. Best-effort, como la voz.
  const lineas = await vigilarLineasClientes().catch((e) => {
    console.error(`[cron:alerta-critica] no se pudieron vigilar las líneas de los clientes: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  if (lineas?.error) console.error(`[cron:alerta-critica] líneas de clientes: ${lineas.error}`);
  for (const l of lineas?.lineas ?? []) {
    if (l.que === 'avisar' || l.error) console.log(`[cron:alerta-critica] línea ${l.linea} (ws ${l.ws}) ${l.sondeo} → ${l.que}${l.llego === false ? ' (NO llegó)' : ''}${l.error ? ` — ${l.error}` : ''}`);
  }

  try {
    // Compartido entre las iteraciones: dos workspaces pueden apuntar a la MISMA
    // cuenta de Meta (le pasa al Cliente de Prueba, que tiene copia de las
    // credenciales del dueño). Una cuenta suspendida es UN problema y se avisa
    // UNA vez. Ver la nota en lib/alerta-critica.ts.
    const cuentasYaAvisadas = new Set<string>();
    const workspaces = await correrPorWorkspace('meta', async (ws) => {
      // Refrescar el estado. Si Meta no contesta NO se corta: los incidentes ya
      // abiertos tienen que seguir persiguiendo igual — que la API esté caída no
      // hace que la cuenta haya vuelto a entregar.
      try {
        await registrarEstadoMeta(await getMetaAccountHealth());
      } catch (e) {
        console.error(`[cron:alerta-critica] ws=${ws} no se pudo leer Meta: ${e instanceof Error ? e.message : String(e)}`);
      }
      const res = await insistirAlertasCriticas(ws, { cuentasYaAvisadas });
      // Se logea solo cuando hay algo: este cron corre 144 veces por día y una
      // línea por corrida vacía tapa la que importa.
      if (res.criticos || res.resueltos || res.errores) {
        console.log(`[cron:alerta-critica] ws=${ws} abiertos=${res.abiertos} criticos=${res.criticos} avisados=${res.avisados} resueltos=${res.resueltos} err=${res.errores}`);
      }
      return res;
    });
    return Response.json({ ok: true, voz, lineas, workspaces, ms: Date.now() - t0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:alerta-critica] error: ${message}`);
    return Response.json({ ok: false, error: message, voz, lineas }, { status: 500 });
  }
}
