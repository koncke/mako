// =============================================================================
// /api/mako-doer — chat de MaKo con HERRAMIENTAS (el "doer"), con sesiones
// =============================================================================
// Misma forma que /api/chart-insights (open|new|send|rename|pin|archive|delete),
// pero el modelo corre con tool-use (chatClaudeTools): MaKo consulta datos REALES
// (leads, WhatsApp, reuniones, conocimiento) antes de responder.
// v1 = solo LECTURA — nada se envía ni se escribe. Las sesiones viven en las
// mismas tablas (chart_sessions/chart_chats), scopeadas por workspace, con
// chart_key fijo 'mako-doer'. El costo lo mide chatClaudeTools solo (feature).

import type { NextRequest } from 'next/server';
import { chatClaude, chatClaudeTools, type RichMsg } from '@/lib/anthropic';
import { chatCheapCascade } from '@/lib/ai-cheap';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import {
  createSession, getSession, listSessions, listAllSessions, getSessionMessages, appendMessage,
  renameSession, setPinned, setArchived, deleteSession, type ChartMsg,
} from '@/lib/chart-chats';
import { buildSystemPrompt } from '@/lib/mako-context';
import { getPromptText } from '@/lib/prompt-render';
import { CHART_PROMPT_SALUDO_DEFAULT, CHART_TITULO_DEFAULT } from '@/lib/prompt-defaults';

export const dynamic = 'force-dynamic';

const CHART_KEY = 'mako-doer';

// Preámbulo que se suma al system de MaKo para el modo doer: cómo y cuándo usar
// las herramientas. Inline (no registry) para no acoplar con prompt-registry.
const DOER_PREAMBLE = `HERRAMIENTAS (modo doer):
Tienes herramientas para CONSULTAR datos reales del negocio: buscar_leads, ficha_lead, historial_whatsapp, reuniones_lead, buscar_conocimiento y estado_experimentos.
Cuando la respuesta dependa de un dato concreto —un lead puntual, su historial, una reunión, tu método— ÚSALAS en vez de suponer. Flujo típico: buscar_leads para ubicar al lead por nombre → ficha_lead / historial_whatsapp / reuniones_lead para el detalle → buscar_conocimiento para apoyar tu recomendación en el método real.
Nunca inventes nombres, números, fechas ni mensajes: si una herramienta no lo trae, di explícitamente que no lo tienes. Después de consultar, responde en tu voz de siempre, sin volcar el JSON crudo.`;

async function buildDoerSystem(opts: { titulo: string; query: string }): Promise<string> {
  const base = await buildSystemPrompt({ chartKey: CHART_KEY, titulo: opts.titulo, contexto: '', query: opts.query });
  return `${base}\n\n${DOER_PREAMBLE}`;
}

// El doer es siempre chat general (sin gráfico): arranca con el saludo de MaKo.
async function buildMsgs(history: ChartMsg[], mensaje?: string): Promise<RichMsg[]> {
  const saludo = await getPromptText('chart_insights.prompt_saludo', CHART_PROMPT_SALUDO_DEFAULT);
  const msgs: RichMsg[] = [{ role: 'user', content: saludo }, ...history.map((m) => ({ role: m.role, content: m.content }))];
  if (mensaje) msgs.push({ role: 'user', content: mensaje });
  return msgs;
}

async function responder(sys: string, msgs: RichMsg[]): Promise<string> {
  const { text } = await chatClaudeTools(sys, msgs, MAKO_TOOLS, runMakoTool, { feature: 'mako-doer', maxSteps: 8 });
  return text;
}

// Título corto generado por la IA (tarea simple → modelo barato, fallback a Claude).
async function generarTitulo(seed: string): Promise<string | null> {
  try {
    const sys = await getPromptText('chart_insights.titulo_generation', CHART_TITULO_DEFAULT);
    const user = seed.slice(0, 1500);
    let t: string;
    // Cascada gratis entera antes de pagar: un título no justifica despertar a Claude
    // porque el primer proveedor tiró 429.
    t = await chatCheapCascade({ system: sys, user, maxTokens: 30, feature: 'Título de chat', motivo: 'Generar título de sesión del doer' });
    if (!t.trim()) t = await chatClaude(sys, [{ role: 'user', content: user }], { thinking: false, maxTokens: 30, feature: 'mako-doer' });
    const clean = t.replace(/^["'`]+|["'`.]+$/g, '').trim();
    return clean ? clean.slice(0, 70) : null;
  } catch { return null; }
}

async function crearYSaludar(titulo: string): Promise<number> {
  const s = await createSession(CHART_KEY, null, '');
  const resp = await responder(await buildDoerSystem({ titulo, query: titulo }), await buildMsgs([]));
  await appendMessage(s.id, 'assistant', resp);
  const t = await generarTitulo(resp);
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
  let body: { action?: string; sessionId?: number; titulo?: string; mensaje?: string; valor?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const { action, titulo = 'Chat' } = body;

  try {
    if (action === 'open') {
      const sesiones = await listSessions(CHART_KEY);
      if (sesiones.length > 0) {
        const s = sesiones[0];
        const mensajes = await getSessionMessages(s.id);
        if (mensajes.length > 0) return Response.json({ session: s, messages: mensajes, sessions: sesiones });
        // Sesión vacía (quedó a medias): MaKo saluda igual, así abrir el doer
        // SIEMPRE devuelve un primer mensaje sin tener que crear otra sesión.
        const resp = await responder(await buildDoerSystem({ titulo: s.titulo ?? titulo, query: s.titulo ?? titulo }), await buildMsgs([]));
        await appendMessage(s.id, 'assistant', resp);
        if (!s.titulo) { const t = await generarTitulo(resp); if (t) await renameSession(s.id, t); }
        return Response.json({ session: await getSession(s.id), messages: await getSessionMessages(s.id), sessions: await listSessions(CHART_KEY) });
      }
      const id = await crearYSaludar(titulo);
      return Response.json({ session: await getSession(id), messages: await getSessionMessages(id), sessions: await listSessions(CHART_KEY) });
    }

    if (action === 'new') {
      const id = await crearYSaludar(titulo);
      return Response.json({ session: await getSession(id), messages: await getSessionMessages(id), sessions: await listSessions(CHART_KEY) });
    }

    if (action === 'send') {
      const { sessionId, mensaje } = body;
      if (!sessionId || !mensaje) return Response.json({ error: 'sessionId y mensaje requeridos' }, { status: 400 });
      const s = await getSession(sessionId);
      if (!s) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      const history = await getSessionMessages(sessionId);
      await appendMessage(sessionId, 'user', mensaje);
      const resp = await responder(await buildDoerSystem({ titulo: s.titulo ?? 'Chat', query: mensaje }), await buildMsgs(history, mensaje));
      await appendMessage(sessionId, 'assistant', resp);
      if (!s.titulo) { const t = await generarTitulo(`${mensaje}\n${resp}`); if (t) await renameSession(sessionId, t); }
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
