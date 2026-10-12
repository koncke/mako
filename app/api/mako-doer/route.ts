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
import type { ToolDef, ToolRunner } from '@/lib/anthropic';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { toolsDelRegistro, REGISTRO } from '@/lib/api-mako/registro';
import { runnerDelRegistro, vistaDe } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import { areasDelMensaje } from '@/lib/mako-intencion';
import type { Ctx } from '@/lib/api-mako/tipos';
import {
  createSession, getSession, listSessions, listAllSessions, getSessionMessages, appendMessage,
  renameSession, setPinned, setArchived, deleteSession, esChatDelTelefono, esSesionDelTelefono, type ChartMsg,
} from '@/lib/chart-chats';
import { buildSystemPrompt } from '@/lib/mako-context';
import { getPromptText } from '@/lib/prompt-render';
import { CHART_PROMPT_SALUDO_DEFAULT, CHART_TITULO_DEFAULT } from '@/lib/prompt-defaults';

export const dynamic = 'force-dynamic';

const CHART_KEY = 'mako-doer';

// Preámbulo que se suma al system de MaKo para el modo doer: cómo y cuándo usar
// las herramientas. Inline (no registry) para no acoplar con prompt-registry.
// (`historial_whatsapp` ya no se nombra: leía el WhatsApp oficial, que se borró el 09/10/2026,
// y hoy sólo contesta que ya no existe. Mandar al modelo a usarla para «el detalle» le
// quemaba un paso por pedido.)
const DOER_PREAMBLE = `HERRAMIENTAS (modo doer):
Tienes herramientas para CONSULTAR datos reales del negocio: buscar_leads, ficha_lead, reuniones_lead, buscar_conocimiento y estado_experimentos. Según de qué te hablen, puedes tener además otras LECTURAS de cada tab de MaKo (email, chatbot, landing, métricas, experimentos…): úsalas igual. Aquí no hay herramientas que escriban: si te piden un cambio, di dónde se hace en MaKo.
Cuando la respuesta dependa de un dato concreto —un lead puntual, su historial, una reunión, tu método— ÚSALAS en vez de suponer. Flujo típico: buscar_leads para ubicar al lead por nombre → ficha_lead / reuniones_lead para el detalle → buscar_conocimiento para apoyar tu recomendación en el método real.
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

/**
 * Las herramientas de un turno del chat de la app: las de siempre (MAKO_TOOLS, por
 * sus cuerpos de siempre) + las LECTURAS del registro de la API de las áreas que el
 * mensaje nombra. SOLO LECTURAS, a propósito: este chat no tiene todavía el turno
 * compartido del doer de WhatsApp (pendientes en el system, `turnStart`, el link del
 * borrador escrito por el código), y una acción sin eso propone y confirma en el
 * mismo turno o pega links copiados por el modelo. Ver docs/api-mako-diseno.md §4.2.
 *
 * Sin workspace resuelto (la agencia sin entrar a un cliente) queda como estaba.
 */
async function herramientasDelTurno(query: string): Promise<{ tools: ToolDef[]; runTool: ToolRunner }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { tools: MAKO_TOOLS, runTool: runMakoTool };
  const rol = (await getRolWsEfectivo()) === 'admin' ? 'admin' : 'miembro';
  const ctx: Ctx = { ws, canal: 'app', canalKey: canalKeyDe('app', `ws${ws}`), alcance: 'lectura', rol };
  const deSiempre = new Set(MAKO_TOOLS.map((t) => t.name));
  // ⚠️ SIN LAS QUE LEEN LA AGENDA DE GOOGLE (`datosDeGoogle`). La agenda no pasa por
  // ninguna IA (lib/agenda-sin-ia.ts): esas herramientas le muestran el detalle a la
  // persona por un canal del código, y este chat no tiene dónde ponerlo sin que vuelva
  // al modelo — guarda la respuesta entera como turno (buildMsgs la reenvía) y con ella
  // arma el título de la sesión (generarTitulo). La agenda se ve en el CRM.
  const excluir = new Set([...deSiempre, ...REGISTRO.filter((d) => d.datosDeGoogle).flatMap((d) => [d.id, ...(d.alias ?? [])])]);
  const areas = areasDelMensaje(query);
  const extra = areas.length
    ? toolsDelRegistro({ vista: await vistaDe(ctx), areas, incluirAcciones: false, excluir, maxChars: 12_000, relevanteA: query })
    : [];
  const runRegistro = runnerDelRegistro(ctx);
  return {
    tools: [...MAKO_TOOLS, ...extra],
    runTool: (name, input) => (deSiempre.has(name) ? runMakoTool(name, input) : runRegistro(name, input)),
  };
}

async function responder(sys: string, msgs: RichMsg[], query = ''): Promise<string> {
  const { tools, runTool } = await herramientasDelTurno(query);
  const { text } = await chatClaudeTools(sys, msgs, tools, runTool, { feature: 'mako-doer', maxSteps: 8 });
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
    // ⚠️ Un chat del TELÉFONO es de UNA persona: por esta ruta (por workspace) no se abre
    // (lib/chart-chats.ts, `esSesionDelTelefono`).
    if (sessionId) {
      if (await esSesionDelTelefono(Number(sessionId))) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      return Response.json({ messages: await getSessionMessages(Number(sessionId)) });
    }
    const chartKey = sp.get('chartKey');
    if (chartKey) {
      if (esChatDelTelefono(chartKey)) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      return Response.json({ sessions: await listSessions(chartKey, arch) });
    }
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
    // Lo mismo para escribir: send/rename/pin/archive/delete por id no tocan un chat del teléfono.
    if (body.sessionId != null && (await esSesionDelTelefono(Number(body.sessionId)))) {
      return Response.json({ error: 'sesión inexistente' }, { status: 404 });
    }
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
      const resp = await responder(await buildDoerSystem({ titulo: s.titulo ?? 'Chat', query: mensaje }), await buildMsgs(history, mensaje), mensaje);
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
