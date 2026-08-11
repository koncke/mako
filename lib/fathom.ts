// =============================================================================
// Fathom — verificación de webhooks + tipos del payload
// =============================================================================
// Fathom firma sus webhooks con el esquema Svix (secret `whsec_…` + headers
// webhook-id / webhook-timestamp / webhook-signature). El contenido firmado es
// `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 con el secret base64-decodeado,
// resultado en base64. El header de firma es una lista separada por espacios,
// cada una "v1,<base64>".
// =============================================================================

import { verificarFirmaSvix, MOTIVO_FIRMA } from './standard-webhooks';

export class FathomSignatureError extends Error {}

export type FathomSigHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export function verifyFathomSignature(rawBody: string, headers: FathomSigHeaders, secret: string, toleranceSec = 300): void {
  // El algoritmo vive en lib/standard-webhooks.ts: Fathom, Resend y Whop firman
  // igual (Svix), y estaba escrito dos veces. Acá queda solo la forma de fallar
  // que este receptor ya esperaba (throw), para no tocar sus call-sites.
  const fallo = verificarFirmaSvix(rawBody, headers, secret, toleranceSec);
  if (!fallo) return;
  if (fallo === 'sin-secreto') throw new FathomSignatureError('FATHOM_WEBHOOK_SECRET no configurado');
  throw new FathomSignatureError(MOTIVO_FIRMA[fallo]);
}

// ── Payload de "new-meeting-content-ready" (subset que usamos) ──
export type FathomInvitee = { name?: string; email?: string; is_external?: boolean };
export type FathomTranscriptEntry = { speaker?: { matched_calendar_invitee_email?: string | null } };
export type FathomWebhookPayload = {
  title?: string;
  meeting_type?: string;
  url?: string;
  share_url?: string;
  recording_start_time?: string;
  recording_end_time?: string;
  scheduled_start_time?: string;
  calendar_invitees?: FathomInvitee[];
  recorded_by?: { name?: string; email?: string };
  transcript?: FathomTranscriptEntry[];
};

/** El invitado EXTERNO (el prospecto). Si hay varios, el primero con email. */
export function externalInvitee(p: FathomWebhookPayload): FathomInvitee | null {
  const ext = (p.calendar_invitees ?? []).filter((i) => i.is_external && i.email);
  return ext[0] ?? null;
}

/** ¿El invitado realmente habló (aparece en el transcript)? Confirma asistencia
 *  cuando el payload incluye transcript; si no lo incluye, devuelve null (desconocido). */
export function inviteeSpoke(p: FathomWebhookPayload, email: string): boolean | null {
  if (!p.transcript || !p.transcript.length) return null;
  const e = email.trim().toLowerCase();
  return p.transcript.some((t) => t.speaker?.matched_calendar_invitee_email?.trim().toLowerCase() === e);
}

/** Duración de la reunión en minutos (del payload del webhook), o null. */
export function webhookDurationMin(p: FathomWebhookPayload): number | null {
  if (!p.recording_start_time || !p.recording_end_time) return null;
  const a = new Date(p.recording_start_time).getTime();
  const b = new Date(p.recording_end_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}
