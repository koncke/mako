// =============================================================================
// /api/chart-insights — chat de MaKo por gráfico, con sesiones
// =============================================================================
// GET ?sessionId=N | ?chartKey=K[&archived=1] | ?all=1[&archived=1]
// POST { action: open|new|send|rename|pin|archive|delete, ... }
// El primer mensaje SIEMPRE es del assistant. MaKo nunca termina con una pregunta.
// El título lo pone la IA (auto) y se puede editar/pinear/archivar/eliminar.

import type { NextRequest } from 'next/server';
import { chatClaude, type ClaudeMsg } from '@/lib/anthropic';
import {
  createSession, getSession, listSessions, listAllSessions, getSessionMessages, appendMessage,
  renameSession, setPinned, setArchived, deleteSession, type ChartMsg,
} from '@/lib/chart-chats';
import { buildSystemPrompt } from '@/lib/mako-context';
import { getPromptText } from '@/lib/prompt-render';
import { CHART_PROMPT_ANALISIS_DEFAULT, CHART_PROMPT_SALUDO_DEFAULT, CHART_TITULO_DEFAULT } from '@/lib/prompt-defaults';

export const dynamic = 'force-dynamic';

// Primer mensaje del usuario: análisis (si hay gráfico) o saludo (chat general).
// Ambos son editables desde Configuraciones (default en lib/prompt-defaults).
const promptInicial = (c: string) =>
  c.trim()
    ? getPromptText('chart_insights.prompt_analisis', CHART_PROMPT_ANALISIS_DEFAULT)
    : getPromptText('chart_insights.prompt_saludo', CHART_PROMPT_SALUDO_DEFAULT);

async function buildMsgs(contexto: string, history: ChartMsg[], mensaje?: string): Promise<ClaudeMsg[]> {
  const msgs: ClaudeMsg[] = [{ role: 'user', content: await promptInicial(contexto) }, ...history.map((m) => ({ role: m.role, content: m.content }))];
  if (mensaje) msgs.push({ role: 'user', content: mensaje });
  return msgs;
}

// Título corto generado por la IA (sin thinking, barato). Diferencia chats del mismo gráfico.
async function generarTitulo(seed: string): Promise<string | null> {
  try {
    const sys = await getPromptText('chart_insights.titulo_generation', CHART_TITULO_DEFAULT);
    const t = await chatClaude(
      sys,
      [{ role: 'user', content: seed.slice(0, 1500) }],
      { thinking: false, maxTokens: 30, feature: 'mako-chat' },
    );
    const clean = t.replace(/^["'`]+|["'`.]+$/g, '').trim();
    return clean ? clean.slice(0, 70) : null;
  } catch { return null; }
}

/** Seed del título cuando no hay gráfico: usa el saludo vigente + la respuesta. */
async function seedTitulo(contexto: string, resp: string): Promise<string> {
  if (contexto.trim()) return resp;
  const saludo = await getPromptText('chart_insights.prompt_saludo', CHART_PROMPT_SALUDO_DEFAULT);
  return `${saludo}\n${resp}`;
}

async function crearYAnalizar(chartKey: string, titulo: string, contexto: string) {
  const s = await createSession(chartKey, null, contexto);
  const query = `${titulo}\n${contexto}`.slice(0, 2000);
  const resp = await chatClaude(await buildSystemPrompt({ chartKey, titulo, contexto, query }), await buildMsgs(contexto, []), { feature: 'mako-chat' });
  await appendMessage(s.id, 'assistant', resp);
  const t = await generarTitulo(await seedTitulo(contexto, resp));
  if (t) await renameSession(s.id, t);
  return s.id;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const arch = !!sp.get('archived');
  try {
    if (sp.get('all')) return Response.json({ sessions: await listAllSessions(arch) });
    const sessionId = sp.get('sessionId');
    if (sessionId) return Response.json({ messages: await getSessionMessages(Number(sessionId)) });
    const chartKey = sp.get('chartKey');
    if (chartKey) return Response.json({ sessions: await listSessions(chartKey, arch) });
    return Response.json({ error: 'parámetros faltantes' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; sessionId?: number; chartKey?: string; titulo?: string; contexto?: string; mensaje?: string; valor?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const { action, chartKey, titulo = 'Chat', contexto = '' } = body;

  try {
    if (action === 'open') {
      if (!chartKey) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
      const sesiones = await listSessions(chartKey);
      if (sesiones.length > 0) {
        const s = sesiones[0];
        const mensajes = await getSessionMessages(s.id);
        if (mensajes.length > 0) {
          return Response.json({ session: s, messages: mensajes, sessions: sesiones });
        }
        // Sesión vacía (quedó a medias por un error previo): MaKo arranca igual,
        // así abrir un gráfico SIEMPRE devuelve su análisis sin tener que crear chat.
        const ctx = s.contexto ?? contexto;
        const query = `${s.titulo ?? titulo}\n${ctx}`.slice(0, 2000);
        const resp = await chatClaude(await buildSystemPrompt({ chartKey, titulo: s.titulo ?? titulo, contexto: ctx, query }), await buildMsgs(ctx, []), { feature: 'mako-chat' });
        await appendMessage(s.id, 'assistant', resp);
        if (!s.titulo) {
          const t = await generarTitulo(await seedTitulo(ctx, resp));
          if (t) await renameSession(s.id, t);
        }
        return Response.json({ session: await getSession(s.id), messages: await getSessionMessages(s.id), sessions: await listSessions(chartKey) });
      }
      const id = await crearYAnalizar(chartKey, titulo, contexto);
      const s = await getSession(id);
      return Response.json({ session: s, messages: await getSessionMessages(id), sessions: await listSessions(chartKey) });
    }

    if (action === 'new') {
      if (!chartKey) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
      const id = await crearYAnalizar(chartKey, titulo, contexto);
      const s = await getSession(id);
      return Response.json({ session: s, messages: await getSessionMessages(id), sessions: await listSessions(chartKey) });
    }

    if (action === 'send') {
      const { sessionId, mensaje } = body;
      if (!sessionId || !mensaje) return Response.json({ error: 'sessionId y mensaje requeridos' }, { status: 400 });
      const s = await getSession(sessionId);
      if (!s) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      const ctx = s.contexto ?? '';
      const history = await getSessionMessages(sessionId);
      await appendMessage(sessionId, 'user', mensaje);
      const resp = await chatClaude(await buildSystemPrompt({ chartKey: s.chart_key, titulo: s.titulo ?? 'Chat', contexto: ctx, query: mensaje }), await buildMsgs(ctx, history, mensaje), { feature: 'mako-chat' });
      await appendMessage(sessionId, 'assistant', resp);
      // Si todavía no tiene título propio, que la IA le ponga uno a partir de la charla.
      if (!s.titulo) {
        const t = await generarTitulo(`${mensaje}\n${resp}`);
        if (t) await renameSession(sessionId, t);
      }
      return Response.json({ messages: await getSessionMessages(sessionId) });
    }

    if (action === 'rename') {
      if (!body.sessionId || !body.titulo) return Response.json({ error: 'sessionId y titulo requeridos' }, { status: 400 });
      await renameSession(body.sessionId, body.titulo);
      return Response.json({ ok: true });
    }
    if (action === 'pin') {
      if (!body.sessionId) return Response.json({ error: 'sessionId requerido' }, { status: 400 });
      await setPinned(body.sessionId, body.valor ?? true);
      return Response.json({ ok: true });
    }
    if (action === 'archive') {
      if (!body.sessionId) return Response.json({ error: 'sessionId requerido' }, { status: 400 });
      await setArchived(body.sessionId, body.valor ?? true);
      return Response.json({ ok: true });
    }
    if (action === 'delete') {
      if (!body.sessionId) return Response.json({ error: 'sessionId requerido' }, { status: 400 });
      await deleteSession(body.sessionId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
