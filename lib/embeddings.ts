// =============================================================================
// embeddings — vectores de texto con el Gemini de la PLATAFORMA (IA16, 22/10/2026)
// =============================================================================
// Hasta el 22/10/2026 eran de OpenAI (`text-embedding-3-small`, 1536), con la key de la plataforma. Esa cuenta se quedó
// sin crédito el 04/10 y el RAG entero estaba caído (lib/mako-knowledge.ts → `falloDelRag`). Martín, 22/10/2026, textual:
// «Tenemos Gemini que hace todo eso, gratis o más barato» — no se le carga crédito a OpenAI, y el buscador de
// conocimiento pasa a Gemini.
//
// ⚠️ SÓLO CON EL GEMINI DE LA PLATAFORMA EN EL PLAN PAGO (lib/gemini-pago.ts). Lo que se embebe es el conocimiento de cada
// negocio, y el plan gratis de Gemini entrena con lo que recibe (la regla del 16/10). Sin la marca, `embed` tira y el RAG
// lo dice (`falloDelRag`), como con OpenAI sin crédito.
//
// ⚠️ UN VECTOR DE GEMINI CONTRA UNO DE OPENAI DA UN COSENO SIN SENTIDO: resultados plausibles y equivocados. Por eso son
// de otro largo (`DIMENSIONES`, 768 contra 1536) y `mako-knowledge` compara sólo los del mismo largo: mientras no se
// re-embebe (scripts/reembeber-conocimiento.mts), una fila vieja no aparece, en vez de aparecer mal.
//
// La similitud (coseno) se calcula en la app, así no hace falta pgvector.

import 'server-only';
import { createHash } from 'node:crypto';
import { credWsEstricta } from './credenciales';
import { geminiDeLaPlataformaPaga } from './gemini-pago';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = process.env.EMBED_MODEL || 'gemini-embedding-001';
/** El largo de los vectores. Distinto del de OpenAI (1536) a propósito: ver la cabecera. */
export const DIMENSIONES = 768;

/** Hash del cuerpo embebido: sirve para saber si hay que re-embeber. */
export function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** El vector de un texto. `consulta` para lo que se busca y `documento` para lo que se guarda (Gemini los distingue). */
export async function embed(text: string, tipo: 'documento' | 'consulta' = 'documento'): Promise<number[]> {
  if (!(await geminiDeLaPlataformaPaga())) {
    throw new Error('embeddings: el Gemini de la plataforma no está en el plan pago (lib/gemini-pago.ts): con datos de los negocios, el plan gratis entrena');
  }
  // La fila de la PLATAFORMA, estricta, y no el entorno: la clave facturada es la de esa fila (la que midió
  // scripts/gemini-pago.mts). Un `.env.local` puede traer otra, gratis: el 22/10/2026 el de esta PC era la …YTBA, y un
  // script local (el de re-embeber) habría mandado el conocimiento de los negocios al plan gratis.
  const { wsSuperAdmin } = await import('./workspace');
  const key = (await credWsEstricta('GEMINI_API_KEY', await wsSuperAdmin(), { ilegibleTira: true }))?.trim();
  if (!key) throw new Error('GEMINI_API_KEY de la plataforma no definida');
  const input = text.trim().slice(0, 8000);
  const r = await fetch(`${GEMINI}/models/${MODELO}:embedContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${MODELO}`,
      content: { parts: [{ text: input }] },
      taskType: tipo === 'consulta' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
      outputDimensionality: DIMENSIONES,
    }),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`embeddings: ${j?.error?.message ?? r.status}`);
  const v = j?.embedding?.values;
  if (!Array.isArray(v) || v.length !== DIMENSIONES) throw new Error(`embeddings: Gemini devolvió un vector de ${Array.isArray(v) ? v.length : 0}, no de ${DIMENSIONES}`);
  return v as number[];
}

/** Similitud coseno entre dos vectores. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
