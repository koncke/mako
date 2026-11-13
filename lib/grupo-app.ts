// =============================================================================
// grupo-app — el hilo del grupo de cada negocio dentro de la app (3/11/2026)
// =============================================================================
// Martín: «todas las notificaciones que hoy en día estamos enviando por WhatsApp también haya un chat específico dentro de MaKo Mobile».
// WhatsApp baneó la línea de MaKo, y la app pasa a ser el canal: hay que poder leer el aviso AUNQUE WhatsApp no lo entregue.
//
// ⚠️ `copiarAlGrupo` ES EL PUNTO ÚNICO DE ESCRITURA de lo que MaKo dice sola, y la fila se escribe ANTES de intentar WhatsApp: de eso depende que
// el aviso exista con la línea caída, y que el eco no duplique (lib/grupo-espejo.ts encuentra la fila por su texto). Por dónde pasa todo lo
// que sale a un grupo lo fija tests/grupos-ops-guarda.test.ts: un envío nuevo que la saltee, rojo.
//
// ⚠️ TIENE TOPE Y NO TIRA. Muchos llamadores son crons sin contexto y un aviso no puede frenarse por el hilo: una base colgada dejó a MaKo
// mudo cinco minutos en el anillo (`anotarEnviadosConTope`). Sin la tabla (la 0372 sin aplicar): loguea, y WhatsApp sigue igual.
//
// ⚠️ NADA DE ESTO PASA POR `getTenantDb()`: ver lib/grupo-puerta.ts.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { getSupabaseServer } from './supabase';
import { getWorkspace, wsSuperAdmin } from './workspace';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO, linkApp } from './app-url';
import { DOMINIOS_MAKO } from './email-remitente';
import { BUCKET_ADJUNTOS } from './chart-chats';
import { linksConWs } from './links-con-ws';
import { taparClaves } from './claves-en-el-chat';
import { buscarUsuarioPorEmail } from './usuarios';
import { claveDeLaApp, filaDelId } from './grupo-salida';
import { avisosParaAgencia } from './avisos-catalogo';
import { letraVigente, miembrosDelGrupo, type PersonaDelGrupo } from './grupo-puerta';
import {
  AVISO_DE_INVITACION_CADA_MS, AVISOS_QUE_NO_VE_UN_INVITADO, POR_PAGINA, TOPE_INVITACIONES_POR_HORA, TOPE_INVITADOS, autorDePersona, esPathDelGrupo, filaAlHilo, laVeUnInvitado, sinLinksParaInvitado,
  msgDeFila, textoInvitacionSinCuenta, textoParaComparar, tituloDelGrupo, tituloParaInvitado, type AdjuntoGrupo, type FilaGrupo, type MensajeDelHilo, type TipoAdjuntoGrupo,
} from './grupo-reglas';
import type { PartePreparada } from './mako-tarjeta';

const T = 'grupo_mensajes';
const db = () => getSupabaseServer();
const COLS = 'id, workspace_id, autor_tipo, usuario_id, autor_nombre, canal, texto, adjunto, responde_a, reaccion, aviso_tipo, wa_message_id, wa_at, cliente_id, created_at';
/** Lo que espera un envío a que quede la copia: lo mismo que el anillo anti-eco. Después sigue sola. */
export const TOPE_DE_LA_COPIA_MS = 3000;
/** Lo que la función se queda viva DESPUÉS de responder esperando una copia lenta (`after`). Una base colgada no la retiene hasta el corte de Vercel. */
export const TOPE_DE_LA_COPIA_DESPUES_MS = 10_000;

/** `p`, o null pasados `ms`. El reloj no retiene el proceso. */
function conTope<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<null>((r) => { t = setTimeout(() => r(null), ms); (t as { unref?: () => void }).unref?.(); });
  return Promise.race([p, tope]).finally(() => { if (t) clearTimeout(t); });
}
/** Los hosts de MaKo: lo que se le saca a un invitado. */
export const hostsDeMaKo = (): string[] => [APP_BASE_URL, ...DOMINIOS_MAKO];

export const FALTA_LA_TABLA = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /grupo_(mensajes|invitados|leidos)/.test(String(e.message ?? '')) && /does not exist|could not find/i.test(String(e.message ?? '')));

// ── La clave de la conversación ───────────────────────────────────────────────────────────────────────────────

/**
 * La clave con la que el doer guarda la memoria, las pendientes, el candado y los settings de este negocio: el jid de su grupo de WhatsApp si
 * tiene, para que el «sí» de un lado vea lo propuesto en el otro; si no, `app<ws>@g.us`.
 *
 * ⚠️ TIRA SI NO PUDO LEER (`grupoJidEstricto`): con null, un bache de la base mandaría el mensaje a otra cola, otro candado y otras pendientes de un
 * negocio que sí tiene grupo, y un «sí» no encontraría la propuesta. Quien llama escribe la fila y no encola.
 * ⚠️ El grupo de la plataforma no vive en `mako.grupo_jid` sino en `KEY_GRUPO_SUPERADMIN`, en el ws1: sin este caso, en la app sería otra clave que en
 * WhatsApp, y Martín no encontraría desde la app lo propuesto por WhatsApp.
 */
export async function claveDeConversacion(ws: number): Promise<string> {
  const { grupoJidEstricto, getGrupoSuperAdminJid } = await import('./mako-grupo');
  if (ws === (await wsSuperAdmin().catch(() => null))) {
    const jid = await getGrupoSuperAdminJid();
    if (jid) return jid;
  }
  return (await grupoJidEstricto(ws)) ?? claveDeLaApp(ws);
}

// ── Escribir ──────────────────────────────────────────────────────────────────────────────────────────────────

type FilaNueva = Omit<FilaGrupo, 'id' | 'created_at' | 'workspace_id' | 'reaccion' | 'wa_message_id' | 'aviso_tipo' | 'responde_a' | 'adjunto' | 'usuario_id'> & Partial<Pick<FilaGrupo, 'reaccion' | 'wa_message_id' | 'aviso_tipo' | 'responde_a' | 'adjunto' | 'usuario_id'>>;

/** Inserta una fila. `{ yaEstaba: true }`: el índice único dijo que ese mensaje ya existe (una re-entrega, el mismo `cliente_id`). */
async function insertar(ws: number, f: FilaNueva): Promise<{ fila: FilaGrupo } | { yaEstaba: true } | { error: string }> {
  const { data, error } = await db().from(T).insert({ workspace_id: ws, ...f, texto: (f.texto ?? '').slice(0, 20000) }).select(COLS).single();
  if (error) {
    if (error.code === '23505') return { yaEstaba: true };
    if (!FALTA_LA_TABLA(error)) console.error(`[grupo-app] ws${ws}: no pude escribir en el hilo: ${error.message}`);
    else console.error(`[grupo-app] ⚠️ FALTA LA MIG 0372: ${error.message}`);
    return { error: error.message };
  }
  return { fila: data as unknown as FilaGrupo };
}

export type Copia = { id: number; ids: number[] };

/** Lo que dice una parte de una tarjeta, y lo que hay que subir de ella. */
function filaDeParte(p: PartePreparada, de: 'mako' | 'equipo', ws: number, avisoTipo: string | null): { fila: FilaNueva; subir?: { base64: string; mime: string; nombre?: string } } {
  const base = { autor_tipo: de, autor_nombre: de === 'mako' ? 'MaKo' : 'Equipo de MaKo', canal: 'app' as const, aviso_tipo: avisoTipo };
  if (p.tipo === 'texto') return { fila: { ...base, texto: taparClaves(linksConWs(p.texto, ws, APP_BASE_URL)).texto } };
  if (p.tipo === 'audio') return { fila: { ...base, texto: '', adjunto: { tipo: 'audio', path: null, mime: p.mime } }, subir: { base64: p.base64, mime: p.mime } };
  // Un video o un documento que no es PDF no se guarda: el hilo sólo dibuja fotos, PDF y notas de voz. Queda su texto.
  const esPdf = p.media.tipo === 'document' && /pdf/i.test(p.media.mimetype);
  if (p.media.tipo !== 'image' && !esPdf) {
    const que = p.media.tipo === 'video' ? '(un video)' : `(un archivo${p.media.fileName ? `: ${p.media.fileName}` : ''})`;
    return { fila: { ...base, texto: taparClaves(linksConWs(`${p.caption ? `${p.caption}\n` : ''}${que}`, ws, APP_BASE_URL)).texto } };
  }
  const tipo: TipoAdjuntoGrupo = p.media.tipo === 'image' ? 'imagen' : 'pdf';
  return {
    fila: { ...base, texto: taparClaves(linksConWs(p.caption ?? '', ws, APP_BASE_URL)).texto, adjunto: { tipo, path: null, mime: p.media.mimetype, ...(p.media.fileName ? { nombre: p.media.fileName } : {}) } },
    subir: { base64: p.base64, mime: p.media.mimetype, nombre: p.media.fileName },
  };
}

const soloB64 = (s: string): string => (s.includes(',') ? s.split(',').pop()! : s);
const extDe = (mime: string, nombre?: string): string => {
  const m = /\.([a-z0-9]{1,8})$/i.exec(nombre ?? '');
  if (m) return m[1].toLowerCase();
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' } as Record<string, string>)[mime.split(';')[0].trim()] ?? 'bin';
};

/** Sube un archivo al bucket privado, en `grupos/<ws>/`. null si no se pudo: la fila queda con su texto. */
export async function guardarArchivoDelGrupo(ws: number, bytes: Buffer | Uint8Array, mime: string, nombre?: string): Promise<string | null> {
  const path = `grupos/${ws}/${randomUUID()}.${extDe(mime, nombre)}`;
  const { error } = await db().storage.from(BUCKET_ADJUNTOS).upload(path, Buffer.from(bytes), { contentType: mime.split(';')[0].trim(), upsert: false });
  if (error) { console.error(`[grupo-app] ws${ws}: no pude guardar el archivo: ${error.message}`); return null; }
  return path;
}

/** Lo que dura la firma de un archivo: lo que tarda en abrirse, no más. */
const FIRMA_S = 300;
export async function firmarArchivoDelGrupo(path: string): Promise<string | null> {
  const { data } = await db().storage.from(BUCKET_ADJUNTOS).createSignedUrl(path, FIRMA_S);
  return data?.signedUrl ?? null;
}
/** El binario de un mensaje que no se pudo guardar. Nunca tira. */
export async function borrarArchivoDelGrupo(path: string): Promise<void> {
  await db().storage.from(BUCKET_ADJUNTOS).remove([path]).then(() => {}, () => {});
}

/** Corre después de responder si hay un pedido; si no (un cron, un script), en línea. Nunca tira. */
function porDetras(trabajo: () => Promise<void>): Promise<void> {
  const seguro = () => trabajo().catch((e) => console.error('[grupo-app] por detrás:', e instanceof Error ? e.message : String(e)));
  try { after(seguro); return Promise.resolve(); } catch { /* sin pedido en curso */ }
  return seguro().then(() => {});
}

/**
 * COPIA AL HILO lo que dice MaKo o el equipo. Una fila por parte. Devuelve la última fila, o null si no quedó (y ya se logueó): el envío sigue.
 *
 * El binario de una parte se sube DESPUÉS y la fila nace con `path` null: la tarjeta no se frena subiendo un audio.
 * `pushYaSalio`: el aviso ya le sonó a los admin del negocio por `enviarPushAviso`, y no les suena dos veces.
 */
export async function copiarAlGrupo(ws: number, o: { texto: string; de?: 'mako' | 'equipo'; avisoTipo?: string | null; partes?: readonly PartePreparada[] | null; pushYaSalio?: boolean }): Promise<Copia | null> {
  const de = o.de ?? 'mako';
  const trabajo = (async (): Promise<Copia | null> => {
    const lista: Array<{ fila: FilaNueva; subir?: { base64: string; mime: string; nombre?: string } }> = o.partes?.length
      ? o.partes.map((p) => filaDeParte(p, de, ws, o.avisoTipo ?? null))
      : [filaDeParte({ tipo: 'texto', texto: o.texto }, de, ws, o.avisoTipo ?? null)];
    const ids: number[] = [];
    for (const { fila, subir } of lista) {
      if (!fila.texto.trim() && !subir) continue;
      const r = await insertar(ws, fila);
      if (!('fila' in r)) return ids.length ? { id: ids[ids.length - 1], ids } : null;
      ids.push(Number(r.fila.id));
      if (subir) {
        await porDetras(async () => {
          const path = await guardarArchivoDelGrupo(ws, Buffer.from(soloB64(subir.base64), 'base64'), subir.mime, subir.nombre);
          if (path) await db().from(T).update({ adjunto: { ...(fila.adjunto as AdjuntoGrupo), path } }).eq('workspace_id', ws).eq('id', r.fila.id);
        });
      }
      // Sólo la primera parte suena: una tarjeta en tres mensajes es UN aviso.
      if (ids.length === 1) await porDetras(() => avisarMiembros(ws, r.fila, { pushYaSalio: o.pushYaSalio }));
    }
    return ids.length ? { id: ids[ids.length - 1], ids } : null;
  })().catch((e: unknown) => {
    console.error(`[grupo-app] ws${ws}: la copia falló: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  // ⚠️ LA COPIA QUE PASA EL TOPE NO PUEDE QUEDAR SUELTA (13/11/2026). Quien manda espera `TOPE_DE_LA_COPIA_MS` y sigue; la copia sigue sola, pero en
  // Vercel una promesa que nadie espera se congela cuando el cron o el webhook contestan, y ese aviso no caía en el hilo ni sonaba, sin un error.
  // Registrada en `after`, la función vive hasta que termina (Next espera la promesa que devuelve la función), con su propio tope: una base colgada no
  // retiene la función hasta el corte. Sin pedido en curso (un script) `after` tira, y la copia termina igual.
  try { after(() => conTope(trabajo, TOPE_DE_LA_COPIA_DESPUES_MS)); } catch { /* sin pedido en curso */ }
  let t: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<null>((r) => { t = setTimeout(() => r(null), TOPE_DE_LA_COPIA_MS); (t as { unref?: () => void }).unref?.(); });
  try { return await Promise.race([trabajo, tope]); } finally { if (t) clearTimeout(t); }
}

// ── El espejo (lib/grupo-espejo.ts) ───────────────────────────────────────────────────────────────────────────

/** Una fila que vino de WhatsApp. null: ya estaba (el índice único: una re-entrega, dos líneas). La cita se ata por el id de WhatsApp, siempre de este negocio. */
export async function escribirDelEspejo(ws: number, f: FilaNueva, citaWaId: string | null): Promise<FilaGrupo | null> {
  let responde_a: number | null = null;
  if (citaWaId) {
    const { data } = await db().from(T).select('id').eq('workspace_id', ws).eq('wa_message_id', citaWaId).maybeSingle();
    responde_a = (data as { id?: number } | null)?.id ?? null;
  }
  const r = await insertar(ws, { ...f, texto: taparClaves(f.texto).texto, responde_a });
  return 'fila' in r ? r.fila : null;
}

/**
 * ¿Este eco es una copia que ya está? Se busca entre lo que escribió MaKo o el equipo y todavía no tiene id: los últimos 10 minutos, mismo texto (normalizado con `linksConWs` en los DOS
 * lados) y mismo tipo de archivo. Si está, le pone el id y no hay fila nueva. La más vieja primero: dos avisos iguales seguidos se atan en orden.
 */
export async function ponerIdALaCopia(ws: number, waId: string, texto: string, tipo: TipoAdjuntoGrupo | null): Promise<boolean> {
  const { data: ya } = await db().from(T).select('id').eq('workspace_id', ws).eq('wa_message_id', waId).maybeSingle();
  if (ya) return true;
  const corte = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data, error } = await db().from(T).select('id, texto, adjunto').eq('workspace_id', ws).in('autor_tipo', ['mako', 'equipo']).is('wa_message_id', null)
    .gt('created_at', corte).order('id', { ascending: false }).limit(50);
  if (error) return false;
  const buscado = textoParaComparar(linksConWs(taparClaves(texto).texto, ws, APP_BASE_URL));
  const filas = [...((data ?? []) as Array<{ id: number; texto: string; adjunto: AdjuntoGrupo | null }>)].reverse();
  const copia = filas.find((f) => (f.adjunto?.tipo ?? null) === tipo && textoParaComparar(linksConWs(f.texto, ws, APP_BASE_URL)) === buscado);
  if (!copia) return false;
  await atarIdDeWhatsApp(ws, copia.id, waId);
  return true;
}

export async function completarArchivoDeLaFila(ws: number, fila: number, adjunto: AdjuntoGrupo): Promise<void> {
  await db().from(T).update({ adjunto }).eq('workspace_id', ws).eq('id', fila);
}

/** El archivo no se pudo guardar, o no era lo que decía ser: queda como texto, y nadie toca un archivo que no existe. */
export async function sinArchivoEnLaFila(ws: number, fila: number, tipo: TipoAdjuntoGrupo): Promise<void> {
  const que = tipo === 'audio' ? 'nota de voz' : tipo === 'imagen' ? 'foto' : 'archivo';
  const { data } = await db().from(T).select('texto').eq('workspace_id', ws).eq('id', fila).maybeSingle();
  const previo = String((data as { texto?: string } | null)?.texto ?? '').trim();
  await db().from(T).update({ adjunto: null, texto: `${previo ? `${previo}\n` : ''}(${que} en WhatsApp)` }).eq('workspace_id', ws).eq('id', fila);
}

/** Le pone a la fila el id que WhatsApp le dio a ese mensaje: el eco la encuentra por acá. Nunca tira. */
export async function atarIdDeWhatsApp(ws: number, fila: number, waId: string): Promise<void> {
  if (!waId) return;
  const { error } = await db().from(T).update({ wa_message_id: waId }).eq('workspace_id', ws).eq('id', fila).is('wa_message_id', null);
  // 23505: el eco ganó la carrera y ya hay una fila con ese id. No es un error.
  if (error && error.code !== '23505') console.warn(`[grupo-app] ws${ws}: no pude atar ${waId} a la fila ${fila}: ${error.message}`);
}

/** Una burbuja del sistema: «Joan entró al grupo». No suena. */
export async function escribirSistema(ws: number, texto: string): Promise<void> {
  await insertar(ws, { autor_tipo: 'sistema', autor_nombre: '', canal: 'app', texto }).catch(() => null);
}

/** La reacción de MaKo a un mensaje, por su `key.id` (`app:<fila>` o el de WhatsApp). Nunca tira. */
export async function anotarReaccion(ws: number, id: string, emoji: string): Promise<boolean> {
  const fila = filaDelId(id);
  const q = db().from(T).update({ reaccion: emoji.slice(0, 16) }).eq('workspace_id', ws);
  const { error } = await (fila != null ? q.eq('id', fila) : q.eq('wa_message_id', id));
  if (error) { console.warn(`[grupo-app] ws${ws}: no pude anotar la reacción: ${error.message}`); return false; }
  return true;
}

export type NuevoDePersona = {
  ws: number; quien: PersonaDelGrupo; texto: string; clienteId?: string | null; respondeA?: number | null; adjunto?: AdjuntoGrupo | null;
};
/** El mensaje de una persona en la app. Con el mismo `cliente_id` devuelve la fila de antes: un reintento del navegador no duplica. */
export async function escribirDePersona(n: NuevoDePersona): Promise<{ fila: FilaGrupo; repetida: boolean } | { error: string }> {
  const r = await insertar(n.ws, {
    autor_tipo: 'persona', usuario_id: n.quien.usuarioId, autor_nombre: autorDePersona(n.quien.nombre),
    canal: 'app', texto: n.texto, adjunto: n.adjunto ?? null, responde_a: n.respondeA ?? null, cliente_id: n.clienteId ?? null,
  });
  if ('fila' in r) return { fila: r.fila, repetida: false };
  if ('error' in r) return { error: r.error };
  const { data } = await db().from(T).select(COLS).eq('workspace_id', n.ws).eq('usuario_id', n.quien.usuarioId).eq('cliente_id', n.clienteId ?? '').maybeSingle();
  return data ? { fila: data as unknown as FilaGrupo, repetida: true } : { error: 'no pude leer el mensaje repetido' };
}

// ── Leer ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * UNA FILA DEL GRUPO, POR ID. ⚠️ Los ids son globales y correlativos: siempre con el ws, y para un invitado también desde que entró. null = para esta
 * persona no existe (404). Lo usan el adjunto y la cita: recorrer ids no tiene que dar archivos de otro negocio ni de antes de entrar.
 */
export async function filaParaPersona(ws: number, id: number, quien: Pick<PersonaDelGrupo, 'invitado' | 'desdeId'>): Promise<FilaGrupo | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const { data, error } = await db().from(T).select(COLS).eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const f = data as unknown as FilaGrupo;
  return !quien.invitado || laVeUnInvitado(f, quien.desdeId) ? f : null;
}

/** La fila por su id en el mensaje (`app:<fila>` o el de WhatsApp), siempre del negocio del turno. */
export async function filaPorIdDeMensaje(ws: number, id: string): Promise<FilaGrupo | null> {
  const fila = filaDelId(id);
  const q = db().from(T).select(COLS).eq('workspace_id', ws);
  const { data, error } = await (fila != null ? q.eq('id', fila) : q.eq('wa_message_id', id)).maybeSingle();
  return error || !data ? null : (data as unknown as FilaGrupo);
}

/** El mensaje de una fila de persona, con la forma del de WhatsApp y la letra de AHORA (lib/grupo-puerta.ts). null: no es un mensaje de persona en la app, o no se pudo leer. */
export async function mensajeParaElTurno(ws: number, id: number): Promise<ReturnType<typeof msgDeFila> | null> {
  const { data, error } = await db().from(T).select(COLS).eq('workspace_id', ws).eq('id', id).maybeSingle();
  const f = error ? null : (data as unknown as FilaGrupo | null);
  if (!f || f.autor_tipo !== 'persona' || f.canal !== 'app' || f.usuario_id == null) return null;
  const { data: u } = await db().from('usuarios').select('email').eq('id', f.usuario_id).maybeSingle();
  const email = String((u as { email?: string } | null)?.email ?? '').toLowerCase();
  if (!email) return null;
  const clave = await claveDeConversacion(ws).catch(() => null);
  if (!clave) return null;
  const citada = f.responde_a != null ? await filaParaPersona(ws, Number(f.responde_a), { invitado: false, desdeId: 0 }) : null;
  return msgDeFila(f, { clave, email, letra: await letraVigente(ws, email), nombre: f.autor_nombre, citada });
}

/** Los bytes del archivo de un mensaje, para el turno de MaKo. Nunca sale de este negocio: la fila se busca con su ws. */
export async function mediaDelMensaje(ws: number, id: string): Promise<{ base64: string; mimetype: string } | null> {
  const f = await filaPorIdDeMensaje(ws, id);
  const a = f?.adjunto;
  if (!a || !esPathDelGrupo(ws, a.path)) return null;
  const { data, error } = await db().storage.from(BUCKET_ADJUNTOS).download(a.path);
  if (error || !data) return null;
  return { base64: Buffer.from(await data.arrayBuffer()).toString('base64'), mimetype: a.mime ?? 'application/octet-stream' };
}

export type PaginaDelHilo = { mensajes: MensajeDelHilo[]; hayMas: boolean; cursor: number; makoPensando: boolean };

/**
 * UNA PÁGINA DEL HILO, para esta persona.
 *   · sin nada: los últimos `POR_PAGINA`, en orden;
 *   · `despues`: lo posterior, en orden ASCENDENTE y repitiendo hasta vaciar (`hayMas`): con 150 mensajes y descendente quedaba un hueco. El
 *     navegador pide con solape (`cursor - 30`) y mezcla por id: así ve la reacción de MaKo y el adjunto que se completa después, y no saltea
 *     una fila ajena con id menor que la suya. `cursor` sale SÓLO de lo que devuelve este GET, nunca de lo que él mismo escribió.
 *   · `antes`: lo anterior, de a una página.
 * Un invitado lee sólo `id > desdeId`, en los tres caminos, y sin los avisos «a la agencia».
 */
export async function leerHilo(ws: number, quien: PersonaDelGrupo, o: { despues?: number | null; antes?: number | null } = {}): Promise<PaginaDelHilo | null> {
  let q = db().from(T).select(COLS).eq('workspace_id', ws);
  if (quien.invitado) q = q.gt('id', quien.desdeId);
  const asc = o.despues != null;
  if (asc) q = q.gt('id', o.despues as number);
  if (o.antes != null) q = q.lt('id', o.antes);
  const { data, error } = await q.order('id', { ascending: asc }).limit(POR_PAGINA + 1);
  if (error) { if (!FALTA_LA_TABLA(error)) console.error(`[grupo-app] ws${ws}: no pude leer el hilo: ${error.message}`); return null; }
  const crudas = (data ?? []) as unknown as FilaGrupo[];
  const hayMas = crudas.length > POR_PAGINA;
  const pagina = crudas.slice(0, POR_PAGINA);
  const enOrden = asc ? pagina : [...pagina].reverse();
  const filas = quien.invitado ? enOrden.filter((f) => laVeUnInvitado(f, quien.desdeId)) : enOrden;
  const cursor = enOrden.length ? Number(enOrden[enOrden.length - 1].id) : Number(o.despues ?? 0);
  const hosts = hostsDeMaKo();
  return { mensajes: filas.map((f) => filaAlHilo(f, { usuarioId: quien.usuarioId, invitado: quien.invitado, hosts })), hayMas, cursor, makoPensando: await makoPensando(ws) };
}

/** Lo último del hilo para la API de MaKo (`ver_grupo`, sólo por la app y sólo para quien administra): autor y texto, en orden. null si no se pudo leer. */
export async function leerParaLaApi(ws: number, limite: number): Promise<Array<{ id: number; autor: string; texto: string; cuando: string }> | null> {
  const { data, error } = await db().from(T).select('id, autor_tipo, autor_nombre, texto, created_at').eq('workspace_id', ws).order('id', { ascending: false }).limit(limite);
  if (error) return null;
  return ((data ?? []) as unknown as FilaGrupo[]).reverse().map((f) => ({ id: Number(f.id), autor: f.autor_tipo === 'mako' ? 'MaKo' : f.autor_tipo === 'sistema' ? '(sistema)' : f.autor_nombre, texto: f.texto, cuando: f.created_at }));
}

/** ¿MaKo está con un turno de este grupo? Un candado vivo o algo en la cola. Sin poder leerlo, no: es una criatura de más o de menos. */
export async function makoPensando(ws: number): Promise<boolean> {
  try {
    const clave = await claveDeConversacion(ws);
    const [l, c] = await Promise.all([
      db().from('mako_doer_lock').select('hasta').eq('workspace_id', ws).eq('grupo_jid', clave).limit(1).maybeSingle(),
      db().from('mako_doer_buffer').select('id').eq('workspace_id', ws).eq('grupo_jid', clave).eq('estado', 'pendiente').limit(1).maybeSingle(),
    ]);
    const hasta = (l.data as { hasta?: string | null } | null)?.hasta;
    return (!!hasta && Date.parse(hasta) > Date.now()) || !!c.data;
  } catch { return false; }
}

/** La fila de la lista: lo último que esta persona puede ver y cuántos no leyó. Para un invitado, también desde que entró. */
export async function resumenParaLaLista(ws: number, quien: PersonaDelGrupo): Promise<{ titulo: string; ultimo: MensajeDelHilo | null; noLeidos: number; hastaId: number }> {
  const nombre = (await getWorkspace(ws).catch(() => null))?.nombre ?? '';
  let titulo = tituloDelGrupo(nombre);
  if (quien.invitado) {
    const { data } = await db().from('grupo_invitados').select('abrio_at').eq('workspace_id', ws).eq('usuario_id', quien.usuarioId).maybeSingle();
    titulo = tituloParaInvitado(nombre, !!(data as { abrio_at?: string | null } | null)?.abrio_at);
  }
  let qUlt = db().from(T).select(COLS).eq('workspace_id', ws);
  if (quien.invitado) qUlt = qUlt.gt('id', quien.desdeId);
  const { data: ult } = await qUlt.order('id', { ascending: false }).limit(5);
  const visibles = ((ult ?? []) as unknown as FilaGrupo[]).filter((f) => !quien.invitado || laVeUnInvitado(f, quien.desdeId));
  const { data: l } = await db().from('grupo_leidos').select('hasta_id').eq('workspace_id', ws).eq('usuario_id', quien.usuarioId).maybeSingle();
  const hastaId = Math.max(Number((l as { hasta_id?: unknown } | null)?.hasta_id ?? 0), quien.invitado ? quien.desdeId : 0);
  // ⚠️ `usuario_id.neq.X` SOLO da 0 con los avisos: SQL descarta los NULL, y todo lo de MaKo y lo espejado va con `usuario_id` null.
  const { count } = await db().from(T).select('id', { count: 'exact', head: true }).eq('workspace_id', ws).gt('id', hastaId)
    .neq('autor_tipo', 'sistema').or(`usuario_id.is.null,usuario_id.neq.${quien.usuarioId}`);
  let noLeidos = count ?? 0;
  // ⚠️ Un invitado no ve los avisos a la agencia (`laVeUnInvitado`): tampoco le cuentan. Si no, el número quedaba hasta el próximo mensaje que sí ve. Se restan con
  // los MISMOS filtros del conteo; sin poder leerlos, se restan cero (un número de más, nunca un aviso que no ve).
  const deAgencia = [...avisosParaAgencia(), ...AVISOS_QUE_NO_VE_UN_INVITADO];
  if (quien.invitado && noLeidos > 0 && deAgencia.length) {
    const { count: noLosVe } = await db().from(T).select('id', { count: 'exact', head: true }).eq('workspace_id', ws).gt('id', hastaId)
      .neq('autor_tipo', 'sistema').in('aviso_tipo', deAgencia);
    noLeidos = Math.max(0, noLeidos - (noLosVe ?? 0));
  }
  return { titulo, ultimo: visibles[0] ? filaAlHilo(visibles[0], { usuarioId: quien.usuarioId, invitado: quien.invitado, hosts: hostsDeMaKo() }) : null, noLeidos, hastaId };
}

/** Hasta dónde leyó esta persona. SUBE Y NUNCA BAJA: un upsert desde una pestaña vieja le bajaría la marca al otro dispositivo. */
export async function marcarLeido(ws: number, usuarioId: number, hastaId: number): Promise<void> {
  if (!Number.isSafeInteger(hastaId) || hastaId <= 0) return;
  const { data, error } = await db().from('grupo_leidos').update({ hasta_id: hastaId, updated_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('usuario_id', usuarioId).lt('hasta_id', hastaId).select('hasta_id');
  if (error) throw new Error(error.message);
  if ((data ?? []).length) return;
  const { error: e2 } = await db().from('grupo_leidos').insert({ workspace_id: ws, usuario_id: usuarioId, hasta_id: hastaId });
  // Ya tenía una marca igual o mayor (o ganó otra pestaña): está bien.
  if (e2 && e2.code !== '23505') throw new Error(e2.message);
}

/**
 * ¿ALGUIEN ABRIÓ EL GRUPO en los últimos 7 días? Una insistencia sobre un aviso que quedó sólo en el hilo tiene que poder cortarse: sin nadie en la app,
 * el «ok» del grupo de WhatsApp nunca llega al webhook y cuenta repeticiones que nadie ve. En la duda, no.
 */
export async function alguienAbrioElGrupo(ws: number): Promise<boolean> {
  const corte = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data, error } = await db().from('grupo_leidos').select('usuario_id').eq('workspace_id', ws).gt('updated_at', corte).limit(1);
  return !error && (data ?? []).length > 0;
}

/** Cuántos mensajes escribió esta persona en este grupo en las últimas 24 h. Contado en la base: el limitador es por instancia. */
export async function mensajesDelDia(ws: number, usuarioId: number): Promise<number | null> {
  const corte = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await db().from(T).select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('usuario_id', usuarioId).gt('created_at', corte);
  return error ? null : (count ?? 0);
}

// ── El push ───────────────────────────────────────────────────────────────────────────────────────────────────

/** `Autor: texto`, en una frase. El título y el resto los pone quien llama. */
function cuerpoDelPush(f: FilaGrupo): string {
  const texto = f.texto.trim() || (f.adjunto?.tipo === 'audio' ? 'Nota de voz' : f.adjunto?.tipo === 'imagen' ? 'Foto' : f.adjunto ? 'Archivo' : '');
  return f.autor_tipo === 'persona' ? `${f.autor_nombre}: ${texto}` : texto;
}

/**
 * LA ÚNICA SALIDA DEL PUSH DEL GRUPO. Destinatarios: los miembros de verdad menos el autor. El super admin no, salvo que esté invitado: le sonaría cada
 * cliente. Con `pushYaSalio`, menos los admin del negocio, que ya lo recibieron por `enviarPushAviso`. Una fila del sistema no suena. Nunca tira.
 *
 * ⚠️ SIN `?ws=`: un invitado abriría SU negocio. El tag reemplaza y no apila. Lo de un invitado va sin links y sin los avisos a la agencia.
 */
export async function avisarMiembros(ws: number, f: FilaGrupo, o: { pushYaSalio?: boolean } = {}): Promise<void> {
  if (f.autor_tipo === 'sistema') return;
  try {
    const m = await miembrosDelGrupo(ws);
    const sinAutor = m.conCuenta.filter((p) => p.usuarioId !== Number(f.usuario_id));
    const nombre = (await getWorkspace(ws).catch(() => null))?.nombre ?? '';
    const miembros = sinAutor.filter((p) => p.tipo !== 'invitado' && !(o.pushYaSalio && p.tipo === 'admin'));
    const invitados = laVeUnInvitado(f, 0) ? sinAutor.filter((p) => p.tipo === 'invitado') : [];
    const { enviarPushAMiembros } = await import('./push');
    const base = { tipo: 'mako-grupo', ruta: `/second-brain?grupo=${ws}`, tag: `grupo:${ws}`, ttl: 6 * 3600, urgencia: 'normal' as const };
    if (miembros.length) await enviarPushAMiembros(miembros.map((p) => p.usuarioId), { ...base, titulo: tituloDelGrupo(nombre), cuerpo: cuerpoDelPush(f) });
    for (const abrio of [true, false]) {
      const ids = invitados.filter((p) => p.abrio === abrio).map((p) => p.usuarioId);
      if (ids.length) await enviarPushAMiembros(ids, { ...base, titulo: tituloParaInvitado(nombre, abrio), cuerpo: sinLinksParaInvitado(cuerpoDelPush(f), hostsDeMaKo()) });
    }
  } catch (e) {
    console.error(`[grupo-app] ws${ws}: el push del grupo falló: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Invitar y sacar ───────────────────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type Resultado = { ok: true } | { ok: false; status: number; error: string };

/**
 * INVITAR, POR EMAIL EXACTO. Nunca un buscador: expondría los clientes de MaKo.
 *
 * ⚠️ LA RESPUESTA ES IDÉNTICA TENGA O NO CUENTA, y el aviso sale después de responder: sin eso, invitar sirve para averiguar quién usa MaKo.
 * ⚠️ `desde_id` se lee con chequeo de error y, si falla, NO se escribe nada: `getSupabaseServer` no tira, devuelve `{ data: null }`, y un 0 le abriría al
 * invitado el historial entero sin que nada lo diga. Un grupo vacío da 0 de verdad.
 * ⚠️ QUIEN NO TIENE CUENTA TAMBIÉN SE ENTERA (4/11/2026, el pedido de Joan): le llega el mail con el link, y la invitación se ata a su cuenta la primera vez que
 * ENTRA con ese email (`atarInvitacionesAlEntrar`, lib/grupo-invitaciones.ts, desde `registrarLogin`), no al crearla: crear una cuenta no prueba que el email sea suyo; entrar, sí (el link
 * del mail, Google o su contraseña). Volver a invitarla también la deja entrar, sin sacarla antes, viendo desde hoy. No se crea ninguna cuenta.
 * No toca `usuarios` ni `/api/equipo`, que rechaza un email que ya existe.
 */
export async function invitarAlGrupo(ws: number, emailCrudo: string, invito: { usuarioId: number | null; nombre: string }): Promise<Resultado> {
  const email = String(emailCrudo ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, status: 400, error: 'Escribe un email válido.' };
  // Al grupo de la plataforma no entra nadie por invitación: trae datos de todos los clientes. También por la API, no sólo por la ruta.
  if (ws === (await wsSuperAdmin().catch(() => ws))) return { ok: false, status: 404, error: 'No existe.' };
  const { data: previa, error: ePrevia } = await db().from('grupo_invitados').select('email, salio_at, avisado_at, usuario_id').eq('workspace_id', ws).eq('email', email).maybeSingle();
  if (ePrevia) return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' };
  const vigente = !!previa && !(previa as { salio_at?: string | null }).salio_at;
  const yaEsta = vigente && (previa as { usuario_id?: number | null }).usuario_id != null;
  if (!yaEsta) {
    // Quien ya está anotado sin cuenta ya cuenta en el tope: volver a invitarlo no suma a nadie.
    if (!vigente) {
      const { count, error } = await db().from('grupo_invitados').select('email', { count: 'exact', head: true }).eq('workspace_id', ws).is('salio_at', null);
      if (error) return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' };
      if ((count ?? 0) >= TOPE_INVITADOS) return { ok: false, status: 409, error: `Este grupo ya tiene ${TOPE_INVITADOS} invitados.` };
    }
    if (invito.usuarioId != null) {
      const corte = new Date(Date.now() - 3600_000).toISOString();
      const { count: hora, error: eHora } = await db().from('grupo_invitados').select('email', { count: 'exact', head: true }).eq('invito_usuario_id', invito.usuarioId).gt('invitado_at', corte);
      if (eHora) return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' };
      if ((hora ?? 0) >= TOPE_INVITACIONES_POR_HORA) return { ok: false, status: 429, error: 'Son muchas invitaciones seguidas: prueba en un rato.' };
    }
    const { data: ult, error: eUlt } = await db().from(T).select('id').eq('workspace_id', ws).order('id', { ascending: false }).limit(1);
    if (eUlt || !Array.isArray(ult)) return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' };
    const desdeId = ult.length ? Number((ult[0] as { id: unknown }).id) : 0;
    if (!Number.isSafeInteger(desdeId) || desdeId < 0) return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' };
    let usuario;
    try { usuario = await buscarUsuarioPorEmail(email); } catch { return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' }; }
    const ahora = new Date().toISOString();
    const { error: eIns } = await db().from('grupo_invitados').upsert({
      workspace_id: ws, email, usuario_id: usuario ? Number(usuario.id) : null, invito_usuario_id: invito.usuarioId, desde_id: desdeId, invitado_at: ahora, abrio_at: null, salio_at: null,
    }, { onConflict: 'workspace_id,email' });
    if (eIns) { console.error(`[grupo-app] ws${ws}: no pude invitar: ${eIns.message}`); return { ok: false, status: 500, error: 'No pude invitar: vuelve a intentarlo.' }; }
    // Con cuenta o sin ella, el aviso sale (después de responder: la respuesta no dice si la cuenta existe).
    await porDetras(() => avisarInvitacion(ws, email, usuario ? Number(usuario.id) : null, invito.nombre));
  }
  return { ok: true };
}

/**
 * El aviso de la invitación, como mucho uno cada 24 h por (negocio, email), también si lo sacan y lo vuelven a invitar. Con cuenta, un push y un mail; sin cuenta,
 * sólo el mail, que dice que el grupo aparece al entrar a MaKo con ese email (`atarInvitacionesAlEntrar`, lib/grupo-invitaciones.ts).
 */
async function avisarInvitacion(ws: number, email: string, usuarioId: number | null, deQuien: string): Promise<void> {
  const corte = new Date(Date.now() - AVISO_DE_INVITACION_CADA_MS).toISOString();
  const ahora = new Date().toISOString();
  // Compare-and-set: dos invitaciones a la vez dan UN aviso.
  const { data, error } = await db().from('grupo_invitados').update({ avisado_at: ahora }).eq('workspace_id', ws).eq('email', email)
    .or(`avisado_at.is.null,avisado_at.lt.${corte}`).select('email');
  if (error || !(data ?? []).length) return;
  const nombre = (await getWorkspace(ws).catch(() => null))?.nombre ?? 'un negocio';
  const titulo = tituloParaInvitado(nombre, false);
  const quien = deQuien.trim() || 'Alguien';
  const cuerpo = usuarioId != null ? `${quien} te invitó a su grupo. Si no es tu negocio, puedes salir.` : textoInvitacionSinCuenta(quien);
  if (usuarioId != null) {
    const { enviarPushAMiembros } = await import('./push');
    await enviarPushAMiembros([usuarioId], { tipo: 'mako-grupo', titulo, cuerpo, ruta: `/second-brain?grupo=${ws}`, tag: `grupo:${ws}`, ttl: 24 * 3600 });
  }
  const [{ sendEmail }, { renderEmailHtml }] = await Promise.all([import('./resend'), import('./email-html')]);
  const html = renderEmailHtml({ subject: titulo, titulo, bodyText: cuerpo, marca: 'mako', cta: { texto: 'Abrir MaKo', url: linkApp(`/second-brain?grupo=${ws}`, null) } });
  await sendEmail({ to: email, subject: titulo, html, text: cuerpo, from: REMITENTE_MAKO, replyTo: EMAIL_MAKO } as Parameters<typeof sendEmail>[0]).catch((e: unknown) => console.warn(`[grupo-app] mail de invitación: ${e instanceof Error ? e.message : String(e)}`));
}

/** Saca a un invitado. Quien entra por rol no se saca: no tiene fila. La fila queda con `salio_at`: de ella sale el tope de avisos. */
export async function sacarDelGrupo(ws: number, email: string, quien: { nombre: string }): Promise<Resultado> {
  const limpio = String(email ?? '').trim().toLowerCase();
  const { data, error } = await db().from('grupo_invitados').update({ salio_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('email', limpio).is('salio_at', null).select('usuario_id, abrio_at');
  if (error) return { ok: false, status: 500, error: 'No pude sacarlo: vuelve a intentarlo.' };
  const fila = (data ?? [])[0] as { usuario_id?: number | null; abrio_at?: string | null } | undefined;
  // Sin abrir, nadie lo vio: una burbuja delataría que esa cuenta existe.
  if (fila?.abrio_at && fila.usuario_id) {
    const { data: u } = await db().from('usuarios').select('nombre').eq('id', fila.usuario_id).maybeSingle();
    await escribirSistema(ws, `${quien.nombre.trim() || 'Alguien'} sacó a ${autorDePersona((u as { nombre?: string } | null)?.nombre)}.`);
  }
  return { ok: true };
}

/** El invitado se sale él. No vuelve a recibir avisos de este grupo por 24 h: `avisado_at` queda. */
export async function salirDelGrupo(ws: number, quien: PersonaDelGrupo): Promise<Resultado> {
  const { error } = await db().from('grupo_invitados').update({ salio_at: new Date().toISOString(), avisado_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('usuario_id', quien.usuarioId).is('salio_at', null);
  if (error) return { ok: false, status: 500, error: 'No pude sacarte: vuelve a intentarlo.' };
  await escribirSistema(ws, `${autorDePersona(quien.nombre)} salió del grupo.`);
  return { ok: true };
}

/** La primera vez que un invitado abre el grupo: su burbuja. El compare-and-set hace que sean UNA, aunque dos pantallas abran a la vez. */
export async function anotarQueAbrio(ws: number, quien: PersonaDelGrupo): Promise<void> {
  if (!quien.invitado) return;
  const { data, error } = await db().from('grupo_invitados').update({ abrio_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('usuario_id', quien.usuarioId).is('abrio_at', null).is('salio_at', null).select('email');
  if (!error && (data ?? []).length) await escribirSistema(ws, `${autorDePersona(quien.nombre)} entró al grupo.`);
}
