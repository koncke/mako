// =============================================================================
// cobro-sesion-ajena — el ticket de una sesión de Stripe que trae el código de un cobro de MaKo y no es la suya (28/10/2026)
// =============================================================================
// La regla (`sesionDelCobro`, lib/cobros-eventos.ts) la miran el aviso de Stripe (lib/cobros-webhook.ts, la rama del checkout) y
// el cron (lib/cobros.ts, `pagoDelLinkEnLaPasarela`); los dos abren este ticket cuando no cuadra. Vive aparte para que los dos
// lo usen sin que lib/cobros.ts importe el webhook.
// =============================================================================

import 'server-only';
import type { Cobro } from './cobros-tipos';

/**
 * Una factura PAGADA de una suscripción que no es la vigente del cobro (29/10/2026, la verificación de ddfa645d4): «Volver a
 * intentar» armó otra sesión y canceló la suscripción de antes, pero un débito de la vieja (un SEPA en curso, un reintento de
 * Stripe) igual entró. No se asienta (sería otra cuota de un cobro ya pagado, o un pago que deja viva la sesión nueva) y queda un
 * ticket para devolverlo. El `ref` es la factura: los reintentos del aviso no abren otro. Nunca tira.
 */
export async function avisarFacturaDeOtraSuscripcion(ws: number, c: Cobro, f: { factura: string; suscripcion: string; vigente: string | null; monto: number | null; moneda: string | null }): Promise<void> {
  try {
    const [{ crearTicket }, { identidadDelSistema }] = await Promise.all([import('./tickets-db'), import('./errores-app')]);
    const r = await crearTicket({
      identidad: await identidadDelSistema(), tipo: 'bug', declaradoPor: 'sistema', sistema: true, canal: 'sistema',
      titulo: `Entró un pago de una suscripción anterior del cobro ${c.id}: no se asentó`.slice(0, 140),
      descripcion: [
        `Stripe cobró la factura ${f.factura} (${f.monto ?? '—'} ${f.moneda ?? ''}) de la suscripción ${f.suscripcion}, del cobro ${c.id} del negocio ${ws} (${c.concepto}).`,
        `Esa suscripción es de un intento anterior: la vigente es ${f.vigente ?? 'la de la sesión nueva, todavía sin completar'}. MaKo la canceló al armar la sesión nueva.`,
        'No se marcó como cuota. Si la persona también pagó la sesión nueva, es un cobro doble: devuelve esta factura en Stripe.',
      ].join('\n'),
      contexto: { ws, cobroId: c.id, factura: f.factura, suscripcion: f.suscripcion, vigente: f.vigente, monto: f.monto, moneda: f.moneda },
      ref: `cobro-sub-vieja:${f.factura}`,
    });
    if (!r.ok) console.error(`[cobros] no pude abrir el ticket del cobro ${c.id} (factura ${f.factura}): ${r.error}`);
  } catch (e) {
    console.error(`[cobros] no pude abrir el ticket del cobro ${c.id} (factura ${f.factura}):`, e instanceof Error ? e.message : String(e));
  }
}

/** Lo que el ticket cuenta de la sesión. */
type Sesion = { id: string; paymentLink?: string | null; monto: number | null; moneda: string | null };

/**
 * Una sesión PAGADA que trae el token de un cobro de MaKo y no es la suya, o cobró menos (`sesionDelCobro`): el cobro no se
 * asienta y queda un ticket para que una persona lo mire (la plata entró en Stripe, pero no por ese cobro). El `ref` es el de
 * la sesión: los reintentos de Stripe y las vueltas del cron no abren otro. Nunca tira.
 */
export async function avisarSesionQueNoCuadra(ws: number, c: Cobro, s: Sesion, motivo: string): Promise<void> {
  try {
    const [{ crearTicket }, { identidadDelSistema }] = await Promise.all([import('./tickets-db'), import('./errores-app')]);
    const r = await crearTicket({
      identidad: await identidadDelSistema(), tipo: 'bug', declaradoPor: 'sistema', sistema: true, canal: 'sistema',
      titulo: `Un pago de Stripe trae el código del cobro ${c.id} y no es suyo: no se asentó`.slice(0, 140),
      descripcion: [
        `Llegó un pago de Stripe (sesión ${s.id}) con el código del cobro ${c.id} del negocio ${ws} (${c.concepto}, ${c.monto} ${c.moneda}).`,
        `No se marcó pagado: ${motivo}.`,
        'Puede ser un link de pago con el código pegado en la URL (?client_reference_id=). Revisa en Stripe quién pagó y cuánto.',
      ].join('\n'),
      contexto: { ws, cobroId: c.id, sesion: s.id, paymentLink: s.paymentLink ?? null, monto: s.monto, moneda: s.moneda, motivo },
      ref: `cobro-ajeno:${s.id}`,
    });
    if (!r.ok) console.error(`[cobros] no pude abrir el ticket del cobro ${c.id} (sesión ${s.id}): ${r.error}`);
  } catch (e) {
    console.error(`[cobros] no pude abrir el ticket del cobro ${c.id} (sesión ${s.id}):`, e instanceof Error ? e.message : String(e));
  }
}
