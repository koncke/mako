// =============================================================================
// mako-knowledge — conocimiento de MaKo (RAG con embeddings)
// =============================================================================
// CRUD de entradas de metodología + búsqueda semántica (top-k por coseno).
// Cada entrada pertenece a un CURSO (agrupador por autor/metodología) y tiene un
// ÁREA de aplicación ('mensajes' | 'ads' | 'general'): el conocimiento se enchufa
// donde corresponde (los mensajes de WhatsApp usan area='mensajes', etc.).
//
// Multi-tenant (mig 0071): mako_knowledge está en TENANT_TABLES.
//  - GESTIÓN (list/create/update/delete/…) via getTenantDb → cada cliente ve y
//    edita SOLO lo suyo (cierra el leak + el IDOR destructivo que había antes).
//  - RAG (search/listActiveByArea) via getSupabaseServer + filtro EXPLÍCITO a
//    [workspace propio, dueño] → el método CURADO de la agencia (filas del dueño)
//    se sirve read-only a la IA de todos, y encima cada cliente suma lo suyo.
// Re-embebe SOLO cuando cambia el cuerpo. Resiliente: si no hay conocimiento o
// falla el embedding, search devuelve [] y MaKo se comporta como hoy.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, getWorkspaceActual, OWNER_WS } from './workspace';
import { embed, cosine, hashText } from './embeddings';

export type EstadoIndex = 'indexado' | 'pendiente' | 'error';
export type KnowledgeArea = 'mensajes' | 'ads' | 'general';

// Área reservada al "swipe" de ejemplos: es material de REFERENCIA (few-shot), no
// metodología curada. Se retira del RAG general (searchKnowledge sin área) para no
// contaminar a los consumidores que asumen que todo lo que traen es método.
export const AREA_EJEMPLOS = 'ejemplos';

// Área reservada al conocimiento de PRODUCTO (cómo se construye esta app: reglas
// de diseño, metodología de onboarding, decisiones de arquitectura). Es material
// del super-admin para MaKo cuando trabaja SOBRE el dashboard — no tiene nada que
// ver con el marketing de un cliente, así que se retira del RAG general para no
// contaminar lo que MaKo le responde a un dueño de negocio.
export const AREA_PRODUCTO = 'producto';

/** Áreas que NO entran al RAG general (solo se sirven pidiéndolas por área). */
export const AREAS_RESERVADAS = [AREA_EJEMPLOS, AREA_PRODUCTO];
export type KnowledgeEntry = {
  id: number; titulo: string; categoria: string | null; cuerpo: string;
  curso: string | null; autor: string | null; area: string; fuente: string;
  activo: boolean; estado: EstadoIndex; error: string | null;
  created_at: string; updated_at: string;
};

const COLS = 'id, titulo, categoria, cuerpo, curso, autor, area, fuente, activo, estado, error, created_at, updated_at';

/** Workspaces que el RAG puede leer: el propio + el dueño (método curado de la agencia). */
async function wsParaRag(): Promise<number[]> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  return ws === OWNER_WS ? [OWNER_WS] : [ws, OWNER_WS];
}

async function getById(id: number): Promise<KnowledgeEntry | null> {
  const { data } = await (await getTenantDb()).from('mako_knowledge').select(COLS).eq('id', id).maybeSingle();
  return (data as KnowledgeEntry) ?? null;
}

/** Embebe el cuerpo y marca estado indexado/error. No lanza. Scopeado al workspace. */
async function embedRow(id: number, cuerpo: string): Promise<void> {
  const sb = await getTenantDb();
  try {
    const v = await embed(cuerpo);
    await sb.from('mako_knowledge').update({ embedding: v, content_hash: hashText(cuerpo), estado: 'indexado', error: null, updated_at: new Date().toISOString() }).eq('id', id);
  } catch (e) {
    await sb.from('mako_knowledge').update({ estado: 'error', error: e instanceof Error ? e.message : String(e), updated_at: new Date().toISOString() }).eq('id', id);
  }
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  const { data, error } = await (await getTenantDb()).from('mako_knowledge').select(COLS).order('updated_at', { ascending: false });
  if (error) throw new Error(`listKnowledge: ${error.message}`);
  return (data ?? []) as KnowledgeEntry[];
}

export type NewKnowledge = { titulo: string; categoria?: string | null; cuerpo: string; curso?: string | null; autor?: string | null; area?: string; fuente?: string; activo?: boolean };

export async function createKnowledge(input: NewKnowledge): Promise<KnowledgeEntry | null> {
  const { data, error } = await (await getTenantDb())
    .from('mako_knowledge')
    .insert({
      titulo: input.titulo, categoria: input.categoria ?? null, cuerpo: input.cuerpo,
      curso: input.curso ?? null, autor: input.autor ?? null,
      area: input.area ?? 'general', fuente: input.fuente ?? 'manual',
      activo: input.activo ?? true, estado: 'pendiente',
    })
    .select(COLS).single();
  if (error) throw new Error(`createKnowledge: ${error.message}`);
  const row = data as KnowledgeEntry;
  if (row.cuerpo.trim()) await embedRow(row.id, row.cuerpo);
  return getById(row.id);
}

export type PatchKnowledge = { titulo?: string; categoria?: string | null; cuerpo?: string; curso?: string | null; autor?: string | null; area?: string; fuente?: string; activo?: boolean };

export async function updateKnowledge(id: number, fields: PatchKnowledge): Promise<KnowledgeEntry | null> {
  const current = await getById(id);
  if (!current) return null; // no existe o es de otro workspace → no se toca
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.titulo !== undefined) patch.titulo = fields.titulo;
  if (fields.categoria !== undefined) patch.categoria = fields.categoria;
  if (fields.curso !== undefined) patch.curso = fields.curso;
  if (fields.autor !== undefined) patch.autor = fields.autor;
  if (fields.area !== undefined) patch.area = fields.area;
  if (fields.fuente !== undefined) patch.fuente = fields.fuente;
  if (fields.activo !== undefined) patch.activo = fields.activo;
  const cuerpoCambia = fields.cuerpo !== undefined && fields.cuerpo !== current.cuerpo;
  if (fields.cuerpo !== undefined) patch.cuerpo = fields.cuerpo;
  if (cuerpoCambia) patch.estado = 'pendiente';
  const { error } = await (await getTenantDb()).from('mako_knowledge').update(patch).eq('id', id);
  if (error) throw new Error(`updateKnowledge: ${error.message}`);
  // Re-embeber SOLO si cambió el cuerpo.
  if (cuerpoCambia && (fields.cuerpo ?? '').trim()) await embedRow(id, fields.cuerpo!);
  return getById(id);
}

export async function deleteKnowledge(id: number): Promise<void> {
  const { error } = await (await getTenantDb()).from('mako_knowledge').delete().eq('id', id);
  if (error) throw new Error(`deleteKnowledge: ${error.message}`);
}

export async function reindexKnowledge(id: number): Promise<KnowledgeEntry | null> {
  const row = await getById(id);
  if (!row) return null;
  if (row.cuerpo.trim()) await embedRow(id, row.cuerpo);
  return getById(id);
}

/** Activar/desactivar todas las entradas de un curso de un tirón (del workspace). */
export async function setCursoActivo(curso: string, activo: boolean): Promise<void> {
  const { error } = await (await getTenantDb()).from('mako_knowledge').update({ activo, updated_at: new Date().toISOString() }).eq('curso', curso);
  if (error) throw new Error(`setCursoActivo: ${error.message}`);
}

/** ¿Ya existe al menos una entrada de este curso en el workspace? (para no re-sembrar). */
export async function cursoExiste(curso: string): Promise<boolean> {
  const { count, error } = await (await getTenantDb()).from('mako_knowledge').select('id', { count: 'exact', head: true }).eq('curso', curso);
  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Top-k entradas activas más relevantes a la consulta (coseno). Lee el conocimiento
 * del workspace propio + el método curado del dueño (RAG compartido, read-only).
 * opts.area filtra por área de aplicación (ej. 'mensajes' para WhatsApp).
 */
export async function searchKnowledge(
  query: string,
  k = 4,
  opts: { area?: string } = {},
): Promise<Array<{ titulo: string; categoria: string | null; cuerpo: string; score: number }>> {
  const q = query.trim();
  if (!q) return [];
  try {
    let sel = getSupabaseServer()
      .from('mako_knowledge')
      .select('titulo, categoria, cuerpo, area, embedding')
      .in('workspace_id', await wsParaRag())
      .eq('activo', true)
      .not('embedding', 'is', null);
    if (opts.area) sel = sel.eq('area', opts.area);
    // El swipe y el conocimiento de producto solo se sirven pidiéndolos por área:
    // ninguno es metodología de marketing para el chat de un cliente.
    else sel = sel.not('area', 'in', `(${AREAS_RESERVADAS.join(',')})`);
    const { data, error } = await sel;
    if (error || !data || data.length === 0) return [];
    const qv = await embed(q);
    return (data as Array<{ titulo: string; categoria: string | null; cuerpo: string; embedding: number[] }>)
      .map((r) => ({ titulo: r.titulo, categoria: r.categoria, cuerpo: r.cuerpo, score: cosine(qv, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .filter((r) => r.score > 0.15);
  } catch {
    return [];
  }
}

/** Todas las entradas ACTIVAS de un área (workspace propio + método curado del dueño),
 *  para inyectar una metodología completa. Ordenadas por id (orden de carga del curso). */
export async function listActiveKnowledgeByArea(area: string): Promise<Array<{ titulo: string; categoria: string | null; cuerpo: string }>> {
  const { data, error } = await getSupabaseServer()
    .from('mako_knowledge')
    .select('titulo, categoria, cuerpo')
    .in('workspace_id', await wsParaRag())
    .eq('activo', true)
    .eq('area', area)
    .order('id', { ascending: true });
  if (error || !data) return [];
  return data as Array<{ titulo: string; categoria: string | null; cuerpo: string }>;
}

export function formatKnowledge(items: Array<{ titulo: string; cuerpo: string }>): string {
  if (items.length === 0) return '';
  return items.map((i) => `### ${i.titulo}\n${i.cuerpo}`).join('\n\n');
}

/**
 * Metodología de un área para inyectar en un system prompt. Incluye TODAS las
 * entradas activas si caben (< maxChars); si no, cae al top-k semántico por la
 * consulta. Así el advisor siempre tiene la metodología a mano sin explotar.
 */
export async function metodologiaDeArea(area: string, query: string, maxChars = 20000): Promise<string> {
  try {
    const todas = await listActiveKnowledgeByArea(area);
    if (todas.length === 0) return '';
    const full = formatKnowledge(todas);
    if (full.length <= maxChars) return full;
    // Corpus grande: caemos a top-k semántico PERO garantizamos que las bases
    // (las primeras entradas del curso: fundamento, estructura y reglas/guardarraíles)
    // siempre entren, aunque no matcheen la consulta puntual.
    const bases = todas.slice(0, 3);
    const seen = new Set(bases.map((b) => b.titulo));
    const top = (await searchKnowledge(query, 6, { area })).filter((t) => !seen.has(t.titulo));
    return formatKnowledge([...bases, ...top]);
  } catch {
    return '';
  }
}
