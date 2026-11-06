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
// ── LOS DATOS DEL PAGO VIAJAN POR ACÁ (6/11/2026, el pendiente 288) ──────────
// Hasta ese día esto mandaba `{ subtipo }` y nada más, así que una tarjeta «MaKo en WhatsApp» de este CRON
// no podía CITAR el monto ni el concepto: `{{pago_monto}}` tiene `alcance: 'pago'` y `alcanzaPara` lo da
// sólo con `conPago`, que ponía únicamente el Evento de MaKo `pago_recibido`. El equipo se enteraba de un
// pago rechazado sin saber de cuánto. Ahora `alCron` (lib/cobros.ts) arma los datos con el cobro en la mano
// (`valoresDelPago`) y los pasa acá; el motor los guarda en la inscripción (`datos_evento`, mig 0411) y los
// pone en el texto de la tarjeta cuando sale.
//
// ⚠️ LOS DATOS SON DE *ESTE* PAGO, Y POR ESO VIAJAN EN VEZ DE RELEERSE. Un rechazo no deja fila en `pagos`
// (lib/cobros.ts, `aplicarPagoFallido`, sólo escribe `cobros.motivo`), y releer «el último pago del lead» al
// mandar diría el monto de otro pago —el que entró después, el que salió bien—. Lo que se cita es lo que la
// pasarela confirmó cuando disparó el CRON, congelado en la inscripción.
//
// ⚠️ NO dispara `lead_nuevo`: un lead que entra pagando no es uno que «dejó el formulario sin agendar».

import 'server-only';
import { enrolarPorEvento, type CtxEvento } from './nutricion';
import { EVENTOS_PAGO } from './disparadores';

export type SubtipoPago = 'aprobado' | 'rechazado' | 'reembolsado' | 'suscripcion_cancelada' | 'comprobante';

const SUBTIPOS: ReadonlySet<string> = new Set(EVENTOS_PAGO.map((e) => e.subtipo));

/**
 * Inscribe al lead en las automatizaciones cuyo CRON es «Pagos» con ese evento. Devuelve cuántas.
 * La automatización corre UNA vez por lead (la única de la inscripción): la bienvenida al pagar sale
 * con el primer pago, no con cada renovación.
 *
 * `datos` son los del pago que acaba de confirmar la pasarela (`valoresDelPago`: `pago_monto`,
 * `pago_concepto`…), para que la tarjeta los pueda citar. Sin ellos la inscripción entra igual y los
 * tokens quedan crudos (los frena Publicar), que es lo que pasaba antes del 6/11/2026.
 */
export async function enrolarPorPago(leadId: number, subtipo: SubtipoPago, datos?: Record<string, string>): Promise<number> {
  if (!SUBTIPOS.has(subtipo)) return 0;
  const ctx: CtxEvento = { subtipo, ...(datos && Object.keys(datos).length ? { datos } : {}) };
  return enrolarPorEvento(leadId, 'pago', ctx);
}
