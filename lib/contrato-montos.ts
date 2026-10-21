// =============================================================================
// Los montos del plan que lee la IA de un contrato (/api/extract-contract), para el asistente de Ganado (21/10/2026, Pagos)
// =============================================================================
// ⚠️ NUNCA UNA TASA DE LA IA. El prompt pedía «todos los montos en USD», convertidos «con un tipo de cambio aproximado
//    actual», y con esa tasa se armaron planes de verdad (72.000 MXN / 17 = 4.235,29 la cuota de una suscripción del ws11).
//    Ahora la IA devuelve el total y las cuotas TAL COMO FIGURAN, con su `moneda`, y acá se decide:
//    - en dólares, los montos van (`total_usd` y el monto de cada cuota), como siempre;
//    - en otra moneda, van el total ORIGINAL (para mostrarlo) y las fechas de las cuotas, sin monto: los dólares los
//      declara la persona en el asistente;
//    - un prompt viejo guardado en Configuraciones (devuelve `total_usd`, sin `moneda`) puede haber convertido: sus montos
//      no se usan, y se marca (`montos_no_usados`) para que la pantalla lo diga.
// ⚠️ Y LAS CUOTAS, SÓLO SI SUMAN EL TOTAL (revisión de bc5fb022d, medio): un contrato mexicano dice «US$4,000 total, 12
//    mensualidades de $6,000 M.N.», la IA dice moneda USD, y las 12 cuotas de 6.000 entraban como dólares (72.000 contra un
//    cierre de 4.000) con el plan dado por resuelto. La moneda que dice la IA vale para el total; las cuotas valen si
//    cuadran con él, con la MISMA tolerancia del asistente (`toleranciaCuotas`). Si no, quedan sin monto, el paso del
//    plan se muestra y los carga la persona. Sin total no hay con qué cuadrarlas: tampoco van.
// ⚠️ CADA AVISO DICE LO QUE PASÓ (revisión de b23ce2a9c, baja): «no suman su total» salía también sin total (un contrato
//    que dice «6 pagos de US$500» y nada más) y con una cuota en 0: mentía. `cuotas_no_cuadran` es sólo con un total y
//    todas las cuotas con monto; sin total, `sin_total`. Una cuota de 0 no es una cuota: se saca, no anula el plan.
// Puro: lo usan la ruta, el asistente de Ganado (`planDelContrato`) y su test (tests/pagos-contrato-moneda.test.ts).

import { formatoMonto, normalizarMoneda } from './pasarela-moneda';

export type MontosDelContrato = {
  total_usd: number | null;
  cuotas: Array<{ monto: number | null; fecha: string | null }>;
  /** La moneda del contrato (código ISO), si la dijo. */
  moneda: string | null;
  /** El total en SU moneda cuando NO es en dólares: para decir «el contrato dice MX$72.000». */
  total_original: number | null;
  /** La IA dio montos que no se usan (un prompt viejo que pudo convertir). */
  montos_no_usados?: boolean;
  /** El contrato es en dólares, con su total, y sus cuotas (todas con monto) no lo suman: van sin monto. */
  cuotas_no_cuadran?: boolean;
  /** El contrato es en dólares y trae montos de cuotas, pero no dice su total: no hay con qué cuadrarlas. */
  sin_total?: boolean;
};

const positivo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Cuánto pueden diferir las cuotas de un plan de su total: la del asistente de Ganado (`cuotasCuadran`) y la de acá. */
export const toleranciaCuotas = (total: number): number => Math.max(1, total * 0.005);

export function montosDelContrato(parsed: Record<string, unknown>): MontosDelContrato {
  // Una cuota de 0 no es una cuota (la IA la pone por un «anticipo: 0»): se saca, en vez de dejar todo el plan sin monto.
  const crudas = (Array.isArray(parsed.cuotas) ? (parsed.cuotas as Array<Record<string, unknown>>) : []).filter((c) => c?.monto !== 0);
  const fecha = (c: Record<string, unknown>) => (typeof c?.fecha === 'string' && c.fecha.trim() ? c.fecha.trim() : null);
  const viejo = !('moneda' in parsed) && ('total_usd' in parsed);
  const moneda = typeof parsed.moneda === 'string' ? normalizarMoneda(parsed.moneda) : null;
  const enDolares = !viejo && moneda === 'USD';
  const hayMontos = positivo(parsed.total) != null || positivo(parsed.total_usd) != null || crudas.some((c) => positivo(c?.monto) != null);
  const total = positivo(parsed.total);
  const montos = crudas.map((c) => positivo(c?.monto));
  const suma = montos.reduce<number>((s, m) => s + (m ?? 0), 0);
  const todas = montos.length > 0 && montos.every((m) => m != null);
  const cuadran = total != null && todas && Math.abs(suma - total) <= toleranciaCuotas(total);
  const cuotasValen = enDolares && cuadran;
  return {
    total_usd: enDolares ? total : null,
    cuotas: crudas.map((c, i) => ({ monto: cuotasValen ? montos[i] : null, fecha: fecha(c) })),
    moneda: viejo ? null : moneda,
    total_original: !viejo && !enDolares ? total : null,
    ...(viejo && hayMontos ? { montos_no_usados: true } : {}),
    ...(enDolares && total != null && todas && !cuadran ? { cuotas_no_cuadran: true } : {}),
    ...(enDolares && total == null && montos.some((m) => m != null) ? { sin_total: true } : {}),
  };
}

/**
 * ¿El plan de cuotas que trajo el contrato queda RESUELTO en el asistente de Ganado, y si no, qué se dice?
 * ⚠️ CUADRAR CON EL TOTAL DEL CONTRATO NO ALCANZA (revisión de b23ce2a9c, baja): el plan se guarda contra el monto de
 * cierre, y con un cierre de 5.000 ya cargado un contrato de 4 × 1.000 quedaba «resuelto» (el paso del plan no se veía)
 * sin pasar por `cuotasCuadran`. Se resuelve sólo si cuadra con el monto que va a QUEDAR (`montoQueQueda`: el que hay,
 * o el total recién precargado), con la misma tolerancia. Una suscripción no tiene total que cuadrar (`cuotasCuadran`
 * tampoco lo mira). Lo usa `buscarDealAuto` (app/crm/StageMoveDialog.tsx).
 */
export function planDelContrato(
  m: Pick<MontosDelContrato, 'cuotas' | 'cuotas_no_cuadran' | 'sin_total'>,
  o: { montoQueQueda: number; suscripcion: boolean },
): { resuelto: boolean; aviso: string | null } {
  const montos = m.cuotas.map((c) => (c.monto == null ? null : Number(c.monto)));
  if (montos.length && montos.every((x) => x != null && x > 0)) {
    const suma = montos.reduce<number>((s, x) => s + (x as number), 0);
    if (o.suscripcion || (o.montoQueQueda > 0 && Math.abs(suma - o.montoQueQueda) <= toleranciaCuotas(o.montoQueQueda))) {
      return { resuelto: true, aviso: null };
    }
    return {
      resuelto: false,
      aviso: o.montoQueQueda > 0
        ? `A revisar: plan de cuotas (suman ${formatoMonto(suma, 'USD')} y el monto de cierre es ${formatoMonto(o.montoQueQueda, 'USD')})`
        : `A revisar: plan de cuotas (suman ${formatoMonto(suma, 'USD')}: falta el monto de cierre)`,
    };
  }
  return {
    resuelto: false,
    aviso: m.sin_total
      ? 'A revisar: plan de cuotas (el contrato no dice su total: carga el monto y las cuotas)'
      : m.cuotas_no_cuadran
        ? 'A revisar: plan de cuotas (las cuotas del contrato no suman su total en dólares: cárgalas a mano)'
        : 'A revisar: plan de cuotas (vinieron las fechas; los montos en dólares se cargan a mano)',
  };
}
