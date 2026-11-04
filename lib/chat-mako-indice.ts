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

import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { CLAVE_HISTORIAL, leerHistorial, sesionDelArranque, unirConOffer } from '@/lib/onboarding-historial';
import { getCapaActual, getRolWsEfectivo, getTenantDb, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { puedeVerKey } from '@/lib/movil-rutas';
import { leerConversacionOffer, listarSesionesOffer } from '@/lib/offer-sesiones';
import { urlAudio } from '@/lib/offer-reglas';
import { TITULO_HILO } from '@/lib/onboarding-arranque';
import { mensajesDeOffer, offerDelOnboardingCopiada, seEscondeDeOffer } from '@/lib/chat-mako-reglas';
import { getSetting } from '@/lib/settings';
import {
  esChatDelTelefono, getSession, getSessionMessages, listAllSessions, listSessions, listSessionsDePersona, temasDeSesiones,
  type ChartMsg, type ChartSession,
} from '@/lib/chart-chats';
import { claveVisible, pasaLaPuertaDeSuTab, personaDeSesion, prefijoDePersona, puedeUsarSesion, type QuienChatea } from '@/lib/chart-chats-reglas';
import { veCopywriter } from '@/lib/copywriter/puerta';
import { PREFIJO_TAB_REFERENTE, TITULO_GRUPO, baseDeLaPersona, claveDeEditor, mensajesDeAutomatizacion, mensajesDeEditor, origenDeClave, partesDeClaveDeEditor, referenteDeTab, temaDe, type GuruConCharla, type TipoEditor } from '@/lib/chat-mako-reglas';
import { hiloAlAbrir as hiloImagenAlAbrir } from '@/lib/image-editor/chat/hilo';
import { hiloAlAbrir as hiloVideoAlAbrir } from '@/lib/editor-video/chat-hilo';
import { leerChat as leerChatDeAutomatizacion, listarChats as listarChatsDeAutomations, secuenciaDelWorkspace } from '@/lib/automatizacion-chat-db';
import { getGrupoJidMaKo } from '@/lib/mako-grupo';
import { hiloDelGrupo } from '@/lib/mako-doer-conv';
import { chartKeyDePersona, type MensajeChat } from '@/lib/mako-turno-app-reglas';

/** Quién pide: admin o no, su persona (la regla de /mako y de chart-insights) y si pasa la puerta del Copywriter (las
 *  charlas de un guion, lib/chart-chats-reglas.ts). null = sin sesión. */
export async function quienChateaDelRequest(): Promise<(QuienChatea & { sub: string }) | null> {
  const [rolWs, sesion, copy] = await Promise.all([getRolWsEfectivo(), getUsuarioActual(), veCopywriter()]);
  if (!rolWs || !sesion) return null;
  const persona = personaDeSesion(sesion);
  return persona ? { admin: rolWs === 'admin', persona, veCopywriter: copy, sub: String(sesion.sub ?? '') } : null;
}

export type ChatDeAntes = { id: number; titulo: string | null; clave: string; updatedAt: string; origen?: string | null; tema?: string | null };

/** Los chats con su tema (lib/chart-chats.ts → temasDeSesiones): los sin título, para nombrarlos; todos, para distinguir dos
 *  que se llaman igual. Si no se puede leer, la lista sale igual, sin temas. */
export async function conTemas(chats: ChatDeAntes[]): Promise<ChatDeAntes[]> {
  const n = new Map<string, number>();
  for (const c of chats) if (c.titulo?.trim()) n.set(c.titulo.trim().toLowerCase(), (n.get(c.titulo.trim().toLowerCase()) ?? 0) + 1);
  const piden = chats.filter((c) => !c.titulo?.trim() || (n.get(c.titulo.trim().toLowerCase()) ?? 0) > 1).map((c) => c.id);
  if (!piden.length) return chats;
  const temas = await temasDeSesiones(piden).catch(() => new Map<number, string>());
  return chats.map((c) => (temas.has(c.id) ? { ...c, tema: temas.get(c.id) } : c));
}

/** Las claves de los chats de /mako-doer (app/api/mako-doer/route.ts: el admin, la del workspace; los demás, la suya). */
const clavesDelDoer = (q: QuienChatea & { sub: string }) => (q.admin ? ['mako-doer'] : /^\d+$/.test(q.sub) ? [`mako-doer:u${q.sub}`] : []);

/** Lo que listaba «Pregúntale a MaKo» (+ los de /mako-doer), lo más reciente arriba. Nunca los del teléfono. */
export async function chatsDeAntes(q: QuienChatea & { sub: string }): Promise<ChatDeAntes[]> {
  const [deMako, ...delDoer] = await Promise.all([
    q.admin ? listAllSessions() : listSessionsDePersona(prefijoDePersona(q.persona)),
    ...clavesDelDoer(q).map((k) => listSessions(k)),
  ]);
  const todas = [...deMako, ...delDoer.flat()]
    .filter((s) => !esChatDelTelefono(s.chart_key) && pasaLaPuertaDeSuTab(s.chart_key, q))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const vistas = new Set<number>();
  return todas.filter((s) => (vistas.has(s.id) ? false : (vistas.add(s.id), true)))
    .map((s) => ({ id: s.id, titulo: s.titulo, clave: claveVisible(s.chart_key, q), updatedAt: s.updated_at }));
}

/** La sesión de un chat de antes, si es de quien pide (la misma regla de /mako). null = no existe o no es suyo. */
async function sesionDeAntes(q: QuienChatea & { sub: string }, id: number): Promise<ChartSession | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const s = await getSession(id);
  if (!s || esChatDelTelefono(s.chart_key)) return null;
  const delDoer = clavesDelDoer(q).includes(s.chart_key);
  return delDoer || puedeUsarSesion(s.chart_key, q) ? s : null;
}

/** Un chat de antes, si es de quien pide (la misma regla de /mako). null = no existe o no es suyo: no se distingue. */
export async function hiloDeAntes(q: QuienChatea & { sub: string }, id: number): Promise<{ sesion: ChatDeAntes; mensajes: ChartMsg[] } | null> {
  const s = await sesionDeAntes(q, id);
  if (!s) return null;
  return { sesion: { id: s.id, titulo: s.titulo, clave: claveVisible(s.chart_key, q), updatedAt: s.updated_at }, mensajes: await getSessionMessages(s.id) };
}

/**
 * Un chat de antes se SIGUE en el Ops Center (21/10/2026, Martín: «las personas deberían poder continuar lo que quieran siempre
 * desde el Ops Center»; hasta ese día era de sólo lectura y se seguía «en uno nuevo»). Lo escrito va al turno de MaKo de
 * siempre (lib/mako-turno-app.ts → turnoApp), sobre ESA sesión: la ruta le pasa a la persona la clave de la sesión, y el
 * turno la reconoce como suya (`sesionDe` compara la clave). La regla de quién la ve es la misma de leerla (`sesionDeAntes`):
 * el admin, las del workspace; los demás, las suyas. null = no existe o no es suyo.
 */
export async function claveDeAntes(q: QuienChatea & { sub: string }, id: number): Promise<string | null> {
  return (await sesionDeAntes(q, id))?.chart_key ?? null;
}

// ── Los chats de las TABS de la persona (22/10/2026, OC4) ──────────────────────────────────────────────────────────────────
// El chat del CRM y el de la ficha de un lead guardan en chart_sessions con la clave de la persona y un sufijo
// (`mako-movil:<persona>:crm:<id>`, `:lead:<id>`). El Ops Center listaba por la clave EXACTA (listarSesiones) y «de antes» saca
// las del teléfono (`mako-movil:%`): esas 68 conversaciones del CRM no se veían en ningún lado. Ahora van en la lista con las de
// antes, y se SIGUEN igual: la ruta prueba la regla de antes y, si no, ésta (`claveDeTab`).
// ⚠️ EL PREFIJO LLEVA SU «:»: con `mako-movil:ana` a secas, el LIKE traería también las de `mako-movil:anabel`.

/** Los chats de las tabs de la persona (CRM, la ficha de un lead), con su origen dicho («CRM», «Ficha · Ana»). */
export async function chatsDeLasTabs(p: { ws: number; chartKey: string }): Promise<ChatDeAntes[]> {
  return runWithWorkspace(p.ws, async () => {
    const ss = (await listSessionsDePersona(`${p.chartKey}:`)).filter((s) => origenDeClave(s.chart_key));
    const leads = [...new Set(ss.map((s) => Number(/:lead:(\d+)$/.exec(s.chart_key)?.[1])).filter((n) => Number.isInteger(n) && n > 0))];
    const nombres = new Map<number, string>();
    if (leads.length) {
      const { data } = await (await getTenantDb()).from('leads').select('id, nombre').in('id', leads.slice(0, 200));
      for (const l of (data ?? []) as Array<{ id: number; nombre: string | null }>) if (l.nombre?.trim()) nombres.set(l.id, l.nombre.trim());
    }
    return ss.map((s) => {
      const lead = Number(/:lead:(\d+)$/.exec(s.chart_key)?.[1]);
      const origen = Number.isInteger(lead) && lead > 0 ? `Ficha · ${nombres.get(lead) ?? `lead ${lead}`}` : origenDeClave(s.chart_key);
      return { id: s.id, titulo: s.titulo, clave: s.chart_key.slice(p.chartKey.length + 1), updatedAt: s.updated_at, origen };
    });
  });
}

/** Los gurús con los que la persona ya habló (`…:referente-<id>`), para su historial en la barra. Sólo los suyos: la clave lleva su persona. */
export async function gurusConCharla(p: { ws: number; chartKey: string }): Promise<GuruConCharla[]> {
  return runWithWorkspace(p.ws, async () => {
    const ss = await listSessionsDePersona(`${p.chartKey}:${PREFIJO_TAB_REFERENTE}`);
    return ss.flatMap((s) => { const id = referenteDeTab(s.chart_key); return id ? [{ id, at: s.updated_at }] : []; });
  });
}

/** La clave de un chat de una tab de la persona, para seguirlo (el turno la reconoce como suya). null = no es suyo, o no es de una tab. */
export async function claveDeTab(p: { ws: number; chartKey: string }, id: number): Promise<string | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const s = await runWithWorkspace(p.ws, () => getSession(id));
  return s && s.chart_key.startsWith(`${p.chartKey}:`) && origenDeClave(s.chart_key) ? s.chart_key : null;
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

// ── Las conversaciones de las TABS en el Ops Center (20/10/2026): una proyección, sin copiar ─────────────────────────────
// Martín: «Revisa que el chat de OFFER no está llegando al Ops Center, eso está muy mal». Medido ese día: Offer guarda en
// `offer_sesiones` (por workspace) y el Ops Center leía sólo `chart_sessions` con la clave exacta `mako-movil:<persona>`:
// las 6 conversaciones de Offer (ws1 ×2, ws10, ws11, ws13, ws21) no se veían en ningún lado. Es la decisión 5 de
// docs/diseno-mako-ai-native.md: «Offer y Automations no se mudan: los lee un índice nuevo, sin copiar filas».
// ⚠️ CADA PROYECCIÓN DICE SU ORIGEN Y SU ALCANCE, para que las que siguen se enchufen igual: CRM (`:crm:%`, `:lead:%`),
//    Automations (`automatizacion.chat:*`) y el grupo. Offer es por WORKSPACE (no por persona): la ve quien ve la tab, con
//    la MISMA puerta que la tab (`puedeVerKey('offer', rol, capa)`); un closer o un setter sin Offer no la ve.
// ⚠️ Martín, mirando un ws como super admin, ve SUS chats de chart_sessions; lo de Offer, al ser del workspace, sí lo ve.

/** Las proyecciones del índice: de dónde sale cada chat que no vive en chart_sessions, a quién alcanza y su tab.
 *  ⚠️ `tab` es la clave de la PUERTA (lib/movil-rutas.ts → puedeVerKey), no el nombre: la de Automations es `setting` (con
 *  'automations', medido el 22/10, la puerta le dice que no a todos, el admin incluido, y no se listaría nada). */
export const PROYECCIONES = [
  { origen: 'offer', alcance: 'workspace', tab: 'offer' },
  { origen: 'automations', alcance: 'workspace', tab: 'setting' },
  // Los de los editores son por PERSONA (como los de antes): el admin ve los del negocio; los demás, los suyos (OC8).
  { origen: 'image-editor', alcance: 'persona', tab: 'image-editor' },
  { origen: 'video-editor', alcance: 'persona', tab: 'video-editor' },
] as const;
export type OrigenDeChat = (typeof PROYECCIONES)[number]['origen'];

export type ChatDeOffer = { id: number; titulo: string; updatedAt: string; origen: 'offer'; alcance: 'workspace'; tema?: string | null };

/** Lo primero que dijo la persona en cada conversación de Offer (sólo las que se llaman igual: el ws1 tiene dos «Mi oferta»). */
async function temasDeOffer(ids: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const { data } = await (await getTenantDb()).from('offer_sesiones').select('id, mensajes').in('id', ids.slice(0, 20));
  for (const r of (data ?? []) as Array<{ id: number; mensajes: unknown }>) {
    const ms = Array.isArray(r.mensajes) ? (r.mensajes as Array<{ de?: unknown; texto?: unknown }>) : [];
    const t = temaDe(String(ms.find((m) => m?.de === 'yo' && typeof m.texto === 'string' && m.texto.trim())?.texto ?? ''));
    if (t) out.set(r.id, t);
  }
  return out;
}

/** El workspace del pedido, si quien pide ve la tab de esa proyección (la puerta de la tab, la misma del teléfono). null = no la ve. */
async function wsSiVe(tab: (typeof PROYECCIONES)[number]['tab']): Promise<number | null> {
  const [rolWs, ws, capa] = await Promise.all([getRolWsEfectivo(), getWorkspaceActual(), getCapaActual().catch(() => null)]);
  return rolWs && ws != null && puedeVerKey(tab, rolWs, capa) ? ws : null;
}

/** Las conversaciones de Offer del negocio, la más reciente primero. [] = no ve la tab, o no hay. */
export async function chatsDeOffer(): Promise<ChatDeOffer[]> {
  const ws = await wsSiVe('offer');
  if (ws == null) return [];
  // La del onboarding, si quien pide ya tiene su chat «Onboarding» (lo copia hiloDelOnboarding), no se lista: saldría dos
  // veces. A los demás (el super admin mirando, otro admin) se les sigue listando, y a ella también si la siguió en Offer
  // después de la copia (`seEscondeDeOffer`).
  const [lista, arranque, sesion] = await runWithWorkspace(ws, () => Promise.all([listarSesionesOffer(), getSetting('onboarding.arranque').catch(() => null), getUsuarioActual()]));
  const copiada = offerDelOnboardingCopiada(arranque, sesion ? chartKeyDePersona(sesion) : null);
  // Para quien no tiene su chat «Onboarding» (el super admin mirando, otro admin), la del onboarding se llama así: trae el
  // arranque entero (`hiloDeOffer`). Martín, 21/10, ws21: «No veo el chat de ONBOARDING tampoco en el ws de Florencia».
  const delOnboarding = sesionDelArranque(arranque);
  const filas = lista.filter((s) => s.id > 0 && !seEscondeDeOffer(s, copiada)).map((s): ChatDeOffer => ({
    id: s.id, titulo: s.id === delOnboarding && !copiada ? TITULO_HILO : s.titulo, updatedAt: s.updatedAt, origen: 'offer', alcance: 'workspace',
  }));
  // Dos que se llaman igual se distinguen por su tema (lib/chat-mako-reglas.ts → listaDelCliente).
  const n = new Map<string, number>();
  for (const f of filas) n.set(f.titulo.trim().toLowerCase(), (n.get(f.titulo.trim().toLowerCase()) ?? 0) + 1);
  const repetidas = filas.filter((f) => (n.get(f.titulo.trim().toLowerCase()) ?? 0) > 1).map((f) => f.id);
  const temas = repetidas.length ? await runWithWorkspace(ws, () => temasDeOffer(repetidas)).catch(() => new Map<number, string>()) : new Map<number, string>();
  return filas.map((f) => (temas.has(f.id) ? { ...f, tema: temas.get(f.id) } : f));
}

// ── Automations (22/10/2026, OC5) ───────────────────────────────────────────────────────────────────────────────────
// La charla con MaKo del lienzo de cada automatización vive en app_settings (`automatizacion.chat:<id>`, lib/automatizacion-chat.ts)
// y nadie la proyectaba. Es por WORKSPACE, con la puerta de la tab (`setting`), y se LEE: se sigue en el lienzo (`rutaDelLienzo`,
// lib/chat-mako-reglas.ts), que es el que sabe editar la automatización.

export type ChatDeAutomatizacion = { id: number; titulo: string; updatedAt: string; origen: 'automations'; alcance: 'workspace' };

/** Las charlas del lienzo del negocio, la más reciente primero. [] = no ve la tab, no hay, o no se pudo leer. */
export async function chatsDeAutomations(): Promise<ChatDeAutomatizacion[]> {
  const ws = await wsSiVe('setting');
  if (ws == null) return [];
  const filas = await runWithWorkspace(ws, () => listarChatsDeAutomations(ws)).catch((e) => {
    console.warn(`[chat-mako-indice] ws=${ws}: no pude listar las charlas de Automations: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  });
  return filas.map((f) => ({ id: f.secuenciaId, titulo: f.nombre, updatedAt: f.updatedAt, origen: 'automations', alcance: 'workspace' }));
}

/** Una charla del lienzo, para leerla. null = no ve la tab, o la automatización no es de este negocio (no se distingue). */
export async function hiloDeAutomatizacion(id: number): Promise<{ sesion: ChatDeAutomatizacion; mensajes: MensajeChat[] } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const ws = await wsSiVe('setting');
  if (ws == null || !(await secuenciaDelWorkspace(ws, id))) return null;
  const [chat, filas] = await Promise.all([leerChatDeAutomatizacion(ws, id), runWithWorkspace(ws, () => listarChatsDeAutomations(ws, 200)).catch(() => [])]);
  const titulo = filas.find((f) => f.secuenciaId === id)?.nombre ?? `Automatización ${id}`;
  return {
    sesion: { id, titulo, updatedAt: chat.mensajes[chat.mensajes.length - 1]?.at ?? '', origen: 'automations', alcance: 'workspace' },
    mensajes: mensajesDeAutomatizacion(chat.mensajes),
  };
}

// ── Los chats del Image Editor y del Video Editor (22/10/2026, OC8) ───────────────────────────────────────────────
// Una fila por (negocio, persona, diseño o proyecto), en la base del inquilino; medido por TB2: sí guardan (hasta ese día nadie
// los había usado). Se LEEN: se siguen en el editor, que aplica lo que propone.

/** `propio`: es de quien mira. El editor abre el hilo de la persona de la sesión: el de otra persona se lee acá y no se «sigue» allá. */
export type ChatDeEditor = { tipo: TipoEditor; clave: string; titulo: string | null; updatedAt: string; propio: boolean };
const DE_EDITOR: Readonly<Record<TipoEditor, { tabla: string; col: string; tab: 'image-editor' | 'video-editor' }>> = {
  imagen: { tabla: 'image_editor_chats', col: 'diseno_id', tab: 'image-editor' },
  video: { tabla: 'video_editor_chats', col: 'proyecto_id', tab: 'video-editor' },
};

/** Los chats de los dos editores que ve quien pide, el más reciente primero. [] = no ve la tab, no hay, o no se pudo leer. */
export async function chatsDeLosEditores(q: QuienChatea & { sub: string }): Promise<ChatDeEditor[]> {
  const out: ChatDeEditor[] = [];
  for (const tipo of ['imagen', 'video'] as const) {
    const t = DE_EDITOR[tipo];
    const ws = await wsSiVe(t.tab);
    if (ws == null) continue;
    const filas = await runWithWorkspace(ws, async () => {
      let consulta = (await getTenantDb()).from(t.tabla).select(`persona, ${t.col}, nombre, updated_at`).eq('workspace_id', ws);
      if (!q.admin) consulta = consulta.eq('persona', q.persona);
      const { data, error } = await consulta.order('updated_at', { ascending: false }).limit(40);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Array<Record<string, unknown>>;
    }).catch((e) => {
      console.warn(`[chat-mako-indice] ws=${ws}: no pude listar los chats del ${tipo === 'imagen' ? 'Image' : 'Video'} Editor: ${e instanceof Error ? e.message : String(e)}`);
      return [] as Array<Record<string, unknown>>;
    });
    for (const f of filas) {
      const persona = typeof f.persona === 'string' ? f.persona : '';
      const id = typeof f[t.col] === 'string' ? (f[t.col] as string) : '';
      if (!persona || !id) continue;
      out.push({ tipo, clave: claveDeEditor(persona, id), titulo: typeof f.nombre === 'string' ? f.nombre : null, updatedAt: String(f.updated_at ?? ''), propio: persona === q.persona });
    }
  }
  return out;
}

/** Un chat de un editor, para leerlo. null = no ve la tab, no es suyo (y no es admin), o no existe: no se distingue. */
export async function hiloDeEditor(q: QuienChatea & { sub: string }, tipo: TipoEditor, clave: string): Promise<{ mensajes: MensajeChat[] } | null> {
  const partes = partesDeClaveDeEditor(clave);
  if (!partes) return null;
  if (!q.admin && partes.persona !== q.persona) return null;
  const t = DE_EDITOR[tipo];
  const ws = await wsSiVe(t.tab);
  if (ws == null) return null;
  const fila = await runWithWorkspace(ws, async () => {
    const { data } = await (await getTenantDb()).from(t.tabla).select('mensajes')
      .eq('workspace_id', ws).eq('persona', partes.persona).eq(t.col, partes.id).maybeSingle();
    return (data as { mensajes?: unknown } | null) ?? null;
  }).catch(() => null);
  if (!fila) return null;
  // Con el saneo de cada editor: lo que no se entiende se descarta y el resto se lee.
  const ms = tipo === 'imagen' ? hiloImagenAlAbrir(fila.mensajes) : hiloVideoAlAbrir(fila.mensajes);
  return { mensajes: mensajesDeEditor(ms) };
}

/**
 * Una conversación de Offer, para leerla en el Ops Center. null = no ve la tab, o no es de este negocio (no se distingue).
 * La del ONBOARDING trae alrededor las preguntas del arranque con sus respuestas (21/10/2026, Florencia, ws21: el super
 * admin la leía empezando en «¿Tienes un documento…?»), del historial guardado (lib/onboarding-historial.ts), por hora.
 * Para DIBUJAR: si el historial no se puede leer, se ve la conversación de Offer sola, como antes.
 */
export async function hiloDeOffer(id: number): Promise<{ sesion: ChatDeOffer; mensajes: MensajeChat[] } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const ws = await wsSiVe('offer');
  if (ws == null) return null;
  const [c, arranque, historial, superAdmin] = await runWithWorkspace(ws, () => Promise.all([
    leerConversacionOffer(id),
    getSetting('onboarding.arranque').catch(() => null),
    getSetting(CLAVE_HISTORIAL).catch(() => null),
    getSesionAdmin().catch(() => null),
  ]));
  if (!c) return null;
  // La nota de voz, con la URL de la ruta de Offer (que vuelve a mirar la puerta y el workspace): la ruta de Storage no sale.
  const deOffer = c.mensajes.map(({ audio, ...m }) => (audio ? { ...m, audio: { url: urlAudio(c.id, m.id), secs: audio.secs } } : m));
  const conversacion = sesionDelArranque(arranque) === c.id ? unirConOffer(leerHistorial(historial) ?? [], deOffer) : deOffer;
  return {
    sesion: { id: c.id, titulo: c.titulo, updatedAt: c.updatedAt, origen: 'offer', alcance: 'workspace' },
    mensajes: mensajesDeOffer(conversacion, { avisoReconstruido: !!superAdmin }),
  };
}
