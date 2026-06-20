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
  created_at: string;
  updated_at: string;
};

export async function createSession(chartKey: string, titulo: string | null, contexto: string | null): Promise<ChartSession> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_sessions')
    .insert({ chart_key: chartKey, titulo, contexto })
    .select('id, chart_key, titulo, contexto, created_at, updated_at')
    .single();
  if (error) throw new Error(`createSession falló: ${error.message}`);
  return data as ChartSession;
}

export async function getSession(sessionId: number): Promise<ChartSession | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_sessions')
    .select('id, chart_key, titulo, contexto, created_at, updated_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(`getSession falló: ${error.message}`);
  return (data as ChartSession) ?? null;
}

/** Sesiones de un gráfico, más reciente primero. */
export async function listSessions(chartKey: string): Promise<ChartSession[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_sessions')
    .select('id, chart_key, titulo, contexto, created_at, updated_at')
    .eq('chart_key', chartKey)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`listSessions falló: ${error.message}`);
  return (data ?? []) as ChartSession[];
}

/** Todas las sesiones (para la tab "Preguntale a MaKo"). */
export async function listAllSessions(limit = 200): Promise<ChartSession[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_sessions')
    .select('id, chart_key, titulo, contexto, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAllSessions falló: ${error.message}`);
  return (data ?? []) as ChartSession[];
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
