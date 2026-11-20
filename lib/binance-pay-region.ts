// =============================================================================
// binance-pay-region — Binance se lee desde São Paulo: desde EE. UU. contesta 451 (20/11/2026)
// =============================================================================
// ⛔ EL PROBLEMA: el proyecto corre en `pdx1` (Portland, vercel.json) y Binance bloquea EE. UU.: `GET /sapi/v1/pay/transactions` contesta
// 451 «Service unavailable from a restricted location according to 'b. Eligibility'» (visto el 20/11 en producción, `grupo_mensajes`
// 1049). La medición del 19/11 se hizo desde la PC (Argentina), por eso no se vio: en producción `verificarEnBinance` daba siempre «falla»
// y nada se aplicaba solo, ni con captura ni sin captura.
// EL ARREGLO: una ruta interna, sólo de lectura, `/api/cron/binance-pagos`, con `preferredRegion = 'gru1'` (São Paulo; el plan Pro deja una
// región por función, medido en la API de Vercel el 20/11). Ella lee la cuenta DIRECTO; desde cualquier otra región de Vercel,
// lib/binance-pay.ts le pide los pagos a ella con el secreto del cron. Desde la PC (scripts en seco), directo.
// Sin `server-only` y con el fetch de afuera: lo prueba tests/binance-pay-region.test.ts.
// ⚠️ NADA DE ESTO MUEVE PLATA: un solo GET, a la ruta interna, que a su vez hace un solo GET de lectura a Binance.
// =============================================================================

import type { MovimientoBinance } from './binance-pay-reglas';

/** La región de Vercel desde donde se lee Binance. */
export const REGION_DE_BINANCE = 'gru1';
/** La ruta interna que lee la cuenta desde esa región (vive en /api/cron por el secreto del cron; no la agenda Vercel). */
export const RUTA_INTERNA_BINANCE = '/api/cron/binance-pagos';

export type LecturaBinance = { ok: true; movs: MovimientoBinance[] } | { ok: false; error: string; sinClave?: boolean };

/** ¿Se habla con Binance directo, o por la ruta interna? En Vercel, directo SÓLO desde la región de Binance. */
export function caminoDeBinance(env: { vercel?: string; region?: string }): 'directo' | 'ruta' {
  if (!env.vercel) return 'directo';
  return env.region === REGION_DE_BINANCE ? 'directo' : 'ruta';
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Un pago como lo devuelve la ruta (ya leído por `movimientoDeBinance` allá); null si no tiene la forma. */
function movimientoDeLaRuta(v: unknown): MovimientoBinance | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const orderId = texto(o.orderId);
  const moneda = texto(o.moneda);
  if (!orderId || !/^\d{6,30}$/.test(orderId) || !moneda) return null;
  if (typeof o.monto !== 'number' || !Number.isFinite(o.monto) || o.monto <= 0 || typeof o.at !== 'number' || !Number.isFinite(o.at)) return null;
  return { orderId, at: o.at, monto: o.monto, moneda, pagadorNombre: texto(o.pagadorNombre), pagadorId: texto(o.pagadorId) };
}

/**
 * Le pide los pagos a la ruta interna. Cualquier cosa que no sea `{ ok: true, movs: [...] }` es una falla con su texto (y la región desde
 * donde corrió la ruta): nunca «no hay pagos». Nunca tira.
 */
export async function leerPorLaRuta(p: { base: string; secreto: string | undefined; desde: number; hasta: number; fetch: typeof fetch }): Promise<LecturaBinance> {
  if (!p.secreto?.trim()) return { ok: false, error: 'falta CRON_SECRET para pedirle los pagos a la ruta de Binance' };
  const url = `${p.base.replace(/\/+$/, '')}${RUTA_INTERNA_BINANCE}?desde=${Math.floor(p.desde)}&hasta=${Math.floor(p.hasta)}`;
  try {
    const r = await p.fetch(url, { method: 'GET', headers: { authorization: `Bearer ${p.secreto.trim()}` }, cache: 'no-store', signal: AbortSignal.timeout(55_000) });
    const j = (await r.json().catch(() => null)) as { ok?: unknown; movs?: unknown; error?: unknown; region?: unknown; sinClave?: unknown } | null;
    const region = texto(j?.region);
    if (!r.ok || !j) return { ok: false, error: `la ruta de Binance contestó ${r.status}${texto(j?.error) ? `: ${texto(j?.error)}` : ''}${region ? ` (desde ${region})` : ''}` };
    // Sin la clave de Binance allá, lo mismo que sin la clave acá (`verificarEnBinance` lo manda a Martín en el acto).
    if (j.ok !== true) return { ok: false, error: `${texto(j.error) ?? 'la ruta de Binance no pudo leer la cuenta'}${region ? ` (desde ${region})` : ''}`, ...(j.sinClave === true ? { sinClave: true } : {}) };
    if (!Array.isArray(j.movs)) return { ok: false, error: 'la ruta de Binance contestó sin la lista de pagos' };
    return { ok: true, movs: j.movs.map(movimientoDeLaRuta).filter((m): m is MovimientoBinance => m != null) };
  } catch (e) {
    return { ok: false, error: `no pude pedirle los pagos a la ruta de Binance: ${e instanceof Error ? e.message : String(e)}` };
  }
}
