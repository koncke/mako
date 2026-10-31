// =============================================================================
// primer-mes-reglas — el 50% del primer mes de un plan de MaKo, en el cobro (lo puro, con test) (30/10/2026)
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md §3: «te ganaste un 50% de descuento», con reloj, sobre los dos planes, y sólo el
// primer mes. Lo que hace que exista de verdad: un cobro `creado_por = planes:<plan>:primer-mes-<pct>`. El reloj y su cookie firmada son
// de Landings (lib/promo-entrada.ts, `promoVigente`); acá, lo que pasa en el cobro cuando el reloj dice que sí.
//
// ⚠️ EL MONTO DEL COBRO SIGUE SIENDO EL DE LISTA (97), y sólo el PRIMER PAGO sale a mitad. Es a propósito: `cobro.monto` es la
// mensualidad para todo lo que viene después (la deuda de una mora, «Tu plan», la retención, «Pasar a Pro», el MRR). Guardar 48,50
// ahí habría dejado una deuda calculada a mitad de precio para siempre.
//   · Stripe: un cupón `once` en el checkout; vuelve solo al precio de lista.
//   · Mercado Pago: la suscripción nace con el monto rebajado y hay que volverla a subir (lib/primer-mes.ts).
// =============================================================================

import { DESCUENTO_PRIMER_MES_PCT } from './planes-mako';

const CREADO_RE = /^planes:[a-z0-9-]{1,32}:primer-mes-(\d{1,2})$/;
const DIA_MS = 86_400_000;

/**
 * Lo que tiene de más quien abrió la página del plan con el reloj vivo y tocó «Ir a pagar» cuando ya estaba en cero: no pierde el descuento
 * por llenar el formulario. Sólo si la página le mostró el descuento (`pedido.promo`). Nunca se muestra: el reloj sigue diciendo cero.
 */
export const MINUTOS_DE_GRACIA = 15;

export const creadoPorPrimerMes = (planId: string): string => `planes:${planId}:primer-mes-${DESCUENTO_PRIMER_MES_PCT}`;

/** El % de descuento del primer pago de este cobro. null = sin descuento. */
export function pctDelPrimerMes(creadoPor: string | null | undefined): number | null {
  const m = CREADO_RE.exec(creadoPor ?? '');
  const pct = m ? Number(m[1]) : NaN;
  return pct > 0 && pct < 100 ? pct : null;
}

const conDescuento = (monto: number, pct: number): number => Math.round(monto * (100 - pct)) / 100;

/** Lo que vale el PRIMER pago de este cobro, en su moneda. */
export function montoDelPrimerPago(c: { monto: number; creado_por?: string | null }): number {
  const pct = pctDelPrimerMes(c.creado_por);
  return pct ? conDescuento(c.monto, pct) : c.monto;
}

/** Lo mismo en dólares (lo que entra al cash y al historial). Sin valor en dólares, null: nunca se inventa una tasa. */
export function usdDelPrimerPago(c: { monto_usd?: number | null; creado_por?: string | null }): number | null {
  if (c.monto_usd == null) return null;
  const pct = pctDelPrimerMes(c.creado_por);
  return pct ? conDescuento(Number(c.monto_usd), pct) : Number(c.monto_usd);
}

/** ¿Sigue corriendo el primer mes con descuento? Después de pagado, hasta el segundo cobro. */
const enElPrimerMes = (c: { creado_por?: string | null; pagado_at?: string | null }, ahoraMs: number): boolean => {
  const pagado = c.pagado_at ? Date.parse(c.pagado_at) : NaN;
  return pctDelPrimerMes(c.creado_por) != null && Number.isFinite(pagado) && ahoraMs < pagado + 31 * DIA_MS;
};

/** Lo que «Tu plan» le dice a la persona durante su primer mes. null = no aplica. */
export function lineaDelPrimerMes(
  c: { monto: number; moneda: string; creado_por?: string | null; pagado_at?: string | null },
  formato: (monto: number, moneda: string) => string,
  ahoraMs: number = Date.now(),
): string | null {
  if (!enElPrimerMes(c, ahoraMs)) return null;
  return `Tu primer mes costó ${formato(montoDelPrimerPago(c), c.moneda)}. Desde el segundo, ${formato(c.monto, c.moneda)} por mes.`;
}

/** Lo que dice la ficha de Customers durante ese primer mes: el precio del primer pago, en dólares. null = no aplica. */
export function usdPrimerMesVigente(c: { monto_usd?: number | null; creado_por?: string | null; pagado_at?: string | null }, ahoraMs: number): number | null {
  return enElPrimerMes(c, ahoraMs) ? usdDelPrimerPago(c) : null;
}

// ── Los textos del rechazo: siempre se dice, y siempre con la salida de seguir a precio normal ─────────────────────────

export const TEXTO_PROMO_VENCIDA = 'Tu descuento ya venció. Puedes seguir con el precio normal.';
export const TEXTO_PROMO_USADA = 'Ese email ya usó su descuento del primer mes. Puedes seguir con el precio normal.';
export const TEXTO_PROMO_CUENTA = 'Ese email ya tiene una cuenta de MaKo, y el descuento es para negocios nuevos. Puedes seguir con el precio normal.';
