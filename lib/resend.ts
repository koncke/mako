// =============================================================================
// Cliente de Resend — envío de email (Email Marketing)
// =============================================================================
// Patrón de integración HTTP igual que lib/chatwoot.ts / lib/meta-capi.ts:
//   • valida la config sin lanzar (devuelve {ok:false}), no rompe el cron;
//   • el ENVÍO REAL queda detrás del flag EMAIL_SEND_ENABLED (el caller decide
//     si llamar a sendEmail o registrar 'simulado'), igual que WhatsApp.
//
// No usamos el SDK de Resend para mantener la convención del repo (fetch directo).
// server-only: el RESEND_API_KEY nunca debe llegar al navegador.

import 'server-only';
import crypto from 'node:crypto';
import { credWs } from './credenciales';

const ENDPOINT = 'https://api.resend.com/emails';

// Flag de envío real (igual que NUTRICION_SEND_ENABLED para WhatsApp).
export const EMAIL_SEND_ENABLED = process.env.EMAIL_SEND_ENABLED === 'true';
// Remitente verificado en Resend. onboarding@resend.dev es el sandbox de Resend
// (solo entrega al dueño de la cuenta) hasta verificar el dominio propio.
export const EMAIL_FROM = process.env.RESEND_FROM || 'Mauricio Bustos <onboarding@resend.dev>';

export async function resendConfigurado(): Promise<boolean> {
  return !!(await credWs('RESEND_API_KEY'));
}

// true si el remitente sigue siendo el sandbox de Resend (resend.dev), que NO
// entrega a terceros. Sirve de preflight antes de un envío real.
export function remitenteEsSandbox(): boolean {
  return /@resend\.dev>?\s*$/i.test(EMAIL_FROM) || !process.env.RESEND_FROM;
}

// URL base del dashboard (para armar links absolutos en emails que salen del cron,
// donde no hay request). Fallback al dominio de prod conocido.
export const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');

// ── Unsubscribe (baja con token firmado) ──────────────────────────────────────
// Token = HMAC corto sobre el lead_id con un secreto estable; evita que alguien
// dé de baja a otro lead cambiando el id en la URL.
// Secreto de firma del token de baja. SUPABASE_SERVICE_ROLE_KEY siempre está
// presente server-side, así que es un fallback estable y NO público (a diferencia
// de una constante hardcodeada). Si no hay ningún secreto → fail-closed.
function unsubSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AUTH_COOKIE_VALUE || '';
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

// Envía un email por Resend. NO chequea EMAIL_SEND_ENABLED — eso lo decide el
// caller (el motor de nutrición / broadcasts), igual que sendWhatsappTemplate.
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const key = await credWs('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' };

  const payload: Record<string, unknown> = {
    from: params.from || EMAIL_FROM,
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

// ── Render de HTML del email ──────────────────────────────────────────────────
// Toma un cuerpo en texto plano (con saltos de línea y URLs) y lo envuelve en un
// HTML email-safe (inline styles, ancho contenido, footer con baja). El cuerpo ya
// viene con las variables ({nombre}…) resueltas.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convierte URLs sueltas en <a>. Opera sobre texto YA escapado.
function linkify(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    // No incluir un punto/coma final pegado a la URL.
    const m = url.match(/[.,;:!?)]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${clean}" style="color:#C8870C;text-decoration:underline;" target="_blank" rel="noopener">${clean}</a>${tail}`;
  });
}

// Texto plano → párrafos HTML. Doble salto = párrafo nuevo; simple = <br>.
function bodyToHtml(text: string): string {
  const parags = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return parags
    .map((p) => `<p style="margin:0 0 16px;">${linkify(escapeHtml(p)).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export type RenderEmailParams = {
  subject: string;
  bodyText: string;        // cuerpo en texto plano, variables ya resueltas
  preheader?: string;      // texto de vista previa (oculto en el cuerpo)
  unsubscribeUrl?: string; // link de baja para el footer
  fromName?: string;       // firma del footer
};

export function renderEmailHtml(params: RenderEmailParams): string {
  const fromName = params.fromName || 'Mauricio Bustos';
  const preheader = params.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(params.preheader)}</span>`
    : '';
  const unsub = params.unsubscribeUrl
    ? `<a href="${params.unsubscribeUrl}" style="color:#A39E91;text-decoration:underline;" target="_blank" rel="noopener">Darme de baja</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(params.subject)}</title></head>
<body style="margin:0;padding:0;background:#F2F0EA;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EA;padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E7E3D9;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:28px 32px 8px;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1813;font-size:16px;line-height:1.55;">
        ${bodyToHtml(params.bodyText)}
      </td></tr>
      <tr><td style="padding:18px 32px 26px;font-family:'Helvetica Neue',Arial,sans-serif;color:#6B675C;font-size:13px;line-height:1.5;border-top:1px solid #E7E3D9;">
        <div style="font-weight:600;color:#1A1813;">${escapeHtml(fromName)}</div>
        <div style="color:#A39E91;margin-top:2px;">Negocio que Escala™</div>
        ${unsub ? `<div style="margin-top:12px;font-size:12px;color:#A39E91;">Si no querés recibir más estos correos, ${unsub}.</div>` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Verificación de firma del webhook (Svix, el que usa Resend) ───────────────
// Headers: svix-id, svix-timestamp, svix-signature ("v1,<base64> v1,<base64>…").
// secret: "whsec_<base64>". signedContent = `${id}.${timestamp}.${rawBody}`.
// sig = base64( HMAC_SHA256(base64decode(secret), signedContent) ).
const TOLERANCIA_SEG = 5 * 60; // ventana anti-replay

export type SvixHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export function verifyResendSignature(rawBody: string, headers: SvixHeaders, secret: string): boolean {
  if (!secret) return false;
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  // Anti-replay: el timestamp no puede estar muy lejos de ahora.
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const ahora = Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - tsNum) > TOLERANCIA_SEG) return false;

  const secretB64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let secretBytes: Buffer;
  try { secretBytes = Buffer.from(secretB64, 'base64'); } catch { return false; }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expBuf = Buffer.from(expected);

  // El header trae una o más firmas separadas por espacio, cada una "v1,<sig>".
  for (const part of signature.split(' ')) {
    const comma = part.indexOf(',');
    const sig = comma >= 0 ? part.slice(comma + 1) : part;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) return true;
  }
  return false;
}
