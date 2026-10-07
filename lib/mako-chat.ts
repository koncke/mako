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
import { leerResultados, esAdminEn, type ParticipanteCrudo } from './participantes-grupo';

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
const soloDigitos = (s: string) => (s || '').replace(/\D/g, '');

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

// ── Detalle / gestión de un grupo (para el modal "detalle del grupo") ─────────
export type GrupoInfo = {
  jid: string; subject: string; descripcion: string; foto: string | null;
  participantes: Array<{ numero: string; admin: boolean }>;
};

/** Info de un grupo (nombre, descripción, foto, participantes). */
export async function infoGrupoMaKo(jid: string): Promise<GrupoInfo | null> {
  if (!esGrupo(jid)) return null;
  const inst = await instanciaVoz();
  const g = await ev<Record<string, unknown>>(`/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(jid)}`);
  if (!g || typeof g !== 'object') return null;
  const parts = (g.participants as Array<{ id?: string; admin?: string | null }> | undefined) ?? [];
  return {
    jid,
    subject: (g.subject as string) || '',
    descripcion: (g.desc as string) || (g.description as string) || '',
    foto: (g.pictureUrl as string) || (g.profilePicUrl as string) || null,
    participantes: parts.map((p) => ({ numero: (p.id || '').replace(/@.*/, ''), admin: !!p.admin })).filter((p) => p.numero),
  };
}

type ResultadoAccion = { ok: boolean; error?: string };

/**
 * Agrega, quita o hace admin a números de un grupo, y DICE si salió.
 *
 * ⚠️ Hasta el 07/10/2026 devolvía `{ ok: r != null }`: «Evolution contestó». Evolution contesta
 * HTTP 200 con el fallo de cada participante adentro, así que el detalle de un grupo decía
 * «Número agregado ✓» sobre un número que no entró. Ahora se lee el `status` de cada uno
 * (`leerResultados`, lib/participantes-grupo.ts). Un número que no vino en la respuesta no
 * cuenta como fallo: no se sabe, y quien necesita SABER relee el grupo (`sumarComoAdmin`).
 *
 * `inst`: la línea que hace el pedido. Sin ella, la voz de MaKo. La mudanza a un número nuevo
 * la pasa explícita para no depender de un setting que ella misma está por cambiar.
 */
async function accionParticipantes(
  jid: string, numeros: string[], action: 'add' | 'remove' | 'promote', inst?: string,
): Promise<ResultadoAccion> {
  const instancia = inst ?? (await instanciaVoz());
  const nums = numeros.map(soloDigitos).filter(Boolean);
  if (!nums.length) return { ok: false, error: 'Falta el número.' };
  const r = await ev(`/group/updateParticipant/${instancia}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ action, participants: nums }),
  });
  if (r == null) return { ok: false, error: 'WhatsApp no contestó.' };
  const malo = leerResultados(r, nums).find((x) => x.ok === false);
  return malo ? { ok: false, error: malo.error } : { ok: true };
}
export const agregarParticipantesMaKo = (jid: string, numeros: string[]) => accionParticipantes(jid, numeros, 'add');
export const quitarParticipantesMaKo = (jid: string, numeros: string[]) => accionParticipantes(jid, numeros, 'remove');

/** Nombre y participantes de un grupo, leídos desde UNA línea. null si no se pudo leer. */
async function grupoDesde(jid: string, inst: string): Promise<{ subject: string; participantes: ParticipanteCrudo[] } | null> {
  const g = await ev<Record<string, unknown>>(`/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(jid)}`);
  if (!g || typeof g !== 'object' || !Array.isArray(g.participants)) return null;
  return { subject: (g.subject as string) || '', participantes: g.participants as ParticipanteCrudo[] };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * La línea NUEVA entra sola, con el link del grupo que saca la línea vieja. Es la salida
 * cuando WhatsApp no deja sumarla directo (403: su privacidad no permite que la agreguen).
 */
async function entrarPorInvitacion(jid: string, desde: string, nueva: string): Promise<boolean> {
  const c = await ev<{ inviteCode?: string; inviteUrl?: string }>(`/group/inviteCode/${desde}?groupJid=${encodeURIComponent(jid)}`);
  const code = c?.inviteCode || (c?.inviteUrl ? c.inviteUrl.split('/').pop() : '') || '';
  if (!code) return false;
  return (await ev(`/group/acceptInviteCode/${nueva}?inviteCode=${encodeURIComponent(code)}`)) != null;
}

export type PasoGrupo = { jid: string; nombre: string; listo: boolean; motivo?: string };

/**
 * Deja a `numero` adentro del grupo y como ADMIN, y lo COMPRUEBA releyendo el grupo.
 *
 * `desde` es la línea que hoy es admin (la voz actual); `nueva`, la instancia del número que
 * entra, que sólo se usa si hay que aceptar una invitación.
 *
 * ⚠️ ADMIN, no sólo participante. La voz de MaKo es la que suma al dueño de un cliente a su
 * grupo (`agregarParticipanteGrupo`) y la que lo renombra: una línea que entra sin admin habla
 * en el grupo pero no puede hacer nada de eso, y el primer «agregá a mi socio» falla.
 *
 * ⚠️ Y el veredicto sale del grupo, no del pedido. El `status` dice qué contestó WhatsApp a
 * cada pedido; lo que importa es cómo quedó el grupo. La relectura va con un respiro:
 * Evolution guarda la metadata del grupo y la actualiza con el evento que dispara el cambio.
 */
export async function sumarComoAdmin(jid: string, numero: string, desde: string, nueva: string): Promise<PasoGrupo> {
  const antes = await grupoDesde(jid, desde);
  if (!antes) return { jid, nombre: jid, listo: false, motivo: 'No pude leer el grupo.' };
  const nombre = antes.subject || jid;
  if (esAdminEn(antes.participantes, numero).admin) return { jid, nombre, listo: true };

  let motivoAlta: string | undefined;
  if (!esAdminEn(antes.participantes, numero).esta) {
    const alta = await accionParticipantes(jid, [numero], 'add', desde);
    if (!alta.ok) {
      motivoAlta = alta.error;
      if (await entrarPorInvitacion(jid, desde, nueva)) { motivoAlta = undefined; await esperar(2500); }
    }
  }
  await accionParticipantes(jid, [numero], 'promote', desde);

  for (const espera of [1500, 3500]) {
    await esperar(espera);
    const despues = await grupoDesde(jid, desde);
    if (!despues) continue;
    const e = esAdminEn(despues.participantes, numero);
    if (e.admin) return { jid, nombre, listo: true };
    if (espera === 3500) {
      return { jid, nombre, listo: false, motivo: e.esta ? 'Entró, pero WhatsApp no lo dejó como admin.' : (motivoAlta ?? 'No quedó adentro del grupo.') };
    }
  }
  return { jid, nombre, listo: false, motivo: 'Lo pedí, pero no pude volver a leer el grupo para comprobarlo.' };
}

/**
 * Los grupos de MaKo, leídos ESTRICTO. Para listar alcanza la versión tolerante; para mudar
 * la voz no: un error de lectura daría «cero grupos», la mudanza saldría «completa» sin tocar
 * ninguno, y MaKo quedaría muda en todos.
 */
export async function gruposDeMaKoEstricto(): Promise<string[]> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings').select('value').in('key', [KEY_GRUPO_SUPERADMIN, KEY_GRUPO_JID]);
  if (error) throw new Error(`No pude leer los grupos de MaKo: ${error.message}`);
  return [...new Set(((data ?? []) as Array<{ value: unknown }>)
    .map((r) => (typeof r.value === 'string' ? r.value : ''))
    .filter((v) => esGrupo(v)))];
}

/**
 * Deja un número como admin en TODOS los grupos de MaKo (SuperAdmin + «MaKo <> cliente»).
 * Corre con la línea `desde` —la voz actual, que es la admin de los grupos—: se llama ANTES
 * de mudar la voz al número nuevo. De a un grupo y con un respiro entre uno y otro: son
 * pedidos al WhatsApp de MaKo, y una ráfaga es lo que hace que lo baneen.
 */
export async function sumarATodosLosGrupos(
  numero: string, lineas: { desde: string; nueva: string },
): Promise<{ grupos: number; ok: number; pasos: PasoGrupo[] }> {
  const jids = await gruposDeMaKoEstricto();
  const pasos: PasoGrupo[] = [];
  for (const jid of jids) {
    if (pasos.length) await esperar(800);
    pasos.push(await sumarComoAdmin(jid, numero, lineas.desde, lineas.nueva));
  }
  return { grupos: jids.length, ok: pasos.filter((p) => p.listo).length, pasos };
}

/** Cambia el nombre del grupo. */
export async function renombrarGrupoMaKo(jid: string, subject: string): Promise<{ ok: boolean }> {
  const inst = await instanciaVoz();
  const r = await ev(`/group/updateGroupSubject/${inst}?groupJid=${encodeURIComponent(jid)}`, { method: 'POST', body: JSON.stringify({ subject }) });
  return { ok: r != null };
}
/** Cambia la descripción del grupo. */
export async function descripcionGrupoMaKoSet(jid: string, descripcion: string): Promise<{ ok: boolean }> {
  const inst = await instanciaVoz();
  const r = await ev(`/group/updateGroupDescription/${inst}?groupJid=${encodeURIComponent(jid)}`, { method: 'POST', body: JSON.stringify({ description: descripcion }) });
  return { ok: r != null };
}
/** Cambia la foto del grupo (base64 crudo o data URL). */
export async function fotoGrupoMaKo(jid: string, base64: string): Promise<{ ok: boolean }> {
  const inst = await instanciaVoz();
  const r = await ev(`/group/updateGroupPicture/${inst}?groupJid=${encodeURIComponent(jid)}`, { method: 'POST', body: JSON.stringify({ image: soloB64(base64) }) });
  return { ok: r != null };
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
