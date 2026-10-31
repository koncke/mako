// =============================================================================
// promo-entrada-reglas — el 50% del primer mes con reloj, en la landing de venta (puro)
// =============================================================================
// Martín, llamada del 30/10/2026 (docs/estrategia-lanzamiento-low-to-high.md §3): «te ganaste un 50% de descuento», con un reloj de
// 5 a 10 minutos, sobre los dos planes de entrada. El descuento es del primer mes.
//
// ⚠️ EL RELOJ NO MIENTE (el Cerebro, 30/10/2026: «un reloj que miente es peor que no tenerlo»; este avatar vende high ticket y lo
//    reconoce). Lo sostiene el servidor (./promo-entrada.ts): al recargar sigue por donde iba, y en cero se terminó en ese navegador.
//    Lo que no puede atar es a una persona que abre otro navegador: a ése le corre su propio reloj.
// =============================================================================

export const PROMO_ENTRADA = { pct: 50, minutos: 10, planes: ['esencial', 'pro'] as readonly string[] } as const;

export const COOKIE_PROMO = 'mk_promo';
/** La cookie dura mucho más que el reloj: es lo que hace que, vencida, no vuelva a empezar. */
export const COOKIE_PROMO_DIAS = 365;

/** El precio del primer mes, en dólares con centavos. */
export const precioPrimerMes = (usd: number): number => Math.round(usd * (100 - PROMO_ENTRADA.pct)) / 100;

/** 23.5 → «23,50»; 47 → «47». */
export function textoUsd(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

/** Lo que falta, como se lee en el reloj: «09:41». Nunca negativo. */
export function textoReloj(restanteMs: number): string {
  const s = Math.max(0, Math.ceil(restanteMs / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Lo que contesta /api/promo-entrada. `hay` false: no hay cartel (apagada, o el reloj ya terminó). */
export type EstadoPromo = { hay: true; restanteMs: number } | { hay: false };
