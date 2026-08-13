import 'server-only';

// =============================================================================
// ia-cuotas — cuánto le queda a cada IA GRATIS hoy, para rotar ANTES del 429
// =============================================================================
// Cada free tier tiene un límite (pedidos/día y/o tokens/día). Contamos el uso de HOY
// desde anthropic_usage (una fila por llamada) y, si un proveedor está cerca del tope,
// lo SALTAMOS de la rotación en vez de esperar a que tire 429. También alimenta el gauge
// "cuánto queda" de /integraciones. Global (contra las keys de la agencia), igual que el
// panel de costo. Límites APROXIMADOS y ajustables acá (los free tiers cambian seguido).

import { getSupabaseServer } from '@/lib/supabase';
import { getSaldo } from '@/lib/anthropic-usage';
import { credWs } from '@/lib/credenciales';
import { clavesDe } from '@/lib/ia-keys';
import { OWNER_WS, getWorkspaceActual } from '@/lib/workspace';

export type LimiteProv = { label: string; rpd?: number; tokensDia?: number; nota?: string };
export const LIMITES_PROVEEDOR: Record<string, LimiteProv> = {
  gemini: { label: 'Gemini', rpd: 250, tokensDia: 250_000, nota: '2.5 Flash free' },
  groq: { label: 'Groq', tokensDia: 500_000, nota: 'plan gratis' },
  cerebras: { label: 'Cerebras', rpd: 14_400, nota: 'free tier' },
  mistral: { label: 'Mistral', rpd: 500, nota: 'free (Experiment)' },
  openrouter: { label: 'OpenRouter', rpd: 50, nota: 'modelos :free sin créditos' },
};
// Límites de Gemini cuando el usuario YA cargó créditos (tier pago): el free tier
// topea en 250 pedidos/día, pero con billing activo sube muchísimo → no lo saltamos
// de la rotación y el gauge muestra el margen real del tier pago.
const GEMINI_PAGO: LimiteProv = { label: 'Gemini', rpd: 30_000, tokensDia: 4_000_000, nota: 'créditos cargados (tier pago)' };
const UMBRAL = 0.9; // a partir de este % de cuota lo tratamos como "sin cuota" (saltar antes del 429)

/**
 * Cuántas CUENTAS (API keys) tiene cargadas este workspace de un proveedor.
 *
 * Vive acá y no en `ai-cheap` a propósito: `ai-cheap` ya importa este módulo
 * (`ordenarPorCuota`), y ponerlo del otro lado cerraba un ciclo de imports.
 */
export async function cuentasDe(prov: string, ws?: number): Promise<number> {
  const claves = clavesDe(prov);
  if (!claves.length) return 1; // proveedor sin multi-key (openai/anthropic)
  let n = 0;
  for (const c of claves) if (await credWs(c, ws)) n++;
  return n;
}

/**
 * Límite de UNA cuenta. Lo único que lo mueve es que Gemini pase a tier pago (= hay
 * créditos cargados).
 *
 * ⚠️ NO se multiplica por la cantidad de cuentas. La versión anterior lo hacía —tres
 * keys, tope × 3— y eso es justo lo que hacía mentir al panel: el tope de tres cuentas
 * NO es un tanque de 750k, son tres tanques de 250k que no se trasvasan. Con el uso
 * apilado en la cuenta 1 el gauge marcaba 32% mientras esa cuenta estaba al 96%.
 * El tope sigue siendo por cuenta; el reparto lo muestra `cuotasProveedores`.
 */
async function limitesEfectivos(): Promise<Record<string, LimiteProv>> {
  const geminiConCredito = !!(await getSaldo('gemini').catch(() => null));
  return geminiConCredito ? { ...LIMITES_PROVEEDOR, gemini: GEMINI_PAGO } : LIMITES_PROVEEDOR;
}

export type UsoProv = { requests: number; tokens: number };
export type CuotaCuenta = { cuenta: number; requests: number; tokens: number; pct: number; agotado: boolean };
export type CuotaProv = {
  provider: string; requests: number; tokens: number; rpd?: number; tokensDia?: number;
  pct: number; agotado: boolean; label: string; nota?: string;
  /** Una fila por CUENTA conectada. El total de arriba es la suma, y la suma sola
   *  miente: ver el comentario de `usoHoyPorCuenta`. */
  cuentas?: CuotaCuenta[];
};

/** La clave con la que se indexa el uso: `gemini` o `gemini#2`. */
export const claveCuenta = (provider: string, cuenta = 1): string => (cuenta > 1 ? `${provider}#${cuenta}` : provider);

/**
 * Uso de HOY por PROVEEDOR y CUENTA, de anthropic_usage.
 *
 * ⚠️ POR QUÉ POR CUENTA, y no solo por proveedor. El free tier se agota por cuenta:
 * tres keys de Gemini son tres cuotas de 250k que NO se trasvasan. Sumarlas da un
 * número que es cierto y una conclusión que es falsa — el panel de una clienta decía
 * «240,6k / 750,0k» (o sea "te sobra") mientras la cuenta 1, que era la que atendía
 * TODAS las llamadas, estaba al 96% de SUS 250k. Ninguna de las dos cifras estaba
 * mal; lo que estaba mal era sumar cuotas que no se pueden mover de lugar.
 *
 * Estas IA son todas BYOK (gratis por-cliente), así que el uso se cuenta SOLO en el
 * workspace del request: el gauge de Mauricio (ws1) no incluye el Gemini de Martín (ws9).
 */
export async function usoHoyPorCuenta(): Promise<Record<string, UsoProv>> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const ws = await (async () => { try { return (await getWorkspaceActual()) ?? OWNER_WS; } catch { return OWNER_WS; } })();
  const out: Record<string, UsoProv> = {};
  try {
    const { data } = await getSupabaseServer()
      .from('anthropic_usage')
      .select('provider, cuenta, input_tokens, output_tokens')
      .eq('workspace_id', ws)
      .gte('created_at', dayStart.toISOString())
      .limit(20000);
    for (const r of (data ?? []) as Array<{ provider: string | null; cuenta: number | null; input_tokens: number | null; output_tokens: number | null }>) {
      const p = r.provider ?? 'anthropic';
      // `cuenta` es NULL en las filas anteriores a la mig 0132: se leen como 1, que
      // es la verdad histórica (antes de multi-key había una sola key por proveedor).
      const k = claveCuenta(p, Number(r.cuenta) || 1);
      const tok = (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
      const u = out[k] ?? { requests: 0, tokens: 0 };
      u.requests += 1; u.tokens += tok;
      out[k] = u;
      // El agregado por proveedor se mantiene: lo consumen el panel de costo y los
      // reportes, que sí quieren "cuánto gastó Gemini en total".
      if (k !== p) {
        const t = out[p] ?? { requests: 0, tokens: 0 };
        t.requests += 1; t.tokens += tok;
        out[p] = t;
      }
    }
  } catch (e) { console.warn(`[ia-cuotas] uso: ${e instanceof Error ? e.message : String(e)}`); }
  return out;
}

/** Compat: el uso agregado por proveedor (lo que había antes de la mig 0132). */
export async function usoHoyProveedores(): Promise<Record<string, UsoProv>> {
  return usoHoyPorCuenta();
}

/** % de cuota consumida (el MAYOR entre pedidos/día y tokens/día). 0 = libre, 1 = tope. */
function pctDe(uso: UsoProv, lim: LimiteProv): number {
  const pr = lim.rpd ? uso.requests / lim.rpd : 0;
  const pt = lim.tokensDia ? uso.tokens / lim.tokensDia : 0;
  return Math.min(1, Math.max(pr, pt));
}

/**
 * Cuota de cada proveedor gratis (para el gauge de /integraciones), CON el detalle
 * por cuenta.
 *
 * El total de arriba sigue siendo la suma —es lo que responde "cuánto consumí hoy"—
 * pero `agotado` ya NO sale de ese total: un proveedor está sin cuota solo cuando
 * TODAS sus cuentas lo están. Es la diferencia entre "te queda el 68%" y "la cuenta
 * que atiende todas tus llamadas está al 96%", que era exactamente lo que el panel
 * no sabía decir.
 */
export async function cuotasProveedores(uso?: Record<string, UsoProv>): Promise<CuotaProv[]> {
  const u = uso ?? (await usoHoyPorCuenta());
  const limites = await limitesEfectivos();
  const out: CuotaProv[] = [];
  for (const [provider, lim] of Object.entries(limites)) {
    const n = Math.max(1, await cuentasDe(provider).catch(() => 1));
    const cuentas: CuotaCuenta[] = Array.from({ length: n }, (_, i) => {
      const usoC = u[claveCuenta(provider, i + 1)] ?? { requests: 0, tokens: 0 };
      const pct = pctDe(usoC, lim);
      return { cuenta: i + 1, requests: usoC.requests, tokens: usoC.tokens, pct, agotado: pct >= UMBRAL };
    });
    const usoP = u[provider] ?? { requests: 0, tokens: 0 };
    out.push({
      provider, requests: usoP.requests, tokens: usoP.tokens,
      // El tope que se muestra al lado del total es el de TODAS las cuentas juntas,
      // porque el total también es de todas. El de una sola vive en cada fila.
      rpd: lim.rpd ? lim.rpd * n : undefined,
      tokensDia: lim.tokensDia ? lim.tokensDia * n : undefined,
      pct: pctDe(usoP, { ...lim, rpd: lim.rpd ? lim.rpd * n : undefined, tokensDia: lim.tokensDia ? lim.tokensDia * n : undefined }),
      agotado: cuentas.every((c) => c.agotado),
      label: lim.label, nota: lim.nota, cuentas,
    });
  }
  return out;
}

/** Reordena una lista de proveedores para la rotación PROACTIVA: primero los que todavía
 *  tienen cuota, después los que están al tope (por si todo lo demás falla). Nunca los saca:
 *  solo los manda al final. Un proveedor sin límite conocido (ej. openai pago) va como "con cuota".
 *
 *  Un proveedor está agotado solo si TODAS sus cuentas lo están: mandar Gemini al final
 *  porque su cuenta 1 se acabó, teniendo dos cuentas intactas, es tirar la mejor opción. */
export async function ordenarPorCuota(orden: string[]): Promise<string[]> {
  const [uso, limites] = await Promise.all([
    usoHoyPorCuenta().catch(() => ({} as Record<string, UsoProv>)),
    limitesEfectivos().catch(() => LIMITES_PROVEEDOR),
  ]);
  const agotado = (p: string): boolean => {
    const lim = limites[p];
    if (!lim) return false;
    const n = Math.max(1, clavesDe(p).length || 1);
    // Sin dato de una cuenta, cuenta como libre. La duda favorece intentar.
    for (let i = 1; i <= n; i++) {
      if (pctDe(uso[claveCuenta(p, i)] ?? { requests: 0, tokens: 0 }, lim) < UMBRAL) return false;
    }
    return true;
  };
  return [...orden.filter((p) => !agotado(p)), ...orden.filter((p) => agotado(p))];
}

/**
 * Ordena las CUENTAS de un proveedor por cuota disponible: la que tiene nafta va
 * primero. Es la mitad proactiva de la rotación — sin esto la cascada siempre
 * empieza por la cuenta 1, y si esa está al tope cada llamada paga un 429 de peaje
 * antes de llegar a la 2. Devuelve las claves en el orden en que hay que probarlas.
 */
export async function ordenarCuentas(provider: string, claves: string[]): Promise<string[]> {
  if (claves.length < 2) return claves;
  const [uso, limites] = await Promise.all([
    usoHoyPorCuenta().catch(() => ({} as Record<string, UsoProv>)),
    limitesEfectivos().catch(() => LIMITES_PROVEEDOR),
  ]);
  const lim = limites[provider];
  if (!lim) return claves;
  const todas = clavesDe(provider);
  const pctDeClave = (c: string): number => {
    const i = todas.indexOf(c);
    return pctDe(uso[claveCuenta(provider, i + 1)] ?? { requests: 0, tokens: 0 }, lim);
  };
  // Estable y por % consumido: la menos gastada primero. `sort` de V8 es estable,
  // así que con todo en 0 el orden queda igual al de siempre (cuenta 1 primero).
  return [...claves].sort((a, b) => pctDeClave(a) - pctDeClave(b));
}
