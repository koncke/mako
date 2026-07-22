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

export type LimiteProv = { label: string; rpd?: number; tokensDia?: number; nota?: string };
export const LIMITES_PROVEEDOR: Record<string, LimiteProv> = {
  gemini: { label: 'Gemini', rpd: 250, tokensDia: 250_000, nota: '2.5 Flash free' },
  groq: { label: 'Groq', tokensDia: 500_000, nota: 'plan gratis' },
  cerebras: { label: 'Cerebras', rpd: 14_400, nota: 'free tier' },
  mistral: { label: 'Mistral', rpd: 500, nota: 'free (Experiment)' },
  openrouter: { label: 'OpenRouter', rpd: 50, nota: 'modelos :free sin créditos' },
};
const UMBRAL = 0.9; // a partir de este % de cuota lo tratamos como "sin cuota" (saltar antes del 429)

export type UsoProv = { requests: number; tokens: number };
export type CuotaProv = { provider: string; requests: number; tokens: number; rpd?: number; tokensDia?: number; pct: number; agotado: boolean; label: string; nota?: string };

/** Uso de HOY por proveedor (pedidos + tokens), de anthropic_usage. */
export async function usoHoyProveedores(): Promise<Record<string, UsoProv>> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const out: Record<string, UsoProv> = {};
  try {
    const { data } = await getSupabaseServer()
      .from('anthropic_usage')
      .select('provider, input_tokens, output_tokens')
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
  return Object.entries(LIMITES_PROVEEDOR).map(([provider, lim]) => {
    const usoP = u[provider] ?? { requests: 0, tokens: 0 };
    const pct = pctDe(usoP, lim);
    return { provider, requests: usoP.requests, tokens: usoP.tokens, rpd: lim.rpd, tokensDia: lim.tokensDia, pct, agotado: pct >= UMBRAL, label: lim.label, nota: lim.nota };
  });
}

/** Reordena una lista de proveedores para la rotación PROACTIVA: primero los que todavía
 *  tienen cuota, después los que están al tope (por si todo lo demás falla). Nunca los saca:
 *  solo los manda al final. Un proveedor sin límite conocido (ej. openai pago) va como "con cuota". */
export async function ordenarPorCuota(orden: string[]): Promise<string[]> {
  const uso = await usoHoyProveedores().catch(() => ({} as Record<string, UsoProv>));
  const agotado = (p: string): boolean => { const lim = LIMITES_PROVEEDOR[p]; return lim ? pctDe(uso[p] ?? { requests: 0, tokens: 0 }, lim) >= UMBRAL : false; };
  return [...orden.filter((p) => !agotado(p)), ...orden.filter((p) => agotado(p))];
}
