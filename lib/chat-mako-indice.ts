import 'server-only';

// =============================================================================
// El índice de los chats con MaKo — lo que lee el Second Brain, sin copiar nada (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 2. Dos lecturas:
//   · «Antes»: los chats que la persona tenía en «Pregúntale a MaKo» (/mako, que ahora redirige al Second Brain). Son
//     de chart-insights, sin herramientas: quedan de SÓLO LECTURA, con la MISMA regla de quién ve qué que tenía /mako
//     (`quienChateaDelRequest` + lib/chart-chats-reglas.ts) — el admin, los del workspace; los demás, los suyos.
//   · Los chats del Second Brain de una persona, para la API de MaKo (`listar_chats_mako`, `hilo_chat_mako`): se
//     leen desde la conversación del turno (`app:<id>` → su `chart_key` → su base `mako-movil:<persona>`), así que la
//     persona sale del dato y no de un parámetro que el modelo pueda cambiar.
// ⚠️ NADA SE COPIA: se lee de chart_sessions/chart_chats, donde ya está (el principio del grafo: una proyección).

import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import {
  esChatDelTelefono, getSession, getSessionMessages, listAllSessions, listSessions, listSessionsDePersona,
  type ChartMsg, type ChartSession,
} from '@/lib/chart-chats';
import { claveVisible, personaDeSesion, prefijoDePersona, puedeUsarSesion, type QuienChatea } from '@/lib/chart-chats-reglas';
import { TITULO_GRUPO, baseDeLaPersona } from '@/lib/chat-mako-reglas';
import { getGrupoJidMaKo } from '@/lib/mako-grupo';
import { hiloDelGrupo } from '@/lib/mako-doer-conv';
import type { MensajeChat } from '@/lib/mako-turno-app-reglas';

/** Quién pide: admin o no, y su persona (la regla de /mako y de chart-insights). null = sin sesión. */
export async function quienChateaDelRequest(): Promise<(QuienChatea & { sub: string }) | null> {
  const [rolWs, sesion] = await Promise.all([getRolWsEfectivo(), getUsuarioActual()]);
  if (!rolWs || !sesion) return null;
  const persona = personaDeSesion(sesion);
  return persona ? { admin: rolWs === 'admin', persona, sub: String(sesion.sub ?? '') } : null;
}

export type ChatDeAntes = { id: number; titulo: string | null; clave: string; updatedAt: string };

/** Las claves de los chats de /mako-doer (app/api/mako-doer/route.ts: el admin, la del workspace; los demás, la suya). */
const clavesDelDoer = (q: QuienChatea & { sub: string }) => (q.admin ? ['mako-doer'] : /^\d+$/.test(q.sub) ? [`mako-doer:u${q.sub}`] : []);

/** Lo que listaba «Pregúntale a MaKo» (+ los de /mako-doer), lo más reciente arriba. Nunca los del teléfono. */
export async function chatsDeAntes(q: QuienChatea & { sub: string }): Promise<ChatDeAntes[]> {
  const [deMako, ...delDoer] = await Promise.all([
    q.admin ? listAllSessions() : listSessionsDePersona(prefijoDePersona(q.persona)),
    ...clavesDelDoer(q).map((k) => listSessions(k)),
  ]);
  const todas = [...deMako, ...delDoer.flat()]
    .filter((s) => !esChatDelTelefono(s.chart_key))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const vistas = new Set<number>();
  return todas.filter((s) => (vistas.has(s.id) ? false : (vistas.add(s.id), true)))
    .map((s) => ({ id: s.id, titulo: s.titulo, clave: claveVisible(s.chart_key, q), updatedAt: s.updated_at }));
}

/** Un chat de antes, si es de quien pide (la misma regla de /mako). null = no existe o no es suyo: no se distingue. */
export async function hiloDeAntes(q: QuienChatea & { sub: string }, id: number): Promise<{ sesion: ChatDeAntes; mensajes: ChartMsg[] } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const s = await getSession(id);
  if (!s || esChatDelTelefono(s.chart_key)) return null;
  const delDoer = clavesDelDoer(q).includes(s.chart_key);
  if (!delDoer && !puedeUsarSesion(s.chart_key, q)) return null;
  return { sesion: { id: s.id, titulo: s.titulo, clave: claveVisible(s.chart_key, q), updatedAt: s.updated_at }, mensajes: await getSessionMessages(s.id) };
}

// ── Para la API de MaKo: los chats del Second Brain de la persona de ESTE turno ──────────────────────────────────

/** La sesión del turno y su base (`mako-movil:<persona>`), o null si no es un chat del Second Brain. */
async function baseDelTurno(sessionId: number): Promise<{ sesion: ChartSession; base: string } | null> {
  const s = await getSession(sessionId);
  const base = baseDeLaPersona(s?.chart_key);
  return s && base ? { sesion: s, base } : null;
}

/** Los chats del Second Brain de la persona del turno (el jefe y sus sub-chats). null = el turno no es de un chat suyo. */
export async function chatsDelSecondBrain(sessionIdDelTurno: number): Promise<ChartSession[] | null> {
  const t = await baseDelTurno(sessionIdDelTurno);
  return t ? listSessions(t.base) : null;
}

/** El hilo de UNO de sus chats (el `id` lo elige el modelo: se cruza con la base, y uno de otro no existe). */
export async function hiloDelSecondBrain(sessionIdDelTurno: number, id: number): Promise<{ sesion: ChartSession; mensajes: ChartMsg[] } | null> {
  const t = await baseDelTurno(sessionIdDelTurno);
  if (!t || !Number.isInteger(id) || id <= 0) return null;
  const s = await getSession(id);
  if (!s || s.chart_key !== t.base) return null;
  return { sesion: s, mensajes: await getSessionMessages(s.id) };
}

// ── El grupo de WhatsApp de MaKo (tanda 8, 16/10/2026): un chat más del índice, de SÓLO LECTURA y sólo del admin ─────
//
// ⚠️ SÓLO EL ADMIN: el grupo trae montos y leads (pii). El corte va acá, en el servidor; la pantalla ni lo pide.
// ⚠️ SÓLO EL GRUPO OFICIAL (`getGrupoJidMaKo`). Nunca se listan los `grupo_jid` distintos de `mako_doer_conv`: ahí
//    también caen los avisos al dueño con el jid del grupo SuperAdmin guardado con el workspace del cliente
//    (lib/avisos.ts) y, en el ws1, los grupos de prueba.
// ⚠️ SE MUESTRA Y NO VA A NINGÚN MODELO: no entra en `listar_chats_mako` ni en `hilo_chat_mako` (decisión 11 del plan
//    de la etapa 2). El jid no sale del servidor.

export type GrupoDeMaKo = { titulo: string; ultimoAt: string | null };

/** El grupo de MaKo del negocio, para la barra. null = no es admin, o el negocio no tiene grupo. */
export async function grupoDeMaKo(p: { ws: number; rol: 'admin' | 'miembro' }): Promise<GrupoDeMaKo | null> {
  if (p.rol !== 'admin') return null;
  const jid = await getGrupoJidMaKo(p.ws);
  if (!jid) return null;
  const { filas } = await hiloDelGrupo(p.ws, jid, { limite: 1 });
  return { titulo: TITULO_GRUPO, ultimoAt: filas[0]?.created_at ?? null };
}

/** Una página del hilo del grupo (las anteriores a `antes`). null = no es admin, o el negocio no tiene grupo. */
export async function hiloDelGrupoMaKo(
  p: { ws: number; rol: 'admin' | 'miembro' }, antes: string | null,
): Promise<{ mensajes: MensajeChat[]; hayMas: boolean } | null> {
  if (p.rol !== 'admin') return null;
  const jid = await getGrupoJidMaKo(p.ws);
  if (!jid) return null;
  const { filas, hayMas } = await hiloDelGrupo(p.ws, jid, { antes, limite: 60 });
  return { mensajes: filas.map((f) => ({ role: f.role, content: f.content, created_at: f.created_at })), hayMas };
}
