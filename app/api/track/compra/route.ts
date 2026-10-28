// =============================================================================
// GET /api/track/compra — el valor de una compra, para que la página de gracias se la avise a Meta (27/10/2026, MAU-10)
// =============================================================================
// El Pixel de MaKo (lib/landing-token.ts, v28) llama acá cuando la página abre con `?session_id=cs_…` (la vuelta de un Payment
// Link de Stripe) y, con la respuesta, manda `fbq('track','Purchase', {value, currency}, {eventID})`: el mismo `event_id` que ya
// mandó el servidor por CAPI, así Meta cuenta UNA compra. El porqué de preguntar acá y no mandarlo sin valor, en
// lib/compra-navegador.ts.
//
// AUTH: la cuenta del Pixel (`c`, la misma de /api/track/vsl: pública, va en el HTML) sólo IDENTIFICA el negocio, fail-closed
// (`wsPorIdentificadorEstricto`). El id de la sesión lo tiene sólo quien pagó (viene en SU dirección). La respuesta trae el
// valor, la moneda y el id del evento: nunca el email ni el teléfono. GET sin cabeceras propias: el navegador no pide permiso
// antes (CORS simple). Tope por IP: cada pregunta nueva es una lectura a Stripe.
// =============================================================================

import { type NextRequest } from 'next/server';
import { limitePorIp } from '@/lib/limite-publico';
import { LANDING_SERVICIO } from '@/lib/landing-token';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { conReintentoTransitorio } from '@/lib/webhook-ruteo-huella';
import { compraParaElNavegador } from '@/lib/compra-navegador';
import { SESION_PAGO_RE } from '@/lib/meta-capi-payload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};
// La misma sanidad que el beacon (app/api/track/vsl/route.ts): la autoridad es la tabla de ruteo.
const CUENTA_RE = /^[\w-]{8,64}$/;

const responder = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: CORS });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const frenado = limitePorIp(req, 'compra', 20, 60_000, CORS);
  if (frenado) return frenado;
  const q = req.nextUrl.searchParams;
  const cuenta = (q.get('c') ?? '').trim();
  const sesion = (q.get('s') ?? '').trim();
  if (!CUENTA_RE.test(cuenta) || !SESION_PAGO_RE.test(sesion)) return responder({ ok: false, compra: null }, 400);

  let ws: number | null;
  try {
    ws = await conReintentoTransitorio(() => wsPorIdentificadorEstricto(LANDING_SERVICIO, cuenta));
  } catch {
    // Sin la base no se sabe de quién es: el navegador no avisa nada, y la compra igual le llega a Meta por el servidor.
    return responder({ ok: false, compra: null }, 503);
  }
  if (ws == null) return responder({ ok: true, compra: null });

  try {
    return responder({ ok: true, compra: await compraParaElNavegador(ws, sesion) });
  } catch (e) {
    console.warn(`[track:compra] ws=${ws} no pude leer las cuentas de Stripe: ${e instanceof Error ? e.message : String(e)}`);
    return responder({ ok: false, compra: null }, 503);
  }
}
