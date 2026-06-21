// =============================================================================
// mako-knowledge — conocimiento de MaKo (RAG con embeddings)
// =============================================================================
// CRUD de entradas de metodología + búsqueda semántica (top-k por coseno).
// Re-embebe SOLO cuando cambia el cuerpo (editar título/categoría/activo no).
// Resiliente: si no hay conocimiento o falla el embedding, search devuelve []
// y MaKo se comporta exactamente como hoy.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { embed, cosine, hashText } from './embeddings';

export type EstadoIndex = 'indexado' | 'pendiente' | 'error';
export type KnowledgeEntry = {
  id: number; titulo: string; categoria: string | null; cuerpo: string;
  activo: boolean; estado: EstadoIndex; error: string | null;
  created_at: string; updated_at: string;
};

const COLS = 'id, titulo, categoria, cuerpo, activo, estado, error, created_at, updated_at';

async function getById(id: number): Promise<KnowledgeEntry | null> {
  const { data } = await getSupabaseServer().from('mako_knowledge').select(COLS).eq('id', id).maybeSingle();
  return (data as KnowledgeEntry) ?? null;
}

/** Embebe el cuerpo y marca estado indexado/error. No lanza. */
async function embedRow(id: number, cuerpo: string): Promise<void> {
  const sb = getSupabaseServer();
  try {
    const v = await embed(cuerpo);
    await sb.from('mako_knowledge').update({ embedding: v, content_hash: hashText(cuerpo), estado: 'indexado', error: null, updated_at: new Date().toISOString() }).eq('id', id);
  } catch (e) {
    await sb.from('mako_knowledge').update({ estado: 'error', error: e instanceof Error ? e.message : String(e), updated_at: new Date().toISOString() }).eq('id', id);
  }
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  const { data, error } = await getSupabaseServer().from('mako_knowledge').select(COLS).order('updated_at', { ascending: false });
  if (error) throw new Error(`listKnowledge: ${error.message}`);
  return (data ?? []) as KnowledgeEntry[];
}

export async function createKnowledge(input: { titulo: string; categoria?: string | null; cuerpo: string; activo?: boolean }): Promise<KnowledgeEntry | null> {
  const { data, error } = await getSupabaseServer()
    .from('mako_knowledge')
    .insert({ titulo: input.titulo, categoria: input.categoria ?? null, cuerpo: input.cuerpo, activo: input.activo ?? true, estado: 'pendiente' })
    .select(COLS).single();
  if (error) throw new Error(`createKnowledge: ${error.message}`);
  const row = data as KnowledgeEntry;
  if (row.cuerpo.trim()) await embedRow(row.id, row.cuerpo);
  return getById(row.id);
}

export async function updateKnowledge(id: number, fields: { titulo?: string; categoria?: string | null; cuerpo?: string; activo?: boolean }): Promise<KnowledgeEntry | null> {
  const current = await getById(id);
  if (!current) return null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.titulo !== undefined) patch.titulo = fields.titulo;
  if (fields.categoria !== undefined) patch.categoria = fields.categoria;
  if (fields.activo !== undefined) patch.activo = fields.activo;
  const cuerpoCambia = fields.cuerpo !== undefined && fields.cuerpo !== current.cuerpo;
  if (fields.cuerpo !== undefined) patch.cuerpo = fields.cuerpo;
  if (cuerpoCambia) patch.estado = 'pendiente';
  const { error } = await getSupabaseServer().from('mako_knowledge').update(patch).eq('id', id);
  if (error) throw new Error(`updateKnowledge: ${error.message}`);
  // Re-embeber SOLO si cambió el cuerpo.
  if (cuerpoCambia && (fields.cuerpo ?? '').trim()) await embedRow(id, fields.cuerpo!);
  return getById(id);
}

export async function deleteKnowledge(id: number): Promise<void> {
  const { error } = await getSupabaseServer().from('mako_knowledge').delete().eq('id', id);
  if (error) throw new Error(`deleteKnowledge: ${error.message}`);
}

export async function reindexKnowledge(id: number): Promise<KnowledgeEntry | null> {
  const row = await getById(id);
  if (!row) return null;
  if (row.cuerpo.trim()) await embedRow(id, row.cuerpo);
  return getById(id);
}

/** Top-k entradas activas más relevantes a la consulta (coseno). */
export async function searchKnowledge(query: string, k = 4): Promise<Array<{ titulo: string; categoria: string | null; cuerpo: string; score: number }>> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { data, error } = await getSupabaseServer()
      .from('mako_knowledge')
      .select('titulo, categoria, cuerpo, embedding')
      .eq('activo', true)
      .not('embedding', 'is', null);
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

export function formatKnowledge(items: Array<{ titulo: string; cuerpo: string }>): string {
  if (items.length === 0) return '';
  return items.map((i) => `### ${i.titulo}\n${i.cuerpo}`).join('\n\n');
}
