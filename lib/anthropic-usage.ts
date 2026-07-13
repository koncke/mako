// =============================================================================
// anthropic-usage — registro de tokens/costo por llamada + saldo manual
// =============================================================================
// La API de Anthropic NO expone el saldo prepago (solo la consola lo muestra).
// Acá: (1) registramos cada llamada (tokens + costo USD) en `anthropic_usage`;
// (2) el usuario carga su saldo a mano (setting `anthropic_saldo`) y derivamos
// "restante = saldo cargado − gasto real desde que lo cargó". Costo por modelo
// según el pricing público (USD por 1M de tokens). Todo es BEST-EFFORT: si no
// hay Supabase (local), nada rompe — solo no se registra.
// =============================================================================

import 'server-only';
import { OWNER_WS } from './workspace';
import { getSupabaseServer } from './supabase';

export type UsageInfo = {
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
  costUsd: number;
  model: string;
};

// Precios públicos por 1M de tokens (USD). cacheWrite ≈ 1.25× input (TTL 5m),
// cacheRead ≈ 0.1× input. Si el modelo no está en la tabla, se asume Opus.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
};
const DEFAULT_PRICE = { in: 5, out: 25 };

export function costFor(model: string, u: { input: number; output: number; cacheCreation: number; cacheRead: number }): number {
  const p = PRICING[model] ?? DEFAULT_PRICE;
  return (u.input * p.in + u.output * p.out + u.cacheCreation * p.in * 1.25 + u.cacheRead * p.in * 0.1) / 1_000_000;
}

/** Registra una llamada. Best-effort: nunca lanza. Devuelve el detalle para mostrarlo. */
export async function recordUsage(feature: string, model: string, rawUsage: unknown, motivo?: string): Promise<UsageInfo> {
  const u = (rawUsage && typeof rawUsage === 'object' ? rawUsage : {}) as Record<string, unknown>;
  const input = Number(u.input_tokens ?? 0) || 0;
  const output = Number(u.output_tokens ?? 0) || 0;
  const cacheCreation = Number(u.cache_creation_input_tokens ?? 0) || 0;
  const cacheRead = Number(u.cache_read_input_tokens ?? 0) || 0;
  const costUsd = costFor(model, { input, output, cacheCreation, cacheRead });
  const info: UsageInfo = { inputTokens: input, outputTokens: output, cacheCreation, cacheRead, costUsd, model };
  try {
    // La API key de Anthropic es ÚNICA para toda la agencia (super-admin y Mauricio
    // comparten el pool). Registramos SIEMPRE contra OWNER_WS con el cliente crudo —
    // igual que getSaldo/getUsageSummary — para no fragmentar el gasto por tenant.
    await getSupabaseServer().from('anthropic_usage').insert({
      workspace_id: OWNER_WS,
      feature: feature || 'otros',
      motivo: motivo?.trim() ? motivo.trim().slice(0, 200) : null,
      model,
      input_tokens: input,
      output_tokens: output,
      cache_creation_tokens: cacheCreation,
      cache_read_tokens: cacheRead,
      cost_usd: costUsd,
    });
  } catch (e) {
    console.warn(`[anthropic-usage] no se registró el uso: ${e instanceof Error ? e.message : String(e)}`);
  }
  return info;
}

type Saldo = { usd: number; setAt: string };
type Row = { created_at: string; feature: string; motivo: string | null; model: string | null; cost_usd: number; input_tokens: number; output_tokens: number };

export type UsageItem = { at: string; feature: string; motivo: string | null; model: string | null; tokens: number; costUsd: number };
export type UsageSummary = {
  saldo: Saldo | null;
  gastadoMesUsd: number;
  gastadoDesdeSaldoUsd: number;
  restanteUsd: number | null;
  ultimaOp: { tokens: number; costUsd: number; feature: string; at: string } | null;
  porFeature: Array<{ feature: string; costUsd: number; tokens: number }>;
  historial: UsageItem[];   // últimas operaciones (cronológico, con el motivo)
};

// El saldo es GLOBAL de la agencia: la API key de Anthropic es única, así que
// leemos/escribimos SIEMPRE contra OWNER_WS con el cliente crudo (settings.ts
// scopea por workspace del request → cada cliente vería un saldo distinto).
export async function getSaldo(): Promise<Saldo | null> {
  let raw: string | null = null;
  try {
    const { data } = await getSupabaseServer()
      .from('app_settings')
      .select('value')
      .eq('workspace_id', OWNER_WS)
      .eq('key', 'anthropic_saldo')
      .maybeSingle();
    raw = (data?.value as string | undefined) ?? null;
  } catch (e) {
    console.warn(`[anthropic-usage] no se pudo leer el saldo: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Saldo;
    if (typeof o.usd === 'number' && typeof o.setAt === 'string') return o;
  } catch { /* ignore */ }
  return null;
}

export async function setSaldo(usd: number, setAt: string): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('app_settings')
    .upsert(
      { workspace_id: OWNER_WS, key: 'anthropic_saldo', value: JSON.stringify({ usd, setAt }), updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw new Error(`Error guardando saldo de IA: ${error.message}`);
}

/** Resumen para el chip: gasto del mes, gasto desde el saldo cargado, restante, última op y desglose. */
export async function getUsageSummary(): Promise<UsageSummary> {
  const saldo = await getSaldo();
  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // La ventana arranca en el menor entre inicio de mes y la carga del saldo, así
  // calculamos ambos acumulados con UNA sola lectura acotada.
  const desde = saldo && saldo.setAt < monthStart ? saldo.setAt : monthStart;

  // GLOBAL (sin filtro de workspace): el gasto total es contra la única API key
  // de la agencia, igual que el saldo. Cliente crudo, no getTenantDb() (scopeado).
  let rows: Row[] = [];
  try {
    const { data } = await getSupabaseServer()
      .from('anthropic_usage')
      .select('created_at, feature, motivo, model, cost_usd, input_tokens, output_tokens')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(20000);
    rows = (data ?? []) as Row[];
  } catch (e) {
    console.warn(`[anthropic-usage] no se pudo leer el resumen: ${e instanceof Error ? e.message : String(e)}`);
  }

  let gastadoMesUsd = 0, gastadoDesdeSaldoUsd = 0;
  const feat = new Map<string, { costUsd: number; tokens: number }>();
  for (const r of rows) {
    const c = Number(r.cost_usd) || 0;
    const tk = (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
    if (r.created_at >= monthStart) {
      gastadoMesUsd += c;
      const f = feat.get(r.feature) ?? { costUsd: 0, tokens: 0 };
      f.costUsd += c; f.tokens += tk; feat.set(r.feature, f);
    }
    if (saldo && r.created_at >= saldo.setAt) gastadoDesdeSaldoUsd += c;
  }

  const last = rows[0] ?? null; // ya viene ordenado desc
  const ultimaOp = last ? { tokens: (Number(last.input_tokens) || 0) + (Number(last.output_tokens) || 0), costUsd: Number(last.cost_usd) || 0, feature: last.feature, at: last.created_at } : null;

  // Historial cronológico (últimas 80 operaciones) con el motivo legible.
  const historial: UsageItem[] = rows.slice(0, 80).map((r) => ({
    at: r.created_at, feature: r.feature, motivo: r.motivo ?? null, model: r.model ?? null,
    tokens: (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0), costUsd: Number(r.cost_usd) || 0,
  }));

  return {
    saldo,
    gastadoMesUsd,
    gastadoDesdeSaldoUsd,
    restanteUsd: saldo ? saldo.usd - gastadoDesdeSaldoUsd : null,
    ultimaOp,
    porFeature: [...feat.entries()].map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.costUsd - a.costUsd),
    historial,
  };
}
