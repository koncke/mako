// =============================================================================
// dolar-cripto-reglas — los pesos del checkout al dólar CRIPTO (Binance) del MOMENTO (19/11/2026)
// =============================================================================
// Martín (18/11/2026): «incluso no del día, sino del momento. Cuando alguien da clic en comprar… que consulte por API… cuánto está la
// cotización». Y la fuente es el dólar CRIPTO, no el blue: Martín pasa los pesos a USDT en Binance (al 18/11 el blue estaba a 1.615 y el USDT
// P2P a 1.704: perdía 5,2 % en cada cambio). Medido el 19/11: dolarapi cripto 1.718,47 (venta) y CriptoYa Binance P2P 1.715,77 (totalAsk).
//
// LOS FRENOS (los mismos del cron del blue, lib/dolar-blue-reglas.ts, aplicados a la lectura en vivo):
//   · las DOS fuentes tienen que coincidir dentro de un 3 % (`COINCIDEN`); se toma la MÁS ALTA (el dólar que le cuesta a Martín: cobrar con
//     la más baja es perder la diferencia en cada venta);
//   · y no puede saltar más de un 15 % (`SALTO_MAXIMO`) contra la última buena;
//   · si no coinciden o falla una: la última buena, si tiene menos de `HORAS_DE_LA_ULTIMA` horas; si no, NADA. Sin cotización no se ofrece
//     Mercado Pago (queda pagar en dólares). NUNCA se inventa un número.
// Lo que se muestra es lo que se cobra: `ofertaDelPlan` (lib/compra-plan.ts) arma la página y el cobro con ESTE número (y `precioVisto` frena
// si cambió entre que se vio y que se tocó).
// Puro: sin red ni base. Lo prueba tests/dolar-cripto.test.ts.
// =============================================================================

import { COINCIDEN, SALTO_MAXIMO } from './dolar-blue-reglas';

export type LecturaCripto = { venta: number; fuente: string; at: number };

/** Cuánto vale la última cotización buena cuando las fuentes no coinciden o fallan. */
export const HORAS_DE_LA_ULTIMA = 6;
/** Cuánto se recuerda una lectura en el servidor (un minuto: «del momento», sin pegarle a las fuentes en cada visita). */
export const CACHE_MS = 60_000;

const PISO = 100;
const TECHO = 100_000;
const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= PISO && n <= TECHO ? n : null;
};

/** dolarapi.com `/v1/dolares/cripto`: `{ casa: "cripto", compra, venta, fechaActualizacion }`. Se usa la venta. */
export function leerDolarApiCripto(json: unknown, ahora: number): LecturaCripto | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (o.casa !== 'cripto') return null;
  const venta = numero(o.venta);
  const compra = numero(o.compra);
  if (venta == null || (compra != null && compra > venta)) return null;
  const t = typeof o.fechaActualizacion === 'string' ? Date.parse(o.fechaActualizacion) : NaN;
  return { venta, fuente: 'dolarapi.com (cripto)', at: Number.isFinite(t) ? Math.min(t, ahora) : ahora };
}

/** CriptoYa `/api/usdt/ars/1`: `{ binancep2p: { ask, totalAsk, bid, totalBid, time } }`. Se usa `totalAsk` (lo que cuesta COMPRAR el USDT). */
export function leerCriptoYa(json: unknown, ahora: number): LecturaCripto | null {
  if (!json || typeof json !== 'object') return null;
  const p2p = (json as Record<string, unknown>).binancep2p as Record<string, unknown> | undefined;
  if (!p2p || typeof p2p !== 'object') return null;
  const venta = numero(p2p.totalAsk) ?? numero(p2p.ask);
  if (venta == null) return null;
  const t = typeof p2p.time === 'number' ? p2p.time * 1000 : NaN;
  return { venta, fuente: 'CriptoYa (Binance P2P)', at: Number.isFinite(t) ? Math.min(t, ahora) : ahora };
}

export type CotizacionCheckout = { venta: number; fuente: string; at: number; deLaUltima: boolean };

/**
 * La cotización que usa el checkout, con los frenos de la cabecera. `lecturas`: lo que contestó cada fuente ahora (null = no contestó o vino roto).
 * `ultima`: la última buena que se guardó. Devuelve null si no hay una que se pueda usar: entonces no se ofrece Mercado Pago.
 */
export function cotizacionParaElCheckout(lecturas: ReadonlyArray<LecturaCripto | null>, ultima: LecturaCripto | null, ahora: number): CotizacionCheckout | null {
  const buenas = lecturas.filter((l): l is LecturaCripto => l != null);
  const ultimaVale = ultima && ahora - ultima.at < HORAS_DE_LA_ULTIMA * 3_600_000 && ultima.venta >= PISO && ultima.venta <= TECHO ? ultima : null;
  const deLaUltima = (): CotizacionCheckout | null => (ultimaVale ? { ...ultimaVale, deLaUltima: true } : null);
  if (buenas.length < 2) return deLaUltima();
  const [a, b] = buenas;
  const mayor = a.venta >= b.venta ? a : b;
  const menor = mayor === a ? b : a;
  if ((mayor.venta - menor.venta) / menor.venta > COINCIDEN) return deLaUltima();
  // La banda, contra una última buena de esta semana: contra una de hace un mes, un 15 % puede ser el dólar de verdad y trabaría el checkout para siempre.
  if (ultima && ahora - ultima.at < 7 * 86_400_000 && Math.abs(mayor.venta - ultima.venta) / ultima.venta > SALTO_MAXIMO) return deLaUltima();
  return { venta: mayor.venta, fuente: `${mayor.fuente} (coincide con ${menor.fuente})`, at: ahora, deLaUltima: false };
}

/** La última buena, como se guarda (`{ venta, fuente, at }`); null si no se entiende. */
export function leerUltima(crudo: string | null | undefined): LecturaCripto | null {
  try {
    const o = JSON.parse(crudo ?? '') as Record<string, unknown>;
    const venta = numero(o.venta);
    const at = typeof o.at === 'number' ? o.at : NaN;
    return venta != null && Number.isFinite(at) && typeof o.fuente === 'string' ? { venta, fuente: o.fuente, at } : null;
  } catch { return null; }
}
