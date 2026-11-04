// =============================================================================
// Cliente de Resend — envío de email (Email Marketing)
// =============================================================================
// Patrón de integración HTTP igual que lib/meta-capi.ts:
//   • valida la config sin lanzar (devuelve {ok:false}), no rompe el cron;
//   • el ENVÍO REAL queda detrás del flag EMAIL_SEND_ENABLED (el caller decide
//     si llamar a sendEmail o registrar 'simulado'), igual que WhatsApp.
//
// No usamos el SDK de Resend para mantener la convención del repo (fetch directo).
// server-only: el RESEND_API_KEY nunca debe llegar al navegador.

import 'server-only';
import { verificarFirmaSvix } from './standard-webhooks';
import crypto from 'node:crypto';
import { credDelCliente } from './credenciales';
import { cuentaDeCorreo, keyDeCorreoDelNegocio, keyDeCorreoDeLaPlataforma } from './email-cuenta';
import { getSettingEstricto } from './settings';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { bloqueoDeEnvioEnRevision } from './revision-guarda';
import {
  remitenteDelNegocio, remitenteDelPaso, sanearRemitente, dominioDe, esDominioDeMako, SIN_EMAIL_PROPIO,
  type VeredictoRemitente,
} from './email-remitente';

const API_BASE = 'https://api.resend.com';
const ENDPOINT = `${API_BASE}/emails`;

// Remitente sandbox de Resend: solo entrega al dueño de la cuenta.
//
// ⚠️ SIN NOMBRE VISIBLE, A PROPÓSITO (cuarta tanda del Chatbot, 09/10/2026, punto 16). Decía
// «Mauricio Bustos», que es un CLIENTE (el ws1), y es el remitente de TODO workspace sin dominio: la
// bandeja de «Probar» (app/automations/PanelProbar.tsx, `remitenteVisible`) le mostraba «De: Mauricio
// Bustos» a otro negocio, y la firma de sus mails decía lo mismo hasta que dejó de salir del
// remitente. Sin nombre, quien lo dibuja cae al nombre del negocio. Lo fija tests/email-remitente.test.ts.
export const SANDBOX_FROM = 'onboarding@resend.dev';

// ── CADA NEGOCIO MANDA CON SU CUENTA DE RESEND (4/11/2026) ──────────────────────
// Martín: «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako». Hasta ese día la key de MaKo era la
// de todos (la «Opción A»: cada cliente verificaba su dominio adentro de la cuenta de MaKo) y la propia de un cliente
// grande ganaba si la cargaba (la «Opción B», con el tracking a medias). Desde ese día:
//   · el email de un NEGOCIO sale SÓLO con su clave (lib/email-cuenta.ts → `cuentaDeCorreo`). Sin ella no sale y dice
//     por qué (`SIN_EMAIL_PROPIO`); nunca cae a la de MaKo. Sus aperturas, clics y rebotes llegan por el webhook de SU
//     cuenta, con SU secreto (app/api/webhooks/resend/route.ts, `?cuenta=`).
//   · la PLATAFORMA manda con la de MaKo, que es su cuenta.
//   · lo que FIRMA MaKo (`from: REMITENTE_MAKO`) sale por la de MaKo desde cualquier negocio.
// La key de MaKo sale de la fila de la plataforma, no del ws1 (lib/credenciales.ts → `esClaveDeCorreoDeLaPlataforma`).
async function resendKey(): Promise<string | null> {
  return keyDeCorreoDelNegocio();
}

/**
 * La key de la PLATAFORMA, siempre: la de lo que HABLA MaKo (`from: REMITENTE_MAKO`).
 *
 * ⚠️ NO `resendKey()` (undécima tanda, 11/10/2026): ésa es la del negocio del contexto, así que adentro de un negocio
 *    con su cuenta de Resend un aviso de MaKo saldría por la cuenta del CLIENTE, donde hola-mako.com no existe.
 */
async function keyDeLaPlataforma(): Promise<string | null> {
  return keyDeCorreoDeLaPlataforma();
}

/**
 * EL REMITENTE DEL NEGOCIO del workspace actual, con su veredicto (`remitenteDelNegocio`, lib/email-remitente.ts,
 * puro y con test). Lee el setting `resend_from` y `resend_domain` del workspace, y la credencial `RESEND_FROM`
 * DEL CLIENTE (`credDelCliente`: `credWs` le daría al ws1 —`OWNER_WS`, un CLIENTE— el del env de la plataforma).
 *   · `keyPropia`: manda con SU cuenta de Resend (`cuentaDeCorreo`, lib/email-cuenta.ts): su clave, distinta de la de
 *     MaKo, o la de MaKo si es la plataforma. Desde el 4/11/2026 es la condición de las DOS vías.
 *   · `plataforma`: sólo se pregunta si el candidato es de un dominio de MaKo.
 * ⚠️ UN ERROR DE LECTURA = NO PUEDE: «no pude leer» no es «tiene remitente», y un mail que no sale se dice;
 *    uno que sale con el remitente equivocado, no.
 */
export async function remitenteDelNegocioActual(): Promise<VeredictoRemitente> {
  try {
    const [resendFrom, resendDominio, credFrom] = await Promise.all([
      getSettingEstricto('resend_from'),
      getSettingEstricto('resend_domain'),
      credDelCliente('RESEND_FROM'), // la fila del workspace; nunca el env de la plataforma
    ]);
    // ¿Manda con SU cuenta? La suya, o la de MaKo si es la plataforma (lib/email-cuenta.ts). Sin cuenta, ninguna vía
    // pasa (4/11/2026): ni la del dominio, que antes se verificaba en la cuenta de MaKo.
    const cuenta = await cuentaDeCorreo();
    if (cuenta.tipo === 'no_pude_leer') throw new Error(cuenta.error);
    const keyPropia = cuenta.tipo === 'propia' || cuenta.tipo === 'plataforma';
    const candidato = sanearRemitente(resendFrom);
    const plataforma = candidato && esDominioDeMako(dominioDe(candidato)) ? await enLaPlataforma() : false;
    return remitenteDelNegocio({ resendFrom, resendDominio, credFrom, keyPropia, plataforma });
  } catch (e) {
    console.error('[resend] no pude leer el remitente del negocio:', e instanceof Error ? e.message : String(e));
    return { puede: false, motivo: 'sin-remitente' };
  }
}

/**
 * Remitente del workspace actual: el que pasa `remitenteDelNegocio`, o el SANDBOX si no hay ninguno.
 *
 * ⚠️ DEVOLVER EL SANDBOX ES LA REGLA, no un default (undécima tanda): todo lo que pregunta `remitenteEsSandbox()`
 *    —el motor, los broadcasts, «Probar», las secuencias de antes, la API, /integraciones, el «De» del editor, GET
 *    /api/email/dominio— pasa a leer «no tiene remitente propio» SIN tocar sus llamadas. Antes devolvía el setting
 *    tal cual, y el ws1 —un cliente— tenía «MaKo <equipo@hola-mako.com>».
 */
export async function getEmailFrom(): Promise<string> {
  const v = await remitenteDelNegocioActual();
  return v.puede ? v.from : SANDBOX_FROM;
}

export async function resendConfigurado(): Promise<boolean> {
  return !!(await resendKey());
}

// true si el remitente del workspace sigue siendo el sandbox (resend.dev), que
// NO entrega a terceros. Sirve de preflight antes de un envío real. Desde la undécima,
// «sandbox» = «el negocio no tiene remitente propio» (`getEmailFrom`).
export async function remitenteEsSandbox(): Promise<boolean> {
  return /@resend\.dev>?\s*$/i.test(await getEmailFrom());
}

/**
 * ¿El workspace del CONTEXTO es el de la plataforma (el del super admin)? Es el único que puede mandar a SUS
 * leads con un dominio de MaKo, y sólo si lo reclamó en /email. Si no se puede saber (sin contexto, la base
 * caída), NO lo es: lo que se cierra es el email de MaKo, nunca el del negocio.
 */
async function enLaPlataforma(): Promise<boolean> {
  try {
    const [ws, plataforma] = await Promise.all([getWorkspaceActual(), wsSuperAdmin()]);
    return ws != null && ws === plataforma;
  } catch {
    return false;
  }
}

/** Email "conectado" para este workspace: hay key y el negocio tiene un remitente propio (`remitenteDelNegocio`). */
export async function emailConectado(): Promise<boolean> {
  const [key, v] = await Promise.all([resendKey(), remitenteDelNegocioActual()]);
  return !!key && v.puede;
}

/**
 * ¿Lo que HABLA MaKo puede salir? La key de la plataforma y `EMAIL_MAKO` fuera del sandbox. Es el preflight de
 * quien manda con `from: REMITENTE_MAKO` (el «te compartieron material» de /conocimientos): preguntar
 * `remitenteEsSandbox()` mide el remitente de un NEGOCIO, que no es el que va a firmar.
 */
export async function correoDeMakoListo(): Promise<boolean> {
  return !!(await keyDeLaPlataforma()) && !/@resend\.dev$/i.test(EMAIL_MAKO);
}

/** Display name de un remitente "Nombre <email>" (o '' si no tiene). */
export function displayNameDe(remitente: string): string {
  const m = remitente.match(/^(.*?)\s*</);
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}

// URL base del dashboard (para armar links absolutos en emails que salen del cron,
// donde no hay request). Se re-exporta porque históricamente vivía acá.
export { APP_BASE_URL };

// ── Unsubscribe (baja con token firmado) ──────────────────────────────────────
// Token = HMAC corto sobre el lead_id con un secreto estable; evita que alguien
// dé de baja a otro lead cambiando el id en la URL.
// Secreto de firma del token de baja. SUPABASE_SERVICE_ROLE_KEY siempre está
// presente server-side, así que es un fallback estable y NO público (a diferencia
// de una constante hardcodeada). Si no hay ningún secreto → fail-closed.
function unsubSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
export function unsubscribeToken(leadId: number): string {
  return crypto.createHmac('sha256', unsubSecret()).update(`unsub:${leadId}`).digest('hex').slice(0, 32);
}
export function verifyUnsubscribeToken(leadId: number, token: string): boolean {
  if (!unsubSecret()) return false; // sin secreto configurado → no validamos nada (fail-closed)
  const expected = unsubscribeToken(leadId);
  const a = Buffer.from(token || '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/**
 * El link de baja. Con `broadcastId`, la baja queda atribuida a ese envío (`email_broadcast_envios.baja_at`: las bajas de
 * cada edición del newsletter). El `b` no va firmado y no hace falta: el token es del LEAD, y con un `b` cambiado sólo se
 * estampa la fila de ese mismo lead en otro envío, si la tiene.
 */
export function buildUnsubscribeUrl(leadId: number, broadcastId?: number | null): string {
  const b = broadcastId != null && Number.isSafeInteger(broadcastId) && broadcastId > 0 ? `&b=${broadcastId}` : '';
  return `${APP_BASE_URL}/api/email/unsubscribe?lead=${leadId}&t=${unsubscribeToken(leadId)}${b}`;
}

// ── La baja de los correos de AVANCE de los tickets (4/11/2026) ──────────────
// Es por PERSONA (`usuarios.id`), no por lead: lo que se apaga es «los avances de MIS tickets» (lib/tickets-avance.ts).
// El mismo secreto que la baja de un lead, con OTRO prefijo adentro de la firma: un token de baja de un lead no sirve para
// apagarle los correos a la persona con ese mismo número, ni al revés.
export function tokenBajaTickets(usuarioId: number): string {
  return crypto.createHmac('sha256', unsubSecret()).update(`tickets-email:${usuarioId}`).digest('hex').slice(0, 32);
}
export function verificarBajaTickets(usuarioId: number, token: string): boolean {
  if (!unsubSecret()) return false;
  const a = Buffer.from(token || '');
  const b = Buffer.from(tokenBajaTickets(usuarioId));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function linkBajaTickets(usuarioId: number): string {
  return `${APP_BASE_URL}/api/email/unsubscribe/tickets?u=${usuarioId}&t=${tokenBajaTickets(usuarioId)}`;
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  scheduledAt?: string; // ISO 8601 o lenguaje natural ("in 1 hour")
  /** Los adjuntos, en base64 (17/10/2026: el composer de Chats, lib/chats-email.ts). Resend acepta hasta 40 MB por email. */
  attachments?: Array<{ filename: string; content: string }>;
};

// Envía un email por Resend. NO chequea el flag de envío del workspace — eso lo
// decide el caller (el motor de nutrición / broadcasts), igual que sendWhatsappTemplate.
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // ⚠️ La cuenta de revisión de las tiendas no le escribe a nadie (lib/revision-guarda.ts): esa contraseña la tienen terceros. Va ANTES
  // de las dos identidades: también corta lo que firmaría MaKo (`invitarNuevoAlumnoAction` mandaba un link a cualquier dirección).
  const enRevision = await bloqueoDeEnvioEnRevision('email', params.to);
  if (enRevision) return { ok: false, error: enRevision };
  // ⚠️ DOS IDENTIDADES, Y SE RECONOCEN SÓLO POR LA CONSTANTE (undécima tanda, decisión 3 de la décima: «Quitale a
  // Mauricio que pueda mandar email con MaKo. Nadie debería poder.»):
  //   · HABLA MaKo (`from: REMITENTE_MAKO`: los avisos, los reportes, el acceso a MaKo): sale por la key de la
  //     PLATAFORMA, nunca por la del workspace del contexto (en ws10/ws11 era la cuenta del cliente).
  //   · HABLA EL NEGOCIO (todo lo demás): sale SÓLO con un remitente que pasa `remitenteDelNegocio`. Sin él no
  //     sale, tampoco con el sandbox (decisión 24). Con `from`, sólo si es del mismo dominio (`remitenteDelPaso`):
  //     el corte de la décima miraba sólo lo que llegaba SIN `from`, y un `from` explícito se lo salteaba.
  const hablaMako = params.from === REMITENTE_MAKO;
  const key = hablaMako ? await keyDeLaPlataforma() : await resendKey();
  // Sin la de MaKo es un problema de MaKo; sin la del negocio, que conecte SU cuenta (4/11/2026: nunca la de MaKo).
  if (!key) return { ok: false, error: hablaMako ? 'RESEND_API_KEY no configurada' : SIN_EMAIL_PROPIO };

  let from: string;
  if (hablaMako) from = REMITENTE_MAKO;
  else {
    const v = await remitenteDelNegocioActual();
    if (!v.puede) return { ok: false, error: SIN_EMAIL_PROPIO };
    const elegido = params.from ? remitenteDelPaso(params.from, v.from) : v.from;
    if (!elegido) return { ok: false, error: 'Ese remitente no es de tu negocio' };
    from = elegido;
  }

  const payload: Record<string, unknown> = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    ...(params.headers ? { headers: params.headers } : {}),
    ...(params.tags ? { tags: params.tags } : {}),
    ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
    ...(params.attachments?.length ? { attachments: params.attachments } : {}),
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja texto */ }

    if (!res.ok) {
      const msg = typeof body === 'object' && body && 'message' in body
        ? String((body as { message?: unknown }).message)
        : (typeof body === 'string' ? body.slice(0, 200) : `Resend ${res.status}`);
      return { ok: false, error: msg };
    }
    const id = typeof body === 'object' && body && 'id' in body ? String((body as { id?: unknown }).id) : '';
    if (!id) return { ok: false, error: 'Resend no devolvió id' };
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Lo que LLEGA (Receiving), para la bandeja de Chats (17/10/2026) ──────────
// El webhook `email.received` trae sólo el SOBRE (lib/email-entrante-reglas.ts): el cuerpo y los adjuntos se piden
// aparte, con la key de la cuenta del negocio (`resendKey`: la suya, o la de MaKo si es la plataforma). Desde el 4/11/2026
// cada negocio tiene la suya con «Full access» (la guía la pide así), así que esto lee en SU cuenta.
// ⚠️ NO MEDIDO: si Resend no deja LEER lo recibido con una key de sólo envío, la plataforma (cuya key de envío es de sólo
// envío) contestaría `restricted_api_key`. Hay que medirlo con un email recibido real antes de decidir nada.
//   GET /emails/receiving/{id}                          → html, text, subject, from, to, message_id, attachments[]
//   GET /emails/receiving/{email_id}/attachments/{id}   → download_url (firmada, vence en `expires_at`)
// Los usa lib/chats-email.ts. Leen; no mandan nada.

export type AdjuntoRecibido = { id: string; filename: string; contentType: string; size: number };
export type EmailRecibido = {
  from: string; to: string[]; subject: string | null; text: string | null; html: string | null;
  messageId: string | null; attachments: AdjuntoRecibido[];
};

async function getDeResend(ruta: string): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  const key = await resendKey();
  if (!key) return { ok: false, error: SIN_EMAIL_PROPIO };
  try {
    const res = await fetch(`${API_BASE}${ruta}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja vacío */ }
    if (!res.ok) {
      const m = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message) : `Resend ${res.status}`;
      return { ok: false, error: m.slice(0, 200) };
    }
    return { ok: true, body: (body && typeof body === 'object' ? body : {}) as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const textoO = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const listaDe = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);

/** El email que llegó, entero (cuerpo y lista de adjuntos). */
export async function getEmailRecibido(id: string): Promise<{ ok: true; email: EmailRecibido } | { ok: false; error: string }> {
  if (!/^[\w-]{1,120}$/.test(id)) return { ok: false, error: 'id inválido' };
  const r = await getDeResend(`/emails/receiving/${id}`);
  if (!r.ok) return r;
  const b = r.body;
  const adj = Array.isArray(b.attachments) ? b.attachments : [];
  return {
    ok: true,
    email: {
      from: textoO(b.from) ?? '', to: listaDe(b.to), subject: textoO(b.subject), text: textoO(b.text), html: textoO(b.html),
      messageId: textoO(b.message_id),
      attachments: adj.flatMap((a) => {
        const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
        const aid = textoO(o.id);
        if (!aid) return [];
        return [{ id: aid, filename: textoO(o.filename) ?? 'archivo', contentType: textoO(o.content_type) ?? 'application/octet-stream', size: Number(o.size) || 0 }];
      }),
    },
  };
}

/** La URL de descarga (firmada, vence) de un adjunto de un email que llegó. */
export async function getAdjuntoRecibido(emailId: string, adjuntoId: string): Promise<{ ok: true; downloadUrl: string } | { ok: false; error: string }> {
  if (!/^[\w-]{1,120}$/.test(emailId) || !/^[\w-]{1,120}$/.test(adjuntoId)) return { ok: false, error: 'id inválido' };
  const r = await getDeResend(`/emails/receiving/${emailId}/attachments/${adjuntoId}`);
  if (!r.ok) return r;
  const url = textoO(r.body.download_url);
  return url && /^https:\/\//.test(url) ? { ok: true, downloadUrl: url } : { ok: false, error: 'Resend no devolvió la descarga' };
}

// ── Render de HTML del email ──────────────────────────────────────────
// ⚠️ EL RENDER YA NO VIVE ACÁ: está en lib/email-html.ts, sin `server-only`.
//
// El motivo no es prolijidad. Este módulo lleva `server-only` porque tiene la API
// key, y eso dejaba a la pantalla que PREVISUALIZA un correo sin poder mostrar el
// correo: dibujaba el texto plano y el lector veía los `*asteriscos*` de WhatsApp
// que el mail real no tiene. El render es una función PURA — no toca credenciales,
// ni settings, ni la base — así que mudarla no expone nada.
//
// Se re-exporta para que los siete call sites sigan importando de donde siempre.
export { renderEmailHtml, escapeHtml, linkify, bodyToHtml, marcasAHtml, type RenderEmailParams } from './email-html';

// ── API de Domains: vive en lib/resend-dominios.ts (4/11/2026) ───────────────────────────────────────────────────────────
// Habla con la cuenta DEL NEGOCIO (su clave, «Full access»). La plataforma administra el dominio de MaKo con
// `RESEND_ADMIN_API_KEY`, que sólo lee ese módulo (la que manda es de sólo envío). Se re-exporta para que los que
// importan de acá sigan igual.
export {
  createResendDomain, getResendDomain, verifyResendDomain, listResendDomains, prenderSeguimiento, puedeAdministrarDominios,
  type ResendDnsRecord, type ResendDomain, type DomainResult, type CreacionDominio,
} from './resend-dominios';

// ── Verificación de firma del webhook ────────────────────────────────────────
// Resend firma con Standard Webhooks (Svix). El algoritmo vive en
// lib/standard-webhooks.ts, que es el mismo que usa Fathom: estaba
// escrito dos veces con dos redacciones y agregar un tercer proveedor habría
// sido la tercera copia. OJO: Resend manda los headers con prefijo `svix-`, no
// `webhook-`, así que su ruta los lee a mano y arma el objeto (por eso acá no se
// usa `headersSvix`).
export type SvixHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export function verifyResendSignature(rawBody: string, headers: SvixHeaders, secret: string): boolean {
  return verificarFirmaSvix(rawBody, headers, secret) === null;
}
