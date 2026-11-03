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

/**
 * ⚠️ UN COBRO EN LA MONEDA DE LA CUOTA, SIN LOS DÓLARES, VA A LA TASA DE LA CUOTA (revisión de 9fc4030dd, alta). Una cuota de un
 * tramo en pesos (MXN 12.000 = US$600) cobrada por 6.000 sin decir los dólares se tomaba por los dólares ENTEROS de la cuota:
 * no quedaba nada pendiente y se perdían 6.000 pesos. Son los dólares que la persona ya declaró para esa cuota, en proporción
 * (no hay tasa que inventar). null: el cobro no es en la moneda de la cuota, o la cuota no tiene monto en ella.
 */
export function dolaresALaTasaDeLaCuota(
  cuota: { monto_usd: number | string; moneda?: string | null; monto_original?: number | string | null },
  cobro: { moneda?: string | null; montoOriginal?: number | null },
): number | null {
  const iso = (m: unknown) => (m == null ? '' : String(m).trim().toUpperCase());
  if (!iso(cuota.moneda) || iso(cuota.moneda) === 'USD' || iso(cobro.moneda) !== iso(cuota.moneda)) return null;
  const pactado = Number(cuota.monto_original);
  const cobrado = Number(cobro.montoOriginal);
  const usd = Number(cuota.monto_usd);
  if (!(pactado > 0) || !(cobrado > 0) || !(usd > 0) || !Number.isFinite(pactado + cobrado + usd)) return null;
  // Un cobro de algo es al menos un centavo: con 0, la cuota se tomaba entera.
  return Math.max(centavos((usd * cobrado) / pactado), 0.01);
}

/**
 * Lo que falta de un cobro a medias, EN LA MONEDA DE LA CUOTA: la MISMA regla que `cobrar_cuota_con_resto` (mig 0347), para que
 * los textos digan la diferencia que queda. Con la 0347 una cuota de MXN 12.000 cobrada por 6.000 deja MXN 6.000 pendientes, y el
 * resumen, el «sí» y el modal seguían diciendo «faltan 300 USD» (revisión de 7f79a4e6c, B13). null: la diferencia es en dólares.
 */
export function restoEnLaMonedaDeLaCuota(
  cuota: { moneda?: string | null; monto_original?: number | string | null },
  cobro: { moneda?: string | null; montoOriginal?: number | null },
): { moneda: string; monto: number } | null {
  const iso = (m: unknown) => (m == null ? '' : String(m).trim().toUpperCase());
  const moneda = iso(cuota.moneda);
  if (!moneda || moneda === 'USD' || iso(cobro.moneda) !== moneda || cobro.montoOriginal == null) return null;
  const pactado = Number(cuota.monto_original);
  const falta = centavos(pactado - Number(cobro.montoOriginal));
  return pactado > 0 && falta > 0 ? { moneda, monto: falta } : null;
}
