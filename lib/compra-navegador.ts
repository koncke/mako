// =============================================================================
// compra-navegador — lo que el navegador necesita para avisarle la compra a Meta (27/10/2026, MAU-10)
// =============================================================================
// Mauricio vende con un Payment Link de SU Stripe. El servidor ya le avisa la compra a Meta por CAPI al llegar el aviso de Stripe
// (`compraDeUnLinkPropio`, lib/cobros-webhook.ts), con `event_id` = `purchase:<id de la sesión>`. La página de gracias, si tiene el
// píxel de Meta, puede avisarla también desde el navegador con el MISMO id, y Meta cuenta una.
//
// ⚠️ EL NAVEGADOR NO MANDA UN PURCHASE SIN VALOR. Meta se queda con el evento que llega PRIMERO de los dos (su página de
// deduplicación: «we generally prefer the event that is received first»), y el navegador suele llegar antes que el aviso de
// Stripe: uno sin valor ni moneda taparía al del servidor, que los trae. Por eso el Pixel le pregunta a MaKo
// (app/api/track/compra/route.ts) y sólo con la respuesta manda el suyo. Y la pregunta la contesta Stripe, no la página: un
// valor escrito en la URL lo cambia cualquiera.
//
// Busca la sesión en las cuentas de Stripe del negocio, la principal primero (con varias cuentas, la sesión vive en una sola:
// en las otras da 404), y salta la clave de otro modo (una sesión de prueba no existe para la clave real).
// =============================================================================

import 'server-only';
import { credDelCliente } from './credenciales';
import { claveDeCuenta } from './cuentas-integracion';
import { cuentasDePago } from './cuentas-pago-server';
import { compraDeLaSesion, SESION_PAGO_RE } from './meta-capi-payload';
import { leerCheckoutStripe, modoDeClaveStripe } from './stripe-api';

export type CompraParaElNavegador = { eventId: string; value: number; currency: string };

/** Unos minutos de memoria: la página de gracias se recarga, y cada carga no tiene por qué ser otra pregunta a Stripe. */
const VIGENCIA_MS = 10 * 60_000;
const recordadas = new Map<string, { hasta: number; compra: CompraParaElNavegador | null }>();

/**
 * La compra de una sesión de pago del negocio, para el navegador: el `eventId`, el valor y la moneda, o null si no es una venta
 * pagada de un Payment Link propio (la misma regla que el servidor, `compraDeLaSesion`). Nunca devuelve el email ni el teléfono:
 * la respuesta va a una página pública. Tira si no puede leer las cuentas (la ruta contesta sin compra).
 */
export async function compraParaElNavegador(ws: number, sesionId: string, ahora = Date.now()): Promise<CompraParaElNavegador | null> {
  if (!SESION_PAGO_RE.test(sesionId)) return null;
  const clave = `${ws}:${sesionId}`;
  const ya = recordadas.get(clave);
  if (ya && ya.hasta > ahora) return ya.compra;

  const modo = sesionId.startsWith('cs_live_') ? 'real' : 'prueba';
  let compra: CompraParaElNavegador | null = null;
  for (const c of await cuentasDePago(ws, 'stripe')) {
    const key = await credDelCliente(claveDeCuenta('STRIPE_SECRET_KEY', c.cuenta), ws);
    if (!key || modoDeClaveStripe(key) !== modo) continue;
    const s = await leerCheckoutStripe(key, sesionId);
    if (!s.ok) {
      if (s.status === 404) continue;
      // Stripe no contestó: no se recuerda, la próxima carga vuelve a preguntar.
      return null;
    }
    const x = compraDeLaSesion(s);
    compra = x ? { eventId: x.eventId, value: x.value, currency: x.currency } : null;
    break;
  }
  if (recordadas.size > 500) recordadas.clear();
  recordadas.set(clave, { hasta: ahora + VIGENCIA_MS, compra });
  return compra;
}
