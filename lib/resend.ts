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
import { credWs } from './credenciales';
import { getSetting } from './settings';
import { APP_BASE_URL } from './app-url';

const API_BASE = 'https://api.resend.com';
const ENDPOINT = `${API_BASE}/emails`;

// Remitente sandbox de Resend: solo entrega al dueño de la cuenta.
//
// ⚠️ SIN NOMBRE VISIBLE, A PROPÓSITO (cuarta tanda del Chatbot, 09/10/2026, punto 16). Decía
// «Mauricio Bustos», que es un CLIENTE (el ws1), y es el remitente de TODO workspace sin dominio: la
// bandeja de «Probar» (app/chatbot/PanelProbar.tsx, `remitenteVisible`) le mostraba «De: Mauricio
// Bustos» a otro negocio, y la firma de sus mails decía lo mismo hasta que dejó de salir del
// remitente. Sin nombre, quien lo dibuja cae al nombre del negocio. Lo fija tests/email-remitente.test.ts.
const SANDBOX_FROM = 'onboarding@resend.dev';

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
  const compartida = process.env.RESEND_API_KEY;
  return compartida && compartida.trim() ? compartida : null;
}

/** Remitente del workspace actual: setting resend_from → credencial → sandbox. */
export async function getEmailFrom(): Promise<string> {
  const setting = await getSetting('resend_from');
  if (setting && setting.trim()) return setting.trim();
  const cred = await credWs('RESEND_FROM'); // dueño → env RESEND_FROM; cliente → su fila
  if (cred && cred.trim()) return cred.trim();
  return SANDBOX_FROM;
}

export async function resendConfigurado(): Promise<boolean> {
  return !!(await resendKey());
}

// true si el remitente del workspace sigue siendo el sandbox (resend.dev), que
// NO entrega a terceros. Sirve de preflight antes de un envío real.
export async function remitenteEsSandbox(): Promise<boolean> {
  return /@resend\.dev>?\s*$/i.test(await getEmailFrom());
}

/** Email "conectado" para este workspace: hay key y el remitente no es sandbox. */
export async function emailConectado(): Promise<boolean> {
  const [key, sandbox] = await Promise.all([resendKey(), remitenteEsSandbox()]);
  return !!key && !sandbox;
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
  const key = await resendKey();
  if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' };

  const payload: Record<string, unknown> = {
    from: params.from || (await getEmailFrom()),
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

async function resendFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> {
  const key = await resendKey();
  if (!key) return { ok: false, status: 0, body: { message: 'RESEND_API_KEY no configurada' } };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja texto */ }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { message: err instanceof Error ? err.message : String(err) } };
  }
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
  return { ok: false, error: errMsg(r.body, `Resend ${r.status}`) };
}

export async function getResendDomain(id: string): Promise<DomainResult> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}`);
  if (!r.ok) return { ok: false, error: errMsg(r.body, `Resend ${r.status}`) };
  const d = parseDomain(r.body);
  return d ? { ok: true, domain: d } : { ok: false, error: 'respuesta inválida de Resend' };
}

// Dispara la verificación (Resend revisa los DNS). El estado nuevo se lee con
// getResendDomain — la verificación puede tardar minutos.
export async function verifyResendDomain(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}/verify`, { method: 'POST' });
  return r.ok ? { ok: true } : { ok: false, error: errMsg(r.body, `Resend ${r.status}`) };
}

export async function listResendDomains(): Promise<{ ok: true; domains: Array<{ id: string; name: string; status: string }> } | { ok: false; error: string }> {
  const r = await resendFetch('/domains');
  if (!r.ok) return { ok: false, error: errMsg(r.body, `Resend ${r.status}`) };
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
