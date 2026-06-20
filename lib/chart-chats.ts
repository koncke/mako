// =============================================================================
// chart-chats — historial de conversaciones de IA por gráfico (tabla chart_chats)
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type ChartMsg = { role: 'user' | 'assistant'; content: string; created_at?: string };

/** Hilo de un gráfico, cronológico (más viejo → más nuevo). */
export async function getChartHistory(chartKey: string): Promise<ChartMsg[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_chats')
    .select('role, content, created_at')
    .eq('chart_key', chartKey)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getChartHistory falló: ${error.message}`);
  return (data ?? []) as ChartMsg[];
}

/** Agrega un mensaje al hilo. */
export async function appendChartMsg(chartKey: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('chart_chats').insert({ chart_key: chartKey, role, content });
  if (error) throw new Error(`appendChartMsg falló: ${error.message}`);
}
