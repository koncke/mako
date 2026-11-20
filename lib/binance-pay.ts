// =============================================================================
// binance-pay — lee los pagos que MaKo RECIBIÓ por Binance Pay, con la clave de SÓLO LECTURA (19/11/2026)
// =============================================================================
// La clave la creó Martín (API Management › «Enable Reading») y la cargó en Vercel: `BINANCE_API_KEY` y `BINANCE_API_SECRET`
// (en la PC, C:/dev/mako-api/.env.local). Medido el 18/11: lectura sí; trading, futures y retiros no; `permitsUniversalTransfer` sí.
// ⚠️ CLAUDE NUNCA MUEVE PLATA: este módulo llama a UN solo endpoint, de lectura (`GET /sapi/v1/pay/transactions`), y un test
// (tests/binance-pay-calce.test.ts) lo exige leyendo este archivo: ninguna otra ruta de Binance, ningún POST.
// Las reglas del calce, en lib/binance-pay-reglas.ts.
// ⛔ DESDE EE. UU. BINANCE CONTESTA 451 (20/11/2026): el proyecto corre en `pdx1`. En Vercel, la cuenta se lee DIRECTO sólo desde São Paulo
// (la ruta interna /api/cron/binance-pagos, `preferredRegion = 'gru1'`); desde cualquier otra región se le piden los pagos a esa ruta
// (lib/binance-pay-region.ts). Desde la PC, directo. tests/binance-pay-region.test.ts.
// =============================================================================

import 'server-only';
import crypto from 'node:crypto';
import { movimientoDeBinance, type MovimientoBinance } from './binance-pay-reglas';
import { caminoDeBinance, leerPorLaRuta, type LecturaBinance } from './binance-pay-region';
import { APP_BASE_URL } from './app-url';

const BASE = 'https://api.binance.com';
const RUTA = '/sapi/v1/pay/transactions';

/** ¿Hay clave para mirar la cuenta? Sin ella, ningún comprobante se puede verificar (y entonces lo mira Martín). */
export const hayClaveDeBinance = (): boolean => !!(process.env.BINANCE_API_KEY?.trim() && process.env.BINANCE_API_SECRET?.trim());

export type { LecturaBinance };

/**
 * Los pagos RECIBIDOS por Binance Pay entre `desde` y `hasta` (ms), por el camino que sirve desde donde corre: directo (la PC, o Vercel en
 * São Paulo) o por la ruta interna (Vercel en cualquier otra región). Nunca tira.
 */
export async function pagosRecibidosEnBinance(desde: number, hasta: number): Promise<LecturaBinance> {
  if (caminoDeBinance({ vercel: process.env.VERCEL, region: process.env.VERCEL_REGION }) === 'directo') return leerDeBinanceDirecto(desde, hasta);
  return leerPorLaRuta({ base: APP_BASE_URL, secreto: process.env.CRON_SECRET, desde, hasta, fetch });
}

/**
 * Lee la cuenta DIRECTO en Binance. Sólo desde la PC o desde la ruta interna de São Paulo (desde EE. UU., 451). Binance devuelve hasta 100
 * por pedido, del más nuevo al más viejo: si vienen 100, se pide otra vez hasta el más viejo de esa tanda (como mucho 5 vueltas). Nunca tira.
 */
export async function leerDeBinanceDirecto(desde: number, hasta: number): Promise<LecturaBinance> {
  const key = process.env.BINANCE_API_KEY?.trim();
  const secret = process.env.BINANCE_API_SECRET?.trim();
  if (!key || !secret) return { ok: false, error: 'falta la clave de Binance (BINANCE_API_KEY / BINANCE_API_SECRET)', sinClave: true };
  const movs = new Map<string, MovimientoBinance>();
  let fin = Math.floor(hasta);
  try {
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      const qs = new URLSearchParams({ startTime: String(Math.floor(desde)), endTime: String(fin), limit: '100', recvWindow: '10000', timestamp: String(Date.now()) });
      qs.set('signature', crypto.createHmac('sha256', secret).update(qs.toString()).digest('hex'));
      const r = await fetch(`${BASE}${RUTA}?${qs.toString()}`, { method: 'GET', headers: { 'X-MBX-APIKEY': key }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      const j = (await r.json().catch(() => null)) as { code?: string | number; message?: string; msg?: string; data?: unknown[] } | null;
      if (!r.ok || !j || (j.code != null && String(j.code) !== '000000')) {
        return { ok: false, error: `Binance contestó ${r.status}: ${j?.message ?? j?.msg ?? 'sin detalle'}` };
      }
      const filas = Array.isArray(j.data) ? j.data : [];
      let masViejo = Infinity;
      for (const f of filas) {
        const t = Number((f as { transactionTime?: unknown })?.transactionTime);
        if (Number.isFinite(t)) masViejo = Math.min(masViejo, t);
        const m = movimientoDeBinance(f);
        if (m) movs.set(m.orderId, m);
      }
      if (filas.length < 100 || !Number.isFinite(masViejo) || masViejo <= desde) break;
      fin = masViejo - 1;
    }
    return { ok: true, movs: [...movs.values()] };
  } catch (e) {
    return { ok: false, error: `no pude leer Binance: ${e instanceof Error ? e.message : String(e)}` };
  }
}
