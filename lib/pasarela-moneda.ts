// =============================================================================
// pasarela-moneda — montos y monedas de Stripe y Mercado Pago
// =============================================================================
// Puro y SIN `server-only`: lo usan los clientes de las pasarelas, la ficha y los tests.
//
// ⚠️ LAS DOS PASARELAS CUENTAN DISTINTO, y ninguna da error si te equivocás:
//   · Stripe quiere UNIDADES MÍNIMAS (centavos): US$ 47 son `4700`. Salvo las monedas de cero
//     decimales (CLP, JPY…), que van ENTERAS: $ 49.900 CLP son `49900`, no `4990000`. Mandar ×100 a
//     un CLP cobra cien veces más (docs.stripe.com/currencies, 11/10/2026).
//   · Mercado Pago quiere el monto DECIMAL tal cual (`unit_price: 49900.5`), no unidades mínimas.
//
// Y la moneda la define la CUENTA de la pasarela, nunca el nombre de un campo (AGENTS.md «Un campo con
// una moneda o un país en el NOMBRE es una constante disfrazada de dato»). Mercado Pago cobra en la
// moneda del sitio de la cuenta (MLA = Argentina = ARS): de ahí sale, no de una constante.

/** Monedas de cero decimales de Stripe (docs.stripe.com/currencies#zero-decimal). */
const CERO_DECIMALES: ReadonlySet<string> = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * ISK y UGX: Stripe las representa con dos decimales aunque NO los tengan, así que se mandan ×100 y
 * terminadas en 00 (docs.stripe.com/currencies, «Special cases»). UGX figura en las dos listas: la
 * regla de los casos especiales gana.
 */
const ESPECIALES_X100: ReadonlySet<string> = new Set(['ISK', 'UGX']);

export const normalizarMoneda = (m: string | null | undefined): string | null => {
  const s = String(m ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
};

export const esCeroDecimales = (moneda: string): boolean => {
  const m = moneda.toUpperCase();
  return CERO_DECIMALES.has(m) && !ESPECIALES_X100.has(m);
};

/** 47 USD → 4700 · 49900 CLP → 49900 · 1500 ISK → 150000 (y siempre entero). */
export function aUnidadMinima(monto: number, moneda: string): number {
  const m = moneda.toUpperCase();
  if (!Number.isFinite(monto) || monto <= 0) throw new Error(`monto inválido: ${monto}`);
  if (ESPECIALES_X100.has(m)) return Math.round(monto) * 100;
  if (CERO_DECIMALES.has(m)) return Math.round(monto);
  return Math.round(monto * 100);
}

/** La inversa: lo que Stripe devuelve (amount_total, amount_paid) a un monto con decimales. */
export function deUnidadMinima(cantidad: number, moneda: string): number {
  const m = moneda.toUpperCase();
  if (ESPECIALES_X100.has(m)) return Math.round(cantidad / 100);
  if (CERO_DECIMALES.has(m)) return cantidad;
  return Math.round(cantidad) / 100;
}

/**
 * El sitio de una cuenta de Mercado Pago (`site_id` de GET /users/me) → su moneda local. La lista es
 * la de los sitios donde opera Mercado Pago; un sitio que no está acá contesta null y el que llama
 * pide la moneda explícita (nunca se asume USD).
 */
const MONEDA_DE_SITIO: Readonly<Record<string, string>> = {
  MLA: 'ARS', // Argentina
  MLB: 'BRL', // Brasil
  MLM: 'MXN', // México
  MLC: 'CLP', // Chile
  MCO: 'COP', // Colombia
  MPE: 'PEN', // Perú
  MLU: 'UYU', // Uruguay
};

export const monedaDeSitioMp = (siteId: string | null | undefined): string | null =>
  siteId ? MONEDA_DE_SITIO[String(siteId).trim().toUpperCase()] ?? null : null;

const PAIS_DE_SITIO: Readonly<Record<string, string>> = {
  MLA: 'Argentina', MLB: 'Brasil', MLM: 'México', MLC: 'Chile', MCO: 'Colombia', MPE: 'Perú', MLU: 'Uruguay',
};
export const paisDeSitioMp = (siteId: string | null | undefined): string | null =>
  siteId ? PAIS_DE_SITIO[String(siteId).trim().toUpperCase()] ?? null : null;

/**
 * `47, 'USD'` → `US$ 47` · `49900, 'ARS'` → `$ 49.900 ARS` · `12.5, 'EUR'` → `12,50 EUR`. Con
 * decimales sólo si los tiene: un link de pago no es un recibo, pero tampoco redondea un precio.
 */
export function formatoMonto(monto: number, moneda: string): string {
  const m = moneda.toUpperCase();
  const tieneDecimales = Math.round(monto * 100) % 100 !== 0 && !esCeroDecimales(m);
  const n = monto.toLocaleString('es-AR', {
    minimumFractionDigits: tieneDecimales ? 2 : 0,
    maximumFractionDigits: tieneDecimales ? 2 : 0,
  });
  if (m === 'USD') return `US$ ${n}`;
  if (m === 'ARS' || m === 'MXN' || m === 'CLP' || m === 'COP' || m === 'UYU') return `$ ${n} ${m}`;
  return `${n} ${m}`;
}
