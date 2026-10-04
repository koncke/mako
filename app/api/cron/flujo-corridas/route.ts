// =============================================================================
// CRON: las corridas de flujo que quedaron dormidas (cada 5 min)
// =============================================================================
// Es la pieza que hace FUNCIONAL el Delay y el Condicional. Hasta el 04/10/2026
// `ejecutarPasos` era un `for` sincrónico adentro del webhook y el paso `esperar`
// hacía `break`: estaba declarado en el tipo desde el día uno y no se ejecutó nunca,
// porque no había dónde anotar en qué paso quedó. Con `flujo_corridas` (mig 0186) el
// motor se duerme y esto lo despierta.
//
// ⚠️ PREGUNTA A LA TABLA, NO ITERA WORKSPACES. Mismo criterio que
// `avisos-programados` e `insistencias`: recorrer los 10 workspaces × sus flujos cada
// cinco minutos son dos lecturas de `app_settings` por workspace y por tick. La tabla
// dice quién tiene algo vencido, y un tick sin nada cuesta UNA consulta — que es el
// caso normal, porque casi ningún flujo tiene delay.
//
// ⚠️ Y CADA CORRIDA AVANZA CON COMPARE-AND-SET sobre su paso (`lib/flujo-corridas.ts`),
// así que un reintento de Vercel o dos ticks que se pisen no ejecutan el mismo paso
// dos veces. Es el mismo reclamo atómico de `insistencias` y de la 0183.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { corridasVencidas } from '@/lib/flujo-corridas';
import { retomarCorrida } from '@/lib/flujos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  // El tope es por el `maxDuration`: una corrida puede mandar un mensaje y abrir una
  // pendiente, así que 50 por tick es lo que entra sin arriesgar el corte a mitad.
  // Lo que no entra queda para el tick siguiente — están ordenadas por vencimiento.
  const vencidas = await corridasVencidas(50);

  let retomadas = 0;
  for (const c of vencidas) {
    try { await retomarCorrida(c.ws, c); retomadas++; }
    catch (e) { console.error('[cron flujo-corridas]', c.id, e instanceof Error ? e.message : String(e)); }
  }

  // Se devuelven los DOS números y no sólo el de éxito: «no había nada que hacer» y
  // «había y no pude» se ven iguales desde un `{ ok: true }`, y ésa es justo la
  // distinción que un cron tiene que poder expresar.
  return Response.json({ ok: true, vencidas: vencidas.length, retomadas });
}
