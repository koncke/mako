// =============================================================================
// Espejo de mensajes del WhatsApp NO oficial (Evolution) — F2.2
// =============================================================================
// guardarMensajeUpsert() lo llama el webhook (dentro de runWithWorkspace, así
// getTenantDb scopea) para cada messages.upsert: parsea el payload, matchea el
// lead por teléfono, baja la multimedia (best-effort) a un bucket propio y
// guarda todo en wa_mensajes (raw incluido → respaldo total del PDF). Las
// funciones de lectura alimentan el inbox.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { OWNER_WS } from '@/lib/auth-session';
import { jidToNumero } from '@/lib/evolution';
import { normalizarTelefono } from '@/lib/leads';
import { pausarPorRespuesta } from '@/lib/nutricion';
import { MEDIA_BUCKET, subirMedia } from '@/lib/evolution-media';

// ── Parseo del payload de Evolution ──────────────────────────────────────────
type UpsertData = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: Record<string, unknown> & { base64?: string };
  messageType?: string;
  messageTimestamp?: number | string;
  base64?: string;
};

type Contenido = { tipo: string; texto: string | null; mediaMime: string | null; mediaBase64: string | null; ext: string };

// Extrae tipo, texto/caption y (si hay) la multimedia en base64. Defensivo: si
// el shape cambia, cae a 'otro' y el raw igual queda guardado.
function extraerContenido(data: UpsertData): Contenido {
  const m = (data.message ?? {}) as Record<string, unknown>;
  const g = (k: string): Record<string, unknown> | null => (m[k] && typeof m[k] === 'object' ? (m[k] as Record<string, unknown>) : null);
  // Evolution con webhookBase64:true adjunta la media en base64 en alguno de estos.
  const b64 = (data.base64 as string) || (data.message?.base64 as string)
    || (g('imageMessage')?.base64 as string) || (g('audioMessage')?.base64 as string)
    || (g('videoMessage')?.base64 as string) || (g('documentMessage')?.base64 as string) || null;

  if (typeof m.conversation === 'string') return { tipo: 'text', texto: m.conversation, mediaMime: null, mediaBase64: null, ext: '' };
  const ext = g('extendedTextMessage');
  if (ext) return { tipo: 'text', texto: (ext.text as string) ?? '', mediaMime: null, mediaBase64: null, ext: '' };

  // MIME fijo por tipo (no confiamos en el mimetype del payload — un contacto
  // podría spoofearlo; lo servimos por URL firmada). Cada tipo → un mime seguro.
  const img = g('imageMessage');
  if (img) return { tipo: 'image', texto: (img.caption as string) ?? null, mediaMime: 'image/jpeg', mediaBase64: b64, ext: 'jpg' };
  const vid = g('videoMessage');
  if (vid) return { tipo: 'video', texto: (vid.caption as string) ?? null, mediaMime: 'video/mp4', mediaBase64: b64, ext: 'mp4' };
  const aud = g('audioMessage');
  if (aud) return { tipo: 'audio', texto: null, mediaMime: 'audio/ogg', mediaBase64: b64, ext: 'ogg' };
  const doc = g('documentMessage');
  if (doc) return { tipo: 'document', texto: (doc.fileName as string) ?? (doc.caption as string) ?? null, mediaMime: 'application/octet-stream', mediaBase64: b64, ext: 'bin' };
  const stk = g('stickerMessage');
  if (stk) return { tipo: 'sticker', texto: null, mediaMime: 'image/webp', mediaBase64: b64, ext: 'webp' };

  // Reacciones, ediciones y mensajes de protocolo (revoke, etc.) → 'evento': se
  // guardan (respaldo) pero no cuentan como "último mensaje" ni pausan nutrición.
  if (g('reactionMessage') || g('protocolMessage') || g('editedMessage') || g('pollUpdateMessage')) {
    return { tipo: 'evento', texto: null, mediaMime: null, mediaBase64: null, ext: '' };
  }

  return { tipo: 'otro', texto: null, mediaMime: null, mediaBase64: null, ext: '' };
}

function tsToISO(ts: number | string | undefined): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString();
  return new Date().toISOString();
}

// Match del lead por teléfono. Preferimos igualdad exacta del normalizado; si no,
// caemos al sufijo de 10 dígitos (como el webhook de Chatwoot) con orden estable
// para que sea determinista. Scopeado al workspace por getTenantDb.
async function matchLeadPorTelefono(telNorm: string): Promise<number | null> {
  if (telNorm.length < 8) return null;
  const supabase = await getTenantDb();
  const exacto = await supabase.from('leads').select('id').eq('telefono_normalizado', telNorm).order('id').limit(1);
  const eId = ((exacto.data ?? []) as Array<{ id: number }>)[0]?.id;
  if (eId) return eId;
  const last = telNorm.slice(-10);
  const suf = await supabase.from('leads').select('id').like('telefono_normalizado', `%${last}`).order('id').limit(1);
  return ((suf.data ?? []) as Array<{ id: number }>)[0]?.id ?? null;
}

// Guarda un messages.upsert. IDEMPOTENTE y no destructivo: Evolution reenvía el
// mismo wa_message_id (reintentos, sync 'append' de historial que a veces NO
// trae la media). Por eso: (a) si la fila ya existe, NO re-subimos media ni
// pisamos media_path/texto/lead_id con null — solo COMPLETAMOS lo que faltaba;
// (b) no re-pausamos la nutrición en re-entregas. Así el respaldo total no se
// corrompe con una re-entrega vacía.
export async function guardarMensajeUpsert(instance: string, data: UpsertData): Promise<void> {
  const key = data.key;
  if (!key?.remoteJid || !key?.id) return;
  const chatJid = key.remoteJid;
  // Ignoramos grupos y estados (además de groupsIgnore en Evolution).
  if (chatJid.endsWith('@g.us') || chatJid.startsWith('status@')) return;

  const fromMe = !!key.fromMe;
  const telefono = normalizarTelefono(jidToNumero(chatJid));
  const { tipo, texto, mediaMime, mediaBase64, ext } = extraerContenido(data);

  const supabase = await getTenantDb();
  const { data: existente } = await supabase
    .from('wa_mensajes').select('id, media_path, texto, lead_id')
    .eq('wa_message_id', key.id).maybeSingle();
  const prev = existente as { id: number; media_path: string | null; texto: string | null; lead_id: number | null } | null;

  // Match de lead solo si hace falta (no lo teníamos aún).
  const leadId = prev?.lead_id ?? (telefono ? await matchLeadPorTelefono(telefono) : null);

  // Subimos media SOLO si es fila nueva o todavía no tenía media guardada.
  let mediaPath: string | null = prev?.media_path ?? null;
  if (!mediaPath && mediaBase64 && mediaMime) {
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    mediaPath = await subirMedia(ws, instance, key.id, mediaBase64, mediaMime, ext);
  }

  if (prev) {
    // Re-entrega: completar SOLO lo que falta, nunca pisar con null.
    const patch: Record<string, unknown> = {};
    if (!prev.media_path && mediaPath) { patch.media_path = mediaPath; patch.media_mime = mediaMime; }
    if (!prev.texto && texto) patch.texto = texto;
    if (!prev.lead_id && leadId) patch.lead_id = leadId;
    if (Object.keys(patch).length) await supabase.from('wa_mensajes').update(patch).eq('id', prev.id);
    return; // ya existía → no re-pausar nutrición
  }

  await supabase.from('wa_mensajes').insert({
    instance_name: instance,
    chat_jid: chatJid,
    telefono,
    wa_message_id: key.id,
    from_me: fromMe,
    tipo,
    texto,
    media_path: mediaPath,
    media_mime: mediaPath ? mediaMime : null,
    push_name: data.pushName ?? null,
    lead_id: leadId,
    wa_timestamp: tsToISO(data.messageTimestamp),
    raw: data as unknown as Record<string, unknown>,
  });

  // El lead RESPONDIÓ (mensaje entrante REAL, no reacción/protocolo) → pausar su
  // nutrición, como el webhook de Chatwoot. Solo en el insert (no re-entregas).
  if (!fromMe && leadId && tipo !== 'evento' && tipo !== 'otro') {
    try { await pausarPorRespuesta(leadId); } catch { /* no fatal */ }
  }
}

// ── Lectura para el inbox ────────────────────────────────────────────────────
export type WaConversacion = {
  chatJid: string; telefono: string | null; nombre: string; leadId: number | null;
  empresa: string | null;
  ultimoTexto: string | null; ultimoTipo: string | null; ultimaFecha: string | null;
  ultimoEntrante: boolean; total: number;
};

// Conversaciones del canal no oficial: agrupa wa_mensajes por chat (en JS, como
// el inbox de Chatwoot). Trae los últimos N y arma un hilo por contacto.
export async function getConversacionesNoOficial(limite = 600): Promise<WaConversacion[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('wa_mensajes')
    .select('chat_jid, telefono, push_name, texto, tipo, from_me, wa_timestamp, lead_id')
    .neq('tipo', 'evento')   // reacciones/protocolo no cuentan como "último mensaje"
    .order('wa_timestamp', { ascending: false })
    .limit(limite);
  const rows = (data ?? []) as Array<{ chat_jid: string; telefono: string | null; push_name: string | null; texto: string | null; tipo: string | null; from_me: boolean; wa_timestamp: string | null; lead_id: number | null }>;

  const porChat = new Map<string, WaConversacion>();
  for (const r of rows) {
    const prev = porChat.get(r.chat_jid);
    if (!prev) {
      porChat.set(r.chat_jid, {
        chatJid: r.chat_jid, telefono: r.telefono, nombre: r.push_name || r.telefono || r.chat_jid.replace(/@.*/, ''),
        leadId: r.lead_id, empresa: null, ultimoTexto: r.texto, ultimoTipo: r.tipo, ultimaFecha: r.wa_timestamp,
        ultimoEntrante: !r.from_me, total: 1,
      });
    } else {
      prev.total += 1;
      if (!prev.leadId && r.lead_id) prev.leadId = r.lead_id;
      if (prev.nombre === prev.chatJid.replace(/@.*/, '') && r.push_name) prev.nombre = r.push_name;
    }
  }
  const convs = [...porChat.values()];
  // Enriquecer con la empresa del lead (tarjeta de lead + contexto de MaKo).
  const leadIds = [...new Set(convs.map((c) => c.leadId).filter((x): x is number => x != null))];
  if (leadIds.length) {
    const { data: leads } = await supabase.from('leads').select('id, empresa').in('id', leadIds);
    const empresaPorId = new Map(((leads ?? []) as Array<{ id: number; empresa: string | null }>).map((l) => [l.id, l.empresa]));
    for (const c of convs) if (c.leadId) c.empresa = empresaPorId.get(c.leadId) ?? null;
  }
  return convs;
}

export type WaMensaje = {
  id: number; fromMe: boolean; tipo: string | null; texto: string | null;
  mediaUrl: string | null; mediaMime: string | null; fecha: string | null;
};

// Mensajes de un chat (asc) con URLs firmadas para la multimedia.
export async function getMensajesDeChat(chatJid: string, limite = 300): Promise<WaMensaje[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('wa_mensajes')
    .select('id, from_me, tipo, texto, media_path, media_mime, wa_timestamp')
    .eq('chat_jid', chatJid)
    .neq('tipo', 'evento')   // no ensuciamos el hilo con reacciones/protocolo
    .order('wa_timestamp', { ascending: true })
    .limit(limite);
  const rows = (data ?? []) as Array<{ id: number; from_me: boolean; tipo: string | null; texto: string | null; media_path: string | null; media_mime: string | null; wa_timestamp: string | null }>;

  // Firmar las media en un solo batch de llamadas.
  const out: WaMensaje[] = [];
  for (const r of rows) {
    let mediaUrl: string | null = null;
    if (r.media_path) {
      const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(r.media_path, 3600);
      mediaUrl = signed?.signedUrl ?? null;
    }
    out.push({ id: r.id, fromMe: r.from_me, tipo: r.tipo, texto: r.texto, mediaUrl, mediaMime: r.media_mime, fecha: r.wa_timestamp });
  }
  return out;
}
