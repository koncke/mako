// =============================================================================
// Modelos IA — las opciones de cada tarea y cómo se nombran (puro: sin 'use client')
// =============================================================================
// Vivían adentro de ModelosIA.tsx, que es `'use client'`, y las necesita también el teléfono (app/m/modelos-ia). Una
// sola copia: la lista de modelos que se ofrecen es la misma en las dos pantallas, y dos copias divergen a la tercera
// edición. La ruta (/api/admin/modelos) valida igual lo que llega.
// =============================================================================

import type { DropdownOption } from '../components/Dropdown';

export type Ref = { provider: 'anthropic' | 'groq' | 'openai' | 'gemini'; model: string };
export type Item = { feature: string; label: string; grupo: string; def: Ref; recomendado?: Ref; pii?: boolean; nota?: string; actual: Ref; overrideado: boolean };

export const PROV_LABEL: Record<string, string> = { anthropic: 'Claude', groq: 'Groq', openai: 'OpenAI', gemini: 'Gemini' };
export const refKey = (r: Ref) => `${r.provider}|${r.model}`;
export const nombreCorto = (r: Ref) => `${PROV_LABEL[r.provider] ?? r.provider} · ${r.model.replace(/^openai\//, '').replace('claude-', '').replace('gemini-', '').replace('-versatile', '')}`;
const PROVEEDORES: readonly Ref['provider'][] = ['anthropic', 'groq', 'openai', 'gemini'];
/** «groq|openai/gpt-oss-20b» → la referencia, o null si el proveedor no es uno de los cuatro. */
export function refDeOpcion(v: string): Ref | null {
  const [provider, ...rest] = v.split('|');
  const p = PROVEEDORES.find((x) => x === provider);
  return p && rest.length ? { provider: p, model: rest.join('|') } : null;
}

export const CHAT_OPTS: DropdownOption[] = [
  { value: 'anthropic|claude-opus-4-8', label: 'Claude Opus 4.8', sub: 'máximo razonamiento / voz de marca' },
  { value: 'anthropic|claude-sonnet-5', label: 'Claude Sonnet 5', sub: 'intermedio: casi Opus, bastante más barato' },
  { value: 'anthropic|claude-sonnet-4-6', label: 'Claude Sonnet 4.6', sub: 'Claude intermedio (previo)' },
  { value: 'anthropic|claude-haiku-4-5', label: 'Claude Haiku 4.5', sub: 'Claude, el más barato' },
  { value: 'groq|openai/gpt-oss-20b', label: 'Groq · gpt-oss-20b', sub: 'barato, rápido, no entrena' },
  { value: 'groq|openai/gpt-oss-120b', label: 'Groq · gpt-oss-120b', sub: 'barato con más cabeza' },
  { value: 'groq|llama-3.3-70b-versatile', label: 'Groq · Llama 3.3 70B', sub: 'barato' },
  { value: 'openai|gpt-4o-mini', label: 'OpenAI · gpt-4o-mini', sub: 'barato' },
  { value: 'openai|gpt-5-mini', label: 'OpenAI · gpt-5-mini', sub: 'OpenAI intermedio, barato' },
  { value: 'openai|gpt-4o', label: 'OpenAI · gpt-4o', sub: 'OpenAI, con visión' },
  { value: 'gemini|gemini-flash-latest', label: 'Gemini · Flash', sub: '1M contexto · gratis con tu key (el free entrena)' },
  { value: 'gemini|gemini-flash-lite-latest', label: 'Gemini · Flash-Lite', sub: 'el más barato/rápido de Google' },
];
export const STT_OPTS: DropdownOption[] = [
  { value: 'groq|whisper-large-v3-turbo', label: 'Groq · Whisper v3 turbo', sub: 'STT barato' },
  { value: 'groq|whisper-large-v3', label: 'Groq · Whisper v3', sub: 'STT, más preciso' },
  { value: 'openai|whisper-1', label: 'OpenAI · Whisper-1', sub: 'STT' },
];
