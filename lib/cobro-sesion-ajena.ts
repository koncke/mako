// =============================================================================
// cobro-sesion-ajena — el ticket de una sesión de Stripe que trae el código de un cobro de MaKo y no es la suya (28/10/2026)
// =============================================================================
// La regla (`sesionDelCobro`, lib/cobros-eventos.ts) la miran el aviso de Stripe (lib/cobros-webhook.ts, la rama del checkout) y
// el cron (lib/cobros.ts, `pagoDelLinkEnLaPasarela`); los dos abren este ticket cuando no cuadra. Vive aparte para que los dos
// lo usen sin que lib/cobros.ts importe el webhook.
// =============================================================================

import 'server-only';
import type { Cobro } from './cobros-tipos';

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
