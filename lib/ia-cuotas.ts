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
 * Límites EFECTIVOS de hoy. Dos cosas los mueven:
 *   · Gemini sube a tier pago si detectamos créditos cargados (= tiene saldo).
 *   · El tope se MULTIPLICA por la cantidad de cuentas cargadas: el free tier se
 *     agota por cuenta, así que tres keys de Gemini son tres veces la cuota. Sin
 *     esto, el gauge marcaba "sin cuota" con dos cuentas enteras sin tocar y la
 *     rotación proactiva mandaba al final a un proveedor que tenía lugar de sobra.
 *
 * ⚠️ Honestidad sobre lo que esto mide: el uso se cuenta por PROVEEDOR, no por
 * cuenta (`anthropic_usage.provider` no guarda cuál key se usó). O sea que el gauge
 * mide el conjunto, no el reparto: si la cuenta 1 se agotó y las otras dos están
 * intactas, el % total recién llega al tope cuando se agotaron las tres. Eso está
 * bien para lo que este número decide —a quién probar PRIMERO—, y el salto real
 * entre cuentas lo hace la cascada por ERROR (429 → próxima cuenta), que no depende
 * de esta cuenta.
 */
async function limitesEfectivos(): Promise<Record<string, LimiteProv>> {
  const geminiConCredito = !!(await getSaldo('gemini').catch(() => null));
  const base = geminiConCredito ? { ...LIMITES_PROVEEDOR, gemini: GEMINI_PAGO } : LIMITES_PROVEEDOR;
  const out: Record<string, LimiteProv> = {};
  for (const [prov, lim] of Object.entries(base)) {
    const n = await cuentasDe(prov).catch(() => 1);
    const mult = Math.max(1, n);
    out[prov] = mult === 1 ? lim : {
      ...lim,
      rpd: lim.rpd ? lim.rpd * mult : undefined,
      tokensDia: lim.tokensDia ? lim.tokensDia * mult : undefined,
      nota: `${lim.nota ?? ''}${lim.nota ? ' · ' : ''}${mult} cuentas conectadas`,
    };
  }
  return out;
}

export type UsoProv = { requests: number; tokens: number };
export type CuotaProv = { provider: string; requests: number; tokens: number; rpd?: number; tokensDia?: number; pct: number; agotado: boolean; label: string; nota?: string };

/** Uso de HOY por proveedor (pedidos + tokens), de anthropic_usage. Estas IA son todas
 *  BYOK (gratis por-cliente), así que el uso se cuenta SOLO en el workspace del request:
 *  el gauge "cuánto queda hoy" de Mauricio (ws1) no debe incluir el Gemini de Martín (ws9). */
export async function usoHoyProveedores(): Promise<Record<string, UsoProv>> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const ws = await (async () => { try { return (await getWorkspaceActual()) ?? OWNER_WS; } catch { return OWNER_WS; } })();
  const out: Record<string, UsoProv> = {};
  try {
    const { data } = await getSupabaseServer()
      .from('anthropic_usage')
      .select('provider, input_tokens, output_tokens')
      .eq('workspace_id', ws)
      .gte('created_at', dayStart.toISOString())
      .limit(20000);
    for (const r of (data ?? []) as Array<{ provider: string | null; input_tokens: number | null; output_tokens: number | null }>) {
      const p = r.provider ?? 'anthropic';
      const u = out[p] ?? { requests: 0, tokens: 0 };
      u.requests += 1;
      u.tokens += (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
      out[p] = u;
    }
  } catch (e) { console.warn(`[ia-cuotas] uso: ${e instanceof Error ? e.message : String(e)}`); }
  return out;
}

/** % de cuota consumida (el MAYOR entre pedidos/día y tokens/día). 0 = libre, 1 = tope. */
function pctDe(uso: UsoProv, lim: LimiteProv): number {
  const pr = lim.rpd ? uso.requests / lim.rpd : 0;
  const pt = lim.tokensDia ? uso.tokens / lim.tokensDia : 0;
  return Math.min(1, Math.max(pr, pt));
}

/** Cuota de cada proveedor gratis (para el gauge de /integraciones). */
export async function cuotasProveedores(uso?: Record<string, UsoProv>): Promise<CuotaProv[]> {
  const u = uso ?? (await usoHoyProveedores());
  const limites = await limitesEfectivos();
  return Object.entries(limites).map(([provider, lim]) => {
    const usoP = u[provider] ?? { requests: 0, tokens: 0 };
    const pct = pctDe(usoP, lim);
    return { provider, requests: usoP.requests, tokens: usoP.tokens, rpd: lim.rpd, tokensDia: lim.tokensDia, pct, agotado: pct >= UMBRAL, label: lim.label, nota: lim.nota };
  });
}

/** Reordena una lista de proveedores para la rotación PROACTIVA: primero los que todavía
 *  tienen cuota, después los que están al tope (por si todo lo demás falla). Nunca los saca:
 *  solo los manda al final. Un proveedor sin límite conocido (ej. openai pago) va como "con cuota". */
export async function ordenarPorCuota(orden: string[]): Promise<string[]> {
  const [uso, limites] = await Promise.all([
    usoHoyProveedores().catch(() => ({} as Record<string, UsoProv>)),
    limitesEfectivos().catch(() => LIMITES_PROVEEDOR),
  ]);
  const agotado = (p: string): boolean => { const lim = limites[p]; return lim ? pctDe(uso[p] ?? { requests: 0, tokens: 0 }, lim) >= UMBRAL : false; };
  return [...orden.filter((p) => !agotado(p)), ...orden.filter((p) => agotado(p))];
}
