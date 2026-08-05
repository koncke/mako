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
// Para ESCUCHAR audio el orden es otro (CASCADA_STT): Gemini → Groq → OpenAI. Gemini
// va primero porque es la key gratis que carga cada cliente y escucha el audio nativo;
// OpenAI queda último por ser el único que cobra.
// Modelos e IDs por env (rotan seguido, no hardcodear). Claude sigue para el
// razonamiento fino y el copywriting con voz de marca (lib/anthropic.ts).

import 'server-only';
import { recordUsage, recordSttUsage } from '@/lib/anthropic-usage';
import type { ToolDef, ToolRunner, RichMsg, ToolsResult } from '@/lib/anthropic';
import { credWs } from '@/lib/credenciales';
import { ordenarPorCuota } from '@/lib/ia-cuotas';

export type ProvName = 'groq' | 'openai' | 'gemini' | 'cerebras' | 'mistral' | 'openrouter';
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
    // Endpoint OpenAI-compatible de Gemini (chat + function-calling). Para AUDIO no
    // sirve —no tiene /audio/transcriptions— pero Gemini igual escucha: lo hace por su
    // API nativa (ver sttGemini), y por eso encabeza la cascada de STT. 1M de contexto.
    // `gemini-flash-latest` = alias oficial al Flash GA vigente (no 404ea como los ids
    // pineados que se van retirando). Pisable con GEMINI_MODEL.
    return { nombre: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', key, chatModel: process.env.GEMINI_MODEL || 'gemini-flash-latest', sttModel: '' };
  }
  // ── IA GRATIS extra para rotar (todas OpenAI-compatibles) ────────────────────
  if (nombre === 'cerebras') { // gratis y MUY rápida (Llama en su chip). Soporta tools.
    const key = await credWs('CEREBRAS_API_KEY');
    if (!key) return null;
    return { nombre: 'cerebras', base: 'https://api.cerebras.ai/v1', key, chatModel: process.env.CEREBRAS_MODEL || 'llama-3.3-70b', sttModel: '' };
  }
  if (nombre === 'mistral') { // free tier de La Plateforme. Soporta tools.
    const key = await credWs('MISTRAL_API_KEY');
    if (!key) return null;
    return { nombre: 'mistral', base: 'https://api.mistral.ai/v1', key, chatModel: process.env.MISTRAL_MODEL || 'mistral-small-latest', sttModel: '' };
  }
  if (nombre === 'openrouter') { // agregador con modelos ":free" (Llama, Gemini exp, etc.).
    const key = await credWs('OPENROUTER_API_KEY');
    if (!key) return null;
    return { nombre: 'openrouter', base: 'https://openrouter.ai/api/v1', key, chatModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', sttModel: '' };
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

// Orden de la transcripción (STT). Gemini primero: es la key gratis y generosa que
// cada cliente carga en el onboarding, y escucha el audio NATIVO (no por Whisper).
// Groq después (Whisper turbo, rápido y gratis) y OpenAI al final, que es el único
// que cobra. Ver transcribirAudio: la cascada cae por ERROR, no solo por falta de key.
export const CASCADA_STT: ProvName[] = ['gemini', 'groq', 'openai'];

export async function cheapDisponible(): Promise<boolean> { return (await proveedor()) !== null; }
/** ¿Hay alguna IA que pueda escuchar un audio en este workspace? */
export async function sttDisponible(): Promise<boolean> {
  for (const p of CASCADA_STT) { if (await provDe(p)) return true; }
  return false;
}

// Cascada para LEER DOCUMENTOS del negocio (El Archivero, onboarding-extract). A
// diferencia de CASCADA_GRATIS, INCLUYE Gemini y lo pone primero: es la IA gratis y
// generosa que el cliente carga en el onboarding (#4), así que la extracción tiene
// que poder usarla. Sin esto, un workspace con SOLO key de Gemini extrae vacío.
export const CASCADA_DOCS: ProvName[] = ['gemini', 'groq', 'cerebras', 'openrouter', 'mistral', 'openai'];
// Modelo CAPAZ por proveedor para EXTRAER de documentos. El default barato de cada
// uno (ej. Groq gpt-oss-20b) es demasiado chico: con un doc real de +10k chars
// genera JSON malformado/truncado y devuelve 0 campos (probado: 20b falla, 70b saca
// 11/11). La extracción de un brief es "análisis", necesita un modelo grande.
export const MODELO_DOCS: Partial<Record<ProvName, string>> = {
  groq: process.env.DOCS_MODEL_GROQ || 'llama-3.3-70b-versatile',
  gemini: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  openai: 'gpt-4o-mini',
  cerebras: 'llama-3.3-70b',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  mistral: 'mistral-small-latest',
};
/** ¿Hay alguna IA para leer documentos (Gemini/Groq/OpenAI/…) en este workspace? */
export async function docsIADisponible(): Promise<boolean> {
  for (const p of CASCADA_DOCS) { if (await provDe(p)) return true; }
  return false;
}

// Ante un 404 de "modelo no encontrado", listamos los modelos que SÍ acepta la key
// (GET /models, OpenAI-compat) y los metemos en el error → nunca más adivinamos el id.
async function modelosDisponibles(p: Prov): Promise<string> {
  try {
    const res = await fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${p.key}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({})) as { data?: Array<{ id?: string }>; models?: Array<{ name?: string }> };
    const ids = [...(data.data ?? []).map((m) => m.id), ...(data.models ?? []).map((m) => m.name)].filter(Boolean).map((s) => String(s).replace(/^models\//, ''));
    const flash = ids.filter((id) => /flash|gemini/i.test(id)).slice(0, 20);
    return flash.length ? ` · modelos disponibles: ${flash.join(', ')}` : '';
  } catch { return ''; }
}

/**
 * LLM barato para tareas simples. Devuelve el texto (o el JSON crudo si json=true).
 * NO usar para copywriting con voz de marca ni razonamiento fino → eso es chatClaude.
 */
/**
 * Cuánto puede PENSAR el modelo barato. Gemini es el único que entiende el campo.
 *
 * ⚠️ Esto no estaba y era un agujero silencioso: `chatClaude` delega acá cuando la
 * feature está ruteada a un proveedor barato, pero TIRABA el `effort` del caller y
 * chatCheap mandaba 'minimal' hardcodeado. O sea: una tarea configurada con
 * `effort:'high'` —la extracción de reuniones, por ejemplo— corría con el mínimo
 * esfuerzo posible, y nadie se enteraba. Explica por qué los detalles salían de 140
 * caracteres cuando el prompt pide 4 a 8 frases.
 *
 * 'minimal' sigue siendo el DEFAULT cuando el caller no pide nada: es lo que arregló el
 * panorama del Archivero, que se cortaba a la mitad porque el modelo gastaba todo el
 * presupuesto pensando. No es un valor válido 'none' (400 Invalid argument, probado).
 */
export type EsfuerzoBarato = 'minimal' | 'low' | 'medium' | 'high';

export async function chatCheap(opts: { system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; feature?: string; motivo?: string; provider?: ProvName; model?: string; timeoutMs?: number; esfuerzo?: EsfuerzoBarato }): Promise<string> {
  const p = await proveedor(opts.provider);
  if (!p) throw new Error('Sin proveedor de IA barata (falta GROQ_API_KEY u OPENAI_API_KEY).');
  const model = opts.model || p.chatModel;
  // Timeout configurable: 30s alcanza para tareas simples, pero una llamada grande
  // (el Perro Guardián puntuando TODO el plan: ~40k input + 8k output) tarda más en
  // Gemini Flash → con el tope fijo abortaba y caía al fallback de Claude. El caller
  // (chatClaude) lo escala según maxTokens.
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
      // Gemini 2.5 Flash "piensa" por default y ese razonamiento oculto consume del
      // mismo max_tokens: con un tope chico, el modelo gasta todo pensando y la
      // respuesta VISIBLE sale cortada a mitad de frase (bug reportado: panorama del
      // Archivero con solo 2 de 6 secciones — confirmado con un pedido de prueba real:
      // SIN este campo, finish_reason daba "length" hasta para "decí hola y nada más").
      // 'none' no es un valor válido para este endpoint (400 Invalid argument,
      // probado); 'minimal' sí, y da finish_reason "stop" — es el mínimo real que
      // acepta. Solo gemini entiende este campo: los demás proveedores tirarían 400
      // con un campo que no reconocen, así que se limita a gemini.
      ...(p.nombre === 'gemini' ? { reasoning_effort: opts.esfuerzo ?? 'minimal' } : {}),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const extra = p.nombre === 'gemini' && res.status === 404 ? await modelosDisponibles(p) : '';
    throw new Error(`chatCheap(${p.nombre}): ${data?.error?.message || `HTTP ${res.status}`}${extra}`);
  }
  // Registrar el gasto (barato, no descuenta del saldo de Claude) con descripción.
  void recordUsage(opts.feature || 'ia-barata', model, data.usage, opts.motivo, p.nombre);
  // Si la respuesta se CORTÓ por llegar al tope, decilo. Era el punto ciego que hacía
  // indistinguible "la reunión no dejaba más tareas" de "se quedó sin lugar para
  // escribirlas": el JSON llega mocho, el parse falla y quedan cero tareas sin motivo.
  const fin = data.choices?.[0]?.finish_reason;
  if (fin && fin !== 'stop') console.warn(`[ia-barata] ${p.nombre}/${model} terminó por "${fin}" (${opts.feature ?? ''}) — la respuesta puede venir cortada; subí maxTokens (era ${opts.maxTokens ?? 512})`);
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/** Genera texto probando las IA baratas EN ORDEN (Groq gratis → OpenAI barato), SIN tocar
 *  Claude. Para cuando la IA pineada (ej. Gemini) falla o no devuelve algo usable y NO
 *  queremos caer en el gasto de Claude. Devuelve el texto de la primera que funcione, o ''. */
// Orden por default: GRATIS primero (Groq, Cerebras, OpenRouter, Mistral) y OpenAI (barato)
// al final. Claude NUNCA entra acá. Cada uno se usa solo si tiene su key cargada (si no, se salta).
export const CASCADA_GRATIS: ProvName[] = ['groq', 'cerebras', 'openrouter', 'mistral', 'openai'];
// erroresOut es opcional y ADITIVO (no cambia qué devuelve la función): si el caller
// pasa un array, cada proveedor que falla empuja su motivo ahí — así quien llama puede
// distinguir "sin key" de "con key pero la cascada falló" (cuota, rate-limit, timeout)
// sin tener que cambiar cómo usa el string que ya devuelve chatCheapCascade.
// `temperature` es opcional y por default sigue siendo la de chatCheap (0.2), que
// es la correcta para extraer y clasificar. Existe porque hay un caller que NO
// hace eso: el ensayo del Chat Agent, donde el modelo interpreta a un lead. Con
// 0.2 se pegaba a la salida más probable y repetía la misma objeción turno tras
// turno, hasta copiar literalmente las frases de ejemplo del prompt.
export async function chatCheapCascade(opts: { system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; feature?: string; motivo?: string; provs?: ProvName[]; timeoutMs?: number; modelos?: Partial<Record<ProvName, string>>; validar?: (t: string) => boolean; erroresOut?: string[] }): Promise<string> {
  // PROACTIVO: probamos primero los que todavía tienen cuota hoy (los cerca del tope van al final).
  const orden = await ordenarPorCuota((opts.provs ?? CASCADA_GRATIS).map(String)).catch(() => (opts.provs ?? CASCADA_GRATIS).map(String));
  for (const prov of orden as ProvName[]) {
    const base = { system: opts.system, user: opts.user, maxTokens: opts.maxTokens, temperature: opts.temperature, feature: opts.feature, motivo: `${opts.motivo ?? ''} · fallback ${prov}`, provider: prov, model: opts.modelos?.[prov], timeoutMs: opts.timeoutMs };
    // Un reintento del MISMO proveedor si el fallo parece transitorio (429/5xx/timeout):
    // clave para un workspace con UN solo proveedor (ej. Gemini), donde no hay a quién caer.
    for (let intento = 0; intento <= 1; intento++) {
      try {
        let t = await chatCheap({ ...base, json: opts.json });
        // La capa OpenAI-compat de Gemini a veces devuelve contenido VACÍO con
        // response_format json_object (el modelo native anda; el /chat/completions no).
        // Reintentamos el MISMO proveedor SIN el flag: `validar`/parseJsonLoose de los
        // callers tolera fences/markdown igual, así que no perdemos nada.
        if (!t.trim() && opts.json) t = await chatCheap({ ...base, json: false });
        // `validar`: solo aceptamos salida que sirve (ej. JSON parseable con la forma esperada).
        // Si un modelo devuelve texto no vacío pero inútil (JSON roto), pasamos al próximo.
        if (t.trim() && (!opts.validar || opts.validar(t))) return t;
        break; // respondió (o vacío en ambos modos) pero no sirve → próximo proveedor
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.warn(`[ai-cheap] cascade ${prov} falló${intento ? ' (reintento)' : ''}: ${m}`);
        opts.erroresOut?.push(`${prov}: ${m}`);
        if (intento === 0 && /\b(429|5\d\d)\b|timeout|abort|ETIMEDOUT|fetch failed|ECONNRESET/i.test(m)) {
          await new Promise((r) => setTimeout(r, 1500));
          continue; // reintentar el mismo proveedor una vez
        }
        break; // fallo no transitorio → próximo proveedor
      }
    }
  }
  return '';
}

/** Interpreta los errores crudos que dejó chatCheapCascade en `erroresOut` en un
 *  motivo legible — el caso más confuso es "hay key conectada pero igual no
 *  respondió": sin esto, el usuario ve el mismo mensaje genérico que si nunca
 *  hubiera conectado nada. null si no hay ninguna pista clara (falla genérica). */
export function motivoDeErroresCascada(errores: string[]): string | null {
  if (!errores.length) return null;
  const todo = errores.join(' | ').toLowerCase();
  if (/resource_exhausted|insufficient_quota|quota|\b429\b|rate limit|rate_limit/.test(todo)) {
    return 'Se quedó sin cuota / límite de uso alcanzado por ahora.';
  }
  if (/\b401\b|\b403\b|invalid.*key|api key not valid|unauthorized/.test(todo)) {
    return 'La API key parece inválida o vencida.';
  }
  if (/timeout|abort|etimedout/i.test(todo)) {
    return 'No respondió a tiempo — puede ser una falla momentánea de conexión.';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de DOCUMENTOS / IMÁGENES (contratos, comprobantes) con IA multimodal.
// Cascada GRATIS-primero SIN Claude: Gemini (docs+imágenes, free tier) → OpenAI
// (docs+imágenes, barato). Cada uno se usa solo si tiene su key (credWs: fila del
// cliente o env del dueño). Devuelve el texto crudo del modelo (JSON string) del
// primero que funcione. Claude queda para el razonamiento fino, no para OCR.
// ─────────────────────────────────────────────────────────────────────────────
export const VISION_CASCADE: ProvName[] = ['gemini', 'openai'];

// dataUrls (plural) es opcional: cuando viene, pisa a dataUrl y manda TODAS esas
// imágenes en la MISMA llamada de visión — para que el modelo sintetice entre varias
// fotos en vez de mirar solo una (bug real: la cara de marca solo analizaba la
// primera foto que le funcionaba, y una sola conclusión sobre p.ej. la vestimenta
// quedaba como si fuera válida para todas). Solo aplica al camino de imagen, no PDF.
type DocOpts = { dataUrl: string; dataUrls?: string[]; isPdf: boolean; nombreArchivo: string; prompt: string; json?: boolean; feature?: string; motivo?: string; timeoutMs?: number };

export async function leerDocumentoIA(opts: DocOpts): Promise<{ text: string; provider: ProvName }> {
  const errores: string[] = [];
  const sinKey: ProvName[] = [];
  for (const prov of VISION_CASCADE) {
    const key = await credWs(prov === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY');
    if (!key) { sinKey.push(prov); continue; }
    try {
      const text = prov === 'gemini' ? await leerConGemini(key, opts) : await leerConOpenAI(key, opts);
      if (text.trim()) return { text, provider: prov };
      errores.push(`${prov}: respuesta vacía`);
    } catch (e) {
      errores.push(`${prov}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (errores.length) throw new Error(`No se pudo leer el documento con ninguna IA. ${errores.join(' · ')}`);
  const nombres = sinKey.map((p) => (p === 'gemini' ? 'Gemini (gratis)' : 'OpenAI')).join(' o ');
  throw new Error(`No hay ninguna IA con visión configurada. Cargá una API key de ${nombres || 'Gemini u OpenAI'} en Integraciones.`);
}

async function leerConOpenAI(key: string, o: DocOpts): Promise<string> {
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
  const imagenes = o.dataUrls && o.dataUrls.length ? o.dataUrls : [o.dataUrl];
  const content = o.isPdf
    ? [{ type: 'text', text: o.prompt }, { type: 'file', file: { filename: o.nombreArchivo.toLowerCase().endsWith('.pdf') ? o.nombreArchivo : 'contrato.pdf', file_data: o.dataUrl } }]
    : [{ type: 'text', text: o.prompt }, ...imagenes.map((u) => ({ type: 'image_url', image_url: { url: u, detail: 'high' } }))];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, ...(o.json ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'user', content }] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(o.timeoutMs ?? 100000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  void recordUsage(o.feature || 'leer-documento', model, j.usage, o.motivo, 'openai');
  return j.choices?.[0]?.message?.content ?? '';
}

async function leerConGemini(key: string, o: DocOpts): Promise<string> {
  // Endpoint NATIVO (no el OpenAI-compat): maneja PDF e imágenes vía inline_data.
  const model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const imagenes = o.dataUrls && o.dataUrls.length ? o.dataUrls : [o.dataUrl];
  const partesImagen = imagenes.map((u) => {
    const m = u.match(/^data:([^;]+);base64,([\s\S]*)$/);
    return { inline_data: { mime_type: m?.[1] || (o.isPdf ? 'application/pdf' : 'image/jpeg'), data: m?.[2] ?? '' } };
  });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: o.prompt }, ...partesImagen] }],
      generationConfig: { temperature: 0, ...(o.json ? { response_mime_type: 'application/json' } : {}) },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(o.timeoutMs ?? 100000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  const um = j.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
  void recordUsage(o.feature || 'leer-documento', model, um ? { prompt_tokens: um.promptTokenCount, completion_tokens: um.candidatesTokenCount, total_tokens: um.totalTokenCount } : undefined, o.motivo, 'gemini');
  return text;
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
    if (!res.ok || data.error) {
      const extra = p.nombre === 'gemini' && res.status === 404 ? await modelosDisponibles(p) : '';
      throw new Error(`chatCheapTools(${p.nombre}): ${data?.error?.message || `HTTP ${res.status}`}${extra}`);
    }
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

export type SttOpts = { language?: string; prompt?: string; feature?: string; motivo?: string };

// Gemini manda el audio DENTRO del request (inline_data), así que hay un techo de
// tamaño. Una nota de voz de WhatsApp pesa kilobytes; un audio largo se va a Whisper.
const MAX_INLINE_GEMINI = 14 * 1024 * 1024;

/** Whisper por endpoint OpenAI-compatible (Groq / OpenAI). Cobra por segundos de audio. */
async function sttWhisper(p: Prov, buf: Buffer, mime: string, opts: SttOpts): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime || 'audio/ogg' }), `nota.${EXT_POR_MIME(mime || '')}`);
  form.append('model', p.sttModel);
  form.append('language', opts.language || 'es');
  form.append('response_format', 'verbose_json'); // trae `duration` → costo real
  if (opts.prompt) form.append('prompt', opts.prompt);
  const res = await fetch(`${p.base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || 'sin detalle'}`);
  void recordSttUsage(opts.feature || 'stt-nota-voz', p.sttModel, Number(data.duration ?? 0), opts.motivo, p.nombre);
  return (data.text ?? '').trim();
}

/**
 * Gemini ESCUCHA el audio (multimodal nativo): no hay /audio/transcriptions, va por
 * generateContent con el audio inline. Por eso no entra por la ruta Whisper de arriba
 * y necesita su propia llamada. Gratis en su free tier.
 */
async function sttGemini(p: Prov, base64: string, buf: Buffer, mime: string, opts: SttOpts): Promise<string> {
  if (buf.length > MAX_INLINE_GEMINI) throw new Error('audio demasiado grande para mandarlo inline');
  const model = process.env.GEMINI_STT_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  // p.base es el shim OpenAI-compatible (…/v1beta/openai); la API nativa cuelga del
  // mismo host sin ese sufijo.
  const base = p.base.replace(/\/openai\/?$/, '');
  const idioma = (opts.language || 'es') === 'es' ? 'español' : (opts.language || 'es');
  const instruccion = [
    `Transcribí este audio en ${idioma}.`,
    'Devolvé SOLO la transcripción literal de lo que se dice: sin comillas, sin timestamps, sin nombres de hablante, sin comentarios tuyos y sin describir el audio.',
    opts.prompt ? `Contexto (nombres propios y jerga que pueden aparecer): ${opts.prompt}` : '',
    'Si no se entiende nada o no hay voz, devolvé exactamente: (vacío)',
  ].filter(Boolean).join(' ');
  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': p.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: instruccion }, { inline_data: { mime_type: (mime || 'audio/ogg').split(';')[0].trim(), data: base64 } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || 'sin detalle'}`);
  const partes = (data.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
  const texto = partes.map((x) => x.text ?? '').join('').trim();
  const u = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
  void recordUsage(opts.feature || 'stt-nota-voz', model,
    { prompt_tokens: u?.promptTokenCount ?? 0, completion_tokens: u?.candidatesTokenCount ?? 0, total_tokens: u?.totalTokenCount ?? 0 },
    opts.motivo, 'gemini');
  return texto === '(vacío)' ? '' : texto;
}

/** Fallos que valen un reintento del MISMO proveedor antes de pasar al siguiente. */
const esTransitorio = (msg: string): boolean => /HTTP (429|5\d\d)|timeout|aborted|fetch failed|ECONN/i.test(msg);

/**
 * Transcribe audio (base64) a texto. Para notas de voz de WhatsApp (ogg/opus).
 * Fuerza español por default (evita auto-detección errónea en clips cortos).
 *
 * CASCADA REAL (Gemini → Groq → OpenAI): antes elegía UN proveedor por tener la key
 * cargada, y si ese fallaba —cuota agotada, 429— la nota de voz se perdía en silencio
 * aunque hubiera otro disponible. Ahora se prueba uno por uno, con un reintento si el
 * error parece pasajero, y solo lanza si NINGUNO pudo escuchar el audio.
 */
export async function transcribirAudio(base64: string, mime: string, opts?: SttOpts): Promise<string> {
  const o = opts ?? {};
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length) return '';
  // Proactivo: los que ya quemaron su cuota de hoy van al final (mismo criterio que el chat).
  const orden = await ordenarPorCuota(CASCADA_STT.map(String)).catch(() => CASCADA_STT.map(String));

  const errores: string[] = [];
  let alguienEscuchó = false; // respondió OK pero sin texto → el audio está vacío, no falló nada
  for (const nombre of orden as ProvName[]) {
    const p = await provDe(nombre);
    if (!p) continue;
    if (nombre !== 'gemini' && !p.sttModel) continue; // proveedor de chat sin Whisper
    for (let intento = 0; intento <= 1; intento++) {
      try {
        const texto = nombre === 'gemini'
          ? await sttGemini(p, base64, buf, mime, o)
          : await sttWhisper(p, buf, mime, o);
        alguienEscuchó = true;
        if (texto) return texto;
        break; // respondió vacío: no insistas con el mismo, probá el próximo
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errores.push(`${nombre}: ${msg}`);
        console.error(`[stt] ${nombre} falló: ${msg}`);
        if (intento === 0 && esTransitorio(msg)) continue; // un reintento y listo
        break;
      }
    }
  }
  if (alguienEscuchó) return ''; // el audio no traía voz entendible
  throw new Error(errores.length ? `transcribirAudio — ninguna IA pudo: ${errores.join(' | ')}` : 'Sin proveedor de STT (falta GEMINI_API_KEY, GROQ_API_KEY u OPENAI_API_KEY).');
}
