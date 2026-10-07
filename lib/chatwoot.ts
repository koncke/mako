// =============================================================================
// Chatwoot — envío de WhatsApp (templates) para la nutrición del VSL funnel
// =============================================================================
// La app le pega directo a la API de Chatwoot (mismo inbox que ya usa Mauricio:
// "Whatsapp Mauricio", inbox 3, +5216863996369). Flujo calcado del n8n de
// recordatorios (probado en producción):
//   1) buscar/crear contacto por teléfono
//   2) crear conversación (contact_id + inbox_id)
//   3) POST mensaje con template_params
//
// Fuera de la ventana de servicio de 24h, WhatsApp SOLO permite plantillas
// APROBADAS en Meta. Los templates de nutrición hay que darlos de alta antes
// de poder enviarlos. Config en .env.local: CHATWOOT_BASE_URL / _ACCOUNT_ID /
// _API_TOKEN / _WA_INBOX_ID.
// =============================================================================

import 'server-only';
import { credWs, credWsEstricta } from './credenciales';
import { getWorkspaceActual, OWNER_WS } from './workspace';
import { upsertRouting, wsPorIdentificadorEstricto } from './webhook-routing';
import { APP_BASE_URL } from './app-url';

// `inbox` es `null` cuando el workspace no lo declaró. Antes caía a `3`, y ese número decide
// POR QUÉ LÍNEA sale un mensaje y DE QUÉ bandeja se listan las conversaciones: un default
// ahí no es una comodidad, es mandar por el WhatsApp de otro sin que nada lo diga. Se lee
// siempre por `inboxWA(c)`, que falla con el motivo. Medido el 06/10/2026: los dos
// workspaces con Chatwoot (ws1 y ws4) lo tienen declarado, así que no le rompe nada a nadie.
type Cfg = { apiBase: string; token: string; inbox: number | null };

/** El inbox de WhatsApp del workspace, o un error que dice qué falta. */
function inboxWA(c: Cfg): number {
  if (c.inbox == null) {
    throw new Error('Falta el ID del inbox de WhatsApp (CHATWOOT_WA_INBOX_ID): sin eso no se sabe por qué línea sale el mensaje.');
  }
  return c.inbox;
}

async function cfg(): Promise<Cfg> {
  const [base, account, token, inboxRaw] = await Promise.all([
    credWs('CHATWOOT_BASE_URL'), credWs('CHATWOOT_ACCOUNT_ID'),
    credWs('CHATWOOT_API_TOKEN'), credWs('CHATWOOT_WA_INBOX_ID'),
  ]);
  const n = Number((inboxRaw ?? '').trim());
  const inbox = Number.isInteger(n) && n > 0 ? n : null;
  if (!base || !account || !token) {
    throw new Error('Chatwoot no configurado (CHATWOOT_BASE_URL / _ACCOUNT_ID / _API_TOKEN)');
  }
  return { apiBase: `${base.replace(/\/$/, '')}/api/v1/accounts/${account}`, token, inbox };
}

/** ¿El workspace tiene Chatwoot configurado? (sin tirar si falta). */
export async function chatwootConfigurado(): Promise<boolean> {
  try { await cfg(); return true; } catch { return false; }
}

function authHeaders(token: string): Record<string, string> {
  return { api_access_token: token, 'Content-Type': 'application/json' };
}

function normalizarTel(p: string): string {
  return (p || '').replace(/[\s\-().]/g, '');
}

async function cwFetch<T>(url: string, init: RequestInit, token: string): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(token), ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* deja body como texto */
  }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body.slice(0, 160) : JSON.stringify(body).slice(0, 160);
    throw new Error(`Chatwoot ${res.status}: ${msg}`);
  }
  return body as T;
}

// ── Contacto ─────────────────────────────────────────────────────────────────
type Contacto = { id?: number; phone_number?: string };
type ContactsResp = {
  payload?: Contacto[] | { contacts?: Contacto[]; results?: Contacto[] };
};
type CreateContactResp = { payload?: { contact?: Contacto; id?: number }; id?: number };

async function buscarContacto(c: Cfg, phone: string): Promise<number | null> {
  const r = await cwFetch<ContactsResp>(
    `${c.apiBase}/contacts/search?q=${encodeURIComponent(phone)}`,
    { method: 'GET' },
    c.token,
  );
  const p = r.payload;
  const list: Contacto[] = Array.isArray(p) ? p : (p?.contacts ?? p?.results ?? []);
  const norm = normalizarTel(phone);
  const found = list.find((x) => normalizarTel(x.phone_number ?? '') === norm);
  return found?.id ?? null;
}

async function buscarOCrearContacto(c: Cfg, phone: string, name: string): Promise<number> {
  const tel = normalizarTel(phone);
  if (!tel) throw new Error('teléfono vacío');

  const existente = await buscarContacto(c, tel);
  if (existente) return existente;

  try {
    const r = await cwFetch<CreateContactResp>(
      `${c.apiBase}/contacts`,
      { method: 'POST', body: JSON.stringify({ phone_number: tel, name }) },
      c.token,
    );
    const cid = r.payload?.contact?.id ?? r.payload?.id ?? r.id;
    if (cid) return cid;
  } catch {
    /* el create puede fallar si el número ya existe → reintentamos search */
  }

  const reintento = await buscarContacto(c, tel);
  if (!reintento) throw new Error(`no se pudo crear/encontrar contacto ${tel}`);
  return reintento;
}

// ── Conversación ─────────────────────────────────────────────────────────────
type ConvResp = { id?: number; payload?: { id?: number } };

async function crearConversacion(c: Cfg, contactId: number): Promise<number> {
  const r = await cwFetch<ConvResp>(
    `${c.apiBase}/conversations`,
    { method: 'POST', body: JSON.stringify({ contact_id: contactId, inbox_id: inboxWA(c) }) },
    c.token,
  );
  const id = r.id ?? r.payload?.id;
  if (!id) throw new Error('Chatwoot: conversación sin id');
  return id;
}

// ── API pública: enviar un template de WhatsApp ──────────────────────────────
export type WhatsappTemplate = {
  name: string;                        // template aprobado en Meta (ej. 'nutricion_dia1')
  category: 'marketing' | 'utility' | 'authentication';
  language: string;                    // ej. 'es_MX'
  bodyParams: Record<string, string>;  // variables del cuerpo → processed_params.body
};

export type SendResult =
  | { ok: true; conversationId: number }
  | { ok: false; error: string };

/**
 * Envía un template de WhatsApp a un teléfono vía Chatwoot. Crea/reusa el
 * contacto y la conversación. `content` es el texto renderizado (lo que se ve
 * en el inbox); `template` son los datos que Meta exige para el envío.
 */
export async function sendWhatsappTemplate(params: {
  phone: string;
  name: string;
  content: string;
  template: WhatsappTemplate;
}): Promise<SendResult> {
  try {
    const c = await cfg();
    await ensureTemplateSynced(c, params.template.name);
    const contactId = await buscarOCrearContacto(c, params.phone, params.name);
    const conversationId = await crearOReusarConversacion(c, contactId);
    await cwFetch(
      `${c.apiBase}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: params.content,
          message_type: 'outgoing',
          template_params: {
            name: params.template.name,
            category: params.template.category,
            language: params.template.language,
            processed_params: { body: params.template.bodyParams },
          },
        }),
      },
      c.token,
    );
    return { ok: true, conversationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Inbox: leer conversaciones y mensajes, responder texto libre ─────────────
// Para la tab /whatsapp de la app. El envío de texto libre solo es válido dentro
// de la ventana de 24h del lead; fuera de eso hay que usar sendWhatsappTemplate.

export type ChatwootConversation = {
  id: number;
  contactId: number;
  contacto: string;
  telefono: string | null;
  avatar: string | null;     // foto de perfil del contacto (meta.sender.thumbnail)
  ultimoMensaje: string | null;
  ultimaActividad: number | null;
  sinLeer: number;
  ultimoEntrante: boolean;   // el último mensaje real es entrante (type 0) → señal de "nuevo"
  estado: string;
  puedeResponder: boolean;   // can_reply de Chatwoot = ventana de 24h abierta
  bloqueado: boolean;        // contacto bloqueado en Chatwoot (meta.sender.blocked)
};

type ConvRaw = {
  id?: number;
  unread_count?: number;
  status?: string;
  last_activity_at?: number;
  can_reply?: boolean;
  // message_type: 0=entrante 1=saliente 2=actividad(sistema) 3=plantilla(saliente)
  messages?: Array<{ content?: string | null; message_type?: number }>;
  meta?: { sender?: { id?: number; name?: string; phone_number?: string; thumbnail?: string; avatar_url?: string; blocked?: boolean } };
};
type ConvListResp = { data?: { payload?: ConvRaw[]; meta?: { all_count?: number } }; payload?: ConvRaw[] };

function mapConv(cv: ConvRaw): ChatwootConversation {
  const msgs = cv.messages ?? [];
  const last = msgs.length ? msgs[msgs.length - 1] : undefined;
  // Último mensaje "real" ignorando actividades de sistema (type 2), para que la
  // dirección no la enmascare un evento como "conversación resuelta".
  const real = [...msgs].reverse().find((m) => m.message_type !== 2) ?? last;
  return {
    id: cv.id ?? 0,
    contactId: cv.meta?.sender?.id ?? 0,
    contacto: cv.meta?.sender?.name ?? 'Sin nombre',
    telefono: cv.meta?.sender?.phone_number ?? null,
    avatar: cv.meta?.sender?.thumbnail || cv.meta?.sender?.avatar_url || null,
    ultimoMensaje: real?.content ?? last?.content ?? null,
    ultimaActividad: cv.last_activity_at ?? null,
    sinLeer: cv.unread_count ?? 0,
    ultimoEntrante: (real?.message_type ?? 1) === 0,
    estado: cv.status ?? 'open',
    puedeResponder: cv.can_reply !== false,
    bloqueado: cv.meta?.sender?.blocked ?? false,
  };
}

// Trae TODAS las conversaciones del inbox paginando (las páginas extra en
// paralelo para que no sea lento). Chatwoot devuelve ~25 por página.
export async function listConversations(maxPages = 12): Promise<ChatwootConversation[]> {
  const c = await cfg();
  const url = (page: number) =>
    `${c.apiBase}/conversations?inbox_id=${inboxWA(c)}&status=all&assignee_type=all&page=${page}`;

  const first = await cwFetch<ConvListResp>(url(1), { method: 'GET' }, c.token);
  const firstPayload = first.data?.payload ?? first.payload ?? [];
  const all: ChatwootConversation[] = firstPayload.map(mapConv);

  const allCount = first.data?.meta?.all_count ?? all.length;
  const pages = Math.min(maxPages, Math.max(1, Math.ceil(allCount / 25)));
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        cwFetch<ConvListResp>(url(i + 2), { method: 'GET' }, c.token).catch(() => ({}) as ConvListResp),
      ),
    );
    for (const p of rest) {
      const pl = p.data?.payload ?? p.payload ?? [];
      for (const cv of pl) all.push(mapConv(cv));
    }
  }
  return all;
}

export type AdjuntoWA = { tipo: string; url: string; ext: string | null };

export type ChatwootMessage = {
  id: number;
  texto: string | null;
  saliente: boolean;
  fecha: number | null;
  template: string | null;
  status: string | null;   // sent | delivered | read | failed
  error: string | null;    // motivo si falló
  adjuntos: AdjuntoWA[];   // imágenes/audios/archivos del mensaje
  /** message_type crudo de Chatwoot: 0 entrante · 1 saliente · 2 actividad (sistema) · 3 plantilla (saliente). */
  messageType: number;
};

type MsgRaw = {
  id?: number;
  content?: string | null;
  message_type?: number; // 0 incoming · 1 outgoing
  created_at?: number;
  status?: string;
  content_attributes?: { template_params?: { name?: string }; external_error?: string };
  attachments?: Array<{ file_type?: string; data_url?: string; thumb_url?: string; extension?: string }>;
};
type MsgListResp = { payload?: MsgRaw[] };

export async function getMessages(conversationId: number): Promise<ChatwootMessage[]> {
  const c = await cfg();
  const r = await cwFetch<MsgListResp>(
    `${c.apiBase}/conversations/${conversationId}/messages`,
    { method: 'GET' },
    c.token,
  );
  return (r.payload ?? []).map((m) => ({
    id: m.id ?? 0,
    texto: m.content ?? null,
    saliente: m.message_type === 1,
    messageType: m.message_type ?? 0,
    fecha: m.created_at ?? null,
    template: m.content_attributes?.template_params?.name ?? null,
    status: m.status ?? null,
    error: m.content_attributes?.external_error ?? null,
    adjuntos: (m.attachments ?? [])
      .map((a) => ({ tipo: a.file_type ?? 'file', url: a.data_url ?? a.thumb_url ?? '', ext: a.extension ?? null }))
      .filter((a) => a.url),
  }));
}

export async function sendText(conversationId: number, content: string): Promise<SendResult> {
  try {
    const c = await cfg();
    await cwFetch(
      `${c.apiBase}/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content, message_type: 'outgoing' }) },
      c.token,
    );
    return { ok: true, conversationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Vista por contacto (un hilo por persona, no por conversación) ────────────
// Chatwoot crea una conversación por interacción (los recordatorios de n8n
// generan varias por contacto). Para el inbox agrupamos por contacto y
// mergeamos los mensajes de todas sus conversaciones.

type ContactConvsResp = {
  payload?: Array<{ id?: number; status?: string; last_activity_at?: number; inbox_id?: number }>;
};
type ContactConv = { id: number; status: string; last_activity_at: number; inboxId: number | null };

async function contactConversaciones(c: Cfg, contactId: number): Promise<ContactConv[]> {
  const r = await cwFetch<ContactConvsResp>(
    `${c.apiBase}/contacts/${contactId}/conversations`,
    { method: 'GET' },
    c.token,
  );
  return (r.payload ?? [])
    .filter((x): x is NonNullable<ContactConvsResp['payload']>[number] & { id: number } => typeof x.id === 'number')
    .map((x) => ({
      id: x.id,
      status: x.status ?? 'open',
      last_activity_at: x.last_activity_at ?? 0,
      inboxId: typeof x.inbox_id === 'number' ? x.inbox_id : null,
    }));
}

// ── Guard: el contacto pertenece al inbox de WhatsApp ────────────────────────
// Los endpoints internos reciben el contactId CRUDO de la URL. El gate de la
// app es una contraseña COMPARTIDA, así que sin esto cualquiera con la sesión
// podría leer/mandar WhatsApp a CUALQUIER contacto de la cuenta de Chatwoot
// (incluidos contactos de otros inboxes). Exigimos que el contacto tenga al
// menos una conversación en CHATWOOT_WA_INBOX_ID — que es exactamente como el
// inbox de la app expone a los contactos (listConversations filtra por inbox).
export async function contactoEnInboxWA(contactId: number): Promise<boolean> {
  if (!Number.isInteger(contactId) || contactId <= 0) return false;
  const c = await cfg();
  const convs = await contactConversaciones(c, contactId);
  return convs.some((cv) => cv.inboxId === inboxWA(c));
}

// ── Bloquear / desbloquear contacto (lo mismo que el botón del dashboard) ─────
export type BlockResult = { ok: true; blocked: boolean } | { ok: false; error: string };

export async function blockContact(contactId: number, blocked: boolean): Promise<BlockResult> {
  try {
    const c = await cfg();
    await cwFetch(
      `${c.apiBase}/contacts/${contactId}/${blocked ? 'block' : 'unblock'}`,
      { method: 'POST', body: JSON.stringify({}) },
      c.token,
    );
    return { ok: true, blocked };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Marcar como leído (limpia unread_count vía update_last_seen) ──────────────
export async function markConversationRead(conversationId: number): Promise<void> {
  const c = await cfg();
  await cwFetch(
    `${c.apiBase}/conversations/${conversationId}/update_last_seen`,
    { method: 'POST', body: JSON.stringify({}) },
    c.token,
  ).catch(() => {});
}

// Marca leídas TODAS las conversaciones de un contacto (la app agrupa por persona).
export async function markContactRead(contactId: number): Promise<void> {
  const c = await cfg();
  const convs = await contactConversaciones(c, contactId).catch(() => [] as ContactConv[]);
  await Promise.all(convs.map((cv) => markConversationRead(cv.id)));
}

// Conversación abierta del contacto (o la más reciente, o una nueva).
async function crearOReusarConversacion(c: Cfg, contactId: number): Promise<number> {
  try {
    // ⚠️ SÓLO LAS DE ESTE INBOX. Un contacto de Chatwoot puede tener conversaciones en varias
    // bandejas (otro canal, otra línea); reusar la primera abierta mandaba el mensaje por la
    // que el negocio no eligió, y el envío volvía «ok» igual. Lo encontró el relevo de la capa
    // de notificaciones del 06/10/2026; los otros dos lectores del archivo ya filtraban así.
    const inbox = inboxWA(c);
    const propias = (await contactConversaciones(c, contactId)).filter((x) => x.inboxId === inbox);
    if (propias.length) {
      const abierta = propias.find((x) => x.status === 'open');
      const elegida = abierta ?? propias.sort((a, b) => b.last_activity_at - a.last_activity_at)[0];
      if (elegida) return elegida.id;
    }
  } catch {
    /* si falla el lookup, creamos una nueva */
  }
  return crearConversacion(c, contactId);
}

// Todos los mensajes de un contacto (merge de sus conversaciones, cronológico).
export async function getContactMessages(contactId: number): Promise<ChatwootMessage[]> {
  const c = await cfg();
  const convs = await contactConversaciones(c, contactId);
  const arrays = await Promise.all(convs.map((cv) => getMessages(cv.id).catch(() => [] as ChatwootMessage[])));
  return arrays.flat().sort((a, b) => (a.fecha ?? 0) - (b.fecha ?? 0));
}

// Mensajes mergeados de una LISTA de conversaciones (para agrupar por persona
// cuando Chatwoot tiene varios contactos del mismo teléfono). Cap a las ~15 más
// recientes (los convIds vienen recent-first) para no hacer 40 fetches por hilo.
export async function getMessagesForConvs(ids: number[]): Promise<ChatwootMessage[]> {
  // Solo las 4 conversaciones MÁS RECIENTES (vienen ordenadas recent-first): los
  // mensajes actuales viven en la última conversación. Bajar de 15→4 hace que abrir
  // un chat sea ~4x más rápido (cada getMessages a Chatwoot tarda ~0.8s).
  const recientes = ids.slice(0, 6);
  const arrays = await Promise.all(recientes.map((id) => getMessages(id).catch(() => [] as ChatwootMessage[])));
  return arrays.flat().sort((a, b) => (a.fecha ?? 0) - (b.fecha ?? 0));
}

// Responde texto libre al contacto (reusa su conversación abierta). Solo llega
// si está dentro de la ventana de 24h del lead.
export async function sendToContact(contactId: number, content: string): Promise<SendResult> {
  try {
    const c = await cfg();
    const conversationId = await crearOReusarConversacion(c, contactId);
    return await sendText(conversationId, content);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Alta automática de contacto para leads nuevos ────────────────────────────
// Cuando entra un lead con teléfono le creamos el contacto en Chatwoot y una
// conversación (vacía) en el inbox de WhatsApp. Así el 100% de los leads tiene
// su chat en /whatsapp aunque nadie haya escrito, y el deep-link de la ficha
// nunca cae en el chat de otra persona. Silencioso por diseño: un fallo acá
// jamás debe romper el alta del lead.
export async function ensureContactoWhatsapp(
  nombre: string,
  telefono: string | null | undefined,
): Promise<number | null> {
  try {
    const tel = normalizarTel(telefono ?? '');
    if (tel.replace(/\D/g, '').length < 8) return null;
    const c = await cfg();
    const contactId = await buscarOCrearContacto(c, tel, nombre);
    const convs = await contactConversaciones(c, contactId).catch(() => [] as ContactConv[]);
    if (!convs.some((cv) => cv.inboxId === inboxWA(c))) {
      await crearConversacion(c, contactId);
    }
    return contactId;
  } catch (err) {
    console.error(`[chatwoot] ensureContactoWhatsapp falló: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// contactId de Chatwoot para un teléfono, matcheando por últimos 10 dígitos
// (igual que el inbox de la app: absorbe variantes de país tipo 52 vs 521).
export async function contactoIdPorTelefono(telefono: string): Promise<number | null> {
  try {
    const digits = (telefono || '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    const q = digits.slice(-10);
    const c = await cfg();
    const r = await cwFetch<ContactsResp>(
      `${c.apiBase}/contacts/search?q=${encodeURIComponent(q)}`,
      { method: 'GET' },
      c.token,
    );
    const p = r.payload;
    const list: Contacto[] = Array.isArray(p) ? p : (p?.contacts ?? p?.results ?? []);
    const found = list.find((x) => (x.phone_number ?? '').replace(/\D/g, '').slice(-10) === q);
    return found?.id ?? null;
  } catch {
    return null;
  }
}

// Envía texto LIBRE a un teléfono (crea/reusa contacto + conversación). Solo llega
// dentro de la ventana de 24h; fuera de ella Chatwoot/Meta lo rechaza y devuelve
// { ok: false } (el caller lo trata como "ventana cerrada"). Se usa para mandarle
// los reportes a Mauricio una vez que abrió la ventana respondiendo el template.
export async function sendTextToPhone(phone: string, name: string, content: string): Promise<SendResult> {
  try {
    const c = await cfg();
    const contactId = await buscarOCrearContacto(c, phone, name);
    const conversationId = await crearOReusarConversacion(c, contactId);
    return await sendText(conversationId, content);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const EXT_POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/3gpp': '.3gp',
  'audio/mpeg': '.mp3', 'audio/aac': '.aac', 'audio/ogg': '.ogg', 'audio/amr': '.amr', 'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
};

// Limpia el nombre que viene del cliente (quita control chars y separadores de
// ruta, lo acota) y le pone extensión por MIME si no tiene — WhatsApp infiere el
// tipo por extensión.
function nombreArchivoSeguro(name: string, mime: string): string {
  let n = Array.from(name || '')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')
    .replace(/[/\\]/g, '_')
    .trim()
    .slice(0, 120);
  if (!n) n = 'archivo';
  if (!/\.[a-z0-9]{1,8}$/i.test(n)) {
    const ext = EXT_POR_MIME[(mime || '').split(';')[0].trim()];
    if (ext) n += ext;
  }
  return n;
}

function mensajeErrorChatwoot(status: number): string {
  if (status === 413) return 'El archivo es demasiado grande para WhatsApp.';
  if (status === 415 || status === 422) return 'WhatsApp no acepta este tipo de archivo.';
  if (status === 401 || status === 403) return 'Sin permisos para enviar en Chatwoot.';
  if (status === 404) return 'No se encontró la conversación del contacto.';
  if (status >= 500) return 'Chatwoot no está disponible en este momento.';
  return 'No se pudo enviar el archivo.';
}

// Envía un archivo/multimedia al contacto (reusa su conversación abierta). Solo
// llega dentro de la ventana de 24h. OJO: multipart NO puede pasar por cwFetch
// (authHeaders fuerza Content-Type: application/json y rompería el boundary).
// Con FormData nativo NO seteamos Content-Type: fetch arma el boundary solo.
export async function sendAttachmentToContact(
  contactId: number,
  blob: Blob,
  filename: string,
  content?: string,
): Promise<SendResult> {
  try {
    const c = await cfg();
    const conversationId = await crearOReusarConversacion(c, contactId);
    const fd = new FormData();
    fd.append('message_type', 'outgoing');
    if (content && content.trim()) fd.append('content', content.trim());
    fd.append('attachments[]', blob, nombreArchivoSeguro(filename, blob.type));
    const res = await fetch(`${c.apiBase}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { api_access_token: c.token }, // sin Content-Type → boundary automático
      body: fd,
    });
    if (!res.ok) {
      const raw = await res.text();
      console.error(`[chatwoot sendAttachment] ${res.status}: ${raw.slice(0, 300)}`);
      return { ok: false, error: mensajeErrorChatwoot(res.status) };
    }
    return { ok: true, conversationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Credenciales de Meta (WhatsApp Cloud) que vive el inbox de Chatwoot ──────
// El inbox de Chatwoot guarda en provider_config el token de Meta (api_key, con
// scope whatsapp_business_management) + el WABA id + el phone_number_id. Los
// reusamos para hablarle directo a la Graph API (crear/listar plantillas) sin
// pedirle credenciales nuevas a Mauricio. Se cachea (no cambian entre requests).
export type WabaConfig = { token: string; wabaId: string; phoneNumberId: string; version: string; appId: string };
// Cache con TTL: si Mauricio re-autentica WhatsApp en Chatwoot el token cambia, así
// que no lo cacheamos para siempre (si no, 401 fantasma hasta reiniciar el proceso).
// Keyed por workspace: cada cliente tiene su propio inbox/WABA, no compartir.
const _wabaCache = new Map<number, { value: WabaConfig; expiresAt: number }>();
const WABA_TTL_MS = 10 * 60 * 1000;

type ProviderConfigResp = {
  provider_config?: { api_key?: string; phone_number_id?: string; business_account_id?: string };
};

export async function getWabaConfig(): Promise<WabaConfig> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const cached = _wabaCache.get(ws);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const c = await cfg();
  const r = await cwFetch<ProviderConfigResp>(`${c.apiBase}/inboxes/${inboxWA(c)}`, { method: 'GET' }, c.token);
  const pc = r.provider_config ?? {};
  if (!pc.api_key || !pc.business_account_id) {
    throw new Error('El inbox de Chatwoot no tiene provider_config de WhatsApp Cloud (api_key / business_account_id).');
  }
  const version = process.env.META_API_VERSION || 'v21.0';
  // app_id del token (lo necesita el resumable-upload de muestras de media).
  let appId = '';
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    try {
      const dt = await fetch(`https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(pc.api_key)}&access_token=${encodeURIComponent(pc.api_key)}`, { signal: ctrl.signal });
      const dj = await dt.json();
      appId = String(dj?.data?.app_id ?? '');
    } finally { clearTimeout(to); }
  } catch { /* sin app_id → la subida de media fallará con mensaje claro */ }
  const value: WabaConfig = {
    token: pc.api_key,
    wabaId: pc.business_account_id,
    phoneNumberId: pc.phone_number_id ?? '',
    version,
    appId,
  };
  _wabaCache.set(ws, { value, expiresAt: Date.now() + WABA_TTL_MS });
  return value;
}

// ── Templates aprobados (para mandar fuera de la ventana de 24h) ─────────────
export type TemplateInfo = {
  name: string;
  category: string;   // marketing | utility | authentication
  language: string;
  params: string[];   // nombres de las variables del body (ej. ['nombre'])
  body: string;       // texto del body con {{var}}
};

type TplComponent = {
  type?: string;
  text?: string;
  example?: { body_text_named_params?: Array<{ param_name?: string }> };
};
type TplRaw = { name?: string; category?: string; language?: string; status?: string; components?: TplComponent[] };
type InboxResp = { message_templates?: TplRaw[] };

export async function getApprovedTemplates(): Promise<TemplateInfo[]> {
  const c = await cfg();
  const r = await cwFetch<InboxResp>(`${c.apiBase}/inboxes/${inboxWA(c)}`, { method: 'GET' }, c.token);
  return (r.message_templates ?? [])
    .filter((t) => (t.status ?? '').toUpperCase() === 'APPROVED')
    .map((t) => {
      const body = (t.components ?? []).find((x) => x.type === 'BODY');
      const params = (body?.example?.body_text_named_params ?? [])
        .map((p) => p.param_name ?? '')
        .filter(Boolean);
      return {
        name: t.name ?? '',
        category: (t.category ?? 'marketing').toLowerCase(),
        language: t.language ?? 'es_MX',
        params,
        body: body?.text ?? '',
      };
    })
    .filter((t) => t.name);
}

// Las plantillas creadas vía Graph API tardan en sincronizarse a Chatwoot, y sin
// eso Chatwoot arma mal los parámetros al enviar (error 132000). Forzamos el sync
// si la plantilla no está en su lista todavía.
async function ensureTemplateSynced(c: Cfg, name: string): Promise<void> {
  try {
    const r = await cwFetch<InboxResp>(`${c.apiBase}/inboxes/${inboxWA(c)}`, { method: 'GET' }, c.token);
    if ((r.message_templates ?? []).some((t) => t.name === name)) return; // ya está sincronizada
    await cwFetch(`${c.apiBase}/inboxes/${inboxWA(c)}/sync_templates`, { method: 'POST' }, c.token);
    await new Promise((res) => setTimeout(res, 4000)); // darle tiempo al sync de Chatwoot
  } catch { /* si falla, intentamos enviar igual */ }
}

// =============================================================================
// Salud del webhook Chatwoot → app (detección de respuestas del canal oficial)
// =============================================================================
// El webhook de Chatwoot es lo que le avisa a la app cuando un lead RESPONDE por
// el WhatsApp oficial (pausa su nutrición, dispara avisos y flujos). Hasta ahora
// se configuraba A MANO en la UI de Chatwoot: si faltaba, apuntaba a otro deploy
// o tenía un secret viejo, el fallo era silencioso (la nutrición seguía
// disparando sobre leads que ya habían contestado). Mismo patrón que el "espejo
// de mensajes" de Evolution (lib/evolution.ts): ping E2E al propio receiver +
// comparación de la config registrada + reparación en un clic desde /whatsapp.
//
// El secret va EN LA URL registrada (?secret=…) porque Chatwoot no firma sus
// webhooks ni manda headers custom; en prod el receiver rechaza todo sin él
// (fail-closed, app/api/webhooks/chatwoot/route.ts). OJO: CHATWOOT_WEBHOOK_SECRET
// es de PLATAFORMA (un solo valor para todos los workspaces) y queda visible para
// el admin del Chatwoot donde se registra — mismo trade-off ya documentado en
// lib/evolution.ts (sinSecreto). Por eso acá también se recortan las URLs antes
// de devolverlas: la UI solo usa `estado` y el secret jamás viaja al browser.

const CW_WEBHOOK_SECRET = process.env.CHATWOOT_WEBHOOK_SECRET || '';

function chatwootWebhookUrl(): string {
  const qs = CW_WEBHOOK_SECRET ? `?secret=${encodeURIComponent(CW_WEBHOOK_SECRET)}` : '';
  return `${APP_BASE_URL}/api/webhooks/chatwoot${qs}`;
}

const sinQuery = (u: string) => u.split('?')[0];

// Estados de salud, del más roto al más sano:
//   sin_secret     → falta CHATWOOT_WEBHOOK_SECRET en ESTE server (no se puede registrar).
//   secret_prod    → el deploy (APP_BASE_URL) rechaza nuestro secret (401): env de
//                    Vercel desalineado — lo corrige el equipo técnico, no "reparar".
//   url_distinta   → APP_BASE_URL no responde donde debería (dominio mal / caído).
//   no_registrado  → receiver sano pero la cuenta de Chatwoot no tiene el webhook
//                    (o con URL/secret viejo, o sin message_created) → "reparar" lo registra.
//   sin_ruteo      → webhook puesto pero el account_id no mapea a este workspace en
//                    webhook_routing: el receiver ignoraría los eventos → "reparar" lo reclama.
//   ruteo_ocupado  → el account_id ya es de OTRO workspace (primer reclamante gana):
//                    lo destraba el equipo técnico, no el botón.
//   error          → la API de Chatwoot no respondió.
export type ChatwootWebhookEstado =
  | 'ok' | 'sin_secret' | 'secret_prod' | 'url_distinta'
  | 'no_registrado' | 'sin_ruteo' | 'ruteo_ocupado' | 'error';
export type ChatwootWebhookSalud = { estado: ChatwootWebhookEstado; urlActual: string | null; urlEsperada: string };

// Webhook tal como lo devuelve la API de Chatwoot. El shape del listado varió
// entre versiones (payload como array vs { webhooks: [...] }) → parseo defensivo,
// igual que ContactsResp arriba.
type CwWebhook = { id?: number; url?: string; subscriptions?: string[] };
type WebhooksResp = CwWebhook[] | { payload?: CwWebhook[] | { webhooks?: CwWebhook[] } };

async function listarWebhooks(c: Cfg): Promise<CwWebhook[]> {
  const r = await cwFetch<WebhooksResp>(
    `${c.apiBase}/webhooks`,
    { method: 'GET', signal: AbortSignal.timeout(15000) },
    c.token,
  );
  if (Array.isArray(r)) return r;
  const p = r.payload;
  if (Array.isArray(p)) return p;
  return p?.webhooks ?? [];
}

// Los webhooks de la cuenta que apuntan a NUESTRO receiver: los que registramos
// nosotros o los que se pusieron a mano en su momento.
//
// Se compara por PATH, ignorando host y query. Comparar la URL entera fue un bug
// real: al cambiar de dominio, los webhooks viejos dejaban de "ser nuestros", así
// que repararWebhookChatwoot() entraba por la rama de "no hay ninguno" y CREABA
// uno nuevo en vez de actualizar el que había — y el borrado de duplicados nunca
// los alcanzaba. Resultado medido tras la mudanza a makodigital.app: dos webhooks
// vivos entregando el mismo message_created, o sea aviso duplicado al dueño y
// turnos repetidos en la memoria del doer. Con el path alcanza: el receiver es
// nuestro sin importar por qué dominio lo llamen.
function webhooksPropios(hooks: CwWebhook[], esperada: string): CwWebhook[] {
  const pathEsperado = pathDe(esperada);
  return hooks.filter((h) => h.url && pathDe(h.url) === pathEsperado);
}

/** Path de una URL, o null si no parsea (un webhook ajeno con URL rara no debe romper). */
function pathDe(u: string): string | null {
  try { return new URL(u).pathname; } catch { return null; }
}

// Verificación REAL de extremo a extremo: pingeamos NUESTRO receiver con el
// secret actual. El receiver responde 200 a un evento benigno (event que no es
// message_created se ignora antes de tocar datos) y 401 si el secret no coincide.
// Detecta drift de secret entre deploys y APP_BASE_URL apuntando a otra app.
async function pingReceiver(url: string): Promise<number> {
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'webhook.health' }),
      signal: AbortSignal.timeout(6000),
    });
    return r.status;
  } catch { return 0; }
}

export async function estadoWebhookChatwoot(): Promise<ChatwootWebhookSalud> {
  const esperada = chatwootWebhookUrl();
  const urlEsperada = sinQuery(esperada);
  if (!CW_WEBHOOK_SECRET) return { estado: 'sin_secret', urlActual: null, urlEsperada };

  // 1) ¿El deploy en APP_BASE_URL acepta nuestro secret? Si esto falla, "reparar"
  //    no sirve: el problema está en el env de Vercel, no en Chatwoot.
  const ping = await pingReceiver(esperada);
  if (ping === 401) return { estado: 'secret_prod', urlActual: null, urlEsperada };
  if (ping !== 200) return { estado: 'url_distinta', urlActual: null, urlEsperada };

  try {
    // 2) ¿La cuenta de Chatwoot tiene el webhook con la URL EXACTA (secret incluido)
    //    y suscripto a message_created? La comparación va con query y todo: una URL
    //    registrada con un secret viejo daría 401 en cada evento real, así que acá
    //    cuenta como no_registrado (y "reparar" la actualiza).
    const c = await cfg();
    const propios = webhooksPropios(await listarWebhooks(c), esperada);
    const urlActual = propios[0]?.url ? sinQuery(propios[0].url) : null;
    const valido = propios.find(
      (h) => h.url === esperada && (h.subscriptions ?? []).includes('message_created'),
    );
    if (!valido) return { estado: 'no_registrado', urlActual, urlEsperada };

    // 3) ¿El account_id rutea a ESTE workspace? Sin fila en webhook_routing el
    //    receiver descarta los eventos (fail-closed) aunque el webhook esté sano.
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    // ESTRICTAS (07/10/2026): con las tolerantes, la base caída daba null, el estado salía
    // «sin_ruteo» y la pantalla ofrecía REPARAR un webhook sano. Ahora tiran, y el `catch` de
    // abajo contesta `error` («no pude comprobarlo»), que es lo que pasó.
    const account = await credWsEstricta('CHATWOOT_ACCOUNT_ID', ws);
    const dueno = await wsPorIdentificadorEstricto('chatwoot', account);
    if (dueno == null) return { estado: 'sin_ruteo', urlActual, urlEsperada };
    if (dueno !== ws) return { estado: 'ruteo_ocupado', urlActual, urlEsperada };

    return { estado: 'ok', urlActual, urlEsperada };
  } catch (err) {
    console.error(`[chatwoot] estadoWebhookChatwoot: ${err instanceof Error ? err.message : String(err)}`);
    return { estado: 'error', urlActual: null, urlEsperada };
  }
}

// (Re)registra el webhook en la cuenta de Chatwoot del workspace + reclama el
// ruteo del account_id, y verifica que quedó. Lo usa el auto-registro al abrir
// la tab /whatsapp y el botón "Registrar webhook" del chip.
export async function repararWebhookChatwoot(): Promise<{ ok: boolean; estado: ChatwootWebhookEstado; error?: string }> {
  if (!CW_WEBHOOK_SECRET) {
    return { ok: false, estado: 'sin_secret', error: 'Falta el secret del webhook de Chatwoot en la configuración de la plataforma — avisa al equipo técnico.' };
  }
  try {
    const c = await cfg();
    const esperada = chatwootWebhookUrl();
    const propios = webhooksPropios(await listarWebhooks(c), esperada);

    if (!propios.length) {
      await cwFetch(
        `${c.apiBase}/webhooks`,
        { method: 'POST', body: JSON.stringify({ webhook: { url: esperada, subscriptions: ['message_created'] } }), signal: AbortSignal.timeout(15000) },
        c.token,
      );
    } else {
      // Ya hay uno nuestro → actualizarlo (URL con el secret vigente + message_created
      // sin pisar otras suscripciones que hayan configurado a mano).
      const [principal, ...duplicados] = propios;
      const subs = Array.from(new Set([...(principal.subscriptions ?? []), 'message_created']));
      if (principal.url !== esperada || !(principal.subscriptions ?? []).includes('message_created')) {
        await cwFetch(
          `${c.apiBase}/webhooks/${principal.id}`,
          { method: 'PATCH', body: JSON.stringify({ webhook: { url: esperada, subscriptions: subs } }), signal: AbortSignal.timeout(15000) },
          c.token,
        );
      }
      // Duplicados apuntando a nuestro receiver: se borran (cada evento llegaría
      // N veces → avisos dobles al dueño). Best-effort.
      for (const d of duplicados) {
        if (d.id != null) {
          await cwFetch(`${c.apiBase}/webhooks/${d.id}`, { method: 'DELETE', signal: AbortSignal.timeout(15000) }, c.token).catch(() => {});
        }
      }
    }

    // Reclamar el ruteo account_id → workspace. Primer reclamante gana (upsertRouting
    // NO pisa a otro workspace); si está ocupado, la verificación lo reporta.
    // El fallback a OWNER_WS es seguro acá: sin impersonar, credWs resuelve las
    // credenciales del DUEÑO (env), así que se reclama su propio account_id.
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    const account = await credWs('CHATWOOT_ACCOUNT_ID', ws);
    if (account) await upsertRouting('chatwoot', account, ws);

    const v = await estadoWebhookChatwoot();
    return {
      ok: v.estado === 'ok',
      estado: v.estado,
      error: v.estado === 'ok' ? undefined : 'El webhook se registró pero la verificación no dio OK.',
    };
  } catch (err) {
    return { ok: false, estado: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

// Manda un template aprobado al contacto (reusa su conversación). Sirve fuera
// de la ventana de 24h. `content` es el texto renderizado para mostrar en el hilo.
export async function sendTemplateToContact(
  contactId: number,
  tpl: { name: string; category: string; language: string; bodyParams: Record<string, string>; content: string },
): Promise<SendResult> {
  try {
    const c = await cfg();
    await ensureTemplateSynced(c, tpl.name);
    const conversationId = await crearOReusarConversacion(c, contactId);
    await cwFetch(
      `${c.apiBase}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: tpl.content,
          message_type: 'outgoing',
          template_params: {
            name: tpl.name,
            category: tpl.category,
            language: tpl.language,
            processed_params: { body: tpl.bodyParams },
          },
        }),
      },
      c.token,
    );
    return { ok: true, conversationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
