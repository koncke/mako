// =============================================================================
// anthropic — cliente mínimo de Claude (Messages API)
// =============================================================================
// Regla del proyecto: OpenAI para tareas simples, Claude para análisis/tareas
// complejas (ej. conclusiones sobre gráficos). La API key va en ANTHROPIC_API_KEY
// (.env.local + Vercel, nunca commiteada).

import 'server-only';

// Opus 4.8: máximo análisis para las conclusiones de los gráficos.
const MODEL = 'claude-opus-4-8';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

export async function chatClaude(
  system: string,
  messages: ClaudeMsg[],
  opts: { maxTokens?: number; model?: string } = {},
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY no configurada');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system,
      messages,
    }),
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body?.error?.message ?? `Anthropic ${res.status}`);
  }
  const text = (body.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text?: string }) => c.text ?? '')
    .join('\n')
    .trim();
  return text || '(sin respuesta)';
}
