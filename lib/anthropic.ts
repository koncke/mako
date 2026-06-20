// =============================================================================
// anthropic — cliente de Claude (Messages API) con extended thinking
// =============================================================================
// MaKo = analista. Siempre el modelo más capaz y con el máximo "esfuerzo"
// (extended thinking con budget alto). La key va en ANTHROPIC_API_KEY.

import 'server-only';

// Opus 4.8: el modelo más pensante disponible.
const MODEL = 'claude-opus-4-8';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
// Esfuerzo en MAX: budget de razonamiento alto.
const THINKING_BUDGET = 16000;

export type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

export async function chatClaude(
  system: string,
  messages: ClaudeMsg[],
  opts: { model?: string; thinkingBudget?: number; maxTokens?: number } = {},
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');

  // thinkingBudget === 0 → sin extended thinking (para tareas chicas como títulos).
  const budget = opts.thinkingBudget ?? THINKING_BUDGET;
  const thinkingOn = budget > 0;
  const payload: Record<string, unknown> = {
    model: opts.model ?? MODEL,
    max_tokens: thinkingOn ? budget + 4000 : (opts.maxTokens ?? 512),
    system,
    messages,
  };
  if (thinkingOn) payload.thinking = { type: 'enabled', budget_tokens: budget };

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
  // Quedarse solo con el texto (descartar los bloques de "thinking").
  const text = (body.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text?: string }) => c.text ?? '')
    .join('\n')
    .trim();
  return text || '(sin respuesta)';
}
