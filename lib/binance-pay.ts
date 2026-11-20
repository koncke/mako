// =============================================================================
// binance-pay — los pagos que MaKo RECIBIÓ por Binance Pay, por el camino que sirve desde donde corre (19/11/2026)
// =============================================================================
// La lectura en sí (la clave de SÓLO LECTURA, un solo GET a Binance) vive en lib/binance-pay-directo.ts; las reglas del calce, en
// lib/binance-pay-reglas.ts. ⚠️ CLAUDE NUNCA MUEVE PLATA: tests/binance-pay-calce.test.ts lo exige leyendo los dos archivos.
// ⛔ DESDE EE. UU. BINANCE CONTESTA 451 (20/11/2026): el proyecto corre en `pdx1`. En Vercel, la cuenta se lee DIRECTO sólo desde la ruta
// interna /api/cron/binance-pagos, la única función del proyecto que corre en São Paulo (`gru1`); desde cualquier otra región se le piden
// los pagos a esa ruta (lib/binance-pay-region.ts). Desde la PC, directo. tests/binance-pay-region.test.ts.
// =============================================================================

import 'server-only';
import { caminoDeBinance, leerPorLaRuta, type LecturaBinance } from './binance-pay-region';
import { leerDeBinanceDirecto } from './binance-pay-directo';
import { APP_BASE_URL } from './app-url';

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
