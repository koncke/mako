// =============================================================================
// /api/chart-insights — chat de MaKo por gráfico, con sesiones
// =============================================================================
// GET ?sessionId=N | ?chartKey=K[&archived=1] | ?all=1[&archived=1]
// POST { action: open|new|send|rename|pin|archive|delete, ... }
// El primer mensaje SIEMPRE es del assistant. MaKo nunca termina con una pregunta.
// El título lo pone la IA (auto) y se puede editar/pinear/archivar/eliminar.
//
// ⛔ DE QUIÉN ES CADA CHAT (auditoría del 16/10/2026, docs/hallazgos-seguridad.md): la ruta abría cualquier sesión del
//    workspace por id (correlativos), listaba todas con `?all=1`, y armaba el system con los montos del trimestre para
//    cualquiera. Un closer o setter en /mako leía lo que el dueño habló con MaKo y recibía la plata del trimestre. Ahora,
//    la regla del doer (/api/mako-doer, `quienPide`): los chats de un admin son del workspace; los de los demás, SUYOS
//    (lib/chart-chats-reglas.ts), y a quien no le corresponde, 404. Y el system va sin los números del negocio para quien
//    no es admin (`sinNumerosDelNegocio`), en los TRES lugares donde se arma, como el teléfono (lib/mako-turno-app.ts).

import type { NextRequest } from 'next/server';
import { chatClaude, type ClaudeMsg } from '@/lib/anthropic';
import { chatCheapCascade } from '@/lib/ai-cheap';
import {
  createSession, getSession, listSessions, listAllSessions, listSessionsDePersona, getSessionMessages, appendMessage,
  renameSession, setPinned, setArchived, deleteSession, esChatDelTelefono, esSesionDelTelefono, type ChartMsg, type ChartSession,
} from '@/lib/chart-chats';
import {
  claveGuardada, claveLogica, claveVisible, personaDeSesion, prefijoDePersona, puedeUsarSesion, type QuienChatea,
} from '@/lib/chart-chats-reglas';
import { buildSystemPrompt } from '@/lib/mako-context';
import { getPromptText } from '@/lib/prompt-render';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { CHART_PROMPT_ANALISIS_DEFAULT, CHART_PROMPT_SALUDO_DEFAULT, CHART_TITULO_DEFAULT } from '@/lib/prompt-defaults';

export const dynamic = 'force-dynamic';

const NO_EXISTE = () => Response.json({ error: 'sesión inexistente' }, { status: 404 });
const SIN_SESION = () => Response.json({ error: 'Tu sesión venció.' }, { status: 401 });

/** Quién pide: admin o no, y su persona (lib/chart-chats-reglas.ts). null = sin sesión. */
async function quienPide(): Promise<QuienChatea | null> {
  const [rolWs, sesion] = await Promise.all([getRolWsEfectivo(), getUsuarioActual()]);
  if (!rolWs || !sesion) return null;
  const persona = personaDeSesion(sesion);
  return persona ? { admin: rolWs === 'admin', persona } : null;
}

/** Una sesión como la ve la pantalla: con la clave de siempre, sin el prefijo de quien pide. */
const paraPantalla = (q: QuienChatea) => (s: ChartSession): ChartSession => ({ ...s, chart_key: claveVisible(s.chart_key, q) });

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

// Título corto generado por la IA (tarea simple → modelo barato, con fallback a
// Claude si no hay proveedor barato o falla). No necesita la cabeza de Opus.
async function generarTitulo(seed: string): Promise<string | null> {
  try {
    const sys = await getPromptText('chart_insights.titulo_generation', CHART_TITULO_DEFAULT);
    const user = seed.slice(0, 1500);
    let t: string;
    // Cascada: titular es lo más barato que hace la app, y caer a Claude porque un
    // proveedor tiró 429 es pagar Opus por escribir siete palabras.
    t = await chatCheapCascade({ system: sys, user, maxTokens: 30, feature: 'Título de chat', motivo: 'Generar título de sesión' });
    if (!t.trim()) t = await chatClaude(sys, [{ role: 'user', content: user }], { thinking: false, maxTokens: 30, feature: 'mako-chat' });
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

/** `clave` es la GUARDADA (la de la persona, si no es admin); el system mira la de siempre (`claveLogica`). */
async function crearYAnalizar(clave: string, titulo: string, contexto: string, q: QuienChatea) {
  const s = await createSession(clave, null, contexto);
  const query = `${titulo}\n${contexto}`.slice(0, 2000);
  const resp = await chatClaude(await buildSystemPrompt({ chartKey: claveLogica(clave), titulo, contexto, query, sinNumerosDelNegocio: !q.admin }), await buildMsgs(contexto, []), { feature: 'mako-chat' });
  await appendMessage(s.id, 'assistant', resp);
  const t = await generarTitulo(await seedTitulo(contexto, resp));
  if (t) await renameSession(s.id, t);
  return s.id;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const arch = !!sp.get('archived');
  try {
    const q = await quienPide();
    if (!q) return SIN_SESION();
    const ver = paraPantalla(q);
    // La lista: el admin, las del workspace; los demás, las SUYAS.
    if (sp.get('all')) {
      return Response.json({ sessions: (q.admin ? await listAllSessions(arch) : await listSessionsDePersona(prefijoDePersona(q.persona), arch)).map(ver) });
    }
    const sessionId = sp.get('sessionId');
    // ⚠️ Un chat del TELÉFONO es de UNA persona: por esta ruta no se abre ni se lista (lib/chart-chats.ts,
    // `esSesionDelTelefono`). Y uno de escritorio, sólo si es de quien pide o si es admin.
    if (sessionId) {
      if (await esSesionDelTelefono(Number(sessionId))) return NO_EXISTE();
      const s = await getSession(Number(sessionId));
      if (!s || !puedeUsarSesion(s.chart_key, q)) return NO_EXISTE();
      return Response.json({ messages: await getSessionMessages(Number(sessionId)) });
    }
    const chartKey = sp.get('chartKey');
    if (chartKey) {
      if (esChatDelTelefono(chartKey)) return NO_EXISTE();
      const guardada = claveGuardada(chartKey, q);
      if (!guardada) return NO_EXISTE();
      return Response.json({ sessions: (await listSessions(guardada, arch)).map(ver) });
    }
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
    // Ni abrir/crear con la clave de un chat del teléfono, ni send/rename/pin/archive/delete
    // sobre uno de sus ids: son de UNA persona (lib/chart-chats.ts, `esSesionDelTelefono`).
    if (chartKey && esChatDelTelefono(chartKey)) return NO_EXISTE();
    if (body.sessionId != null && (await esSesionDelTelefono(Number(body.sessionId)))) return NO_EXISTE();
    // Y de escritorio, sólo lo de quien pide (o todo, si es admin): por clave y por id, ANTES de cualquier acción.
    const q = await quienPide();
    if (!q) return SIN_SESION();
    const ver = paraPantalla(q);
    const clave = chartKey ? claveGuardada(chartKey, q) : null;
    if (chartKey && !clave) return NO_EXISTE();
    if (body.sessionId != null) {
      const s = await getSession(Number(body.sessionId));
      if (!s || !puedeUsarSesion(s.chart_key, q)) return NO_EXISTE();
    }

    if (action === 'open') {
      if (!clave) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
      const sesiones = await listSessions(clave);
      if (sesiones.length > 0) {
        const s = sesiones[0];
        const mensajes = await getSessionMessages(s.id);
        if (mensajes.length > 0) {
          return Response.json({ session: ver(s), messages: mensajes, sessions: sesiones.map(ver) });
        }
        // Sesión vacía (quedó a medias por un error previo): MaKo arranca igual,
        // así abrir un gráfico SIEMPRE devuelve su análisis sin tener que crear chat.
        const ctx = s.contexto ?? contexto;
        const query = `${s.titulo ?? titulo}\n${ctx}`.slice(0, 2000);
        const resp = await chatClaude(await buildSystemPrompt({ chartKey: claveLogica(clave), titulo: s.titulo ?? titulo, contexto: ctx, query, sinNumerosDelNegocio: !q.admin }), await buildMsgs(ctx, []), { feature: 'mako-chat' });
        await appendMessage(s.id, 'assistant', resp);
        if (!s.titulo) {
          const t = await generarTitulo(await seedTitulo(ctx, resp));
          if (t) await renameSession(s.id, t);
        }
        const actual = await getSession(s.id);
        return Response.json({ session: actual ? ver(actual) : null, messages: await getSessionMessages(s.id), sessions: (await listSessions(clave)).map(ver) });
      }
      const id = await crearYAnalizar(clave, titulo, contexto, q);
      const s = await getSession(id);
      return Response.json({ session: s ? ver(s) : null, messages: await getSessionMessages(id), sessions: (await listSessions(clave)).map(ver) });
    }

    if (action === 'new') {
      if (!clave) return Response.json({ error: 'chartKey requerido' }, { status: 400 });
      const id = await crearYAnalizar(clave, titulo, contexto, q);
      const s = await getSession(id);
      return Response.json({ session: s ? ver(s) : null, messages: await getSessionMessages(id), sessions: (await listSessions(clave)).map(ver) });
    }

    if (action === 'send') {
      const { sessionId, mensaje } = body;
      if (!sessionId || !mensaje) return Response.json({ error: 'sessionId y mensaje requeridos' }, { status: 400 });
      const s = await getSession(sessionId);
      if (!s) return NO_EXISTE();
      const ctx = s.contexto ?? '';
      const history = await getSessionMessages(sessionId);
      await appendMessage(sessionId, 'user', mensaje);
      const resp = await chatClaude(await buildSystemPrompt({ chartKey: claveLogica(s.chart_key), titulo: s.titulo ?? 'Chat', contexto: ctx, query: mensaje, sinNumerosDelNegocio: !q.admin }), await buildMsgs(ctx, history, mensaje), { feature: 'mako-chat' });
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
