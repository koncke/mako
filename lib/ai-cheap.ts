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

type Prov = { base: string; key: string; chatModel: string; sttModel: string; nombre: string };

function provDe(nombre: 'groq' | 'openai'): Prov | null {
  if (nombre === 'groq') {
    const groq = process.env.GROQ_API_KEY;
    if (!groq) return null;
    return { nombre: 'groq', base: (process.env.CHEAP_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''), key: groq, chatModel: process.env.CHEAP_MODEL || 'openai/gpt-oss-20b', sttModel: process.env.STT_MODEL || 'whisper-large-v3-turbo' };
  }
  const oai = process.env.OPENAI_API_KEY;
  if (!oai) return null;
  return { nombre: 'openai', base: 'https://api.openai.com/v1', key: oai, chatModel: process.env.CHEAP_MODEL || 'gpt-4o-mini', sttModel: process.env.STT_MODEL || 'whisper-1' };
}

/** Resuelve el proveedor barato: Groq si hay key, si no OpenAI. `pref` fuerza uno
 *  (del registro de modelos); si no está disponible cae al default. null si ninguno. */
function proveedor(pref?: 'groq' | 'openai'): Prov | null {
  if (pref) { const p = provDe(pref); if (p) return p; }
  return provDe('groq') ?? provDe('openai');
}

export function cheapDisponible(): boolean { return proveedor() !== null; }
export function sttDisponible(): boolean { return proveedor() !== null; }

/**
 * LLM barato para tareas simples. Devuelve el texto (o el JSON crudo si json=true).
 * NO usar para copywriting con voz de marca ni razonamiento fino → eso es chatClaude.
 */
export async function chatCheap(opts: { system: string; user: string; json?: boolean; maxTokens?: number; temperature?: number; feature?: string; motivo?: string; provider?: 'groq' | 'openai'; model?: string }): Promise<string> {
  const p = proveedor(opts.provider);
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
  const p = proveedor();
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
