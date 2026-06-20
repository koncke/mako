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
import { MAKO_PERSONA } from '@/lib/mako-persona';

export const dynamic = 'force-dynamic';

const PROMPT_ANALISIS = 'Mirá el gráfico y tirame SOLO lo más importante: el insight que más impacta, en 2-4 líneas, con tu voz. Nada de resumen completo ni listar todo.';
const PROMPT_SALUDO = 'Presentate en 1-2 líneas como MaKo y decime en qué me podés ayudar con los datos del negocio. Breve, con tu voz.';
const promptInicial = (c: string) => (c.trim() ? PROMPT_ANALISIS : PROMPT_SALUDO);

function systemPrompt(titulo: string, contexto: string): string {
  const base = `${MAKO_PERSONA}

REGLAS DE FORMATO Y TONO:
- Markdown: **negritas** para lo clave, viñetas y títulos cortos (##) SOLO cuando ayuden. Nada de muros de texto.
- El PRIMER mensaje breve e impactante (2-4 líneas): lo más importante, no un resumen de todo.
- Muy analítico: pensá a fondo, usá números, comparaciones y relaciones causa-efecto.
- REGLA DURA: NUNCA termines con una pregunta. Cerrá con una afirmación, recomendación o próximo paso concreto.
- No inventes datos que no estén; si algo no se puede concluir, decilo.`;
  if (!contexto.trim()) return `${base}\n\nCONTEXTO: chat general del dashboard del negocio de Martín. Ayudá con lo que pregunte; si te pega datos, analizalos.`;
  return `${base}\n\nCONTEXTO: estás mirando el gráfico "${titulo}" del PROPIO negocio de Martín. Ya tenés los datos abajo, analizá directo.\n\nDATOS DEL GRÁFICO:\n${contexto}`;
}

function buildMsgs(contexto: string, history: ChartMsg[], mensaje?: string): ClaudeMsg[] {
  const msgs: ClaudeMsg[] = [{ role: 'user', content: promptInicial(contexto) }, ...history.map((m) => ({ role: m.role, content: m.content }))];
  if (mensaje) msgs.push({ role: 'user', content: mensaje });
  return msgs;
}

// Título corto generado por la IA (sin thinking, barato). Diferencia chats del mismo gráfico.
async function generarTitulo(seed: string): Promise<string | null> {
  try {
    const t = await chatClaude(
      'Devolvé SOLO un título corto (3 a 6 palabras, en español, sin comillas ni punto final) que resuma de qué trata esto. Nada más que el título.',
      [{ role: 'user', content: seed.slice(0, 1500) }],
      { thinking: false, maxTokens: 30 },
    );
    const clean = t.replace(/^["'`]+|["'`.]+$/g, '').trim();
    return clean ? clean.slice(0, 70) : null;
  } catch { return null; }
}

async function crearYAnalizar(chartKey: string, titulo: string, contexto: string) {
  const s = await createSession(chartKey, null, contexto);
  const resp = await chatClaude(systemPrompt(titulo, contexto), buildMsgs(contexto, []));
  await appendMessage(s.id, 'assistant', resp);
  const t = await generarTitulo(contexto.trim() ? resp : `${PROMPT_SALUDO}\n${resp}`);
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
        return Response.json({ session: s, messages: await getSessionMessages(s.id), sessions: sesiones });
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
      const resp = await chatClaude(systemPrompt(s.titulo ?? 'Chat', ctx), buildMsgs(ctx, history, mensaje));
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
