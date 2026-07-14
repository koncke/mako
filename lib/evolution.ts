// =============================================================================
// Evolution API — WhatsApp NO oficial (número por QR, texto libre)
// =============================================================================
// Cuenta única de MaKo (env EVOLUTION_BASE_URL / EVOLUTION_API_KEY), UNA
// instancia por workspace (instance_name = 'mako_ws<id>'). El estado y el
// mapeo instancia↔workspace viven en evolution_instancias; el QR se pide en
// vivo (efímero). Contrato verificado contra Evolution v2.3.7.
//
// Reglas del PDF: a leads calientes NUNCA se dispara automático (F2.3, cola de
// borradores). Acá viven el cliente HTTP, la conexión (QR) y los helpers.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';

// Workspace del request, ESTRICTO: si es null (admin de agencia sin impersonar)
// cortamos — nunca operar sobre la instancia del dueño por un fallback silencioso.
async function wsEstricto(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Seleccioná un cliente (impersoná un workspace) para conectar su WhatsApp.');
  return ws;
}

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';
// URL base del dashboard para el webhook (Evolution → nuestra app). En prod es
// el dominio de Vercel; en local el webhook no llega (se usa polling de estado).
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || '';

export function evolutionConfigurado(): boolean {
  return !!BASE && !!KEY;
}

// instance_name estable por workspace. Único en la cuenta de Evolution.
export function instanceNameDeWs(ws: number): string {
  return `mako_ws${ws}`;
}

export type EstadoConexion = 'desconectado' | 'conectando' | 'conectado' | 'error';

type EvResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function evFetch<T = unknown>(path: string, init?: RequestInit): Promise<EvResult<T>> {
  if (!evolutionConfigurado()) return { ok: false, error: 'Evolution no configurado', status: 0 };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
      // Tope de 30s: cubre el 'delay' de tipeo de sendText (~≤11s) y evita que
      // un Evolution colgado bloquee el cron hasta el maxDuration.
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja texto */ }
    if (!res.ok) {
      const msg = typeof body === 'object' && body && 'message' in body
        ? JSON.stringify((body as { message: unknown }).message)
        : (typeof body === 'string' ? body.slice(0, 200) : `Evolution ${res.status}`);
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), status: 0 };
  }
}

// ── URL del webhook para una instancia ────────────────────────────────────────
function webhookUrl(): string {
  const qs = WEBHOOK_SECRET ? `?secret=${encodeURIComponent(WEBHOOK_SECRET)}` : '';
  return `${APP_BASE_URL}/api/webhooks/evolution${qs}`;
}

// Eventos que nos importan: conexión/QR + mensajes (nuevo/estado/borrado/editado)
// + contactos (nombre/foto) + etiquetas (catálogo + asociación).
const EVENTOS_WEBHOOK = [
  'QRCODE_UPDATED', 'CONNECTION_UPDATE',
  'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'MESSAGES_EDITED',
  'CONTACTS_UPSERT', 'CONTACTS_UPDATE',
  'LABELS_EDIT', 'LABELS_ASSOCIATION',
];

// Configura (best-effort en la conexión) el webhook de la instancia hacia nuestra
// app. Sin secret configurado NO registramos el webhook (registraría un endpoint
// sin auth end-to-end; con el fail-closed del route, además, esos eventos darían
// 401). Devuelve el resultado para que "reparar" pueda superficiar el error (antes
// era void → si fallaba, la conexión quedaba "ok" pero el espejo muerto en silencio).
async function setWebhook(instance: string): Promise<{ ok: boolean; error?: string }> {
  if (!WEBHOOK_SECRET) return { ok: false, error: 'Falta EVOLUTION_WEBHOOK_SECRET en el servidor.' };
  const r = await evFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: { enabled: true, url: webhookUrl(), byEvents: false, base64: true, events: EVENTOS_WEBHOOK },
    }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Ajustes anti-baneo / de comportamiento humano (PDF): no leer recibos de forma
// automática, ignorar grupos, no forzar "en línea" siempre.
async function setSettings(instance: string): Promise<void> {
  await evFetch(`/settings/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      rejectCall: false, msgCall: '', groupsIgnore: true,
      alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false,
    }),
  });
}

// Habilita la RECEPCIÓN de mensajes de grupo (groupsIgnore:false) para una
// instancia — necesario para el doer "Hola MaKo", que escucha en los grupos de
// MaKo. Por defecto las instancias ignoran grupos (regla anti-ban del PDF); esto
// se activa a propósito solo en la línea que le da voz a MaKo. Mantiene el resto
// de los ajustes anti-ban igual.
export async function permitirGruposEnInstancia(instance: string): Promise<{ ok: boolean; error?: string }> {
  const r = await evFetch(`/settings/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      rejectCall: false, msgCall: '', groupsIgnore: false,
      alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false,
    }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ── Tipos de respuesta que consumimos ────────────────────────────────────────
export type QrData = { base64: string | null; code: string | null; pairingCode: string | null };

type CreateResp = {
  instance?: { instanceName?: string; instanceId?: string; status?: string };
  qrcode?: { base64?: string; code?: string; pairingCode?: string | null };
};
type ConnectResp = { base64?: string; code?: string; pairingCode?: string | null; instance?: unknown; count?: number };
type StateResp = { instance?: { instanceName?: string; state?: string } };

function mapEstado(state: string | undefined): EstadoConexion {
  switch ((state ?? '').toLowerCase()) {
    case 'open': return 'conectado';
    case 'connecting': return 'conectando';
    case 'close': case 'closed': return 'desconectado';
    default: return 'desconectado';
  }
}

// ── Fila de la instancia del workspace (DB) ──────────────────────────────────
export type InstanciaRow = {
  id: number; instance_name: string; instance_id: string | null;
  estado: EstadoConexion; numero: string | null; perfil_nombre: string | null;
  ultima_conexion_at: string | null;
};

export async function getInstanciaRow(): Promise<InstanciaRow | null> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('evolution_instancias')
    .select('id, instance_name, instance_id, estado, numero, perfil_nombre, ultima_conexion_at')
    .maybeSingle();
  return (data as InstanciaRow | null) ?? null;
}

async function upsertInstancia(patch: Record<string, unknown>): Promise<void> {
  const ws = await wsEstricto();
  const supabase = await getTenantDb();
  const name = instanceNameDeWs(ws);
  // getTenantDb estampa workspace_id; onConflict por workspace_id (único).
  await supabase.from('evolution_instancias').upsert(
    { instance_name: name, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'workspace_id' },
  );
}

// ── Acciones de conexión ─────────────────────────────────────────────────────

// Crea (si no existe) la instancia del workspace y devuelve el QR para escanear.
// Idempotente: si ya existe, pide un QR nuevo con /instance/connect.
export async function conectar(): Promise<{ ok: true; qr: QrData; estado: EstadoConexion } | { ok: false; error: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);

  // ¿Ya existe en Evolution? Matcheamos por NOMBRE exacto (no length>0): si una
  // versión ignorara el filtro y devolviera todas, no adoptamos la equivocada.
  const existe = await evFetch<Array<Record<string, unknown>>>(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
  const yaExiste = existe.ok && Array.isArray(existe.data)
    && existe.data.some((i) => (i.name ?? i.instanceName) === instance);

  if (!yaExiste) {
    const r = await evFetch<CreateResp>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    });
    if (!r.ok) return { ok: false, error: r.error };
    // Config best-effort (no fatal).
    await setWebhook(instance);
    await setSettings(instance);
    await upsertInstancia({ instance_id: r.data.instance?.instanceId ?? null, estado: 'conectando' });
    return {
      ok: true,
      estado: 'conectando',
      qr: { base64: r.data.qrcode?.base64 ?? null, code: r.data.qrcode?.code ?? null, pairingCode: r.data.qrcode?.pairingCode ?? null },
    };
  }

  // Ya existe → pedir un QR fresco (re-vincular).
  await setWebhook(instance);
  const c = await evFetch<ConnectResp>(`/instance/connect/${encodeURIComponent(instance)}`);
  if (!c.ok) return { ok: false, error: c.error };
  await upsertInstancia({ estado: 'conectando' });
  return {
    ok: true,
    estado: 'conectando',
    qr: { base64: c.data.base64 ?? null, code: c.data.code ?? null, pairingCode: c.data.pairingCode ?? null },
  };
}

// Estado en vivo (para el polling de la UI). Reconcilia la fila en DB.
export async function estadoEnVivo(): Promise<{ estado: EstadoConexion; numero: string | null; perfil: string | null }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<StateResp>(`/instance/connectionState/${encodeURIComponent(instance)}`);
  if (!r.ok) {
    // 404 = instancia no creada aún → desconectado (sin ruido).
    if (r.status === 404) return { estado: 'desconectado', numero: null, perfil: null };
    return { estado: 'error', numero: null, perfil: null };
  }
  const estado = mapEstado(r.data.instance?.state);
  let numero: string | null = null;
  let perfil: string | null = null;
  if (estado === 'conectado') {
    // Traer el número/perfil conectado desde fetchInstances.
    const info = await evFetch<Array<Record<string, unknown>>>(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
    if (info.ok && Array.isArray(info.data) && info.data[0]) {
      const it = info.data[0];
      numero = jidToNumero((it.ownerJid as string) || (it.owner as string) || (it.number as string) || null);
      perfil = (it.profileName as string) || (it.profilePicName as string) || null;
    }
  }
  await upsertInstancia({
    estado,
    ...(numero ? { numero } : {}),
    ...(perfil ? { perfil_nombre: perfil } : {}),
    ...(estado === 'conectado' ? { ultima_conexion_at: new Date().toISOString() } : {}),
  });
  return { estado, numero, perfil };
}

// Refresca el QR (nuevo código) sin recrear la instancia.
export async function refrescarQr(): Promise<{ ok: true; qr: QrData } | { ok: false; error: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const c = await evFetch<ConnectResp>(`/instance/connect/${encodeURIComponent(instance)}`);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, qr: { base64: c.data.base64 ?? null, code: c.data.code ?? null, pairingCode: c.data.pairingCode ?? null } };
}

// Cierra sesión y elimina la instancia (chip nuevo → volver a conectar).
export async function desconectar(): Promise<{ ok: boolean; error?: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  await evFetch(`/instance/logout/${encodeURIComponent(instance)}`, { method: 'DELETE' });
  const del = await evFetch(`/instance/delete/${encodeURIComponent(instance)}`, { method: 'DELETE' });
  await upsertInstancia({ estado: 'desconectado', numero: null, perfil_nombre: null, instance_id: null });
  // Idempotente: borrar algo que ya no existe (404) es el resultado deseado.
  return del.ok || del.status === 404 ? { ok: true } : { ok: false, error: del.error };
}

// ── Salud del "espejo de mensajes" (webhook) ─────────────────────────────────
// El síntoma clásico: WhatsApp CONECTA pero no aparece ningún chat, porque el
// webhook (Evolution → app) nunca se registró o apunta a otro deploy. Esto lo
// hace VISIBLE y reparable en vez de un fallo silencioso.
//   ok            → webhook activo Y el receiver responde 200 a nuestro secret.
//   sin_secret    → falta EVOLUTION_WEBHOOK_SECRET en ESTE server (no se puede activar).
//   secret_prod   → el deploy (APP_BASE_URL) rechaza nuestro secret (401): env de Vercel
//                   desalineado — NO lo arregla "reparar", hay que corregir Vercel.
//   url_distinta  → APP_BASE_URL no responde donde debería (dominio mal / caído).
//   no_registrado → el receiver acepta el secret, pero el webhook no está puesto en la
//                   instancia (o sin MESSAGES_UPSERT) → "reparar" lo registra y funciona.
//   error         → Evolution no respondió.
export type WebhookEstado = 'ok' | 'sin_secret' | 'secret_prod' | 'no_registrado' | 'url_distinta' | 'error';
export type WebhookSalud = { estado: WebhookEstado; urlActual: string | null; urlEsperada: string };

const sinQuery = (u: string) => u.split('?')[0];

// Verificación REAL de extremo a extremo: pingeamos NUESTRO propio receiver con el
// secret actual. Detecta lo que la comparación interna no ve — drift de secret entre
// deploys, o APP_BASE_URL apuntando a un dominio que no sirve esta app. El receiver
// responde 200 a un evento benigno con secret válido, 401 si el secret no coincide.
async function pingReceiver(url: string): Promise<number> {
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'webhook.health', instance: '__health__' }),
      signal: AbortSignal.timeout(6000),
    });
    return r.status;
  } catch { return 0; }
}

export async function estadoWebhook(): Promise<WebhookSalud> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const esperada = webhookUrl();
  if (!WEBHOOK_SECRET) return { estado: 'sin_secret', urlActual: null, urlEsperada: esperada };

  // 1) ¿El deploy en APP_BASE_URL acepta nuestro secret? (test real de reachability)
  //    Si esto falla, "reparar" no sirve: el problema está en el env de Vercel.
  const ping = await pingReceiver(esperada);
  if (ping === 401) return { estado: 'secret_prod', urlActual: null, urlEsperada: esperada };
  if (ping !== 200) return { estado: 'url_distinta', urlActual: null, urlEsperada: esperada };

  // 2) El receiver está OK; ahora chequeamos que el webhook esté puesto en la instancia.
  const r = await evFetch<{ enabled?: boolean; url?: string; events?: string[] } | null>(`/webhook/find/${encodeURIComponent(instance)}`);
  if (!r.ok) return { estado: 'error', urlActual: null, urlEsperada: esperada };
  const cfg = r.data;
  if (!cfg || !cfg.enabled || !cfg.url) return { estado: 'no_registrado', urlActual: cfg?.url ?? null, urlEsperada: esperada };
  if (sinQuery(cfg.url) !== sinQuery(esperada)) return { estado: 'no_registrado', urlActual: cfg.url, urlEsperada: esperada };
  const events = (cfg.events ?? []).map((e) => String(e).toUpperCase());
  if (!events.includes('MESSAGES_UPSERT')) return { estado: 'no_registrado', urlActual: cfg.url, urlEsperada: esperada };
  return { estado: 'ok', urlActual: cfg.url, urlEsperada: esperada };
}

// (Re)registra el webhook y verifica que quedó. Lo usa el botón "Reparar espejo".
export async function repararWebhook(): Promise<{ ok: boolean; estado: WebhookEstado; error?: string }> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  if (!WEBHOOK_SECRET) return { ok: false, estado: 'sin_secret', error: 'Falta EVOLUTION_WEBHOOK_SECRET en el servidor. Configuralo en Vercel y volvé a intentar.' };
  const set = await setWebhook(instance);
  if (!set.ok) return { ok: false, estado: 'error', error: set.error };
  const v = await estadoWebhook();
  return { ok: v.estado === 'ok', estado: v.estado, error: v.estado === 'ok' ? undefined : 'El webhook se registró pero la verificación no dio OK.' };
}

// ── Envío de texto (anti-ban: "escribiendo…" proporcional al texto) ──────────
export type EnvioResult = { ok: true; id: string; chatJid: string } | { ok: false; error: string };

// Envía un texto libre por el número no oficial del workspace. El `delay` hace
// que Evolution muestre "escribiendo…" ese tiempo antes de soltar el mensaje
// (nativo) — proporcional al largo + jitter, para no parecer un bot.
export async function enviarTexto(telefono: string, texto: string): Promise<EnvioResult> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return { ok: false, error: 'teléfono inválido' };
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const base = Math.min(1500 + texto.length * 45, 9000);
  const delay = Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% jitter
  const r = await evFetch<{ key?: { id?: string; remoteJid?: string } }>(
    `/message/sendText/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ number: num, text: texto, delay }) },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data.key?.id ?? '', chatJid: r.data.key?.remoteJid ?? `${num}@s.whatsapp.net` };
}

const soloB64 = (s: string): string => (s.includes(',') ? s.split(',').pop()! : s); // saca el prefijo data:*;base64,

// Envía media (imagen/video/documento) por el no oficial. base64 PURO (sin prefijo
// data:). document exige fileName. `delay` simula un envío humano (anti-ban).
export async function enviarMedia(
  telefono: string,
  media: { base64: string; mimetype: string; fileName?: string; tipo: 'image' | 'video' | 'document' },
  caption?: string,
): Promise<EnvioResult> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return { ok: false, error: 'teléfono inválido' };
  const media64 = soloB64(media.base64);
  if (!media64) return { ok: false, error: 'archivo vacío' };
  const delay = Math.round(Math.min(1200 + Math.floor(media64.length / 120), 6000) * (0.8 + Math.random() * 0.4));
  const body: Record<string, unknown> = { number: num, mediatype: media.tipo, mimetype: media.mimetype, media: media64, delay };
  if (media.fileName) body.fileName = media.fileName;
  if (caption) body.caption = caption;
  const r = await evFetch<{ key?: { id?: string; remoteJid?: string } }>(
    `/message/sendMedia/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data.key?.id ?? '', chatJid: r.data.key?.remoteJid ?? `${num}@s.whatsapp.net` };
}

// Envía una NOTA DE VOZ (PTT) por el no oficial. sendWhatsAppAudio (no sendMedia)
// para que salga como nota de voz; el delay muestra "grabando audio…" nativo.
export async function enviarAudio(telefono: string, base64: string): Promise<EnvioResult> {
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return { ok: false, error: 'teléfono inválido' };
  const audio64 = soloB64(base64);
  if (!audio64) return { ok: false, error: 'audio vacío' };
  const delay = Math.round(Math.min(2000 + Math.floor(audio64.length / 90), 8000) * (0.8 + Math.random() * 0.4));
  const r = await evFetch<{ key?: { id?: string; remoteJid?: string } }>(
    `/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ number: num, audio: audio64, delay, encoding: true }) },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data.key?.id ?? '', chatJid: r.data.key?.remoteJid ?? `${num}@s.whatsapp.net` };
}

// Foto de perfil de WhatsApp de un número (URL efímera del CDN, o null si no tiene
// / es privada / no está en WhatsApp). Best-effort: no lanza.
export async function fetchProfilePic(telefono: string): Promise<string | null> {
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return null;
  const ws = await wsEstricto();
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<{ profilePictureUrl?: string | null }>(
    `/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ number: num }) },
  );
  if (r.ok && r.data.profilePictureUrl) return r.data.profilePictureUrl;
  // Fallback: el profilePicUrl CACHEADO de findContacts (lo que muestra la UI de
  // Evolution). fetchProfilePictureUrl (en vivo) devuelve null seguido si el
  // contacto no está agendado; el cache suele tenerla igual.
  return fetchContactoPicUrl(num);
}

// Foto de perfil cacheada (tabla Contact de Evolution) vía findContacts. Best-effort.
export async function fetchContactoPicUrl(telefono: string): Promise<string | null> {
  const num = (telefono || '').replace(/\D/g, '');
  const ws = await getWorkspaceActual();
  if (ws == null || !num || !evolutionConfigurado()) return null;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ remoteJid?: string; profilePicUrl?: string | null }>>(
    `/chat/findContacts/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ where: { remoteJid: `${num}@s.whatsapp.net` } }) },
  );
  if (!r.ok || !Array.isArray(r.data)) return null;
  return r.data.find((c) => c.profilePicUrl)?.profilePicUrl ?? null;
}

// ── Lectura EN VIVO desde Evolution (no depende del webhook) ─────────────────
// El espejo en DB se llena SOLO con el webhook; si no está registrado, el inbox
// sale vacío aunque Evolution SÍ tenga los mensajes. Estas funciones leen directo
// del store de Evolution (findMessages/findChats) para mostrar la conversación
// real con o sin webhook. Best-effort: [] ante cualquier fallo (NUNCA lanzan, así
// el inbox del admin sin impersonar o un Evolution caído no rompen la lectura).

// Record crudo de un mensaje de Evolution (mismo shape que el messages.upsert del
// webhook → se parsea con el mismo extraerContenido). OJO: findMessages NO trae la
// media en base64, sólo metadata (tipo/caption); los bytes los llena el webhook.
export type EvRecord = {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string };
  pushName?: string; message?: Record<string, unknown>; messageType?: string;
  messageTimestamp?: number | string; MessageUpdate?: Array<{ status?: string }>;
};

// Mensajes de un chat, del más viejo al más nuevo (Evolution los da desc → los
// invertimos). limite = tamaño de página (en findMessages, `offset` es el take).
export async function fetchMensajesEvolution(chatJid: string, limite = 300): Promise<EvRecord[]> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado() || !chatJid) return [];
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<{ messages?: { records?: EvRecord[] } } | EvRecord[]>(
    `/chat/findMessages/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: chatJid } }, page: 1, offset: limite }) },
  );
  if (!r.ok) return [];
  const d = r.data as { messages?: { records?: EvRecord[] } } | EvRecord[];
  const records = Array.isArray(d) ? d : (d?.messages?.records ?? []);
  return Array.isArray(records) ? records.slice().reverse() : []; // desc → asc
}

// Resuelve el @lid asociado a un número (WhatsApp direcciona a los contactos no
// agendados por ese alias). POST /chat/whatsappNumbers → [{ jid, exists, lid }].
// Sólo funciona si Evolution ya "aprendió" el mapeo. null si no hay. Best-effort.
export async function fetchLidDeNumero(telefono: string): Promise<string | null> {
  const num = (telefono || '').replace(/\D/g, '');
  const ws = await getWorkspaceActual();
  if (ws == null || !num || !evolutionConfigurado()) return null;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ jid?: string; lid?: string | null; exists?: boolean }>>(
    `/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ numbers: [num] }) },
  );
  if (!r.ok || !Array.isArray(r.data)) return null;
  const lid = r.data[0]?.lid;
  if (!lid) return null;
  return lid.includes('@lid') ? lid : `${lid.replace(/\D/g, '')}@lid`;
}

// ── Etiquetas (labels) de WhatsApp Business ──────────────────────────────────
// No se pueden CREAR por API (se crean en el celular y llegan por labels.edit);
// sólo se listan y se asignan/quitan a un número. Best-effort.
export type EvLabel = { id: string; name: string | null; color: number | null };
export async function listarLabelsEvolution(): Promise<EvLabel[]> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado()) return [];
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<Array<{ id?: string; labelId?: string; name?: string; color?: number | string }>>(`/label/findLabels/${encodeURIComponent(instance)}`);
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data.map((l) => ({ id: String(l.id ?? l.labelId ?? ''), name: l.name ?? null, color: l.color != null ? Number(l.color) : null })).filter((l) => l.id);
}

// Asigna/quita una etiqueta a un número. action: 'add' | 'remove'. Best-effort.
export async function asignarLabel(telefono: string, labelId: string, action: 'add' | 'remove'): Promise<boolean> {
  const num = (telefono || '').replace(/\D/g, '');
  const ws = await getWorkspaceActual();
  if (ws == null || !num || !labelId || !evolutionConfigurado()) return false;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch(`/label/handleLabel/${encodeURIComponent(instance)}`, {
    method: 'POST', body: JSON.stringify({ number: num, labelId, action }),
  });
  return r.ok;
}

export type EvChat = { remoteJid?: string; pushName?: string; profilePicUrl?: string | null; unreadCount?: number; updatedAt?: string; lastMessage?: EvRecord };

// Lista de chats del store de Evolution (los que tienen al menos un mensaje).
export async function fetchChatsEvolution(): Promise<EvChat[]> {
  const ws = await getWorkspaceActual();
  if (ws == null || !evolutionConfigurado()) return [];
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<EvChat[] | { chats?: EvChat[] }>(
    `/chat/findChats/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  if (!r.ok) return [];
  const d = r.data;
  const arr = Array.isArray(d) ? d : ((d as { chats?: EvChat[] } | null)?.chats ?? []);
  return Array.isArray(arr) ? arr : [];
}

// Bytes de la media de un mensaje (findMessages NO trae base64 → se pide aparte).
// POST /chat/getBase64FromMediaMessage. Best-effort: null si falla. Scopeado al ws.
export async function fetchMediaBase64(chatJid: string, waMessageId: string, fromMe: boolean): Promise<{ base64: string; mimetype: string } | null> {
  const ws = await getWorkspaceActual();
  if (ws == null || !waMessageId || !evolutionConfigurado()) return null;
  const instance = instanceNameDeWs(ws);
  const r = await evFetch<{ base64?: string; mimetype?: string; message?: { base64?: string } }>(
    `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
    { method: 'POST', body: JSON.stringify({ message: { key: { id: waMessageId, remoteJid: chatJid, fromMe } }, convertToMp4: false }) },
  );
  if (!r.ok) return null;
  const b64 = r.data?.base64 || r.data?.message?.base64;
  if (!b64) return null;
  return { base64: soloB64(b64), mimetype: r.data?.mimetype || 'application/octet-stream' };
}

// Estado (tick) de un record de Evolution → nuestro status (0-5 de Baileys / string).
export function statusDeRecord(rec: EvRecord): string | null {
  const s = rec.MessageUpdate?.[rec.MessageUpdate.length - 1]?.status;
  if (!s) return rec.key?.fromMe ? 'sent' : null;
  const up = String(s).toUpperCase();
  if (up.includes('READ')) return 'read';
  if (up.includes('DELIV')) return 'delivered';
  if (up.includes('SERVER') || up.includes('SENT')) return 'sent';
  if (up.includes('ERROR') || up.includes('FAIL')) return 'failed';
  return rec.key?.fromMe ? 'sent' : null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// '5216863996369@s.whatsapp.net' → '5216863996369'
export function jidToNumero(jid: string | null): string | null {
  if (!jid) return null;
  return jid.replace(/@.*/, '').replace(/:.*/, '') || null;
}
