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
import { checkCronAuth } from '@/lib/cron-auth';
import { procesarReunionesNuevas } from '@/lib/reunion-auto';
import { cruzarPendientes } from '@/lib/reunion-cruce';
import { correrRonda } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** El reloj de la ronda, con su reserva de salida. `correrRonda` le resta la suya. */
const TECHO_MS = 300_000;
/** Lo mínimo que hace falta para que a un workspace le valga la pena arrancar: el
 *  extractor de una reunión más una corrida del juez. Con menos, se difiere — y
 *  diferir es gratis, porque sin candado la próxima corrida la agarra igual. */
const MINIMO_UTIL_MS = 180_000;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;

  try {
    // ⚠️ `correrRonda` Y NO `correrPorWorkspace`, Y EL DEADLINE VIAJA HASTA ADENTRO.
    //
    // `correrPorWorkspace` es `correrRonda` pelado: sin techo, sin mínimo y sin
    // rotación. O sea que el PRIMER workspace de la lista podía comerse los 300 s
    // enteros y los demás no arrancaban nunca — y como no hay rotación, era siempre
    // el mismo primero. Inanición silenciosa: el cron contesta 200 y para los otros
    // clientes es como si no existiera.
    //
    // Y el techo entre workspaces NO alcanza solo: `correrRonda` mira el reloj ENTRE
    // iteraciones, no adentro de una. Sin el `hasta` que se pasa abajo, el primer
    // workspace con tres reuniones largas sigue reventando el tope — y morir a mitad
    // es peor que no arrancar, porque no escribe ni el borrador ni el candado y la
    // reunión se reprocesa entera en las 13 corridas del día.
    const ronda = await correrRonda('fathom', async (ws, deadline) => {
      const res = await procesarReunionesNuevas(ws, { hasta: deadline });
      // EL BARRIDO DEL CRUCE (16/10/2026): los borradores pendientes que quedaron sin cruzar contra el
      // tablero —el cruce no entró en el reloj, falló, o los dejó un camino que no cruza— se cruzan
      // acá, con lo que sobre del reloj. El modal ya no cruza nada (lib/reunion-cruce.ts).
      const barrido = await cruzarPendientes({ hasta: deadline }).catch((e) => {
        console.error(`[cron:fathom-plan] ws=${ws} barrido del cruce: ${e instanceof Error ? e.message : String(e)}`);
        return { cruzados: 0, fallidos: 0, marcadas: 0 };
      });
      console.log(
        `[cron:fathom-plan] ws=${ws} miradas=${res.miradas} alPlan=${res.alPlan} nuevas=${res.nuevas} ` +
        `borradores=${res.conTareas} tareas=${res.tareas} avisados=${res.avisados} sinAviso=${res.sinAviso} err=${res.errores}` +
        (res.sinTiempo ? ` · ${res.sinTiempo} sin tiempo (quedan para la próxima)` : '') +
        (res.enCurso ? ` · ${res.enCurso} ya las leía otro` : '') +
        (res.descartadasAnotadas != null ? ` · descartadas anotadas=${res.descartadasAnotadas}` : '') +
        ` · cruzados=${(res.cruzados ?? 0) + barrido.cruzados}${barrido.fallidos ? ` (sin cruzar ${barrido.fallidos})` : ''}` +
        (res.avisoError ? ` · WhatsApp NO salió: ${res.avisoError}` : ''),
      );
      return { ...res, barrido };
    }, { techoMs: TECHO_MS, minimoMs: MINIMO_UTIL_MS, rotacion: 'fathom-plan' });

    // TRES estados y no dos, igual que `closing-sync`: corrió · SIN TURNO (diferido a
    // la próxima ronda, que no es un error sino cómo funciona la rotación) · falló.
    // Contar «sin turno» como error dejaría la alarma sonando desde el tercer cliente.
    return Response.json({
      ok: ronda.conectados.length === 0 || ronda.resultados.length > 0,
      workspaces: ronda.resultados,
      sinTurno: ronda.sinTurno,
      conectados: ronda.conectados.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:fathom-plan] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
