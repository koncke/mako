// =============================================================================
// anthropic — cliente de Claude (Messages API) con extended thinking
// =============================================================================
// MaKo = analista. Siempre el modelo más capaz y con el máximo "esfuerzo"
// (extended thinking con budget alto). La key va en ANTHROPIC_API_KEY.

import 'server-only';
import { recordUsage, type UsageInfo } from './anthropic-usage';

// Opus 4.8: el modelo más pensante disponible.
const MODEL = 'claude-opus-4-8';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Niveles de esfuerzo válidos en Opus 4.8 (output_config.effort).
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
// Esfuerzo por defecto para los análisis de MaKo (alto, sin sobre-pensar).
const DEFAULT_EFFORT: Effort = 'high';

export type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

export async function chatClaude(
  system: string,
  messages: ClaudeMsg[],
  // feature: etiqueta para el desglose de gasto (ej. 'ads-rename'). onUsage:
  // callback con los tokens/costo de ESTA llamada (para mostrarlo al usuario).
  opts: { model?: string; thinking?: boolean; effort?: Effort; maxTokens?: number; feature?: string; onUsage?: (u: UsageInfo) => void } = {},
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');

  // thinking === false → sin razonamiento extendido (tareas chicas, p.ej. títulos).
  const thinkingOn = opts.thinking ?? true;
  const effort: Effort = thinkingOn ? (opts.effort ?? DEFAULT_EFFORT) : 'low';
  const payload: Record<string, unknown> = {
    model: opts.model ?? MODEL,
    // Con thinking adaptativo el razonamiento entra en max_tokens: damos aire.
    max_tokens: opts.maxTokens ?? (thinkingOn ? 16000 : 512),
    system,
    messages,
    // Opus 4.8: el esfuerzo se controla acá, NO con budget_tokens.
    output_config: { effort },
  };
  // Opus 4.8: thinking ADAPTATIVO (el modelo decide cuánto pensar).
  // El antiguo { type: 'enabled', budget_tokens } ya no existe en este modelo.
  if (thinkingOn) payload.thinking = { type: 'adaptive' };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body?.error?.message ?? `Anthropic ${res.status}`);
  }
  // Registrar tokens/costo de esta llamada (best-effort) y avisar al caller.
  const usage = await recordUsage(opts.feature ?? 'otros', String(payload.model), body.usage);
  opts.onUsage?.(usage);
  // Quedarse solo con el texto (descartar los bloques de "thinking").
  const text = (body.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text?: string }) => c.text ?? '')
    .join('\n')
    .trim();
  return text || '(sin respuesta)';
}
