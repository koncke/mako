// =============================================================================
// chart-chats — conversaciones de MaKo por gráfico (sesiones + mensajes)
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';

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

/**
 * El prefijo de los chats del TELÉFONO (`chart_key = mako-movil:<persona>`). Es el mismo
 * string que `PREFIJO_CHART_MOVIL` de lib/mako-turno-app-reglas.ts —ese módulo no se puede
 * importar acá sin traer el registro de la API— y tests/movil-privacidad.test.ts frena si
 * los dos se separan.
 */
const PREFIJO_CHAT_MOVIL = 'mako-movil:';

/** ¿Esta clave es de un chat del teléfono (por PERSONA)? */
export function esChatDelTelefono(chartKey: string | null | undefined): boolean {
  return String(chartKey ?? '').startsWith(PREFIJO_CHAT_MOVIL);
}

/**
 * Para las rutas de ESCRITORIO (/api/chart-insights, /api/mako-doer), que leen y escriben
 * sesiones POR ID sin mirar de quién son (el escritorio es por workspace a propósito).
 * true = ese id es un chat del TELÉFONO: la ruta contesta 404.
 *
 * ⚠️ Los chats del teléfono son POR PERSONA (lib/mako-turno-app.ts, `sesionDe`), y esa
 * promesa se caía por la puerta de al lado: medido el 11/10/2026 leyendo las dos rutas,
 * cualquier sesión del mismo workspace —un closer— leía con `?sessionId=N` (ids
 * correlativos) o `?chartKey=mako-movil:u<id>` lo que el dueño habló con MaKo en su celular,
 * y con `send`/`rename`/`delete` se lo escribía o se lo borraba. Un id que no existe sigue
 * contestando como siempre (false): sólo se corta lo que es del teléfono.
 */
export async function esSesionDelTelefono(sessionId: number): Promise<boolean> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) return false;
  const s = await getSession(sessionId);
  return !!s && esChatDelTelefono(s.chart_key);
}

export async function createSession(chartKey: string, titulo: string | null, contexto: string | null): Promise<ChartSession> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('chart_sessions')
    .insert({ chart_key: chartKey, titulo, contexto })
    .select(SESSION_COLS)
    .single();
  if (error) throw new Error(`createSession falló: ${error.message}`);
  return data as ChartSession;
}

export async function getSession(sessionId: number): Promise<ChartSession | null> {
  const supabase = (await getTenantDb());
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
  const supabase = (await getTenantDb());
  let q = supabase.from('chart_sessions').select(SESSION_COLS).eq('chart_key', chartKey);
  if (!incluirArchivadas) q = q.eq('archived', false);
  const { data, error } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false });
  if (error) throw new Error(`listSessions falló: ${error.message}`);
  return (data ?? []) as ChartSession[];
}

/** Todas las sesiones (para la tab "Preguntale a MaKo"). Excluye las sesiones de
 *  asesoría por lead de WhatsApp (chart_key 'wa-advisor:*') y las del doer
 *  (chart_key 'mako-doer'), que tienen su propia superficie y no deben ensuciar
 *  la lista global de MaKo.
 *
 *  ⚠️ Y excluye los chats del TELÉFONO ('mako-movil:<persona>', lib/mako-turno-app.ts):
 *  son POR PERSONA a propósito, y esta lista es por workspace. Sin este filtro, la tab de
 *  escritorio le mostraba a un closer los chats que el dueño tuvo con MaKo en su celular
 *  (y a la inversa). */
export async function listAllSessions(incluirArchivadas = false, limit = 300): Promise<ChartSession[]> {
  const supabase = (await getTenantDb());
  let q = supabase.from('chart_sessions').select(SESSION_COLS).not('chart_key', 'like', 'wa-advisor:%').not('chart_key', 'like', `${PREFIJO_CHAT_MOVIL}%`).neq('chart_key', 'mako-doer').not('chart_key', 'like', 'mako-doer:%');
  if (!incluirArchivadas) q = q.eq('archived', false);
  const { data, error } = await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`listAllSessions falló: ${error.message}`);
  return (data ?? []) as ChartSession[];
}

export async function renameSession(id: number, titulo: string): Promise<void> {
  const { error } = await (await getTenantDb()).from('chart_sessions').update({ titulo }).eq('id', id);
  if (error) throw new Error(`renameSession falló: ${error.message}`);
}
export async function setPinned(id: number, pinned: boolean): Promise<void> {
  const { error } = await (await getTenantDb()).from('chart_sessions').update({ pinned }).eq('id', id);
  if (error) throw new Error(`setPinned falló: ${error.message}`);
}
export async function setArchived(id: number, archived: boolean): Promise<void> {
  const { error } = await (await getTenantDb()).from('chart_sessions').update({ archived }).eq('id', id);
  if (error) throw new Error(`setArchived falló: ${error.message}`);
}
export async function deleteSession(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  await supabase.from('chart_chats').delete().eq('session_id', id);
  const { error } = await supabase.from('chart_sessions').delete().eq('id', id);
  if (error) throw new Error(`deleteSession falló: ${error.message}`);
}

export async function getSessionMessages(sessionId: number): Promise<ChartMsg[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('chart_chats')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getSessionMessages falló: ${error.message}`);
  return (data ?? []) as ChartMsg[];
}

export async function appendMessage(sessionId: number, role: 'user' | 'assistant', content: string): Promise<void> {
  const supabase = (await getTenantDb());
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
