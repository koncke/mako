// =============================================================================
// dolar-cripto — lee el dólar cripto (Binance) EN EL MOMENTO, para los pesos del checkout (19/11/2026)
// =============================================================================
// Las reglas y los frenos, en lib/dolar-cripto-reglas.ts. Acá: las dos fuentes públicas (sin clave), un minuto de memoria en el servidor, y la
// última buena en el ajuste `planes.dolar_cripto` del negocio de la plataforma (para cuando las fuentes no coinciden o no contestan). Nunca tira:
// sin cotización devuelve null, y el checkout no ofrece Mercado Pago.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { CACHE_MS, cotizacionParaElCheckout, leerCriptoYa, leerDolarApiCripto, leerUltima, type CotizacionCheckout, type LecturaCripto } from './dolar-cripto-reglas';

/** El ajuste con la última cotización buena (en el negocio de la plataforma). */
export const CLAVE_DOLAR_CRIPTO = 'planes.dolar_cripto';

const FUENTES: ReadonlyArray<{ url: string; leer: (json: unknown, ahora: number) => LecturaCripto | null }> = [
  { url: 'https://dolarapi.com/v1/dolares/cripto', leer: leerDolarApiCripto },
  { url: 'https://criptoya.com/api/usdt/ars/1', leer: leerCriptoYa },
];

let memoria: { at: number; valor: CotizacionCheckout | null } | null = null;

async function leerFuente(f: (typeof FUENTES)[number], ahora: number): Promise<LecturaCripto | null> {
  try {
    const r = await fetch(f.url, { cache: 'no-store', signal: AbortSignal.timeout(4_000) });
    if (!r.ok) return null;
    return f.leer(await r.json(), ahora);
  } catch { return null; }
}

/** El dólar cripto de AHORA para el checkout (un minuto de memoria), o null si no hay uno que se pueda usar. */
export async function dolarCriptoAhora(ahora: number = Date.now()): Promise<CotizacionCheckout | null> {
  if (memoria && ahora - memoria.at < CACHE_MS) return memoria.valor;
  const db = getSupabaseServer();
  let ws: number | null = null;
  let ultima: LecturaCripto | null = null;
  try {
    ws = await wsSuperAdmin();
    const { data } = await db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_DOLAR_CRIPTO).maybeSingle();
    ultima = leerUltima((data as { value?: string } | null)?.value ?? null);
  } catch { /* sin la última: sólo vale lo de ahora */ }
  const lecturas = await Promise.all(FUENTES.map((f) => leerFuente(f, ahora)));
  const c = cotizacionParaElCheckout(lecturas, ultima, ahora);
  if (!c) console.warn(`[dolar-cripto] sin cotización para el checkout (lecturas: ${JSON.stringify(lecturas)}; última: ${JSON.stringify(ultima)}): no se ofrece Mercado Pago`);
  else if (c.deLaUltima) console.warn(`[dolar-cripto] las fuentes no coinciden o no contestaron: uso la última buena (${c.venta}, ${new Date(c.at).toISOString()})`);
  // La nueva buena se guarda (como mucho una vez cada 10 minutos, o si cambió): es la que sirve cuando las fuentes fallan.
  if (c && !c.deLaUltima && ws != null && (!ultima || ultima.venta !== c.venta || ahora - ultima.at > 10 * 60_000)) {
    const valor: LecturaCripto = { venta: c.venta, fuente: c.fuente, at: c.at };
    await db.from('app_settings').upsert({ workspace_id: ws, key: CLAVE_DOLAR_CRIPTO, value: JSON.stringify(valor), updated_at: new Date(ahora).toISOString() }, { onConflict: 'workspace_id,key' })
      .then(({ error }) => { if (error) console.warn(`[dolar-cripto] no pude guardar la última buena: ${error.message}`); });
  }
  memoria = { at: ahora, valor: c };
  return c;
}
