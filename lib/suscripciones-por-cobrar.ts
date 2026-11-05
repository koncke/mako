// =============================================================================
// suscripciones-por-cobrar — «Clientes por cobrar» también lista las SUSCRIPCIONES (20/10/2026)
// =============================================================================
// Martín, en la llamada con Leila del 19/10 (docs/investigacion-ops-center-19-10.md, «Fallas vistas en la llamada»): el
// bloque leía sólo las cuotas impagas, y una suscripción no genera cuotas, así que un cliente de mensualidad no aparecía
// nunca, debiera lo que debiera.
//
// La regla es la de TODA la app (`cobradoDelLead`, lib/cobrado-lead.ts), no una cuenta nueva:
//   · una suscripción MANUAL con meses que ya empezaron y no están registrados («Falta registrar N meses»): por cobrar,
//     vencida desde el primer mes sin registrar;
//   · una de la PASARELA con la renovación rechazada («Falló la renovación»): por cobrar, vencida;
//   · una MANUAL al día, con la próxima mensualidad dentro de la ventana: por cobrar, con su fecha;
//   · una de la pasarela al día NO aparece: la tarjeta se cobra sola. Una cancelada o que terminó su plazo, tampoco.
//
// ⚠️ NO SUMA AL OUTSTANDING. La app no llama deuda a un mes sin registrar (lo dice «Falta registrar», en ámbar: puede
//    estar cobrado y no anotado). Por eso esto se agrega a la LISTA de a quién cobrarle, y el número de Outstanding
//    sigue siendo el de las cuotas (`getOutstandingDetalle`, lib/pagos.ts).
//
// Sin `server-only`: lo ejecuta el test. Los tipos de lib/pagos entran con `import type`.
// =============================================================================

import { cobradoDelLead, sumarMeses, type CobroParaCobrado, type CuotaParaCobrado } from './cobrado-lead';
import type { OutstandingLead } from './pagos';
import type { MovimientoSuscripcion } from './suscripcion-meses';

export type MotivoSuscripcion = 'sin-registrar' | 'renovacion-fallida' | 'proxima';

/** Una fila de «a quién cobrarle»: la de una cuota (lib/pagos.ts) o la de una suscripción, que no tiene cuota. */
export type ItemPorCobrar = OutstandingLead & {
  suscripcion?: { motivo: MotivoSuscripcion; meses: number; vence: string | null } | null;
};

export type LeadSuscripcion = {
  id: number;
  nombre: string | null;
  fecha_cierre: string | null;
  suscripcion_monto_usd: number | string | null;
  suscripcion_meses: number | null;
  suscripcion_cancelada_at: string | null;
};

const redondo = (n: number) => Math.round(n * 100) / 100;
const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

/** ¿La fecha cae en la ventana del período? Sin ventana (el «Todo»), sí. La misma vara que las cuotas. */
function dentro(v: { desde: string | null; hasta: string | null }, fecha: string): boolean {
  if (!v.desde || !v.hasta) return true;
  return fecha >= v.desde && fecha <= v.hasta;
}

/** El último aniversario de la mensualidad que ya pasó (o es hoy): cuándo tocó la renovación que falló. */
function ultimoAniversario(fechaCierre: string, hoy: string): string {
  let k = 0;
  while (sumarMeses(fechaCierre, k + 1) <= hoy && k < 1200) k++;
  return sumarMeses(fechaCierre, k);
}

/** La fila de una suscripción para «a quién cobrarle», o null si no hay nada que cobrarle (ver la cabecera). */
export function itemDeSuscripcion(e: {
  lead: LeadSuscripcion;
  pagos: readonly CuotaParaCobrado[];
  cobros: readonly CobroParaCobrado[];
  /** Los cambios de la suscripción (mig 0398, lib/suscripcion-meses.ts). Sin ellos, el monto del lead para todos los meses. */
  movimientos?: readonly MovimientoSuscripcion[];
  hoy: string;
  ventana: { desde: string | null; hasta: string | null };
}): ItemPorCobrar | null {
  const { lead, hoy } = e;
  const cierre = lead.fecha_cierre && /^\d{4}-\d{2}-\d{2}/.test(lead.fecha_cierre) ? lead.fecha_cierre.slice(0, 10) : null;
  if (!cierre) return null;
  const c = cobradoDelLead({
    ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: lead.suscripcion_monto_usd,
    suscripcionMeses: lead.suscripcion_meses, fechaCierre: cierre, suscripcionCanceladaAt: lead.suscripcion_cancelada_at,
    pagos: e.pagos, cobros: e.cobros, hoy, movimientos: e.movimientos ?? [],
  });
  const s = c.suscripcion;
  if (!s || s.estado !== 'activa' || !s.mensualidadUsd || s.mensualidadUsd <= 0) return null;

  let motivo: MotivoSuscripcion;
  let meses: number;
  let vence: string | null;
  if (s.renovacionFallida) {
    motivo = 'renovacion-fallida'; meses = 1; vence = ultimoAniversario(cierre, hoy);
  } else if (s.fuente === 'manual' && s.sinRegistrar > 0) {
    // El primer mes sin completar, el de la suscripción mes a mes (lib/suscripcion-meses.ts): un adelanto de 3 meses en un
    // pago son 3, y dos pagos en un mes completan ese mes (no adelantan el siguiente).
    motivo = 'sin-registrar'; meses = s.sinRegistrar; vence = s.proximoMes?.vence ?? sumarMeses(cierre, s.mesesCubiertos);
  } else if (s.fuente === 'manual' && s.proximaRenovacion) {
    motivo = 'proxima'; meses = 1; vence = s.proximaRenovacion;
  } else {
    return null;
  }
  if (vence && !dentro(e.ventana, vence)) return null;

  return {
    lead_id: lead.id,
    lead_nombre: lead.nombre?.trim() || `Lead #${lead.id}`,
    // Una suscripción no tiene monto de cierre: su plata es la mensualidad (lib/venta-tipo.ts).
    vendido_usd: null,
    cobrado_usd: c.cobradoUsd,
    // Lo que falta de verdad (con lo pagado a medias y el monto de cada mes); sin él, la mensualidad por los meses.
    pendiente_usd: motivo === 'sin-registrar' && s.historia.deudaUsd > 0 ? s.historia.deudaUsd : redondo(s.mensualidadUsd * meses),
    proxima_cuota: null,
    dias_desde_cierre: diasEntre(cierre, hoy),
    fecha_cierre: cierre,
    suscripcion: { motivo, meses, vence },
  };
}

/** «falta registrar 2 meses» · «falló la renovación» · null (la próxima mensualidad dice su fecha). */
export function textoDeSuscripcion(s: { motivo: MotivoSuscripcion; meses: number }): string | null {
  if (s.motivo === 'sin-registrar') return s.meses === 1 ? 'falta registrar 1 mes' : `falta registrar ${s.meses} meses`;
  if (s.motivo === 'renovacion-fallida') return 'falló la renovación';
  return null;
}
