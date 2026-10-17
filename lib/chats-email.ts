// =============================================================================
// chats-email — el canal EMAIL de la bandeja de Chats: lo que llega, lo que se contesta y sus adjuntos (17/10/2026)
// =============================================================================
// Martín: «eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats", y que por favor te asegures de que todo
// funcione bien». Hasta acá el email NO tenía bandeja en ningún lado: /email es marketing (secuencias, envíos y dominio)
// y lo que llegaba sólo disparaba automatizaciones, guardando el sobre (lib/email-entrante.ts, `email_entrantes`). Esto
// lo vuelve una CONVERSACIÓN: `email_mensajes` (mig 0312), una fila por email, entrante o saliente.
//
// LAS TRES PUERTAS, y ninguna manda nada que una persona no apretó:
//   · `guardarEmailEntrante`: la llama el webhook DESPUÉS de resolver el lead. Lee el cuerpo y los adjuntos de Resend
//     (GET /emails/receiving/{id}: el webhook sólo trae el sobre), sube los adjuntos al bucket privado y escribe la fila.
//     ⚠️ NUNCA frena el disparo de las automatizaciones: si algo falla acá, se anota y el webhook sigue.
//   · `enviarEmailDeChat`: el «Enviar» del composer. Sale con el remitente DEL NEGOCIO (`sendEmail` ya lo exige: un email
//     del negocio nunca sale con MaKo), en el hilo del último que llegó (`In-Reply-To`), con sus adjuntos.
//   · las lecturas de la bandeja (`fuentesEmail`, `hiloEmail`), que usa lib/chats.ts.
//
// ⚠️ Para que LLEGUE algo hace falta «Receiving» prendido en Resend y el MX del dominio apuntando a Resend: eso es de
// la cuenta, no del código (docs/diseno-sidebar.md §5). Sin eso, la bandeja muestra sólo lo que se contestó desde acá.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { sendEmail, remitenteDelNegocioActual, getEmailRecibido, getAdjuntoRecibido } from './resend';
import type { AdjuntoChat, IdentidadCanal, MensajeChat } from './chats-tipos';
import { claveEmail, type FuenteChat } from './chats-reglas';
import {
  asuntoDeRespuesta, encabezadosDeRespuesta, htmlDeTexto, nombreDeArchivo, normalizarEmail, sinCita, textoDeHtml,
  MAX_ADJUNTOS_EMAIL, TOPE_ADJUNTO_ENTRANTE,
} from './chats-email-reglas';
import { escaparIlike, leadDelEmail } from './email-entrante-reglas';

export const BUCKET_EMAIL = 'chats-email';
const TABLA = 'email_mensajes';
const COLS = 'id, lead_id, direccion, contacto, de, para, asunto, texto, message_id, resend_id, adjuntos, estado, error, autor, created_at';

/** Un adjunto guardado: `ruta` en el bucket privado, null si no se pudo bajar (o pasaba el tope). */
export type AdjuntoEmail = { nombre: string; mime: string; tamano: number; ruta: string | null };
type FilaEmail = {
  id: number; lead_id: number | null; direccion: 'entrante' | 'saliente'; contacto: string; de: string; para: string[] | null;
  asunto: string | null; texto: string | null; message_id: string | null; resend_id: string | null; adjuntos: AdjuntoEmail[] | null;
  estado: 'ok' | 'fallido'; error: string | null; autor: string | null; created_at: string;
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function subirAdjunto(ws: number, id: number, nombre: string, mime: string, buf: Buffer): Promise<string> {
  const ruta = `${ws}/${id}/${nombre}`;
  const { error } = await getSupabaseServer().storage.from(BUCKET_EMAIL).upload(ruta, buf, { contentType: mime || 'application/octet-stream', upsert: true });
  if (error) throw new Error(error.message);
  return ruta;
}

// ── Lo que llega ────────────────────────────────────────────────────────────────

/**
 * Guarda un email que LLEGÓ como mensaje de la bandeja. Se llama adentro de `runWithWorkspace(ws)`, con el lead ya
 * resuelto (o null: alguien que todavía no está en el CRM, que se ve igual y se agrega desde Chats). Devuelve false si
 * no se pudo, SIN tirar: el disparo de las automatizaciones no depende de esto.
 */
export async function guardarEmailEntrante(input: { ws: number; resendId: string; leadId: number | null }): Promise<boolean> {
  try {
    const r = await getEmailRecibido(input.resendId);
    if (!r.ok) { console.error(`[chats-email] ${input.resendId}: no pude leer el cuerpo (${r.error})`); return false; }
    const e = r.email;
    const contacto = normalizarEmail(e.from);
    if (!contacto) return false;
    const db = await getTenantDb();
    const { data: fila, error } = await db.from(TABLA).insert({
      lead_id: input.leadId, direccion: 'entrante', contacto, de: contacto,
      para: e.to.map((x) => normalizarEmail(x)).filter((x): x is string => !!x),
      asunto: (e.subject ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300),
      texto: (e.text?.trim() ? e.text : textoDeHtml(e.html)).slice(0, 100_000),
      message_id: e.messageId?.slice(0, 300) ?? null, resend_id: input.resendId, adjuntos: [],
    }).select('id').single();
    // 23505 = el reintento del webhook: ya está guardado.
    if (error) { if (error.code === '23505') return true; throw new Error(error.message); }
    const id = Number((fila as { id: number }).id);
    const adjuntos: AdjuntoEmail[] = [];
    for (const a of e.attachments.slice(0, 10)) {
      const nombre = nombreDeArchivo(a.filename);
      if (a.size > TOPE_ADJUNTO_ENTRANTE) { adjuntos.push({ nombre, mime: a.contentType, tamano: a.size, ruta: null }); continue; }
      const ruta = await (async () => {
        const d = await getAdjuntoRecibido(input.resendId, a.id);
        if (!d.ok) throw new Error(d.error);
        const res = await fetch(d.downloadUrl, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`descarga ${res.status}`);
        return subirAdjunto(input.ws, id, nombre, a.contentType, Buffer.from(await res.arrayBuffer()));
      })().catch((err) => { console.error(`[chats-email] adjunto ${a.id}: ${msg(err)}`); return null; });
      adjuntos.push({ nombre, mime: a.contentType, tamano: a.size, ruta });
    }
    if (adjuntos.length) {
      const { error: eAdj } = await db.from(TABLA).update({ adjuntos }).eq('id', id);
      if (eAdj) console.error(`[chats-email] ${input.resendId}: los adjuntos no quedaron anotados (${eAdj.message})`);
    }
    return true;
  } catch (err) {
    console.error(`[chats-email] ${input.resendId}: ${msg(err)}`);
    return false;
  }
}

// ── La bandeja: las fuentes y el hilo ───────────────────────────────────────────

/**
 * De qué lead es una dirección: el que ya quedó anotado en un email suyo, o el lead del CRM con ESE email (una igualdad
 * exacta, como el webhook: `leadDelEmail`). Varios leads con el mismo email = ninguno (no se adivina).
 */
export async function leadDeEmail(email: string): Promise<number | null> {
  const contacto = normalizarEmail(email);
  if (!contacto) return null;
  const db = await getTenantDb();
  const { data: anotado, error: e1 } = await db.from(TABLA).select('lead_id').eq('contacto', contacto).not('lead_id', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (e1) throw new Error(`${TABLA}: ${e1.message}`);
  const ya = (anotado as { lead_id: number | null } | null)?.lead_id;
  if (ya != null) return Number(ya);
  const { data, error } = await db.from('leads').select('id, email').ilike('email', escaparIlike(contacto)).limit(10);
  if (error) throw new Error(`leads: ${error.message}`);
  const r = leadDelEmail((data ?? []) as Array<{ id: unknown; email: unknown }>, contacto);
  return r.leadId;
}

type Escritura = { puede: boolean; motivo: string | null; dominio: string | null; from: string | null };

/** ¿Puede contestar este negocio por email? Con su remitente propio; sin él, ningún email del negocio sale. */
async function escrituraEmail(): Promise<Escritura> {
  const v = await remitenteDelNegocioActual();
  if (!v.puede) return { puede: false, motivo: 'Sin email propio', dominio: null, from: null };
  const from = normalizarEmail(v.from);
  return { puede: true, motivo: null, dominio: from?.split('@')[1] ?? null, from };
}

function identidadEmail(contacto: string, ultimaFecha: string | null, w: Escritura): IdentidadCanal {
  return {
    canal: 'email', cuenta: w.dominio, rotulo: 'Email', destino: contacto, ref: contacto, telefono: null,
    ultimaFecha, puedeEscribir: w.puede, motivoNoEscribir: w.motivo, bloqueado: false,
  };
}

/** Una línea del último mensaje para la lista: el asunto, o lo escrito sin la cita. */
const resumen = (f: FilaEmail): string => ((f.asunto ?? '').trim() || sinCita(f.texto).split('\n')[0] || '').slice(0, 160);

function fuenteDe(contacto: string, filas: readonly FilaEmail[], leadId: number | null, w: Escritura): FuenteChat {
  // `filas` en orden DESCENDENTE: la primera es la última.
  const ultimo = filas[0] ?? null;
  return {
    identidad: identidadEmail(contacto, ultimo?.created_at ?? null, w),
    leadId, claveSinLead: claveEmail(contacto), nombre: contacto, empresa: null,
    ultimoTexto: ultimo ? resumen(ultimo) : null, ultimoTipo: ultimo ? 'text' : null, ultimaFecha: ultimo?.created_at ?? null,
    ultimoEntrante: ultimo?.direccion === 'entrante', ultimaEntrante: filas.find((x) => x.direccion === 'entrante')?.created_at ?? null,
    total: filas.length,
  };
}

/**
 * Las conversaciones de email del negocio, una FUENTE por dirección, con el último mensaje: lo que `agruparPorContacto`
 * junta con WhatsApp e Instagram por lead. Lee los últimos 2.000 (como las 600 conversaciones de cada línea de
 * WhatsApp): una bandeja muestra lo reciente.
 */
export async function fuentesEmail(): Promise<FuenteChat[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLS).order('created_at', { ascending: false }).limit(2000);
  if (error) throw new Error(`${TABLA}: ${error.message}`);
  const filas = (data ?? []) as FilaEmail[];
  if (!filas.length) return [];
  const w = await escrituraEmail();
  const porContacto = new Map<string, FilaEmail[]>();
  for (const f of filas) porContacto.set(f.contacto, [...(porContacto.get(f.contacto) ?? []), f]);
  return [...porContacto].map(([contacto, xs]) => fuenteDe(contacto, xs, xs.find((x) => x.lead_id != null)?.lead_id ?? null, w));
}

/**
 * El hilo de email de un contacto: los de su lead y los de sus direcciones (`contactos`: la del lead en el CRM, o la de
 * la clave `em:`), en orden. Con un lead que tiene email y ningún mensaje, la identidad igual vuelve: es para escribirle
 * el primero.
 */
export async function hiloEmail(de: { leadId: number | null; contactos: readonly (string | null | undefined)[] }): Promise<{ fuente: FuenteChat | null; mensajes: MensajeChat[] }> {
  const contactos = [...new Set(de.contactos.map((c) => normalizarEmail(c)).filter((x): x is string => !!x))];
  if (de.leadId == null && !contactos.length) return { fuente: null, mensajes: [] };
  const db = await getTenantDb();
  // Dos lecturas y no un `.or()` armado a mano: la dirección viene de la clave (el navegador) y del CRM.
  const [porLead, porDireccion] = await Promise.all([
    de.leadId != null ? db.from(TABLA).select(COLS).eq('lead_id', de.leadId).order('created_at', { ascending: false }).limit(500) : null,
    contactos.length ? db.from(TABLA).select(COLS).in('contacto', contactos).order('created_at', { ascending: false }).limit(500) : null,
  ]);
  for (const r of [porLead, porDireccion]) if (r?.error) throw new Error(`${TABLA}: ${r.error.message}`);
  const unicas = new Map<number, FilaEmail>();
  for (const f of [...((porLead?.data ?? []) as FilaEmail[]), ...((porDireccion?.data ?? []) as FilaEmail[])]) unicas.set(Number(f.id), f);
  const desc = [...unicas.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  const w = await escrituraEmail();
  // La identidad: la dirección del último que ESCRIBIÓ (se le contesta a ésa), o la del CRM para escribirle por primera vez.
  const contacto = desc.find((f) => f.direccion === 'entrante')?.contacto ?? desc[0]?.contacto ?? contactos[0] ?? null;
  const fuente = contacto ? fuenteDe(contacto, desc, de.leadId, w) : null;
  const mensajes = await Promise.all([...desc].reverse().map(mensajeDeFila));
  return { fuente, mensajes };
}

/** Una fila como mensaje del hilo. Los adjuntos van con una URL firmada de 10 minutos (el bucket es privado). */
async function mensajeDeFila(f: FilaEmail): Promise<MensajeChat> {
  const adjuntos: AdjuntoChat[] = await Promise.all((f.adjuntos ?? []).map(async (a) => {
    if (!a.ruta) return { nombre: a.nombre, mime: a.mime, url: null };
    const { data } = await getSupabaseServer().storage.from(BUCKET_EMAIL).createSignedUrl(a.ruta, 600, { download: a.nombre });
    return { nombre: a.nombre, mime: a.mime, url: data?.signedUrl ?? null };
  }));
  return {
    id: `em:${f.id}`, tipo: 'mensaje', canal: 'email', cuenta: null, saliente: f.direccion === 'saliente',
    autor: f.direccion === 'saliente' ? f.autor : null,
    // Lo que el contacto escribió, sin el hilo entero que su cliente de correo pega abajo.
    texto: f.direccion === 'entrante' ? sinCita(f.texto) : (f.texto ?? ''),
    formato: 'text', mediaUrl: null, mediaMime: null, fecha: f.created_at,
    status: f.direccion === 'saliente' ? (f.estado === 'fallido' ? 'failed' : 'sent') : null, error: f.error,
    asunto: f.asunto?.trim() || null, adjuntos,
  };
}

// ── Lo que se contesta ──────────────────────────────────────────────────────────

export type EnvioEmail = {
  leadId: number | null;
  para: string;
  /** null = «Re: <el asunto del último que llegó>», o uno nuevo si nunca escribió. */
  asunto: string | null;
  texto: string;
  archivos: ReadonlyArray<{ nombre: string; mime: string; buf: Buffer }>;
  autor: string;
};

/**
 * Manda un email desde la bandeja y lo deja en el hilo. Sale con el remitente del negocio (`sendEmail`: sin él, no sale)
 * y, si el contacto escribió antes, como RESPUESTA a su último email (`In-Reply-To`), con «Re:» en el asunto.
 * Un envío que FALLA también queda en el hilo (fallido, con su error), como en WhatsApp: se ve que no salió.
 */
export async function enviarEmailDeChat(e: EnvioEmail): Promise<{ ok: true; mensaje: MensajeChat } | { ok: false; error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin negocio' };
  const para = normalizarEmail(e.para);
  if (!para) return { ok: false, error: 'Ese email no es válido' };
  const texto = e.texto.trim();
  if (!texto && !e.archivos.length) return { ok: false, error: 'Escribe algo para enviar' };
  if (e.archivos.length > MAX_ADJUNTOS_EMAIL) return { ok: false, error: `Hasta ${MAX_ADJUNTOS_EMAIL} archivos por email` };
  const w = await escrituraEmail();
  if (!w.puede) return { ok: false, error: 'Tu negocio todavía no tiene su email: conéctalo en Email' };
  const db = await getTenantDb();
  const { data: previo, error: ePrevio } = await db.from(TABLA).select('asunto, message_id').eq('contacto', para).eq('direccion', 'entrante')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (ePrevio) return { ok: false, error: 'No pude leer el hilo' };
  const anterior = previo as { asunto: string | null; message_id: string | null } | null;
  const asunto = (e.asunto?.trim() || (anterior ? asuntoDeRespuesta(anterior.asunto) : 'Mensaje')).replace(/[\r\n]+/g, ' ').slice(0, 300);
  const r = await sendEmail({
    to: para, subject: asunto, html: htmlDeTexto(texto), text: texto,
    headers: encabezadosDeRespuesta(anterior?.message_id),
    attachments: e.archivos.map((a) => ({ filename: nombreDeArchivo(a.nombre), content: a.buf.toString('base64') })),
  });
  const { data: fila, error } = await db.from(TABLA).insert({
    lead_id: e.leadId, direccion: 'saliente', contacto: para, de: w.from ?? para, para: [para], asunto, texto,
    resend_id: r.ok ? r.id : null, adjuntos: [], estado: r.ok ? 'ok' : 'fallido', error: r.ok ? null : r.error.slice(0, 300),
    autor: e.autor.slice(0, 120) || null,
  }).select(COLS).single();
  if (!r.ok) return { ok: false, error: r.error };
  if (error || !fila) return { ok: false, error: 'Salió, pero no quedó en el hilo' };
  const guardada = fila as FilaEmail;
  // Lo que salió con adjuntos se guarda también: el hilo muestra lo que se mandó.
  if (e.archivos.length) {
    const adjuntos: AdjuntoEmail[] = [];
    for (const a of e.archivos) {
      const nombre = nombreDeArchivo(a.nombre);
      const ruta = await subirAdjunto(ws, guardada.id, nombre, a.mime, a.buf).catch((err) => { console.error(`[chats-email] adjunto saliente: ${msg(err)}`); return null; });
      adjuntos.push({ nombre, mime: a.mime, tamano: a.buf.length, ruta });
    }
    await db.from(TABLA).update({ adjuntos }).eq('id', guardada.id);
    guardada.adjuntos = adjuntos;
  }
  return { ok: true, mensaje: await mensajeDeFila(guardada) };
}
