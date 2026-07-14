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
function textoDeMensaje(m: Record<string, unknown> | undefined): string {
  if (!m) return '';
  if (typeof m.conversation === 'string') return m.conversation;
  const ext = m.extendedTextMessage as { text?: string } | undefined;
  if (ext?.text) return ext.text;
  const img = m.imageMessage as { caption?: string } | undefined;
  if (img?.caption) return `📷 ${img.caption}`;
  if (m.imageMessage) return '📷 Imagen';
  if (m.videoMessage) return '🎥 Video';
  if (m.audioMessage) return '🎤 Audio';
  if (m.documentMessage) return '📄 Documento';
  if (m.stickerMessage) return 'Sticker';
  return '';
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

export type MensajeChat = { id: string; fromMe: boolean; autor: string; texto: string; at: number };

/** Mensajes de un grupo (del más viejo al más nuevo). */
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
    .map((m) => ({
      id: m.key?.id ?? '',
      fromMe: !!m.key?.fromMe,
      autor: m.key?.fromMe ? 'MaKo' : (m.pushName || 'Contacto'),
      texto: textoDeMensaje(m.message),
      at: ts(m.messageTimestamp),
    }))
    .filter((m) => m.texto)
    .sort((a, b) => a.at - b.at);
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
