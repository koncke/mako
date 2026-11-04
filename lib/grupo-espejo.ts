// =============================================================================
// grupo-espejo — lo que entra por el grupo de WhatsApp se ve también en la app (3/11/2026)
// =============================================================================
// Requisito 5 de Martín: mientras exista el grupo de WhatsApp, lo que entra por ahí y lo que MaKo manda ahí se ve también en la app, sin duplicar y sin que MaKo conteste dos veces.
//
// ⚠️ NUNCA LLAMA AL DOER. Por eso MaKo no contesta dos veces: el doer sigue entrando sólo por su `after` del webhook, una vez, y acá sólo se escriben filas. Lo de la app no tiene ningún
// camino a WhatsApp. Corre SINCRÓNICO en el webhook, antes del turno: `after` no es durable.
//
// ⚠️ LA PUERTA ES `wsDelGrupoOficial`, NUNCA EL WS DE LA INSTANCIA. La voz es el número personal de Martín: `messages.upsert` trae TODOS sus grupos. Sin esta puerta, sus grupos
// personales entrarían al hilo de un negocio; y con `wsDeInstancia` caería todo en el ws1 (bug del 06/10, documentado en el webhook).
//
// ⚠️ EL ECO: la copia se escribe ANTES del envío (lib/grupo-app.ts), así que lo que vuelve `fromMe` se busca por su TEXTO entre las copias sin id. No depende del anillo, que con la voz en
// `mako_ws<n>` ya perdió carreras. Los dos lados se comparan con `linksConWs`: el doer manda `/tickets?t=5` crudo y la copia lo guarda con `&ws=13`; sin normalizar, el eco no empareja y sale
// una burbuja doble, a veces a nombre de Martín.
//
// ⚠️ EN LOS GRUPOS DONDE LA LÍNEA NO ESTÁ, EVOLUTION NO ENTREGA NADA: ahí se ve lo que MaKo manda y lo escrito en la app, pero NO lo que esas personas escriban en WhatsApp. No tiene arreglo sin
// una línea adentro, y sumarla es otra decisión.
// =============================================================================

import 'server-only';
import { fetchMediaBase64EnInstancia } from './evolution';
import { conMediaDelMomento } from './grupos-guardados-media';
import { taparClavesDelMensaje } from './doer-claves';
import { citaDelMensaje } from './doer-equipo';
import { esEcoDeMaKo, vozPropiaDeMaKo } from './doer-para-quien';
import { esFirmaDelEquipo } from './aviso-arreglo-reglas';
import { esMp3, tipoPorFirma } from './mako-adjuntos';
import { idsEnviadosAlGrupo, instanciaVoz } from './mako-grupo';
import { OWNER_WS } from './workspace';
import { wsDelGrupoOficial } from './mako-doer-in';
import { avisarMiembros, completarArchivoDeLaFila, escribirDelEspejo, guardarArchivoDelGrupo, ponerIdALaCopia, sinArchivoEnLaFila } from './grupo-app';
import { PUSH_DEL_ESPEJO_HASTA_MS, autorDePersona, type AdjuntoGrupo, type TipoAdjuntoGrupo } from './grupo-reglas';

type Msg = Record<string, unknown> & {
  key?: { remoteJid?: string; id?: string; fromMe?: boolean; participant?: string };
  message?: Record<string, unknown>; pushName?: string; messageTimestamp?: unknown; base64?: string;
};
const TOPE_MEDIA_MS = 8000;

const esOgg = (b: Uint8Array): boolean => b.length > 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53;

/** Lo que se ve de un mensaje de WhatsApp: su texto y, si trae un archivo que se guarda, de qué tipo. Video y sticker quedan como texto. null: no es un mensaje (una reacción, un protocolo). */
export function leerMensajeDeWhatsApp(message: Record<string, unknown> | undefined): { texto: string; adjunto: { tipo: TipoAdjuntoGrupo; mime: string; nombre?: string; secs?: number } | null } | null {
  const m = message ?? {};
  if (m.reactionMessage || m.protocolMessage) return null;
  if (typeof m.conversation === 'string' && m.conversation.trim()) return { texto: m.conversation, adjunto: null };
  const ext = m.extendedTextMessage as { text?: string } | undefined;
  if (typeof ext?.text === 'string' && ext.text.trim()) return { texto: ext.text, adjunto: null };
  const img = m.imageMessage as { caption?: string; mimetype?: string } | undefined;
  if (img) return { texto: img.caption ?? '', adjunto: { tipo: 'imagen', mime: img.mimetype || 'image/jpeg' } };
  const aud = (m.audioMessage ?? m.pttMessage) as { mimetype?: string; seconds?: number } | undefined;
  if (aud) return { texto: '', adjunto: { tipo: 'audio', mime: aud.mimetype || 'audio/ogg', ...(Number.isFinite(Number(aud.seconds)) ? { secs: Number(aud.seconds) } : {}) } };
  const doc = (m.documentMessage ?? (m.documentWithCaptionMessage as { message?: { documentMessage?: unknown } } | undefined)?.message?.documentMessage) as { caption?: string; mimetype?: string; fileName?: string } | undefined;
  if (doc) {
    const esPdf = /pdf/i.test(doc.mimetype ?? '') || /\.pdf$/i.test(doc.fileName ?? '');
    if (esPdf) return { texto: doc.caption ?? '', adjunto: { tipo: 'pdf', mime: 'application/pdf', ...(doc.fileName ? { nombre: doc.fileName } : {}) } };
    return { texto: `${doc.caption ? `${doc.caption}\n` : ''}(archivo en WhatsApp${doc.fileName ? `: ${doc.fileName}` : ''})`, adjunto: null };
  }
  const vid = m.videoMessage as { caption?: string } | undefined;
  if (vid) return { texto: `${vid.caption ? `${vid.caption}\n` : ''}(video en WhatsApp)`, adjunto: null };
  if (m.stickerMessage) return { texto: '(sticker en WhatsApp)', adjunto: null };
  if (m.contactMessage || m.contactsArrayMessage) return { texto: '(contacto en WhatsApp)', adjunto: null };
  if (m.locationMessage) return { texto: '(ubicación en WhatsApp)', adjunto: null };
  return null;
}

/** ¿Estos bytes son lo que dice ser? Lo que no es, no se guarda: un HTML o un SVG con nombre de PDF se serviría en línea desde el storage y sirve para engañar a quien lo abre. */
function bytesAceptados(tipo: TipoAdjuntoGrupo, b: Uint8Array): boolean {
  if (tipo === 'audio') return esMp3(b) || esOgg(b);
  const f = tipoPorFirma(b);
  return tipo === 'imagen' ? f?.tipo === 'image' : f?.tipo === 'document';
}

const fechaDe = (ts: unknown): string | null => {
  const n = Number(typeof ts === 'object' && ts ? (ts as { low?: unknown }).low : ts);
  return Number.isFinite(n) && n > 1_000_000_000 ? new Date(n * 1000).toISOString() : null;
};

async function espejarUno(instance: string, crudo: Msg, deQuien: Map<string, number | null>): Promise<void> {
  const jid = crudo.key?.remoteJid ?? '';
  const waId = crudo.key?.id ?? '';
  if (!jid.endsWith('@g.us') || !waId) return;
  if (!deQuien.has(jid)) deQuien.set(jid, await wsDelGrupoOficial(jid).catch(() => null));
  const ws = deQuien.get(jid) ?? null;
  if (ws == null) return;
  // ANTES de guardar: una clave pegada en WhatsApp quedaría a la vista de un invitado de otro negocio.
  const m = taparClavesDelMensaje(crudo).mensaje;
  const leido = leerMensajeDeWhatsApp(m.message);
  if (!leido) return;
  const fromMe = !!m.key?.fromMe;
  const adjunto: AdjuntoGrupo | null = leido.adjunto ? { ...leido.adjunto, path: null } : null;
  if (fromMe && (await ponerIdALaCopia(ws, waId, leido.texto, leido.adjunto?.tipo ?? null))) return;
  let autor_tipo: 'persona' | 'mako' | 'equipo' = 'persona';
  if (fromMe) {
    const [enviados, voz] = await Promise.all([
      idsEnviadosAlGrupo(OWNER_WS, jid).catch(() => [] as string[]),
      instanciaVoz({ estricto: true }).catch(() => null),
    ]);
    if (esEcoDeMaKo({ fromMe: true, msgId: waId, instancia: instance, voz: vozPropiaDeMaKo(voz), enviados })) autor_tipo = esFirmaDelEquipo(leido.texto) ? 'equipo' : 'mako';
  }
  const cita = citaDelMensaje(m as never);
  const creada = await escribirDelEspejo(ws, {
    autor_tipo, autor_nombre: autor_tipo === 'persona' ? autorDePersona(m.pushName, 'Alguien en WhatsApp') : autor_tipo === 'mako' ? 'MaKo' : 'Equipo de MaKo',
    canal: 'whatsapp', texto: leido.texto, adjunto, wa_message_id: waId, wa_at: fechaDe(m.messageTimestamp),
  }, cita?.id ?? null);
  // Una re-entrega, o dos líneas con el mismo mensaje: una fila, y nada más.
  if (!creada) return;
  if (adjunto) {
    // La fila ya existe: el texto que venía detrás no queda antes que esta foto en el hilo. El archivo se baja con tope y se completa; si no baja, queda sin archivo y con su texto.
    await Promise.race([
      (async () => {
        const conMedia = await conMediaDelMomento(instance, m as never, fetchMediaBase64EnInstancia) as Msg;
        const b64 = typeof conMedia.base64 === 'string' ? conMedia.base64 : null;
        const bytes = b64 ? Buffer.from(b64, 'base64') : null;
        if (!bytes || !bytesAceptados(adjunto.tipo, bytes)) { await sinArchivoEnLaFila(ws, creada.id, adjunto.tipo); return; }
        const path = await guardarArchivoDelGrupo(ws, bytes, adjunto.mime ?? 'application/octet-stream', adjunto.nombre);
        if (path) await completarArchivoDeLaFila(ws, creada.id, { ...adjunto, path, bytes: bytes.length });
        else await sinArchivoEnLaFila(ws, creada.id, adjunto.tipo);
      })(),
      new Promise<void>((r) => { const t = setTimeout(r, TOPE_MEDIA_MS); (t as { unref?: () => void }).unref?.(); }),
    ]).catch((e: unknown) => console.warn(`[grupo-espejo] ws${ws}: el archivo no se pudo guardar: ${e instanceof Error ? e.message : String(e)}`));
  }
  // Lo viejo que Evolution reentrega al reconectar entra al hilo, y no suena.
  const at = creada.wa_at ? Date.parse(creada.wa_at) : Date.now();
  if (Date.now() - at < PUSH_DEL_ESPEJO_HASTA_MS) await avisarMiembros(ws, creada);
}

/** El espejo de los mensajes de un `messages.upsert`. Nunca tira: el webhook sigue. */
export async function espejarDeWhatsApp(instance: string, grupos: readonly Record<string, unknown>[]): Promise<void> {
  const deQuien = new Map<string, number | null>();
  for (const m of grupos) {
    try { await espejarUno(instance, m as Msg, deQuien); } catch (e) {
      console.error(`[grupo-espejo] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
