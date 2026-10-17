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
import { credWs, credDelCliente, envCred, esDeLaPlataforma } from './credenciales';
import { getSettingEstricto } from './settings';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { esKeySoloEnvio, KEY_SOLO_ENVIO_DE_MAKO, KEY_SOLO_ENVIO_TUYA } from './resend-errores';
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

// ── Config por workspace (Opción A: cuenta única de MaKo) ────────────────────
// La API key es LA DE MAKO (env global) para todos los workspaces — cada cliente
// solo verifica SU dominio dentro de esa cuenta. credWs primero: si un cliente
// grande carga su propia RESEND_API_KEY en credenciales, esa gana (Opción B).
// Excepción deliberada al aislamiento de credWs (que jamás da env a un cliente):
// acá el fallback compartido es el modelo de negocio, no un leak.
// OJO Opción B a medias: el webhook de eventos valida UN solo signing secret
// (el de la cuenta de MaKo) — un cliente con key propia pierde tracking de
// abiertos/clics/rebotes hasta soportar secrets por workspace (pendiente F2).
async function resendKey(): Promise<string | null> {
  const propia = await credWs('RESEND_API_KEY');
  if (propia) return propia;
  // ⚠️ envCred y NO process.env (09/10/2026, lo encontró la sesión de Customer Success): la key
  // de la PLATAFORMA vive en las credenciales del dueño y llega a process.env recién cuando termina
  // la hidratación del arranque. Leída antes, daba null, y el invitar del curso le pedía al cliente
  // que conectara SU correo para tapar una falla nuestra («RESEND_API_KEY no configurada»).
  const compartida = await envCred('RESEND_API_KEY');
  return compartida && compartida.trim() ? compartida : null;
}

/**
 * La key de la PLATAFORMA, siempre: la de lo que HABLA MaKo (`from: REMITENTE_MAKO`).
 *
 * ⚠️ NO `resendKey()` (undécima tanda, 11/10/2026): ésa empieza por la key PROPIA del workspace del contexto, así
 *    que adentro de un negocio con su cuenta de Resend (ws10, ws11) un aviso de MaKo salía por la cuenta del
 *    CLIENTE, donde hola-mako.com no existe, y Resend lo rechazaba (PLAUSIBLE: no se mandó nada para probarlo).
 *    Hoy la key de la plataforma vive en la fila del ws1 y el boot la hidrata a process.env (lib/credenciales.ts).
 */
async function keyDeLaPlataforma(): Promise<string | null> {
  const k = await envCred('RESEND_API_KEY');
  return k && k.trim() ? k : null;
}

/**
 * EL REMITENTE DEL NEGOCIO del workspace actual, con su veredicto (`remitenteDelNegocio`, lib/email-remitente.ts,
 * puro y con test). Lee el setting `resend_from` y `resend_domain` del workspace, y la credencial `RESEND_FROM`
 * DEL CLIENTE (`credDelCliente`: `credWs` le daría al ws1 —`OWNER_WS`, un CLIENTE— el del env de la plataforma).
 *   · `keyPropia`: su `RESEND_API_KEY` cargada Y distinta de la de la plataforma (`esDeLaPlataforma` mira el env Y la
 *     fila del dueño: la del ws1 es la de la plataforma y la del ws4 una copia).
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
    const conCred = !!credFrom && credFrom.trim() !== '';
    const keyCliente = conCred ? await credDelCliente('RESEND_API_KEY') : null;
    const keyPropia = !!keyCliente && !(await esDeLaPlataforma('RESEND_API_KEY', keyCliente));
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
export function buildUnsubscribeUrl(leadId: number): string {
  return `${APP_BASE_URL}/api/email/unsubscribe?lead=${leadId}&t=${unsubscribeToken(leadId)}`;
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
};

// Envía un email por Resend. NO chequea el flag de envío del workspace — eso lo
// decide el caller (el motor de nutrición / broadcasts), igual que sendWhatsappTemplate.
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // ⚠️ DOS IDENTIDADES, Y SE RECONOCEN SÓLO POR LA CONSTANTE (undécima tanda, decisión 3 de la décima: «Quitale a
  // Mauricio que pueda mandar email con MaKo. Nadie debería poder.»):
  //   · HABLA MaKo (`from: REMITENTE_MAKO`: los avisos, los reportes, el acceso a MaKo): sale por la key de la
  //     PLATAFORMA, nunca por la del workspace del contexto (en ws10/ws11 era la cuenta del cliente).
  //   · HABLA EL NEGOCIO (todo lo demás): sale SÓLO con un remitente que pasa `remitenteDelNegocio`. Sin él no
  //     sale, tampoco con el sandbox (decisión 24). Con `from`, sólo si es del mismo dominio (`remitenteDelPaso`):
  //     el corte de la décima miraba sólo lo que llegaba SIN `from`, y un `from` explícito se lo salteaba.
  const hablaMako = params.from === REMITENTE_MAKO;
  const key = hablaMako ? await keyDeLaPlataforma() : await resendKey();
  if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' };

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

// ── API de Domains (onboarding de dominio por workspace) ─────────────────────
// POST /domains crea el dominio en la cuenta de MaKo y devuelve los registros
// DNS (DKIM/SPF) que el cliente carga en su proveedor. GET /domains/{id} da el
// estado; POST /domains/{id}/verify dispara la verificación.

export type ResendDnsRecord = {
  record: string;            // 'DKIM' | 'SPF' | ...
  name: string;              // host del registro
  type: string;              // 'TXT' | 'MX' | 'CNAME'
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;           // 'not_started' | 'pending' | 'verified' | 'failure'
};

export type ResendDomain = {
  id: string;
  name: string;
  status: string;            // 'not_started' | 'pending' | 'verified' | 'failure' | 'temporary_failure'
  region?: string;
  records: ResendDnsRecord[];
};

export type DomainResult = { ok: true; domain: ResendDomain } | { ok: false; error: string };

// `deMako`: la key de esta llamada es la de la PLATAFORMA (la que el negocio no puede tocar). Lo usa `errorDeResend`.
async function resendFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown; deMako?: boolean }> {
  const key = await resendKey();
  if (!key) return { ok: false, status: 0, body: { message: 'RESEND_API_KEY no configurada' } };
  const deMako = await esDeLaPlataforma('RESEND_API_KEY', key).catch(() => false);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja texto */ }
    return { ok: res.ok, status: res.status, body, deMako };
  } catch (err) {
    return { ok: false, status: 0, body: { message: err instanceof Error ? err.message : String(err) } };
  }
}

/**
 * EL ERROR DE UNA LLAMADA A /domains, EN PALABRAS (#875). Una key de sólo envío no es «Resend 401»: si es la de MaKo,
 * el problema es nuestro (y queda en el log, fuerte); si es la del negocio, se le dice cuál crear (lib/resend-errores.ts).
 */
function errorDeResend(r: { status: number; body: unknown; deMako?: boolean }, fallback: string): string {
  if (esKeySoloEnvio(r.body)) {
    if (r.deMako) console.error('[resend] la key de la PLATAFORMA es de sólo envío: no da de alta ni verifica dominios (#875, docs/hallazgos-comunicacion.md)');
    return r.deMako ? KEY_SOLO_ENVIO_DE_MAKO : KEY_SOLO_ENVIO_TUYA;
  }
  return errMsg(r.body, fallback);
}

function errMsg(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body && 'message' in body) return String((body as { message?: unknown }).message);
  return typeof body === 'string' && body ? body.slice(0, 200) : fallback;
}

function parseDomain(body: unknown): ResendDomain | null {
  if (typeof body !== 'object' || !body || !('id' in body)) return null;
  const d = body as { id?: unknown; name?: unknown; status?: unknown; region?: unknown; records?: unknown };
  return {
    id: String(d.id ?? ''),
    name: String(d.name ?? ''),
    status: String(d.status ?? 'pending'),
    region: d.region ? String(d.region) : undefined,
    records: Array.isArray(d.records) ? (d.records as ResendDnsRecord[]) : [],
  };
}

const REGIONES_VALIDAS = new Set(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']);

// Crea el dominio. Si ya existe en la cuenta (ej: re-conectar en la prueba E2E),
// lo busca en la lista y lo devuelve — idempotente para el onboarding. El caller
// (route de dominio) valida la TITULARIDAD por workspace antes de adoptarlo.
// El fallback por lista corre ante cualquier 4xx (no dependemos del wording del
// mensaje de error de Resend).
export async function createResendDomain(name: string, region = 'sa-east-1'): Promise<DomainResult> {
  const reg = REGIONES_VALIDAS.has(region) ? region : 'sa-east-1';
  const r = await resendFetch('/domains', { method: 'POST', body: JSON.stringify({ name, region: reg }) });
  if (r.ok) {
    const d = parseDomain(r.body);
    return d ? { ok: true, domain: d } : { ok: false, error: 'Resend no devolvió el dominio' };
  }
  // 4xx → puede ser "ya existe": buscarlo por nombre en la cuenta.
  if (r.status >= 400 && r.status < 500) {
    const lista = await listResendDomains();
    if (lista.ok) {
      const existente = lista.domains.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (existente) return getResendDomain(existente.id);
    }
  }
  return { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
}

export async function getResendDomain(id: string): Promise<DomainResult> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}`);
  if (!r.ok) return { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
  const d = parseDomain(r.body);
  return d ? { ok: true, domain: d } : { ok: false, error: 'respuesta inválida de Resend' };
}

// Dispara la verificación (Resend revisa los DNS). El estado nuevo se lee con
// getResendDomain — la verificación puede tardar minutos.
export async function verifyResendDomain(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}/verify`, { method: 'POST' });
  return r.ok ? { ok: true } : { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
}

export async function listResendDomains(): Promise<{ ok: true; domains: Array<{ id: string; name: string; status: string }> } | { ok: false; error: string }> {
  const r = await resendFetch('/domains');
  if (!r.ok) return { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
  const data = typeof r.body === 'object' && r.body && 'data' in r.body ? (r.body as { data?: unknown }).data : null;
  const arr = Array.isArray(data) ? data : [];
  return {
    ok: true,
    domains: arr.map((d) => ({
      id: String((d as { id?: unknown }).id ?? ''),
      name: String((d as { name?: unknown }).name ?? ''),
      status: String((d as { status?: unknown }).status ?? ''),
    })),
  };
}

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
