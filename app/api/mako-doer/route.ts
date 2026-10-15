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
import { getUsuarioActual } from '@/lib/auth';
import { toolsDelRegistro, REGISTRO, type Vista } from '@/lib/api-mako/registro';
import { runnerDelRegistro, vistaDe } from '@/lib/api-mako/ejecutar';
import { canalKeyDe } from '@/lib/api-mako/canal';
import { entraAlChat } from '@/lib/mako-turno-app-reglas';
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
// ⚠️ 300 Y NO MÁS, A PROPÓSITO (tanda 7 del Web Generator, 15/10/2026). El pendiente decía «/api/mako-doer sin
// maxDuration para los 240 s de replicar por chat», y era el diagnóstico obvio y equivocado: esta ruta es SÓLO
// LECTURA (`incluirAcciones: false`, sin `confirmar_accion` ni el turno compartido): acá no se confirma ni se
// ejecuta replicar_landing ni analizar_landing. Y sin maxDuration ya corría 300 s: el proyecto tiene fluid
// compute y `functionDefaultTimeout: 300` (medido con GET a la API de Vercel ese día; plan Pro, tope 800). Se
// escribe igual para no depender de esa configuración (sin fluid, el default de Pro es 15 s y el loop de hasta
// 8 pasos se cortaría). Las rutas donde una confirmación por chat SÍ corre replicar (hasta ~275 s: 265 de
// imágenes más crear, lib/editor-landing/replicar.ts) más los pasos del modelo son el webhook de Evolution
// (WhatsApp), /api/m/mako y las páginas /m/mako, /m/inbox y /mako/pendientes (sus server actions), y
// /api/crm/mako: ésas son las que necesitan ~420 (tests/mako-doer-plazo.test.ts, el `todo`).
export const maxDuration = 300;

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

/**
 * De quién es el chat que se abre (auditoría de seguridad del 14/10/2026).
 *
 * ⚠️ Los chats del doer eran del WORKSPACE: `open` devolvía el último, que era el del admin, con las
 * respuestas de metricas_negocio y analisis_negocio en texto, y `?all=1` + `?sessionId=` abrían cualquiera.
 * Filtrar las herramientas no alcanzaba: el dato ya estaba en el historial. Los de un admin siguen siendo
 * del workspace (como siempre); los de un closer o setter son SUYOS (`mako-doer:u<id>`), como los del
 * teléfono, y no abre ningún otro.
 */
async function quienPide(): Promise<{ admin: boolean; clave: string }> {
  const [rolWs, sesion] = await Promise.all([getRolWsEfectivo(), getUsuarioActual()]);
  const admin = rolWs === 'admin';
  return { admin, clave: admin ? CHART_KEY : `${CHART_KEY}:u${sesion?.sub ?? 'sin-sesion'}` };
}

/** ¿Este id es un chat que quien pide puede abrir? Un admin, cualquiera (salvo los del teléfono, aparte). */
async function puedeAbrir(sessionId: number, q: { admin: boolean; clave: string }): Promise<boolean> {
  if (q.admin) return true;
  const s = Number.isInteger(sessionId) && sessionId > 0 ? await getSession(sessionId) : null;
  return !!s && s.chart_key === q.clave;
}

async function buildDoerSystem(opts: { titulo: string; query: string; admin: boolean }): Promise<string> {
  const base = await buildSystemPrompt({ chartKey: CHART_KEY, titulo: opts.titulo, contexto: '', query: opts.query, sinNumerosDelNegocio: !opts.admin });
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
 * ⚠️ LAS DE SIEMPRE TAMBIÉN SE FILTRAN POR LA VISTA DE ESTA PERSONA (auditoría de seguridad,
 * 14/10/2026). Antes MAKO_TOOLS viajaba entero y `runMakoTool` no mira ni rol ni capa: un closer
 * o un setter le pedía a MaKo `metricas_negocio` y `analisis_negocio` (ingreso, inversión en
 * Meta, CAC, cascada de costos), que en el registro tienen `rolMinimo: 'admin'` y que su
 * Dashboard le esconde. Ahora pasa por `entraAlChat` (lib/mako-turno-app-reglas.ts), el MISMO
 * filtro que el chat del teléfono: viaja sólo lo que tiene gemela en el registro y es visible
 * para su rol y la capa del workspace. Y `runTool` rechaza todo nombre que no viajó: el modelo
 * puede pedir una herramienta que no está en la lista (la nombra el historial, la inventa).
 * Medido el 14/10/2026: con la capa `completo`, el admin conserva las 12 de siempre y el
 * closer/setter pierde exactamente esas dos. Con una capa sin CRM (`pm`) las del CRM tampoco
 * viajan, igual que en el teléfono.
 *
 * Sin workspace resuelto, la agencia (rol admin) queda como estaba. Cualquier otro rol sin
 * workspace ve la vista fail-closed de `vistaDe` (sin tabs): nada que dependa de una tab.
 */
async function herramientasDelTurno(query: string): Promise<{ tools: ToolDef[]; runTool: ToolRunner }> {
  const [ws, rolWs] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  const rol = rolWs === 'admin' ? 'admin' : 'miembro';
  if (ws == null) {
    if (rol === 'admin') return { tools: MAKO_TOOLS, runTool: runMakoTool };
    const sinWs: Vista = { canal: 'app', alcance: 'lectura', ws: 0, rol, tabs: [] };
    return soloLasQueViajan(MAKO_TOOLS.filter((t) => entraAlChat(t.name, sinWs)), runMakoTool);
  }
  const ctx: Ctx = { ws, canal: 'app', canalKey: canalKeyDe('app', `ws${ws}`), alcance: 'lectura', rol };
  const vista = await vistaDe(ctx);
  const deSiempre = new Set(MAKO_TOOLS.map((t) => t.name));
  // ⚠️ SIN LAS QUE LEEN LA AGENDA DE GOOGLE (`datosDeGoogle`). La agenda no pasa por
  // ninguna IA (lib/agenda-sin-ia.ts): esas herramientas le muestran el detalle a la
  // persona por un canal del código, y este chat no tiene dónde ponerlo sin que vuelva
  // al modelo — guarda la respuesta entera como turno (buildMsgs la reenvía) y con ella
  // arma el título de la sesión (generarTitulo). La agenda se ve en el CRM.
  const excluir = new Set([...deSiempre, ...REGISTRO.filter((d) => d.datosDeGoogle).flatMap((d) => [d.id, ...(d.alias ?? [])])]);
  const areas = areasDelMensaje(query);
  const extra = areas.length
    ? toolsDelRegistro({ vista, areas, incluirAcciones: false, excluir, maxChars: 12_000, relevanteA: query })
    : [];
  const runRegistro = runnerDelRegistro(ctx);
  const propias = MAKO_TOOLS.filter((t) => entraAlChat(t.name, vista));
  return soloLasQueViajan(
    [...propias, ...extra],
    (name, input) => (deSiempre.has(name) ? runMakoTool(name, input) : runRegistro(name, input)),
  );
}

/** El contrato se aplica AL EJECUTAR: lo que no viajó no corre, aunque el modelo lo pida. */
function soloLasQueViajan(tools: ToolDef[], correr: ToolRunner): { tools: ToolDef[]; runTool: ToolRunner } {
  const permitidas = new Set(tools.map((t) => t.name));
  return {
    tools,
    runTool: async (name, input) => (permitidas.has(name)
      ? correr(name, input)
      : { content: JSON.stringify({ ok: false, error: `«${name}» no está disponible en este chat.` }), isError: true }),
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

async function crearYSaludar(titulo: string, q: { admin: boolean; clave: string }): Promise<number> {
  const s = await createSession(q.clave, null, '');
  const resp = await responder(await buildDoerSystem({ titulo, query: titulo, admin: q.admin }), await buildMsgs([]));
  await appendMessage(s.id, 'assistant', resp);
  const t = await generarTitulo(resp);
  if (t) await renameSession(s.id, t);
  return s.id;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const arch = !!sp.get('archived');
  try {
    const q = await quienPide();
    // Un closer o setter sólo ve los SUYOS: ni la lista de todos ni los chats de otro.
    if (sp.get('all')) return Response.json({ sessions: q.admin ? await listAllSessions(arch) : await listSessions(q.clave, arch) });
    const sessionId = sp.get('sessionId');
    // ⚠️ Un chat del TELÉFONO es de UNA persona: por esta ruta (por workspace) no se abre
    // (lib/chart-chats.ts, `esSesionDelTelefono`).
    if (sessionId) {
      if (await esSesionDelTelefono(Number(sessionId))) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      if (!(await puedeAbrir(Number(sessionId), q))) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      return Response.json({ messages: await getSessionMessages(Number(sessionId)) });
    }
    const chartKey = sp.get('chartKey');
    if (chartKey) {
      if (esChatDelTelefono(chartKey)) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      if (!q.admin && chartKey !== q.clave) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
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
    const q = await quienPide();
    // Y para escribir: un closer o setter sólo toca sus chats.
    if (body.sessionId != null && !(await puedeAbrir(Number(body.sessionId), q))) {
      return Response.json({ error: 'sesión inexistente' }, { status: 404 });
    }
    if (action === 'open') {
      const sesiones = await listSessions(q.clave);
      if (sesiones.length > 0) {
        const s = sesiones[0];
        const mensajes = await getSessionMessages(s.id);
        if (mensajes.length > 0) return Response.json({ session: s, messages: mensajes, sessions: sesiones });
        // Sesión vacía (quedó a medias): MaKo saluda igual, así abrir el doer
        // SIEMPRE devuelve un primer mensaje sin tener que crear otra sesión.
        const resp = await responder(await buildDoerSystem({ titulo: s.titulo ?? titulo, query: s.titulo ?? titulo, admin: q.admin }), await buildMsgs([]));
        await appendMessage(s.id, 'assistant', resp);
        if (!s.titulo) { const t = await generarTitulo(resp); if (t) await renameSession(s.id, t); }
        return Response.json({ session: await getSession(s.id), messages: await getSessionMessages(s.id), sessions: await listSessions(q.clave) });
      }
      const id = await crearYSaludar(titulo, q);
      return Response.json({ session: await getSession(id), messages: await getSessionMessages(id), sessions: await listSessions(q.clave) });
    }

    if (action === 'new') {
      const id = await crearYSaludar(titulo, q);
      return Response.json({ session: await getSession(id), messages: await getSessionMessages(id), sessions: await listSessions(q.clave) });
    }

    if (action === 'send') {
      const { sessionId, mensaje } = body;
      if (!sessionId || !mensaje) return Response.json({ error: 'sessionId y mensaje requeridos' }, { status: 400 });
      const s = await getSession(sessionId);
      if (!s) return Response.json({ error: 'sesión inexistente' }, { status: 404 });
      const history = await getSessionMessages(sessionId);
      await appendMessage(sessionId, 'user', mensaje);
      const resp = await responder(await buildDoerSystem({ titulo: s.titulo ?? 'Chat', query: mensaje, admin: q.admin }), await buildMsgs(history, mensaje), mensaje);
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
