// =============================================================================
// moneda-meta — en qué moneda cobra la cuenta publicitaria de ESTE workspace
// =============================================================================
// El `spend` que guarda `marketing_metrics_daily` (y el saldo, y el presupuesto de un
// conjunto) viene en la MONEDA DE LA CUENTA de Meta. Hasta el 08/10/2026 todo lo que lo
// mostraba en dólares dividía por 17,30 asumiendo pesos, y ws13, ws14 y ws15 cobran en USD:
// su gasto salía 17,3 veces más chico en el dashboard, el CAC, los experimentos y MaKo.
//
// Una cosa, un lugar: todo lector del gasto pide su conversor acá (`conversorGastoMeta`) y
// la regla de qué hacer con cada moneda vive, pura y con test, en `conversorDeGasto`
// (lib/presupuesto-cambio.ts).
//
// DE DÓNDE SALE LA MONEDA, en este orden:
//   1. El setting `meta.moneda_cuenta` del workspace, que escribe el sincronizador de Meta
//      (`fetchMetaInsights` pide `account_currency` en el mismo pedido de siempre). Toda
//      fila de gasto la escribió una sincronización con el token vivo, así que donde hay
//      gasto, la moneda quedó guardada aunque el token después venza.
//   2. Si no está guardada —o es de OTRA cuenta: el negocio reconectó Meta—, se le pregunta
//      a Meta una vez y se guarda.
//   3. Si tampoco se puede, `null`: «no sé», que no es «USD». (`cuentaMeta()` de
//      lib/meta-ads-create.ts devuelve 'USD' cuando Meta no manda el campo; acá no se usa
//      por eso.)
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from './settings';
import { credWs } from './credenciales';
import { getWorkspaceActual } from './workspace';
import { conversorDeGasto, type ConversorGasto } from './presupuesto-cambio';

export const KEY_MONEDA_META = 'meta.moneda_cuenta';

type Guardada = { moneda: string; cuenta: string | null; leida: string };

/** Una moneda ISO de tres letras, o null. Lo que no tenga esa forma no se guarda. */
function normalizar(moneda: unknown): string | null {
  const m = typeof moneda === 'string' ? moneda.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(m) ? m : null;
}

function leerGuardada(raw: string | null): Guardada | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<Guardada>;
    const moneda = normalizar(j.moneda);
    return moneda ? { moneda, cuenta: typeof j.cuenta === 'string' ? j.cuenta : null, leida: String(j.leida ?? '') } : null;
  } catch { return null; }
}

/**
 * Cinco minutos por workspace, en la memoria de la instancia: el dashboard pide el
 * conversor en cada consulta y no hace falta ir a la base cada vez. Reconectar Meta lo
 * invalida a lo sumo cinco minutos tarde.
 */
const MEMO_MS = 5 * 60_000;
const memo = new Map<number, { moneda: string | null; hasta: number }>();

/** Guarda la moneda de la cuenta del workspace en curso, sólo si cambió. Best-effort. */
export async function registrarMonedaMeta(moneda: unknown, cuenta: string | null): Promise<void> {
  const m = normalizar(moneda);
  if (!m) return;
  try {
    const actual = leerGuardada(await getSetting(KEY_MONEDA_META));
    if (actual && actual.moneda === m && actual.cuenta === cuenta) return;
    await setSetting(KEY_MONEDA_META, JSON.stringify({ moneda: m, cuenta, leida: new Date().toISOString() } satisfies Guardada));
    const ws = await getWorkspaceActual();
    if (ws != null) memo.set(ws, { moneda: m, hasta: Date.now() + MEMO_MS });
  } catch (e) {
    console.warn(`[moneda-meta] no pude guardar la moneda ${m}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Pregunta la moneda a Meta con las credenciales del workspace en curso. null si no puede. */
async function monedaDesdeMeta(cuenta: string): Promise<string | null> {
  const [ver, tk] = [process.env.META_API_VERSION, await credWs('META_ACCESS_TOKEN')];
  if (!ver || !tk || tk.startsWith('PENDING')) return null;
  try {
    const url = new URL(`https://graph.facebook.com/${ver}/${cuenta}`);
    url.searchParams.set('fields', 'currency');
    url.searchParams.set('access_token', tk);
    const r = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const j = (await r.json().catch(() => ({}))) as { currency?: unknown };
    return r.ok ? normalizar(j.currency) : null;
  } catch { return null; }
}

/** La moneda de la cuenta de Meta del workspace en curso, o null si no se sabe. */
export async function monedaCuentaMeta(): Promise<string | null> {
  const ws = await getWorkspaceActual();
  const m = ws != null ? memo.get(ws) : undefined;
  if (m && m.hasta > Date.now()) return m.moneda;

  const cuentaRaw = await credWs('META_AD_ACCOUNT_ID').catch(() => null);
  const cuenta = cuentaRaw && !cuentaRaw.startsWith('PENDING') ? cuentaRaw : null;
  const guardada = leerGuardada(await getSetting(KEY_MONEDA_META));
  // La guardada vale si es de esta cuenta, o si no hay cuenta para comparar (el token se
  // fue pero el gasto viejo sigue ahí y esa moneda es la que tenía).
  let moneda = guardada && (!cuenta || !guardada.cuenta || guardada.cuenta === cuenta) ? guardada.moneda : null;
  if (!moneda && cuenta) {
    moneda = await monedaDesdeMeta(cuenta);
    if (moneda) await registrarMonedaMeta(moneda, cuenta);
  }
  // No se memoiza un «no sé»: el próximo pedido vuelve a intentar.
  if (ws != null && moneda) memo.set(ws, { moneda, hasta: Date.now() + MEMO_MS });
  return moneda;
}

/** El conversor del gasto de Meta a dólares para el workspace en curso. Ver `conversorDeGasto`. */
export async function conversorGastoMeta(): Promise<ConversorGasto> {
  const moneda = await monedaCuentaMeta().catch(() => null);
  const ws = await getWorkspaceActual().catch(() => null);
  return conversorDeGasto(moneda, (msg) => console.error(`[moneda-meta] ws=${ws ?? '?'}: ${msg}`));
}
