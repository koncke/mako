// =============================================================================
// embeddings — vectores de texto vía OpenAI (reusa OPENAI_API_KEY del repo)
// =============================================================================
// Sin proveedor nuevo: misma key que la transcripción de anuncios. La similitud
// (coseno) se calcula en la app, así no hace falta pgvector.

import 'server-only';
import { createHash } from 'node:crypto';
import { envCred } from './credenciales';

const OAI = 'https://api.openai.com/v1';
const MODEL = 'text-embedding-3-small';

/** Hash del cuerpo embebido: sirve para saber si hay que re-embeber. */
export function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function embed(text: string): Promise<number[]> {
  // envCred (no process.env a secas): espera a que la hidratación del boot haya
  // terminado y, si igual no dejó el valor, lo resuelve contra la base. Ver el
  // comentario de credencialesListas() en lib/credenciales.ts — Next no garantiza
  // que instrumentation haya corrido cuando entra el primer request.
  const key = await envCred('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY no definida');
  const input = text.trim().slice(0, 8000);
  const r = await fetch(`${OAI}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input }),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`embeddings: ${j?.error?.message ?? r.status}`);
  return j.data[0].embedding as number[];
}

/** Similitud coseno entre dos vectores. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
