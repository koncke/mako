// =============================================================================
// embeddings — vectores de texto con el Gemini DEL NEGOCIO (IA16, 22/10/2026)
// =============================================================================
// Hasta el 22/10/2026 eran de OpenAI (`text-embedding-3-small`, 1536), con la key de la plataforma. Esa cuenta se quedó
// sin crédito el 04/10 y el RAG entero estaba caído (lib/mako-knowledge.ts → `falloDelRag`). Martín, 22/10/2026, textual:
// «Tenemos Gemini que hace todo eso, gratis o más barato» — no se le carga crédito a OpenAI, y el buscador de
// conocimiento pasa a Gemini.
//
// ⚠️ CON EL GEMINI DEL NEGOCIO, NUNCA CON EL DE LA PLATAFORMA. Martín, 22/10/2026, textual: «Cada usuario debe poder pagar
// su token, su propia IA de gemini». Lo que se embebe es el conocimiento de cada negocio y lo que se busca es la charla con
// sus clientes: va a SU cuenta (`clavesDeSuGemini`, las mismas reglas que la cascada). En el ws9 es la de la plataforma,
// que es lo interno de MaKo. Sin su Gemini, `embed` tira con `SIN_SU_GEMINI` y el RAG lo dice (`falloDelRag`).
//
// Los vectores de dos claves distintas del mismo modelo SÍ se comparan: el vector sale del modelo, no de la cuenta. Por eso
// la consulta de un negocio (su Gemini) encuentra el método de MaKo.
//
// ⚠️ EL MÉTODO DE MAKO VIVE EN EL WS1, QUE ES UN CLIENTE (las filas `fuente: 'mako'`, lib/rag-prestamo.ts). El ws1 no tiene su
// Gemini (sus filas de IA son copias de la plataforma): con «cada uno con la suya», el método no se podía embeber y
// desaparecía del buscador de TODOS (la revisión del 22/10/2026). Es contenido de MaKo, no del negocio: `deMako` lo embebe
// con la de la plataforma (en el ws9). Sólo para eso; lo del negocio, nunca.
//
// ⚠️ UN VECTOR DE GEMINI CONTRA UNO DE OPENAI DA UN COSENO SIN SENTIDO: resultados plausibles y equivocados. Por eso son
// de otro largo (`DIMENSIONES`, 768 contra 1536) y `mako-knowledge` compara sólo los del mismo largo: mientras no se
// re-embebe (scripts/reembeber-conocimiento.mts), una fila vieja no aparece, en vez de aparecer mal.
//
// La similitud (coseno) se calcula en la app, así no hace falta pgvector.

import 'server-only';
import { createHash } from 'node:crypto';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = process.env.EMBED_MODEL || 'gemini-embedding-001';
/** El largo de los vectores. Distinto del de OpenAI (1536) a propósito: ver la cabecera. */
export const DIMENSIONES = 768;

/** Lo que dice el buscador (y la fila del conocimiento) cuando el negocio no conectó su Gemini. */
export const SIN_SU_GEMINI = 'Conecta tu Gemini en Integraciones para que MaKo busque en tu conocimiento';

/** Hash del cuerpo embebido: sirve para saber si hay que re-embeber. */
export function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** El vector de un texto. `consulta` para lo que se busca y `documento` para lo que se guarda (Gemini los distingue). */
export async function embed(text: string, tipo: 'documento' | 'consulta' = 'documento', opts: { deMako?: boolean } = {}): Promise<number[]> {
  // Sus filas y no el entorno: un `.env.local` trae la clave de la plataforma (el 22/10/2026, en esta PC, la …YTBA), y un
  // script local (el de re-embeber) habría mandado el conocimiento de un negocio a la cuenta de MaKo.
  const { clavesDeSuGemini } = await import('./ai-cheap');
  const { runWithWorkspace, wsSuperAdmin } = await import('./workspace');
  const claves = opts.deMako ? await runWithWorkspace(await wsSuperAdmin(), () => clavesDeSuGemini()) : await clavesDeSuGemini();
  if (!claves.length) throw new Error(SIN_SU_GEMINI);
  const input = text.trim().slice(0, 8000);
  let ultimo = '';
  // Todas sus cuentas antes de rendirse, como la cascada: el tope gratis se agota por CUENTA.
  for (const key of claves) {
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
    }).catch((e: unknown) => e instanceof Error ? e : new Error(String(e)));
    if (r instanceof Error) { ultimo = `embeddings: ${r.message}`; continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { ultimo = `embeddings: ${j?.error?.message ?? r.status}`; continue; }
    const v = j?.embedding?.values;
    if (!Array.isArray(v) || v.length !== DIMENSIONES) throw new Error(`embeddings: Gemini devolvió un vector de ${Array.isArray(v) ? v.length : 0}, no de ${DIMENSIONES}`);
    return v as number[];
  }
  throw new Error(ultimo);
}

/** Similitud coseno entre dos vectores. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
