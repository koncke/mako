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
};

const positivo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function montosDelContrato(parsed: Record<string, unknown>): MontosDelContrato {
  const crudas = Array.isArray(parsed.cuotas) ? (parsed.cuotas as Array<Record<string, unknown>>) : [];
  const fecha = (c: Record<string, unknown>) => (typeof c?.fecha === 'string' && c.fecha.trim() ? c.fecha.trim() : null);
  const viejo = !('moneda' in parsed) && ('total_usd' in parsed);
  const moneda = typeof parsed.moneda === 'string' ? normalizarMoneda(parsed.moneda) : null;
  const enDolares = !viejo && moneda === 'USD';
  const hayMontos = positivo(parsed.total) != null || positivo(parsed.total_usd) != null || crudas.some((c) => positivo(c?.monto) != null);
  return {
    total_usd: enDolares ? positivo(parsed.total) : null,
    cuotas: crudas.map((c) => ({ monto: enDolares ? positivo(c?.monto) : null, fecha: fecha(c) })),
    moneda: viejo ? null : moneda,
    total_original: !viejo && !enDolares ? positivo(parsed.total) : null,
    ...(viejo && hayMontos ? { montos_no_usados: true } : {}),
  };
}
