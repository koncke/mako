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
// Puro: lo usan la ruta y su test (tests/pagos-contrato-moneda.test.ts).

import { normalizarMoneda } from './pasarela-moneda';

export type MontosDelContrato = {
  total_usd: number | null;
  cuotas: Array<{ monto: number | null; fecha: string | null }>;
  /** La moneda del contrato (código ISO), si la dijo. */
  moneda: string | null;
  /** El total en SU moneda cuando NO es en dólares: para decir «el contrato dice MX$72.000». */
  total_original: number | null;
  /** La IA dio montos que no se usan (un prompt viejo que pudo convertir). */
  montos_no_usados?: boolean;
  /** El contrato es en dólares pero sus cuotas no suman el total (o no hay total): van sin monto. */
  cuotas_no_cuadran?: boolean;
};

const positivo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Cuánto pueden diferir las cuotas de un plan de su total: la del asistente de Ganado (`cuotasCuadran`) y la de acá. */
export const toleranciaCuotas = (total: number): number => Math.max(1, total * 0.005);

export function montosDelContrato(parsed: Record<string, unknown>): MontosDelContrato {
  const crudas = Array.isArray(parsed.cuotas) ? (parsed.cuotas as Array<Record<string, unknown>>) : [];
  const fecha = (c: Record<string, unknown>) => (typeof c?.fecha === 'string' && c.fecha.trim() ? c.fecha.trim() : null);
  const viejo = !('moneda' in parsed) && ('total_usd' in parsed);
  const moneda = typeof parsed.moneda === 'string' ? normalizarMoneda(parsed.moneda) : null;
  const enDolares = !viejo && moneda === 'USD';
  const hayMontos = positivo(parsed.total) != null || positivo(parsed.total_usd) != null || crudas.some((c) => positivo(c?.monto) != null);
  const total = positivo(parsed.total);
  const montos = crudas.map((c) => positivo(c?.monto));
  const suma = montos.reduce<number>((s, m) => s + (m ?? 0), 0);
  const cuadran = total != null && montos.length > 0 && montos.every((m) => m != null) && Math.abs(suma - total) <= toleranciaCuotas(total);
  const cuotasValen = enDolares && cuadran;
  return {
    total_usd: enDolares ? total : null,
    cuotas: crudas.map((c, i) => ({ monto: cuotasValen ? montos[i] : null, fecha: fecha(c) })),
    moneda: viejo ? null : moneda,
    total_original: !viejo && !enDolares ? total : null,
    ...(viejo && hayMontos ? { montos_no_usados: true } : {}),
    ...(enDolares && !cuadran && montos.some((m) => m != null) ? { cuotas_no_cuadran: true } : {}),
  };
}
