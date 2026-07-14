// =============================================================================
// mako-chat — leer/mandar en los GRUPOS de la línea de MaKo (para /agencia)
// =============================================================================
// El admin ve, desde el WhatsApp de MaKo, SOLO los grupos (…@g.us) de la instancia
// de la voz de MaKo: el grupo SuperAdmin, los "MaKo <> cliente" y los de prueba.
// Lee directo del store de Evolution (findChats/findMessages) de esa instancia
// (no del workspace), y manda con la voz de MaKo. Best-effort: nunca lanza.

import 'server-only';
import { instanciaVoz, enviarAGrupoJid, KEY_GRUPO_SUPERADMIN, KEY_GRUPO_JID } from './mako-grupo';
import { getSupabaseServer } from './supabase';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

async function ev<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  if (!BASE || !KEY) return null;
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store', signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? (JSON.parse(t) as T) : null;
  } catch { return null; }
}

const esGrupo = (jid: string | undefined | null): boolean => !!jid && jid.endsWith('@g.us');

// Texto legible de un record de Evolution (conversation / texto extendido / caption).
type EvMsg = {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string };
  pushName?: string; messageTimestamp?: number | string;
  message?: Record<string, unknown>;
};
export type TipoMedia = 'image' | 'audio' | 'video' | 'document' | 'sticker';
type Parsed = { texto: string; tipo: TipoMedia | null; mime: string | null };
// Extrae texto + tipo de media + mimetype de un record de Evolution.
function parseMensaje(m: Record<string, unknown> | undefined): Parsed {
  if (!m) return { texto: '', tipo: null, mime: null };
  if (typeof m.conversation === 'string') return { texto: m.conversation, tipo: null, mime: null };
  const ext = m.extendedTextMessage as { text?: string } | undefined;
  if (ext?.text) return { texto: ext.text, tipo: null, mime: null };
  const img = m.imageMessage as { caption?: string; mimetype?: string } | undefined;
  if (img) return { texto: img.caption || '', tipo: 'image', mime: img.mimetype || 'image/jpeg' };
  const vid = m.videoMessage as { caption?: string; mimetype?: string } | undefined;
  if (vid) return { texto: vid.caption || '', tipo: 'video', mime: vid.mimetype || 'video/mp4' };
  const aud = m.audioMessage as { mimetype?: string } | undefined;
  if (aud) return { texto: '', tipo: 'audio', mime: aud.mimetype || 'audio/ogg' };
  const doc = m.documentMessage as { fileName?: string; title?: string; mimetype?: string } | undefined;
  if (doc) return { texto: doc.fileName || doc.title || 'Documento', tipo: 'document', mime: doc.mimetype || 'application/octet-stream' };
  if (m.stickerMessage) return { texto: '', tipo: 'sticker', mime: 'image/webp' };
  return { texto: '', tipo: null, mime: null };
}
// Solo el texto (para el preview de la lista de grupos).
function textoDeMensaje(m: Record<string, unknown> | undefined): string {
  const p = parseMensaje(m);
  if (p.texto) return p.texto;
  return p.tipo === 'image' ? '📷 Foto' : p.tipo === 'audio' ? '🎤 Nota de voz' : p.tipo === 'video' ? '🎥 Video' : p.tipo === 'document' ? '📄 Documento' : p.tipo === 'sticker' ? 'Sticker' : '';
}
const ts = (v: number | string | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return n > 1e12 ? n : n * 1000; // Evolution manda segundos
};

export type GrupoChat = { jid: string; nombre: string; foto: string | null; ultimo: string; ultimoAt: number };

// JIDs de grupos que MaKo administra (SuperAdmin + "MaKo <> cliente" de cada ws),
// leídos de app_settings. Sirven para filtrar los grupos PERSONALES del número
// (mientras la voz sea el número de Martín, está en muchísimos grupos ajenos).
async function jidsGruposMaKo(): Promise<Set<string>> {
  try {
    const { data } = await getSupabaseServer()
      .from('app_settings').select('value').in('key', [KEY_GRUPO_SUPERADMIN, KEY_GRUPO_JID]);
    return new Set(((data ?? []) as Array<{ value: string }>).map((r) => r.value).filter(Boolean));
  } catch { return new Set<string>(); }
}
// Un grupo es "de MaKo" si su nombre arranca con "MaKo" (convención) o su JID está
// guardado como grupo de MaKo. Así el admin ve SOLO clientes + prueba + SuperAdmin.
function esGrupoMaKo(nombre: string, jid: string, conocidos: Set<string>): boolean {
  return nombre.trim().toLowerCase().startsWith('mako') || conocidos.has(jid);
}

/** Lista los grupos DE MaKo de la instancia de voz (no los personales del número). */
export async function listarGruposMaKo(): Promise<GrupoChat[]> {
  const inst = await instanciaVoz();
  const [data, conocidos] = await Promise.all([
    ev<Array<Record<string, unknown>> | { chats?: Array<Record<string, unknown>> }>(
      `/chat/findChats/${inst}`, { method: 'POST', body: JSON.stringify({}) },
    ),
    jidsGruposMaKo(),
  ]);
  const arr = Array.isArray(data) ? data : (data?.chats ?? []);
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c) => esGrupo((c.remoteJid as string) || (c.id as string)))
    .map((c) => {
      const jid = (c.remoteJid as string) || (c.id as string);
      const last = c.lastMessage as EvMsg | undefined;
      return {
        jid,
        nombre: (c.pushName as string) || (c.name as string) || (c.subject as string) || jid.replace('@g.us', ''),
        foto: (c.profilePicUrl as string) || null,
        ultimo: last ? textoDeMensaje(last.message) : '',
        ultimoAt: last ? ts(last.messageTimestamp) : ((c.updatedAt as number) ?? 0),
      };
    })
    .filter((g) => esGrupoMaKo(g.nombre, g.jid, conocidos))
    .sort((a, b) => b.ultimoAt - a.ultimoAt);
}

export type MensajeChat = {
  id: string; fromMe: boolean; autor: string; texto: string; at: number;
  tipo: TipoMedia | null; mediaMime: string | null; mediaUrl: string | null;
};

/** Mensajes de un grupo (del más viejo al más nuevo). Incluye media (con URL al
 *  proxy /api/admin/mako-chats/media que trae los bytes desde Evolution). */
export async function mensajesGrupoMaKo(jid: string, limite = 200): Promise<MensajeChat[]> {
  if (!esGrupo(jid)) return [];
  const inst = await instanciaVoz();
  const data = await ev<{ messages?: { records?: EvMsg[] } } | EvMsg[]>(
    `/chat/findMessages/${inst}`,
    { method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: jid } }, page: 1, offset: limite }) },
  );
  const records = Array.isArray(data) ? data : (data?.messages?.records ?? []);
  if (!Array.isArray(records)) return [];
  return records
    .map((m) => {
      const p = parseMensaje(m.message);
      const id = m.key?.id ?? '';
      const fromMe = !!m.key?.fromMe;
      const mediaUrl = p.tipo && id
        ? `/api/admin/mako-chats/media?jid=${encodeURIComponent(jid)}&id=${encodeURIComponent(id)}&fromMe=${fromMe ? 1 : 0}`
        : null;
      return {
        id, fromMe,
        autor: fromMe ? 'MaKo' : (m.pushName || 'Contacto'),
        texto: p.texto, tipo: p.tipo, mediaMime: p.mime, mediaUrl,
        at: ts(m.messageTimestamp),
      };
    })
    .filter((m) => m.texto || m.tipo)
    .sort((a, b) => a.at - b.at);
}

/** Trae los bytes de la media de un mensaje de grupo (proxy same-origin). */
export async function fetchMediaGrupoMaKo(jid: string, id: string, fromMe: boolean): Promise<{ base64: string; mimetype: string } | null> {
  if (!esGrupo(jid) || !id) return null;
  const inst = await instanciaVoz();
  const r = await ev<{ base64?: string; mimetype?: string; message?: { base64?: string } }>(
    `/chat/getBase64FromMediaMessage/${inst}`,
    { method: 'POST', body: JSON.stringify({ message: { key: { id, remoteJid: jid, fromMe } }, convertToMp4: false }) },
  );
  const b64 = r?.base64 || r?.message?.base64;
  if (!b64) return null;
  return { base64: soloB64(b64), mimetype: r?.mimetype || 'application/octet-stream' };
}

/** Manda un texto a un grupo desde la voz de MaKo. */
export async function enviarGrupoMaKo(jid: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  if (!esGrupo(jid)) return { ok: false, error: 'jid no es un grupo' };
  const r = await enviarAGrupoJid(jid, texto);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

const soloB64 = (s: string) => (s.includes(',') ? s.split(',').pop()! : s);

/** Manda media (imagen/video/documento) a un grupo desde la voz de MaKo. */
export async function enviarMediaGrupoMaKo(
  jid: string, media: { base64: string; mimetype: string; fileName?: string; tipo: 'image' | 'video' | 'document' }, caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!esGrupo(jid)) return { ok: false, error: 'jid no es un grupo' };
  const inst = await instanciaVoz();
  const media64 = soloB64(media.base64);
  const body: Record<string, unknown> = { number: jid, mediatype: media.tipo, mimetype: media.mimetype, media: media64, delay: 500 };
  if (media.fileName) body.fileName = media.fileName;
  if (caption) body.caption = caption;
  const r = await ev(`/message/sendMedia/${inst}`, { method: 'POST', body: JSON.stringify(body) });
  return r != null ? { ok: true } : { ok: false, error: 'no se pudo enviar la media' };
}

/** Manda una nota de voz (PTT) a un grupo desde la voz de MaKo. */
export async function enviarAudioGrupoMaKo(jid: string, base64: string): Promise<{ ok: boolean; error?: string }> {
  if (!esGrupo(jid)) return { ok: false, error: 'jid no es un grupo' };
  const inst = await instanciaVoz();
  const r = await ev(`/message/sendWhatsAppAudio/${inst}`, {
    method: 'POST', body: JSON.stringify({ number: jid, audio: soloB64(base64), delay: 500, encoding: true }),
  });
  return r != null ? { ok: true } : { ok: false, error: 'no se pudo enviar el audio' };
}
