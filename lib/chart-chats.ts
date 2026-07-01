// =============================================================================
// chart-chats — conversaciones de MaKo por gráfico (sesiones + mensajes)
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type ChartMsg = { role: 'user' | 'assistant'; content: string; created_at?: string };
export type ChartSession = {
  id: number;
  chart_key: string;
  titulo: string | null;
  contexto: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

const SESSION_COLS = 'id, chart_key, titulo, contexto, pinned, archived, created_at, updated_at';

export async function createSession(chartKey: string, titulo: string | null, contexto: string | null): Promise<ChartSession> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_sessions')
    .insert({ chart_key: chartKey, titulo, contexto })
    .select(SESSION_COLS)
    .single();
  if (error) throw new Error(`createSession falló: ${error.message}`);
  return data as ChartSession;
}

export async function getSession(sessionId: number): Promise<ChartSession | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_sessions')
    .select(SESSION_COLS)
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(`getSession falló: ${error.message}`);
  return (data as ChartSession) ?? null;
}

/** Sesiones de un gráfico: pineadas primero, luego por actividad. Sin archivadas. */
export async function listSessions(chartKey: string, incluirArchivadas = false): Promise<ChartSession[]> {
  const supabase = getSupabaseServer();
  let q = supabase.from('chart_sessions').select(SESSION_COLS).eq('chart_key', chartKey);
  if (!incluirArchivadas) q = q.eq('archived', false);
  const { data, error } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false });
  if (error) throw new Error(`listSessions falló: ${error.message}`);
  return (data ?? []) as ChartSession[];
}

/** Todas las sesiones (para la tab "Preguntale a MaKo"). Excluye las sesiones de
 *  asesoría por lead de WhatsApp (chart_key 'wa-advisor:*'), que son privadas de
 *  cada chat y no deben ensuciar la lista global de MaKo. */
export async function listAllSessions(incluirArchivadas = false, limit = 300): Promise<ChartSession[]> {
  const supabase = getSupabaseServer();
  let q = supabase.from('chart_sessions').select(SESSION_COLS).not('chart_key', 'like', 'wa-advisor:%');
  if (!incluirArchivadas) q = q.eq('archived', false);
  const { data, error } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`listAllSessions falló: ${error.message}`);
  return (data ?? []) as ChartSession[];
}

export async function renameSession(id: number, titulo: string): Promise<void> {
  const { error } = await getSupabaseServer().from('chart_sessions').update({ titulo }).eq('id', id);
  if (error) throw new Error(`renameSession falló: ${error.message}`);
}
export async function setPinned(id: number, pinned: boolean): Promise<void> {
  const { error } = await getSupabaseServer().from('chart_sessions').update({ pinned }).eq('id', id);
  if (error) throw new Error(`setPinned falló: ${error.message}`);
}
export async function setArchived(id: number, archived: boolean): Promise<void> {
  const { error } = await getSupabaseServer().from('chart_sessions').update({ archived }).eq('id', id);
  if (error) throw new Error(`setArchived falló: ${error.message}`);
}
export async function deleteSession(id: number): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from('chart_chats').delete().eq('session_id', id);
  const { error } = await supabase.from('chart_sessions').delete().eq('id', id);
  if (error) throw new Error(`deleteSession falló: ${error.message}`);
}

export async function getSessionMessages(sessionId: number): Promise<ChartMsg[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_chats')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getSessionMessages falló: ${error.message}`);
  return (data ?? []) as ChartMsg[];
}

export async function appendMessage(sessionId: number, role: 'user' | 'assistant', content: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('chart_chats').insert({ session_id: sessionId, role, content });
  if (error) throw new Error(`appendMessage falló: ${error.message}`);
  // bump updated_at para ordenar las sesiones por actividad
  await supabase.from('chart_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
}

/** Título corto para una sesión nueva, a partir de la primera pregunta del user. */
export function tituloDesde(texto: string): string {
  const t = texto.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}
