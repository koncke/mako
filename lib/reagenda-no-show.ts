// =============================================================================
// Una reunión NUEVA limpia la marca de «no asistió»
// =============================================================================
// Decisión de Martín (06/10/2026, el formulario del cierre del Chatbot): «Sí, la reunión nueva
// limpia la marca». Un lead que faltó y vuelve a agendar por Calendly o Cal.com quedaba con
// `asistio_jN = false` sobre una reunión que todavía no pasó: el CRM lo dibujaba como no-show y
// el recordatorio y la post-agenda lo trataban como alguien que ya faltó a ESTA reunión.
//
// Es lo mismo que ya hace el «reagendar» del CRM (`reagendarReunionAction`, app/crm/actions.ts):
// el no-show se ANOTA en el historial antes de limpiarlo —hay un solo par de campos por reunión,
// no un registro por intento, así que si no queda escrito el hecho de que faltó desaparece— y la
// marca vuelve a `null`.
//
// Sin 'server-only' a propósito: tests/reagenda-no-show.test.ts lo ejecuta.
// =============================================================================

import { fmtDDMMYYYY } from './date-utils';
import { isoCanonico } from './recordatorio-lead';

/** La reunión que la fila tiene HOY: si asistió, el día y el instante. */
export type ReunionDeLaFila = {
  asistio: boolean | null | undefined;
  fecha: string | null | undefined;
  at: string | null | undefined;
};

/** La reserva que acaba de llegar. */
export type ReservaNueva = { fecha: string; at?: string | null };

/**
 * ¿Esta reserva limpia la marca de «no asistió»? Sólo si la fila está marcada como no-show
 * (`false`, no `null`) y la reserva es OTRA reunión: otro día, o el mismo día a otra hora.
 *
 * ⚠️ Una reentrega del mismo evento (Calendly reintenta; el backfill vuelve a pasar por la
 * fila) NO es otra reunión: mismo día y, si las dos tienen hora, mismo instante. Y sin fecha
 * previa no hay de qué reunión haber faltado: no se toca nada, en vez de borrar una marca que no
 * se sabe a qué se refiere.
 */
export function limpiaNoShow(fila: ReunionDeLaFila, nueva: ReservaNueva): boolean {
  if (fila.asistio !== false) return false;
  if (!fila.fecha || !nueva.fecha) return false;
  if (fila.fecha.slice(0, 10) !== nueva.fecha.slice(0, 10)) return true;
  if (!fila.at || !nueva.at) return false;
  const antes = isoCanonico(fila.at);
  const ahora = isoCanonico(nueva.at);
  return !!antes && !!ahora && antes !== ahora;
}

/** La línea del historial: qué reunión fue la que faltó y por dónde reagendó. */
export function textoNoShow(fechaVieja: string | null | undefined, canal: string): string {
  return fechaVieja
    ? `No se presentó a la reunión del ${fmtDDMMYYYY(fechaVieja)} — reagendó por ${canal}`
    : `No se presentó — reagendó por ${canal}`;
}
