// =============================================================================
// ai-cheap — IA barata para tareas simples + transcripción (hermano de chatClaude)
// =============================================================================
// Objetivo: sacar a Claude Opus de lo que NO necesita su cabeza (clasificar,
// extraer, titular, resumir, detectar intención) y del STT (notas de voz). Se
// resuelve el proveedor por env, todo OpenAI-compatible:
//   1) GROQ_API_KEY  → Groq (gpt-oss-20b + whisper-large-v3-turbo). Barato, rápido,
//      NO entrena con tus datos (activá ZDR en la consola de Groq para PII).
//   2) OPENAI_API_KEY → OpenAI (gpt-4o-mini + whisper-1). Ya configurado en el repo,
//      así que esto FUNCIONA HOY; al agregar GROQ_API_KEY se abarata solo.
// Modelos e IDs por env (rotan seguido, no hardcodear). Claude sigue para el
// razonamiento fino y el copywriting con voz de marca (lib/anthropic.ts).

import 'server-only';
import { recordUsage, recordSttUsage } from '@/lib/anthropic-usage';
import type { ToolDef, ToolRunner, RichMsg, ToolsResult } from '@/lib/anthropic';
import { credWs } from '@/lib/credenciales';

export type ProvName = 'groq' | 'openai' | 'gemini';
type Prov = { base: string; key: string; chatModel: string; sttModel: string; nombre: ProvName };

// La key sale POR WORKSPACE (credWs): la fila cifrada del cliente primero, y para
// el DUEÑO el env queda de respaldo. Así cada cliente usa SU propia key (BYOK real)
// y su gasto corre contra SU cuenta; un cliente sin fila propia → null, nunca la
// del dueño (aislamiento). Antes se leía process.env directo → pagaba la agencia.
async function provDe(nombre: ProvName): Promise<Prov | null> {
  if (nombre === 'groq') {
    const key = await credWs('GROQ_API_KEY');
    if (!key) return null;
    return { nombre: 'groq', base: (process.env.CHEAP_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''), key, chatModel: process.env.CHEAP_MODEL || 'openai/gpt-oss-20b', sttModel: process.env.STT_MODEL || 'whisper-large-v3-turbo' };
  }
  if (nombre === 'gemini') {
    const key = await credWs('GEMINI_API_KEY');
    if (!key) return null;
    // Endpoint OpenAI-compatible de Gemini (chat + function-calling). SIN STT: su
    // transcripción es multimodal nativa, no /audio/transcriptions → el STT se
    // queda en Groq/OpenAI (ver proveedorStt). 1M de contexto, function-calling.
    return { nombre: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', key, chatModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash', sttModel: '' };
  }
  const key = await credWs('OPENAI_API_KEY');
  if (!key) return null;
  return { nombre: 'openai', base: 'https://api.openai.com/v1', key, chatModel: process.env.CHEAP_MODEL || 'gpt-4o-mini', sttModel: process.env.STT_MODEL || 'whisper-1' };
}

/** Proveedor barato para CHAT. `pref` (del registro de modelos) fuerza uno; si no
 *  está, cae a groq→openai. Gemini SOLO sale si lo pide `pref` explícito: necesita
 *  la key del cliente y no entra en el fallback por default. null si ninguno. */
async function proveedor(pref?: ProvName): Promise<Prov | null> {
  if (pref) { const p = await provDe(pref); if (p) return p; }
  return (await provDe('groq')) ?? (await provDe('openai'));
}

/** Proveedor para STT (Whisper): solo Groq/OpenAI (Gemini no expone ese endpoint). */
async function proveedorStt(): Promise<Prov | null> {
  return (await provDe('groq')) ?? (await provDe('openai'));
}

export async function cheapDisponible(): Promise<boolean> { return (await proveedor()) !== null; }
export async function sttDisponible(): Promise<boolean> { return (await proveedorStt()) !== null; }

/**
 * LLM barato para tareas simples. Devuelve el texto (o el JSON crudo si json=true).
 * NO usar para copywriting con voz de marca ni razonamiento fino → eso es chatClaude.
 */
export async function chatCheap(opts: { system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; feature?: string; motivo?: string; provider?: ProvName; model?: string }): Promise<string> {
  const p = await proveedor(opts.provider);
  if (!p) throw new Error('Sin proveedor de IA barata (falta GROQ_API_KEY u OPENAI_API_KEY).');
  const model = opts.model || p.chatModel;
  const res = await fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`chatCheap(${p.nombre}): ${data?.error?.message || `HTTP ${res.status}`}`);
  // Registrar el gasto (barato, no descuenta del saldo de Claude) con descripción.
  void recordUsage(opts.feature || 'ia-barata', model, data.usage, opts.motivo, p.nombre);
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

// Bloques (tool_use/tool_result/text) → texto plano. El historial del doer ya viene
// como texto; esto es defensivo por si entra un Block[].
function bloqueATexto(content: RichMsg['content']): string {
  if (typeof content === 'string') return content;
  return content.filter((b) => b.type === 'text').map((b) => String((b as { text?: string }).text ?? '')).join('\n').trim();
}

// Gemini (function-calling) RECHAZA varios keywords de JSON Schema que Claude y
// OpenAI aceptan sin drama (additionalProperties, propertyNames, $schema/$ref/$defs,
// default, title, format, const, examples, exclusiveMin/Max…) → 400 INVALID_ARGUMENT
// y toda la llamada falla. Los limpiamos recursivamente SOLO para Gemini (los otros
// proveedores los toleran, no les tocamos nada). Ref: ai.google.dev/gemini-api/docs/openai.
const GEMINI_SCHEMA_STRIP = new Set(['additionalProperties', 'propertyNames', '$schema', '$defs', '$ref', '$id', '$comment', 'default', 'examples', 'title', 'const', 'format', 'exclusiveMaximum', 'exclusiveMinimum']);
function sanitizarSchemaGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizarSchemaGemini);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (GEMINI_SCHEMA_STRIP.has(k)) continue;
      out[k] = sanitizarSchemaGemini(v);
    }
    return out;
  }
  return node;
}

export type CheapToolsResult = ToolsResult & { toolsUsados: number };

/**
 * Como chatClaudeTools pero por Groq/OpenAI (function-calling OpenAI-compatible). Para
 * el doer: los turnos de tool-use (cargar tareas, leer un dato, confirmar) tienen INPUT
 * enorme (tools + historial + resultados) y en Claude eso cuesta; en Groq el input es
 * ~gratis. Menos fiable que Claude en orquestaciones largas → el caller DEBE mirar
 * `toolsUsados`: si el turno pedía una acción y Groq no llamó ninguna tool, hacer
 * fallback a Claude (no dejar que "describa" en vez de ejecutar).
 */
export async function chatCheapTools(
  system: string,
  messages: RichMsg[],
  tools: ToolDef[],
  runTool: ToolRunner,
  opts: { maxSteps?: number; maxTokens?: number; feature?: string; motivo?: string; provider?: ProvName; model?: string } = {},
): Promise<CheapToolsResult> {
  const p = await proveedor(opts.provider);
  if (!p) throw new Error('Sin proveedor de IA barata (falta GROQ_API_KEY u OPENAI_API_KEY).');
  const model = opts.model || p.chatModel;
  const esGemini = p.nombre === 'gemini';
  const oaiTools = tools.map((t) => {
    const fn: Record<string, unknown> = { name: t.name, description: t.description };
    let params: unknown = t.input_schema;
    if (esGemini) {
      params = sanitizarSchemaGemini(t.input_schema);
      // Gemini RECHAZA un OBJECT con `properties` vacío (400): las tools SIN parámetros
      // (ver_plan, estado_experimentos, ver_funnel…) tienen que ir SIN `parameters`.
      const props = (params as { properties?: Record<string, unknown> } | null)?.properties;
      if (!props || Object.keys(props).length === 0) params = undefined;
    }
    if (params !== undefined) fn.parameters = params as Record<string, unknown>;
    return { type: 'function', function: fn };
  });
  const msgs: Array<Record<string, unknown>> = [{ role: 'system', content: system }];
  for (const m of messages) msgs.push({ role: m.role, content: bloqueATexto(m.content) });

  const maxSteps = opts.maxSteps ?? 6;
  let toolsUsados = 0;
  for (let step = 0; step < maxSteps; step++) {
    const res = await fetch(`${p.base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: msgs, tools: oaiTools, tool_choice: 'auto', max_tokens: opts.maxTokens ?? 1400, temperature: 0.2 }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`chatCheapTools(${p.nombre}): ${data?.error?.message || `HTTP ${res.status}`}`);
    void recordUsage(opts.feature || 'ia-barata-tools', model, data.usage, opts.motivo, p.nombre);
    const msg = data.choices?.[0]?.message as { content?: string; tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }> } | undefined;
    if (!msg) break;
    msgs.push(msg as Record<string, unknown>);
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!calls.length) return { text: (msg.content || '').trim() || '(sin respuesta)', steps: step + 1, stopReason: 'stop', toolsUsados };
    for (const c of calls) {
      toolsUsados++;
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(c.function?.arguments || '{}'); } catch { /* args mal formados → tool con {} */ }
      let out: string;
      try { const r = await runTool(c.function?.name || '', input); out = typeof r === 'string' ? r : r.content; }
      catch (e) { out = e instanceof Error ? e.message : String(e); }
      msgs.push({ role: 'tool', tool_call_id: c.id, content: out.slice(0, 12000) });
    }
  }
  return { text: '(se alcanzó el máximo de pasos)', steps: maxSteps, stopReason: 'max_steps', toolsUsados };
}

/** Igual que chatCheap pero parsea el JSON (json:true forzado). Lanza si no parsea. */
export async function chatCheapJson<T = unknown>(opts: { system: string; user: string; maxTokens?: number }): Promise<T> {
  const raw = await chatCheap({ ...opts, json: true });
  try { return JSON.parse(raw) as T; }
  catch { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]) as T; throw new Error('chatCheapJson: respuesta no es JSON'); }
}

const EXT_POR_MIME = (mime: string): string =>
  mime.includes('ogg') || mime.includes('opus') ? 'ogg'
    : mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac') ? 'm4a'
    : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
    : mime.includes('wav') ? 'wav'
    : mime.includes('webm') ? 'webm' : 'ogg';

/**
 * Transcribe audio (base64) a texto. Para notas de voz de WhatsApp (ogg/opus).
 * Fuerza español por default (evita auto-detección errónea en clips cortos).
 * Endpoint OpenAI-compatible /audio/transcriptions (Groq Whisper u OpenAI Whisper).
 */
export async function transcribirAudio(base64: string, mime: string, opts?: { language?: string; prompt?: string; feature?: string; motivo?: string }): Promise<string> {
  const p = await proveedorStt();
  if (!p) throw new Error('Sin proveedor de STT (falta GROQ_API_KEY u OPENAI_API_KEY).');
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length) return '';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime || 'audio/ogg' }), `nota.${EXT_POR_MIME(mime || '')}`);
  form.append('model', p.sttModel);
  form.append('language', opts?.language || 'es');
  form.append('response_format', 'verbose_json'); // trae `duration` → costo real
  if (opts?.prompt) form.append('prompt', opts.prompt);
  const res = await fetch(`${p.base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`transcribirAudio(${p.nombre}): ${data?.error?.message || `HTTP ${res.status}`}`);
  // Registrar el gasto de STT (por segundos de audio).
  void recordSttUsage(opts?.feature || 'stt-nota-voz', p.sttModel, Number(data.duration ?? 0), opts?.motivo, p.nombre);
  return (data.text ?? '').trim();
}
