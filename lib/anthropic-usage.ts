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
import { OWNER_WS, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';

// A QUÉ workspace pertenece el saldo/gasto de un proveedor. La regla real no es
// "qué proveedor es" sino **de quién es la key que lo pagó**:
//  · el resto (gemini/openai/groq/…): BYOK por cliente → el workspace del request.
//    Así el saldo que Martín carga en Gemini vive en SU ws (9), no se cuela en ws1.
//  · anthropic (Claude): la key de la agencia es compartida → OWNER_WS. PERO un
//    cliente con SU PROPIA fila de ANTHROPIC_API_KEY paga él, así que su gasto es
//    suyo. Antes esto decía "SIEMPRE OWNER_WS" y era verdad cuando se escribió;
//    desde BYOK, el gasto de un cliente se le sumaba a Mauricio y el cliente no lo
//    veía en ningún lado. Sin key propia `chatClaude` ni siquiera puede correr, así
//    que el fallback a OWNER_WS queda para los crons sin contexto.
// Best-effort: sin contexto de workspace (algún cron suelto) cae a OWNER_WS.
async function wsDeProveedor(provider?: string | null): Promise<number> {
  let ws: number | null = null;
  try { ws = await getWorkspaceActual(); } catch { ws = null; }
  if (ws == null) return OWNER_WS;
  if (provider && provider !== 'anthropic') return ws;
  if (ws === OWNER_WS) return OWNER_WS;
  // Claude en el workspace de un cliente: es suyo solo si la key es suya.
  try {
    const { credWs } = await import('./credenciales');
    return (await credWs('ANTHROPIC_API_KEY', ws)) ? ws : OWNER_WS;
  } catch { return OWNER_WS; }
}

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
  // ⚠️ Sonnet 5 está en PRECIO INTRODUCTORIO 2/10 hasta el 31/08/2026; el 1 de
  // septiembre pasa a 3/15. Es un error con fecha de vencimiento en las DOS
  // direcciones: con 3/15 el histórico de julio-agosto queda sobrevaluado 50%
  // (y de ahí cuelga el baseline de US$93,50 y el «margen del Pro» que sale en
  // /admin/dev/pricing), y si no se toca, el 1/9 el número se vuelve correcto
  // solo para lo nuevo y el histórico queda mal para siempre, sin que nada avise.
  //
  // ✅ HISTÓRICO YA RE-VALUADO (2026-08-13): `cost_usd` se congela al insertar, así
  // que las 513 filas de sonnet-5 escritas antes del cambio de esta tabla quedaron
  // a 3/15 y se corrigieron con un UPDATE a 2/10 (julio 10,96→5,92 · agosto
  // 65,05→48,94). Ese 48,94 cierra contra los US$51,97 que muestra el dashboard de
  // Anthropic; lo que falta son los módulos que gastan SIN registrar (embeddings,
  // transcribe, analyze-creatives — ver docs/hallazgos-ia.md).
  // NO volver a correr ese UPDATE: hoy la tabla y las filas coinciden.
  'claude-sonnet-5': { in: 2, out: 10 },   // ← volver a { in: 3, out: 15 } el 2026-09-01
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
  // Baratos (tareas simples)
  'openai/gpt-oss-20b': { in: 0.075, out: 0.30 },   // Groq
  'openai/gpt-oss-120b': { in: 0.15, out: 0.60 },   // Groq
  'llama-3.3-70b-versatile': { in: 0.59, out: 0.79 }, // Groq
  'gpt-4o-mini': { in: 0.15, out: 0.60 },           // OpenAI
};
const DEFAULT_PRICE = { in: 5, out: 25 };
// Precio de Gemini cuando el cliente cargó créditos (tier pago). En free tier no cobra
// (costFor devuelve 0 al escribir); getUsageSummary recomputa el costo real de las filas
// de Gemini SOLO si hay saldo registrado → así el restante de créditos baja de verdad.
export const GEMINI_PRICE_PAGO = { in: 0.30, out: 2.50 }; // gemini-2.5-flash ≈ USD/1M in/out

// STT: precio por SEGUNDO de audio (USD). El STT cobra por duración, no por tokens.
const STT_PRICE_SEG: Record<string, number> = {
  'whisper-large-v3-turbo': 0.04 / 3600,  // Groq
  'whisper-large-v3': 0.111 / 3600,       // Groq
  'whisper-1': 0.006 / 60,                // OpenAI
};

// Proveedores GRATIS por rate-limit: no cobran dinero (Gemini free tier incluido; su
// costo pago se recomputa en getUsageSummary si hay créditos). Se guardan a costo 0.
const PROVEEDORES_GRATIS = ['groq', 'gemini', 'cerebras', 'mistral', 'openrouter'];
export function costFor(model: string, u: { input: number; output: number; cacheCreation: number; cacheRead: number }, provider = ''): number {
  if (provider && PROVEEDORES_GRATIS.includes(provider)) return 0;
  if (model.startsWith('gemini')) return 0; // por si la llamada no pasó provider
  const p = PRICING[model] ?? DEFAULT_PRICE;
  return (u.input * p.in + u.output * p.out + u.cacheCreation * p.in * 1.25 + u.cacheRead * p.in * 0.1) / 1_000_000;
}

async function insertUsage(row: Record<string, unknown>): Promise<void> {
  try {
    // Claude va contra la key compartida de la agencia → OWNER_WS. El resto (BYOK)
    // se registra en el workspace del request, así el gasto de Gemini de Martín (ws9)
    // NO aparece en el de Mauricio (ws1). Cliente crudo (no getTenantDb): el ws lo
    // decide wsDeProveedor, no el scoping automático.
    const ws = await wsDeProveedor(row.provider as string | undefined);
    await getSupabaseServer().from('anthropic_usage').insert({ workspace_id: ws, ...row });
  } catch (e) {
    console.warn(`[anthropic-usage] no se registró el uso: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Registra una llamada por TOKENS. Best-effort. `provider` distingue Claude (que
 * descuenta del saldo) del resto. rawUsage tolera el shape de Anthropic
 * (input_tokens/output_tokens) o el de OpenAI-compat (prompt_tokens/completion_tokens).
 */
export async function recordUsage(feature: string, model: string, rawUsage: unknown, motivo?: string, provider = 'anthropic', cuenta?: number): Promise<UsageInfo> {
  const u = (rawUsage && typeof rawUsage === 'object' ? rawUsage : {}) as Record<string, unknown>;
  const input = Number(u.input_tokens ?? u.prompt_tokens ?? 0) || 0;
  const outputVisible = Number(u.output_tokens ?? u.completion_tokens ?? 0) || 0;
  // Gemini (y otros con "thinking") cobran tokens de razonamiento que NO vienen en
  // completion_tokens pero SÍ en total_tokens. Si total > input+visible, el excedente
  // son tokens ocultos billables → los sumamos al output para que el costo dé bien.
  const total = Number(u.total_tokens ?? 0) || 0;
  const reasoning = Number((u.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens ?? 0) || 0;
  const output = Math.max(outputVisible + reasoning, total > input ? total - input : 0);
  const cacheCreation = Number(u.cache_creation_input_tokens ?? 0) || 0;
  const cacheRead = Number(u.cache_read_input_tokens ?? 0) || 0;
  const costUsd = costFor(model, { input, output, cacheCreation, cacheRead }, provider);
  await insertUsage({
    feature: feature || 'otros', motivo: motivo?.trim() ? motivo.trim().slice(0, 200) : null, model, provider,
    // CUÁL de las keys del proveedor atendió (mig 0132). Sin esto la cuota solo se
    // puede medir sumada, y esa suma miente cuando el uso se apila en una cuenta.
    cuenta: cuenta && cuenta > 1 ? cuenta : 1,
    input_tokens: input, output_tokens: output, cache_creation_tokens: cacheCreation, cache_read_tokens: cacheRead, cost_usd: costUsd,
  });
  return { inputTokens: input, outputTokens: output, cacheCreation, cacheRead, costUsd, model };
}

/** Registra una transcripción (STT): cobra por SEGUNDOS de audio, no por tokens. */
export async function recordSttUsage(feature: string, model: string, segundos: number, motivo?: string, provider = 'openai', cuenta?: number): Promise<void> {
  const seg = Math.max(0, Number(segundos) || 0);
  const costUsd = PROVEEDORES_GRATIS.includes(provider) ? 0 : (STT_PRICE_SEG[model] ?? STT_PRICE_SEG['whisper-1']) * seg;
  await insertUsage({
    feature: feature || 'stt', motivo: motivo?.trim() ? motivo.trim().slice(0, 200) : null, model, provider,
    cuenta: cuenta && cuenta > 1 ? cuenta : 1,
    input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, cost_usd: costUsd,
  });
}

// usd = TOTAL acumulado de créditos cargados; setAt = fecha de la PRIMERA carga
// (el restante se mide desde ahí). cargas = histórico de cada carga (aditivo).
type Saldo = { usd: number; setAt: string; cargas?: Array<{ usd: number; at: string }> };
type Row = { created_at: string; feature: string; motivo: string | null; model: string | null; provider: string | null; cost_usd: number; input_tokens: number; output_tokens: number };

export type UsageItem = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
export type SaldoProveedor = { provider: string; costMesUsd: number; tokens: number; tokensHoy: number; saldo: Saldo | null; restanteUsd: number | null; gratis: boolean };
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

// El saldo de Claude es GLOBAL de la agencia (key única, compartida) → OWNER_WS. El
// del resto es POR-WORKSPACE (BYOK): wsDeProveedor decide dónde vive. La key de
// Claude conserva su nombre viejo (anthropic_saldo) por compat.
export const PROVEEDORES = ['anthropic', 'openai', 'groq', 'gemini'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];
const keySaldo = (p: string) => (p === 'anthropic' ? 'anthropic_saldo' : `saldo.${p}`);

export async function getSaldo(provider: string = 'anthropic'): Promise<Saldo | null> {
  let raw: string | null = null;
  try {
    const ws = await wsDeProveedor(provider);
    const { data } = await getSupabaseServer()
      .from('app_settings').select('value')
      .eq('workspace_id', ws).eq('key', keySaldo(provider)).maybeSingle();
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

// Pone el saldo ACTUAL (lo que el dueño lee en la consola del proveedor) y resetea el
// baseline a `setAt` → el restante = ese número y baja con el gasto NUEVO. Es el modelo
// correcto porque, con recarga automática, el saldo real cambia por fuera de la app y no
// se puede seguir por "cargas" sueltas: se SINCRONIZA. Cada sync queda en el histórico.
export async function setSaldo(usd: number, setAt: string, provider: string = 'anthropic'): Promise<void> {
  const prev = await getSaldo(provider);
  const cargas = [...(prev?.cargas ?? []), { usd, at: setAt }];
  const ws = await wsDeProveedor(provider);
  const { error } = await getSupabaseServer()
    .from('app_settings')
    .upsert(
      { workspace_id: ws, key: keySaldo(provider), value: JSON.stringify({ usd, setAt, cargas }), updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw new Error(`Error guardando saldo de IA (${provider}): ${error.message}`);
}

/** Agrega una carga de créditos (ADITIVO): suma al total, conserva la fecha de la
 *  PRIMERA carga (el restante se mide desde ahí) y registra la carga en el histórico.
 *  Así "cargar créditos" es sumar, no reemplazar (el input arranca vacío en la UI). */
export async function agregarCarga(usdAgregado: number, provider: string = 'anthropic'): Promise<void> {
  const prev = await getSaldo(provider);
  const at = new Date().toISOString();
  // Si el saldo previo no tenía histórico (cargado con el modelo viejo de reemplazo),
  // lo sembramos como la primera carga para que el histórico cuadre con el total.
  const base = prev?.cargas ?? (prev ? [{ usd: prev.usd, at: prev.setAt }] : []);
  const cargas = [...base, { usd: usdAgregado, at }];
  const usd = Number(((prev?.usd ?? 0) + usdAgregado).toFixed(4));
  const setAt = prev?.setAt ?? at;
  const ws = await wsDeProveedor(provider);
  const { error } = await getSupabaseServer()
    .from('app_settings')
    .upsert(
      { workspace_id: ws, key: keySaldo(provider), value: JSON.stringify({ usd, setAt, cargas }), updated_at: at },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw new Error(`Error guardando carga de IA (${provider}): ${error.message}`);
}

/** Resumen para el chip: gasto del mes, gasto desde el saldo cargado, restante, última op y desglose. */
export async function getUsageSummary(): Promise<UsageSummary> {
  const [sAnthropic, sOpenai, sGroq, sGemini] = await Promise.all([getSaldo('anthropic'), getSaldo('openai'), getSaldo('groq'), getSaldo('gemini')]);
  const saldos: Record<string, Saldo | null> = { anthropic: sAnthropic, openai: sOpenai, groq: sGroq, gemini: sGemini };
  const saldo = sAnthropic; // compat: el saldo "principal" sigue siendo Claude
  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // Inicio del día UTC: para el uso de HOY (Groq se mide por tokens/día, no por $).
  const dayStart = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();
  // La ventana arranca en el menor entre inicio de mes y la carga MÁS VIEJA de un
  // saldo, así calculamos todos los acumulados con UNA sola lectura acotada.
  const setAts = [sAnthropic, sOpenai, sGroq, sGemini].filter(Boolean).map((s) => (s as Saldo).setAt);
  const desde = setAts.length ? [monthStart, ...setAts].sort()[0] : monthStart;

  // ── Qué filas ve cada uno ──────────────────────────────────────────────────
  // Claude corre contra la key COMPARTIDA de la agencia y su gasto vive en OWNER_WS
  // (ver `wsDeProveedor`). Eso se le suma al dueño, y SOLO al dueño.
  //
  // ⚠️ Un cliente NO puede ver esas filas. No es una cuestión de plata: `motivo`
  // trae texto libre del trabajo de la agencia («Analizar la llamada de …»), o sea
  // datos de OTROS clientes. Mientras el panel de gasto era solo-dueño esto no se
  // notaba; al abrirlo al admin de cada workspace —que es lo que había que hacer,
  // porque el gasto es SUYO— la mezcla se vuelve una fuga cross-tenant. La condición
  // va en POSITIVO, como manda AGENTS.md: «las de la agencia SOLO si sos la agencia».
  // Una sola lectura: TODO lo del workspace del request, y nada más. Para el dueño
  // es lo mismo que antes (Claude ya se registraba en su ws); para un cliente es lo
  // que arregla las dos cosas a la vez — ve su gasto y no ve el de la agencia.
  const wsActual = await (async () => { try { return (await getWorkspaceActual()) ?? OWNER_WS; } catch { return OWNER_WS; } })();
  const cols = 'created_at, feature, motivo, model, provider, cost_usd, input_tokens, output_tokens';
  let rows: Row[] = [];
  try {
    const { data } = await getSupabaseServer()
      .from('anthropic_usage').select(cols)
      .eq('workspace_id', wsActual)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(20000);
    rows = ((data ?? []) as Row[]).sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  } catch (e) {
    console.warn(`[anthropic-usage] no se pudo leer el resumen: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Costo REAL de una fila para mostrar, corrigiendo lo que se guardó mal:
  // - IA gratis por rate-limit (groq/cerebras/mistral/openrouter) → SIEMPRE $0 (no
  //   cobran plata; antes Mistral/Cerebras caían a DEFAULT_PRICE y mostraban dinero).
  // - Gemini → $0 en free tier; si hay créditos cargados, recomputa el costo real.
  // - Anthropic/OpenAI → lo guardado (sí se paga con dinero).
  const FREE_RATE_LIMIT = ['groq', 'cerebras', 'mistral', 'openrouter'];
  const costRow = (r: Row): number => {
    const p = r.provider ?? 'anthropic';
    if (p === 'gemini') {
      // Gemini es GRATIS antes de cargar créditos (o si nunca se cargaron); pago SOLO
      // desde el momento exacto en que se registró el saldo (sGemini.setAt). El uso
      // previo NO se cobra — el free tier no cuesta plata.
      if (!sGemini || r.created_at < sGemini.setAt) return 0;
      return ((Number(r.input_tokens) || 0) * GEMINI_PRICE_PAGO.in + (Number(r.output_tokens) || 0) * GEMINI_PRICE_PAGO.out) / 1_000_000;
    }
    if (FREE_RATE_LIMIT.includes(p)) return 0;
    return Number(r.cost_usd) || 0;
  };

  let gastadoMesUsd = 0, gastadoDesdeSaldoUsd = 0;
  const feat = new Map<string, { costUsd: number; tokens: number }>();
  const prov = new Map<string, { mes: number; tokens: number; hoy: number; desdeSaldo: number }>();
  for (const r of rows) {
    const p = r.provider ?? 'anthropic';
    const tk = (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
    const c = costRow(r);
    const pa = prov.get(p) ?? { mes: 0, tokens: 0, hoy: 0, desdeSaldo: 0 };
    if (r.created_at >= monthStart) {
      gastadoMesUsd += c; // gasto total de IA del mes (todos los proveedores)
      pa.mes += c; pa.tokens += tk;
      const f = feat.get(r.feature) ?? { costUsd: 0, tokens: 0 };
      f.costUsd += c; f.tokens += tk; feat.set(r.feature, f);
    }
    if (r.created_at >= dayStart) pa.hoy += tk; // tokens de HOY (para el gauge de Groq)
    const sp = saldos[p];
    if (sp && r.created_at >= sp.setAt) pa.desdeSaldo += c;
    prov.set(p, pa);
    // El SALDO prepago principal es de Claude.
    if (saldo && p === 'anthropic' && r.created_at >= saldo.setAt) gastadoDesdeSaldoUsd += c;
  }
  const porProveedor: SaldoProveedor[] = PROVEEDORES.map((p) => {
    const pa = prov.get(p) ?? { mes: 0, tokens: 0, hoy: 0, desdeSaldo: 0 };
    const s = saldos[p];
    // Gemini es el caso especial: por defecto es GRATIS (free tier), pero cuando el
    // usuario carga créditos (= aparece su saldo) pasa a comportarse como de PAGO →
    // se muestra con "$ restante" y sus límites de rotación suben (ver ia-cuotas).
    const gratis = p === 'gemini' ? !s : ['groq', 'cerebras', 'mistral', 'openrouter'].includes(p);
    return { provider: p, costMesUsd: pa.mes, tokens: pa.tokens, tokensHoy: pa.hoy, saldo: s, restanteUsd: s ? s.usd - pa.desdeSaldo : null, gratis };
  });

  const last = rows[0] ?? null; // ya viene ordenado desc
  const ultimaOp = last ? { tokens: (Number(last.input_tokens) || 0) + (Number(last.output_tokens) || 0), costUsd: costRow(last), feature: last.feature, at: last.created_at } : null;

  // Historial cronológico (últimas 80 operaciones) con el motivo legible. Usa costRow →
  // Gemini pago muestra su costo (no "gratis") y las gratis de rate-limit muestran $0.
  const historial: UsageItem[] = rows.slice(0, 80).map((r) => ({
    at: r.created_at, feature: r.feature, motivo: r.motivo ?? null, model: r.model ?? null, provider: r.provider ?? 'anthropic',
    tokens: (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0), costUsd: costRow(r),
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
