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
// cacheRead ≈ 0.1× input. Incluye los modelos BARATOS (Groq/OpenAI) que usa
// lib/ai-cheap.ts, para que su gasto también quede registrado con costo real.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
  // Baratos (tareas simples)
  'openai/gpt-oss-20b': { in: 0.075, out: 0.30 },   // Groq
  'openai/gpt-oss-120b': { in: 0.15, out: 0.60 },   // Groq
  'llama-3.3-70b-versatile': { in: 0.59, out: 0.79 }, // Groq
  'gpt-4o-mini': { in: 0.15, out: 0.60 },           // OpenAI
};
const DEFAULT_PRICE = { in: 5, out: 25 };

// STT: precio por SEGUNDO de audio (USD). El STT cobra por duración, no por tokens.
const STT_PRICE_SEG: Record<string, number> = {
  'whisper-large-v3-turbo': 0.04 / 3600,  // Groq
  'whisper-large-v3': 0.111 / 3600,       // Groq
  'whisper-1': 0.006 / 60,                // OpenAI
};

export function costFor(model: string, u: { input: number; output: number; cacheCreation: number; cacheRead: number }): number {
  const p = PRICING[model] ?? DEFAULT_PRICE;
  return (u.input * p.in + u.output * p.out + u.cacheCreation * p.in * 1.25 + u.cacheRead * p.in * 0.1) / 1_000_000;
}

async function insertUsage(row: Record<string, unknown>): Promise<void> {
  try {
    // La API key es del pool de la agencia → registramos SIEMPRE contra OWNER_WS
    // con el cliente crudo (no getTenantDb, que scopea) para no fragmentar el gasto.
    await getSupabaseServer().from('anthropic_usage').insert({ workspace_id: OWNER_WS, ...row });
  } catch (e) {
    console.warn(`[anthropic-usage] no se registró el uso: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Registra una llamada por TOKENS. Best-effort. `provider` distingue Claude (que
 * descuenta del saldo) del resto. rawUsage tolera el shape de Anthropic
 * (input_tokens/output_tokens) o el de OpenAI-compat (prompt_tokens/completion_tokens).
 */
export async function recordUsage(feature: string, model: string, rawUsage: unknown, motivo?: string, provider = 'anthropic'): Promise<UsageInfo> {
  const u = (rawUsage && typeof rawUsage === 'object' ? rawUsage : {}) as Record<string, unknown>;
  const input = Number(u.input_tokens ?? u.prompt_tokens ?? 0) || 0;
  const output = Number(u.output_tokens ?? u.completion_tokens ?? 0) || 0;
  const cacheCreation = Number(u.cache_creation_input_tokens ?? 0) || 0;
  const cacheRead = Number(u.cache_read_input_tokens ?? 0) || 0;
  const costUsd = costFor(model, { input, output, cacheCreation, cacheRead });
  await insertUsage({
    feature: feature || 'otros', motivo: motivo?.trim() ? motivo.trim().slice(0, 200) : null, model, provider,
    input_tokens: input, output_tokens: output, cache_creation_tokens: cacheCreation, cache_read_tokens: cacheRead, cost_usd: costUsd,
  });
  return { inputTokens: input, outputTokens: output, cacheCreation, cacheRead, costUsd, model };
}

/** Registra una transcripción (STT): cobra por SEGUNDOS de audio, no por tokens. */
export async function recordSttUsage(feature: string, model: string, segundos: number, motivo?: string, provider = 'openai'): Promise<void> {
  const seg = Math.max(0, Number(segundos) || 0);
  const costUsd = (STT_PRICE_SEG[model] ?? STT_PRICE_SEG['whisper-1']) * seg;
  await insertUsage({
    feature: feature || 'stt', motivo: motivo?.trim() ? motivo.trim().slice(0, 200) : null, model, provider,
    input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, cost_usd: costUsd,
  });
}

type Saldo = { usd: number; setAt: string };
type Row = { created_at: string; feature: string; motivo: string | null; model: string | null; provider: string | null; cost_usd: number; input_tokens: number; output_tokens: number };

export type UsageItem = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
export type SaldoProveedor = { provider: string; costMesUsd: number; tokens: number; saldo: Saldo | null; restanteUsd: number | null; gratis: boolean };
export type UsageSummary = {
  saldo: Saldo | null;
  gastadoMesUsd: number;
  gastadoDesdeSaldoUsd: number;
  restanteUsd: number | null;
  ultimaOp: { tokens: number; costUsd: number; feature: string; at: string } | null;
  porFeature: Array<{ feature: string; costUsd: number; tokens: number }>;
  porProveedor: SaldoProveedor[];   // Claude / OpenAI / Groq: gasto + saldo + restante
  historial: UsageItem[];   // últimas operaciones (cronológico, con el motivo)
};

// El saldo es GLOBAL de la agencia (las API keys son únicas por proveedor): se
// lee/escribe SIEMPRE contra OWNER_WS con el cliente crudo. Un saldo POR PROVEEDOR
// (Claude/OpenAI/Groq); la key de Claude conserva su nombre viejo por compat.
export const PROVEEDORES = ['anthropic', 'openai', 'groq'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];
const keySaldo = (p: string) => (p === 'anthropic' ? 'anthropic_saldo' : `saldo.${p}`);

export async function getSaldo(provider: string = 'anthropic'): Promise<Saldo | null> {
  let raw: string | null = null;
  try {
    const { data } = await getSupabaseServer()
      .from('app_settings').select('value')
      .eq('workspace_id', OWNER_WS).eq('key', keySaldo(provider)).maybeSingle();
    raw = (data?.value as string | undefined) ?? null;
  } catch (e) {
    console.warn(`[anthropic-usage] no se pudo leer el saldo (${provider}): ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Saldo;
    if (typeof o.usd === 'number' && typeof o.setAt === 'string') return o;
  } catch { /* ignore */ }
  return null;
}

export async function setSaldo(usd: number, setAt: string, provider: string = 'anthropic'): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('app_settings')
    .upsert(
      { workspace_id: OWNER_WS, key: keySaldo(provider), value: JSON.stringify({ usd, setAt }), updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw new Error(`Error guardando saldo de IA (${provider}): ${error.message}`);
}

/** Resumen para el chip: gasto del mes, gasto desde el saldo cargado, restante, última op y desglose. */
export async function getUsageSummary(): Promise<UsageSummary> {
  const [sAnthropic, sOpenai, sGroq] = await Promise.all([getSaldo('anthropic'), getSaldo('openai'), getSaldo('groq')]);
  const saldos: Record<string, Saldo | null> = { anthropic: sAnthropic, openai: sOpenai, groq: sGroq };
  const saldo = sAnthropic; // compat: el saldo "principal" sigue siendo Claude
  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // La ventana arranca en el menor entre inicio de mes y la carga MÁS VIEJA de un
  // saldo, así calculamos todos los acumulados con UNA sola lectura acotada.
  const setAts = [sAnthropic, sOpenai, sGroq].filter(Boolean).map((s) => (s as Saldo).setAt);
  const desde = setAts.length ? [monthStart, ...setAts].sort()[0] : monthStart;

  // GLOBAL (sin filtro de workspace): el gasto total es contra las API keys únicas
  // de la agencia, igual que el saldo. Cliente crudo, no getTenantDb() (scopeado).
  let rows: Row[] = [];
  try {
    const { data } = await getSupabaseServer()
      .from('anthropic_usage')
      .select('created_at, feature, motivo, model, provider, cost_usd, input_tokens, output_tokens')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(20000);
    rows = (data ?? []) as Row[];
  } catch (e) {
    console.warn(`[anthropic-usage] no se pudo leer el resumen: ${e instanceof Error ? e.message : String(e)}`);
  }

  let gastadoMesUsd = 0, gastadoDesdeSaldoUsd = 0;
  const feat = new Map<string, { costUsd: number; tokens: number }>();
  const prov = new Map<string, { mes: number; tokens: number; desdeSaldo: number }>();
  for (const r of rows) {
    const c = Number(r.cost_usd) || 0;
    const tk = (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
    const p = r.provider ?? 'anthropic';
    const pa = prov.get(p) ?? { mes: 0, tokens: 0, desdeSaldo: 0 };
    if (r.created_at >= monthStart) {
      gastadoMesUsd += c; // gasto total de IA del mes (todos los proveedores)
      pa.mes += c; pa.tokens += tk;
      const f = feat.get(r.feature) ?? { costUsd: 0, tokens: 0 };
      f.costUsd += c; f.tokens += tk; feat.set(r.feature, f);
    }
    const sp = saldos[p];
    if (sp && r.created_at >= sp.setAt) pa.desdeSaldo += c;
    prov.set(p, pa);
    // El SALDO prepago principal es de Claude.
    if (saldo && p === 'anthropic' && r.created_at >= saldo.setAt) gastadoDesdeSaldoUsd += c;
  }
  const porProveedor: SaldoProveedor[] = PROVEEDORES.map((p) => {
    const pa = prov.get(p) ?? { mes: 0, tokens: 0, desdeSaldo: 0 };
    const s = saldos[p];
    return { provider: p, costMesUsd: pa.mes, tokens: pa.tokens, saldo: s, restanteUsd: s ? s.usd - pa.desdeSaldo : null, gratis: p === 'groq' };
  });

  const last = rows[0] ?? null; // ya viene ordenado desc
  const ultimaOp = last ? { tokens: (Number(last.input_tokens) || 0) + (Number(last.output_tokens) || 0), costUsd: Number(last.cost_usd) || 0, feature: last.feature, at: last.created_at } : null;

  // Historial cronológico (últimas 80 operaciones) con el motivo legible.
  const historial: UsageItem[] = rows.slice(0, 80).map((r) => ({
    at: r.created_at, feature: r.feature, motivo: r.motivo ?? null, model: r.model ?? null, provider: r.provider ?? 'anthropic',
    tokens: (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0), costUsd: Number(r.cost_usd) || 0,
  }));

  return {
    saldo,
    gastadoMesUsd,
    gastadoDesdeSaldoUsd,
    restanteUsd: saldo ? saldo.usd - gastadoDesdeSaldoUsd : null,
    ultimaOp,
    porFeature: [...feat.entries()].map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.costUsd - a.costUsd),
    porProveedor,
    historial,
  };
}
