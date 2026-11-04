// =============================================================================
// embeddings — vectores de texto con la IA DEL NEGOCIO: su OpenAI, o su Gemini si es lo único que tiene (25/10/2026)
// =============================================================================
// Hasta el 22/10/2026 eran de OpenAI (`text-embedding-3-small`, 1536), con la key de la plataforma. Esa cuenta se quedó
// sin crédito el 04/10 y el RAG entero estaba caído (lib/mako-knowledge.ts → `falloDelRag`). IA16 (22/10) lo pasó al Gemini
// DEL NEGOCIO, y el 25/10 eso chocó con la decisión de Martín: «le sigue diciendo que debe conectar su IA de Gemini, cuando
// dijimos que todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». Un negocio con sólo su GPT
// se quedaba sin buscador y leía «Conecta tu Gemini». El Cerebro, 25/10/2026 (docs/conexiones-y-ayuda.md):
//   · embebe con la IA del negocio que la tenga: su OpenAI (`text-embedding-3-small`, 1536) primero, su Gemini si es lo único;
//   · sin ninguna de las dos, el conocimiento se busca por PALABRAS (lib/conocimiento-palabras.ts): nunca la Gemini de la
//     plataforma y nunca «conecta tu Gemini»;
//   · cada fila guarda con qué se embebió (`embedding_modelo`), una pregunta se compara sólo contra filas del MISMO modelo, y
//     lo del negocio se re-embebe solo, de a poco, cuando conecta su IA (`reembeberLoQueFalta`).
//
// ⚠️ CON LA IA DEL NEGOCIO, NUNCA CON LA DE LA PLATAFORMA. Lo que se embebe es el conocimiento de cada negocio y lo que se
// busca es la charla con sus clientes: va a SU cuenta (`provsDe`, las mismas reglas que la cascada: sus filas, nunca el
// entorno, sin copias de una clave de la plataforma, y D6b). En la plataforma (el ws9) es la de la plataforma, Gemini: es lo
// interno de MaKo, y su OpenAI no tiene crédito.
//
// ⚠️ EL MÉTODO DE MAKO VIVE EN EL WS1, QUE ES UN CLIENTE (las filas `fuente: 'mako'`, lib/rag-prestamo.ts). Es contenido de
// MaKo, no del negocio: `deMako` lo embebe con la Gemini de la plataforma. Por eso un negocio que embebe con su OpenAI no lo
// compara por vector (otro modelo): lo encuentra por palabras (lib/mako-knowledge.ts, `searchKnowledge`).
//
// ⚠️ UN VECTOR DE GEMINI CONTRA UNO DE OPENAI DA UN COSENO SIN SENTIDO: resultados plausibles y equivocados. Por eso cada
// vector lleva su modelo y sólo se comparan los del mismo (`modeloDelVector`; sin la columna, el largo lo dice).
//
// Los vectores de dos claves distintas del mismo modelo SÍ se comparan: el vector sale del modelo, no de la cuenta.
// La similitud (coseno) se calcula en la app, así no hace falta pgvector.

import 'server-only';
import { createHash } from 'node:crypto';
import { exigirPermisoIa } from '@/lib/ia-permiso';
import { esSinPermisoIa } from '@/lib/ia-permiso-reglas';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI = 'https://api.openai.com/v1';

/** Los dos modelos con que se embebe, y su largo. Son de largo distinto a propósito: ver la cabecera. */
export type ModeloEmbedding = 'text-embedding-3-small' | 'gemini-embedding-001';
export const DIMENSIONES_DE: Readonly<Record<ModeloEmbedding, number>> = { 'text-embedding-3-small': 1536, 'gemini-embedding-001': 768 };
/** El de Gemini (lo que embebían todos hasta el 25/10). */
export const DIMENSIONES = DIMENSIONES_DE['gemini-embedding-001'];

/**
 * Con qué modelo está una fila: su columna `embedding_modelo` si la tiene (la migración del 25/10/2026) y si no, el largo del
 * vector (768 = Gemini, 1536 = OpenAI). null = sin vector, o uno que no es de ninguno de los dos. Puro.
 */
export function modeloDelVector(fila: { embedding?: unknown; embedding_modelo?: unknown }): ModeloEmbedding | null {
  if (!Array.isArray(fila.embedding) || !fila.embedding.length) return null;
  const largo = fila.embedding.length;
  const dicho = typeof fila.embedding_modelo === 'string' ? fila.embedding_modelo : null;
  if (dicho && dicho in DIMENSIONES_DE) return DIMENSIONES_DE[dicho as ModeloEmbedding] === largo ? (dicho as ModeloEmbedding) : null;
  return (Object.keys(DIMENSIONES_DE) as ModeloEmbedding[]).find((m) => DIMENSIONES_DE[m] === largo) ?? null;
}

/** Con qué embebe el negocio en curso y sus claves, en orden. */
export type Embebedor = { modelo: ModeloEmbedding; claves: string[] };

/**
 * La IA con que embebe el negocio en curso: su OpenAI primero, su Gemini si es lo único; en la plataforma, su Gemini (lo
 * interno de MaKo). null = no tiene ninguna: se busca por palabras. `deMako`: el método de MaKo, con la Gemini de la plataforma.
 * Tira si no se pudo leer (quien llama lo trata como «no se pudo», nunca como «no tiene»).
 */
export async function embebedorDelNegocio(opts: { deMako?: boolean } = {}): Promise<Embebedor | null> {
  const { provsDe } = await import('./ai-cheap');
  const { runWithWorkspace, wsSuperAdmin, getWorkspaceActual } = await import('./workspace');
  const plataforma = await wsSuperAdmin();
  const enLaPlataforma = opts.deMako || (await getWorkspaceActual()) === plataforma;
  const claves = async (p: 'openai' | 'gemini') => (await provsDe(p)).map((x) => x.key);
  if (enLaPlataforma) {
    const g = opts.deMako ? await runWithWorkspace(plataforma, () => claves('gemini')) : await claves('gemini');
    return g.length ? { modelo: 'gemini-embedding-001', claves: g } : null;
  }
  const openai = await claves('openai');
  if (openai.length) return { modelo: 'text-embedding-3-small', claves: openai };
  const gemini = await claves('gemini');
  return gemini.length ? { modelo: 'gemini-embedding-001', claves: gemini } : null;
}

/** El negocio no tiene ninguna IA con que embeber: no es un error, se busca por palabras. */
export class SinEmbebedor extends Error {}
/** Lo que queda en la fila (como `error`, sin ser un error) mientras se busca por palabras. */
export const POR_PALABRAS = 'Se busca por palabras hasta que conectes tu GPT.';

/** Hash del cuerpo embebido: sirve para saber si hay que re-embeber. */
export function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * El vector de un texto, con el modelo que lo hizo. `consulta` para lo que se busca y `documento` para lo que se guarda
 * (Gemini los distingue). `embebedor`: el que ya se pidió (una búsqueda lo pide una vez). Tira `SinEmbebedor` si el negocio
 * no tiene con qué, y el error del proveedor si ninguna de sus cuentas contestó.
 */
export async function embed(
  text: string, tipo: 'documento' | 'consulta' = 'documento', opts: { deMako?: boolean; embebedor?: Embebedor | null } = {},
): Promise<{ modelo: ModeloEmbedding; vector: number[] }> {
  // Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i)). Es lo mismo que no tener con qué: se busca por palabras, y
  // una fila no queda en error por una decisión de la persona.
  await exigirPermisoIa().catch((e) => { if (esSinPermisoIa(e)) throw new SinEmbebedor(POR_PALABRAS); throw e; });
  const e = opts.embebedor !== undefined ? opts.embebedor : await embebedorDelNegocio({ deMako: opts.deMako });
  if (!e || !e.claves.length) throw new SinEmbebedor(POR_PALABRAS);
  const input = text.trim().slice(0, 8000);
  const largo = DIMENSIONES_DE[e.modelo];
  let ultimo = '';
  // Todas sus cuentas antes de rendirse, como la cascada: la cuota se agota por CUENTA.
  for (const key of e.claves) {
    const r = await (e.modelo === 'text-embedding-3-small'
      ? fetch(`${OPENAI}/embeddings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: e.modelo, input }),
          cache: 'no-store',
        })
      : fetch(`${GEMINI}/models/${e.modelo}:embedContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${e.modelo}`,
            content: { parts: [{ text: input }] },
            taskType: tipo === 'consulta' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            outputDimensionality: largo,
          }),
          cache: 'no-store',
        })).catch((x: unknown) => x instanceof Error ? x : new Error(String(x)));
    if (r instanceof Error) { ultimo = `embeddings: ${r.message}`; continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { ultimo = `embeddings: ${j?.error?.message ?? r.status}`; continue; }
    const v = e.modelo === 'text-embedding-3-small' ? j?.data?.[0]?.embedding : j?.embedding?.values;
    if (!Array.isArray(v) || v.length !== largo) throw new Error(`embeddings: ${e.modelo} devolvió un vector de ${Array.isArray(v) ? v.length : 0}, no de ${largo}`);
    return { modelo: e.modelo, vector: v as number[] };
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
