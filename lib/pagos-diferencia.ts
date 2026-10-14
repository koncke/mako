// =============================================================================
// pagos-diferencia — qué pasa cuando se cobra una cuota por un monto DISTINTO
// =============================================================================
// Mauricio (reunión del 13/10/2026): «yo no pude ponerle el tema cuando es un pago diferente». Hasta acá, marcar
// una cuota con un monto menor la dejaba «pagada por menos» y la diferencia DESAPARECÍA del plan y del Outstanding.
//
// La regla, en una función pura (la usan la ficha del CRM y la API de MaKo, por `cobrarCuota` en lib/pagos.ts):
//   · se cobró MENOS → la diferencia queda PENDIENTE (una cuota nueva con el mismo vencimiento), salvo que se diga
//     que es un DESCUENTO;
//   · se cobró igual o MÁS → no queda nada pendiente (lo cobrado de más queda en la cuota: el plan suma de más y la
//     ficha lo dice al editar);
//   · una cuota que ya estaba pagada no genera diferencia (se está corrigiendo el registro, no cobrando).
//
// Sin `server-only`: lo importa el test.

export type RestoDeCobro = 'pendiente' | 'descuento';

/** Redondeo a centavos: los montos son USD con dos decimales. */
export const centavos = (n: number): number => Math.round(n * 100) / 100;

/**
 * Cuánto queda pendiente al cobrar `monto` de una cuota de `original`. 0 = nada. `monto` null = se cobró la cuota
 * tal cual. Montos que no son números positivos cuentan como «tal cual» (no se inventa una diferencia).
 */
export function diferenciaPendiente(original: number, monto: number | null | undefined, opts: { yaPagada: boolean; resto?: RestoDeCobro }): number {
  if (opts.yaPagada || opts.resto === 'descuento') return 0;
  if (monto == null || !Number.isFinite(monto) || monto <= 0) return 0;
  const d = centavos(original - monto);
  return d > 0 ? d : 0;
}
