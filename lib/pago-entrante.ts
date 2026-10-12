// =============================================================================
// pago-entrante — la puerta de los pagos de la pasarela al motor de las automatizaciones
// =============================================================================
// El CRON «Pagos» (11/10/2026, lib/disparadores.ts `TRIGGER_PAGO`): un pago aprobado, rechazado o
// devuelto, o una suscripción cancelada, de un cobro creado en MaKo con Stripe o Mercado Pago. Lo llama
// lib/cobros.ts (aplicarPagoAprobado y compañía) adentro de runWithWorkspace(ws del cobro) y DESPUÉS de
// asentar el pago en el CRM — el orden decide cómo sale lo que viene: con `fecha_primer_pago` ya
// escrita, `esLeadCliente` da true (el WhatsApp sale solo, no como borrador del setter) y la condición
// «Pagó» del lienzo da bien.
//
// UNA puerta y sin casts (molde: enrolarPorEmailRecibido, lib/email-entrante.ts): el `ctx` es el que
// lee `disparaPorEvento`, y el subtipo va en las palabras del CRON (`EVENTOS_PAGO`), no en las del
// proveedor.
//
// ⚠️ NO dispara `lead_nuevo`: un lead que entra pagando no es uno que «dejó el formulario sin agendar».

import 'server-only';
import { enrolarPorEvento, type CtxEvento } from './nutricion';
import { EVENTOS_PAGO } from './disparadores';

export type SubtipoPago = 'aprobado' | 'rechazado' | 'reembolsado' | 'suscripcion_cancelada';

const SUBTIPOS: ReadonlySet<string> = new Set(EVENTOS_PAGO.map((e) => e.subtipo));

/**
 * Inscribe al lead en las automatizaciones cuyo CRON es «Pagos» con ese evento. Devuelve cuántas.
 * La automatización corre UNA vez por lead (la única de la inscripción): la bienvenida al pagar sale
 * con el primer pago, no con cada renovación.
 */
export async function enrolarPorPago(leadId: number, subtipo: SubtipoPago): Promise<number> {
  if (!SUBTIPOS.has(subtipo)) return 0;
  const ctx: CtxEvento = { subtipo };
  return enrolarPorEvento(leadId, 'pago', ctx);
}
