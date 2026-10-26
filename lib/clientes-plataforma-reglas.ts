// =============================================================================
// clientes-plataforma-reglas — los clientes de MaKo vistos por el super admin: segmentos, MRR y riesgo (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 10): «Para SuperAdmin, creame una vista especial para ver a mis clientes...
// Donde pueda ver a los partners, a agency y al resto de clientes... Siempre revisa como lo hacen otras apps, que se vea
// epico». Copiado de Stripe › Customers (los segmentos en pills) y de Baremetrics (el MRR arriba, de los cobros reales).
//
// LO QUE SE DECIDIÓ (el porqué, en docs/hallazgos-agencias.md):
//   · LOS SEGMENTOS NO SON EXCLUYENTES, salvo el último: un negocio puede ser Agency y Partner a la vez. «Clientes» es el
//     resto (ni Partner, ni Agency, ni cliente de una agencia). Un cliente de agencia NO es cliente de MaKo: lo factura su
//     agencia (AdminView, 28/09/2026), y por eso tiene su propio segmento.
//   · EL MRR SALE DE LOS COBROS, nunca del precio del plan: un plan dado a mano (Mauricio, Leila) no factura nada, y
//     sumarlo inflaría el número que Martín mira para decidir. Una suscripción ACTIVA de la plataforma, en dólares
//     (`monto_usd`), sin las pruebas gratis (Stripe no cuenta un trial como MRR) ni lo anulado o devuelto. Un cobro sin
//     su valor en dólares no se inventa: suma «sin dólares» y la pantalla lo dice.
//   · EN RIESGO: pausado, o con la renovación activa y el último cobro fallido (la pasarela reintenta: la mora).
//
// Sin `server-only`: lo ejecutan los tests.
// =============================================================================

import { esPruebaDePlan } from './prueba-plan-reglas';

export const SEGMENTOS = ['partner', 'agency', 'cliente', 'de-agencia'] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  partner: 'Partner',
  agency: 'Agency',
  cliente: 'Cliente',
  'de-agencia': 'Cliente de agencia',
};

/** Los segmentos de un negocio. Siempre al menos uno. */
export function segmentosDe(ws: number, s: { partners: ReadonlySet<number>; agencias: ReadonlySet<number>; deAgencia: ReadonlyMap<number, unknown> }): Segmento[] {
  if (s.deAgencia.has(ws)) return ['de-agencia'];
  const out: Segmento[] = [];
  if (s.agencias.has(ws)) out.push('agency');
  if (s.partners.has(ws)) out.push('partner');
  return out.length ? out : ['cliente'];
}

/** Lo que hace falta de un cobro de la plataforma para el MRR. */
export type CobroMrr = {
  tipo: string;
  estado: string;
  suscripcion_estado: string | null;
  monto_usd?: number | null;
  alta_capa?: string | null;
  creado_por?: string | null;
};

/** ¿Este cobro factura cada mes hoy? Una suscripción activa, que no es una prueba gratis ni está anulada o devuelta. */
export const factura = (c: CobroMrr): boolean =>
  c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa' && c.estado !== 'anulado' && c.estado !== 'reembolsado' && !esPruebaDePlan(c);

/** El MRR de un negocio, en dólares, y cuántas suscripciones que facturan no traen su valor en dólares. */
export function mrrDe(cobros: readonly CobroMrr[]): { usd: number; sinDolares: number } {
  let usd = 0;
  let sinDolares = 0;
  for (const c of cobros) {
    if (!factura(c)) continue;
    const v = typeof c.monto_usd === 'number' && Number.isFinite(c.monto_usd) ? c.monto_usd : null;
    if (v == null) sinDolares += 1; else usd += v;
  }
  return { usd: Math.round(usd * 100) / 100, sinDolares };
}

/** ¿Está en prueba gratis? (una suscripción de prueba viva y ninguna que facture) */
export const enPrueba = (cobros: readonly CobroMrr[]): boolean =>
  !cobros.some(factura) && cobros.some((c) => esPruebaDePlan(c) && c.suscripcion_estado !== 'cancelada' && c.estado !== 'anulado');

/** ¿En riesgo? Pausado, o con la renovación activa y el último cobro fallido (la mora: la pasarela reintenta). */
export const enRiesgo = (estado: string, cobros: readonly CobroMrr[]): boolean =>
  estado === 'pausado' || cobros.some((c) => c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa' && c.estado === 'fallido');

/** Los números de arriba de la vista. `ahoraMs` se pasa para que el test no dependa del reloj. */
export function kpisDeClientes(filas: ReadonlyArray<{ estado: string; creado: string; mrrUsd: number; sinDolares: number; riesgo: boolean; segmentos: readonly Segmento[] }>, ahoraMs: number) {
  const hace30 = ahoraMs - 30 * 86_400_000;
  const deMaKo = filas.filter((f) => !f.segmentos.includes('de-agencia'));
  return {
    mrrUsd: Math.round(filas.reduce((a, f) => a + f.mrrUsd, 0) * 100) / 100,
    sinDolares: filas.reduce((a, f) => a + f.sinDolares, 0),
    pagan: filas.filter((f) => f.mrrUsd > 0).length,
    activos: deMaKo.filter((f) => f.estado === 'activo').length,
    nuevos30: deMaKo.filter((f) => Date.parse(f.creado) >= hace30).length,
    enRiesgo: filas.filter((f) => f.riesgo).length,
    porSegmento: Object.fromEntries(SEGMENTOS.map((s) => [s, filas.filter((f) => f.segmentos.includes(s)).length])) as Record<Segmento, number>,
  };
}
