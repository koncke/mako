// =============================================================================
// /api/chart-insights — chat de MaKo por gráfico, con sesiones
// =============================================================================
// GET ?sessionId=N        → mensajes de esa sesión.
// GET ?chartKey=K          → sesiones de ese gráfico.
// GET ?all=1               → todas las sesiones (tab Preguntale a MaKo).
// POST { action:'open',  chartKey, titulo, contexto }   → última sesión (o nueva con análisis).
// POST { action:'new',   chartKey, titulo, contexto }   → sesión nueva (primer mensaje de MaKo).
// POST { action:'send',  sessionId, mensaje }           → responde y persiste.
// El primer mensaje SIEMPRE es del assistant. MaKo nunca termina con una pregunta.

import type { NextRequest } from 'next/server';
import { chatClaude, type ClaudeMsg } from '@/lib/anthropic';
import {
  createSession, getSession, listSessions, listAllSessions,
  getSessionMessages, appendMessage, tituloDesde, type ChartMsg,
} from '@/lib/chart-chats';
import { MAKO_PERSONA } from '@/lib/mako-persona';

export const dynamic = 'force-dynamic';

const PROMPT_ANALISIS = 'Mirá el gráfico y tirame SOLO lo más importante: el insight que más impacta, en 2-4 líneas, con tu voz. Nada de resumen completo ni listar todo.';
const PROMPT_SALUDO = 'Presentate en 1-2 líneas como MaKo y decime en qué me podés ayudar con los datos del negocio. Breve, con tu voz.';

function promptInicial(contexto: string): string {
  return contexto.trim() ? PROMPT_ANALISIS : PROMPT_SALUDO;
}

function systemPrompt(titulo: string, contexto: string): string {
  const base = `${MAKO_PERSONA}

REGLAS DE FORMATO Y TONO:
- Respondé en Markdown: **negritas** para lo clave, viñetas y títulos cortos (##) SOLO cuando ayuden. Nada de muros de texto.
- El PRIMER mensaje tiene que ser breve e impactante (2-4 líneas): lo más importante, no un resumen de todo.
- Sé muy analítico: pensá a fondo antes de responder, usá los números, comparaciones y relaciones causa-efecto.
- REGLA DURA: NUNCA termines tu mensaje con una pregunta. Cerrá siempre con una afirmación, una recomendación o un próximo paso concreto.
- No inventes datos que no estén; si algo no se puede concluir, decilo.`;

  if (!contexto.trim()) {
    return `${base}

CONTEXTO: sos el consultor IA del dashboard del negocio de Martín. Es un chat general — ayudá con lo que te pregunte. Si te pega datos, analizalos.`;
  }
  return `${base}

CONTEXTO: estás mirando el gráfico "${titulo}" del dashboard del PROPIO negocio de Martín (no es un cliente). Ya tenés los datos abajo, así que analizá directo, no pidas info que está acá.

DATOS DEL GRÁFICO:
${contexto}`;
}

// Mensajes para Claude: prompt inicial (oculto) + historial + el nuevo mensaje.
function buildClaudeMsgs(contexto: string, history: ChartMsg[], mensaje?: string): ClaudeMsg[] {
  const msgs: ClaudeMsg[] = [{ role: 'user', content: promptInicial(contexto) }, ...history.map((m) => ({ role: m.role, content: m.content }))];
  if (mensaje) msgs.push({ role: 'user', content: mensaje });
  return msgs;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get('all')) return Response.json({ sessions: await listAllSessions() });
    const sessionId = sp.get('sessionId');
    if (sessionId) return Response.json({ messages: await getSessionMessages(Number(sessionId)) });
    const chartKey = sp.get('chartKey');
    if (chartKey) return Response.json({ sessions: await listSessions(chartKey) });
    return Response.json({ error: 'parámetros faltantes' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; sessionId?: number; chartKey?: string; titulo?: string; contexto?: string; mensaje?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const { action, chartKey, titulo = 'Chat', contexto = '' } = body;

  try {
    // ── Abrir: última sesión del gráfico, o crear una nueva con su primer mensaje ──
    if (action === 'open') {
      if (!chartKey) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
      const sesiones = await listSessions(chartKey);
      if (sesiones.length > 0) {
        const s = sesiones[0];
        return Response.json({ session: s, messages: await getSessionMessages(s.id), sessions: sesiones });
      }
      // no hay → crear y analizar
      const s = await createSession(chartKey, titulo, contexto);
      const resp = await chatClaude(systemPrompt(titulo, contexto), buildClaudeMsgs(contexto, []));
      await appendMessage(s.id, 'assistant', resp);
      return Response.json({ session: s, messages: await getSessionMessages(s.id), sessions: await listSessions(chartKey) });
    }

    // ── New Chat: sesión nueva con su primer mensaje ──
    if (action === 'new') {
      if (!chartKey) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
      const s = await createSession(chartKey, titulo, contexto);
      const resp = await chatClaude(systemPrompt(titulo, contexto), buildClaudeMsgs(contexto, []));
      await appendMessage(s.id, 'assistant', resp);
      return Response.json({ session: s, messages: await getSessionMessages(s.id), sessions: await listSessions(chartKey) });
    }

    // ── Enviar un mensaje a una sesión existente ──
    if (action === 'send') {
      const { sessionId, mensaje } = body;
      if (!sessionId || !mensaje) return Response.json({ error: 'sessionId y mensaje requeridos' }, { status: 400 });
      const s = await getSession(sessionId);
      if (!s) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      const ctx = s.contexto ?? '';
      const history = await getSessionMessages(sessionId);
      await appendMessage(sessionId, 'user', mensaje);
      // si la sesión no tenía título útil, ponerle la primera pregunta
      if (!s.titulo || s.titulo === 'Chat') {
        const { getSupabaseServer } = await import('@/lib/supabase');
        await getSupabaseServer().from('chart_sessions').update({ titulo: tituloDesde(mensaje) }).eq('id', sessionId);
      }
      const resp = await chatClaude(systemPrompt(s.titulo ?? 'Chat', ctx), buildClaudeMsgs(ctx, history, mensaje));
      await appendMessage(sessionId, 'assistant', resp);
      return Response.json({ messages: await getSessionMessages(sessionId) });
    }

    return Response.json({ error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
