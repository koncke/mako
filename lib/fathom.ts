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
  // El algoritmo vive en lib/standard-webhooks.ts: Fathom y Resend firman igual
  // (Svix), y estaba escrito dos veces. Acá queda solo la forma de fallar
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

/**
 * ¿El invitado realmente habló? `true` = certeza de que asistió · `false` = certeza
 * de que NO · `null` = no se puede saber (el caller asume que asistió: hubo grabación).
 *
 * ⚠️ `matched_calendar_invitee_email` NO es un hecho sobre la asistencia: es la
 * HEURÍSTICA de Fathom, que matchea el nombre del invitado del calendario contra el
 * display name de quien habla. Cuando no matchea, el campo viene null — y eso no
 * dice nada sobre si la persona estuvo.
 *
 * Leer ese null como "no vino" mandó a Nutrición No Show una R1 de 64 minutos con
 * 218 turnos del prospecto (lead 1696, 12/08). El invitado del calendario era una
 * casilla genérica —`contacto@prosesamed.com`, con `name` = el propio email— y la
 * persona real aparecía como «Fernando»: un nombre de buzón NUNCA va a matchear con
 * una persona, así que el caso no era raro, era el caso típico de un lead B2B.
 *
 * Por eso la ausencia solo se AFIRMA cuando el transcript la prueba: todos los que
 * hablaron están matcheados, y todos son de casa (el host o un invitado interno).
 * Alcanza UN hablante sin matchear para no poder concluir — esa voz puede ser el
 * invitado. Ante la duda se devuelve null y el lead sigue su curso: equivocarse
 * hacia "asistió" lo corrige una persona en un click, y equivocarse hacia "no vino"
 * lo manda a la secuencia de no-show, apaga el análisis de la llamada y nadie se
 * entera hasta que el prospecto se enfría.
 */
export function inviteeSpoke(p: FathomWebhookPayload, email: string): boolean | null {
  const t = p.transcript ?? [];
  if (!t.length) return null;
  const norm = (s: string | null | undefined) => s?.trim().toLowerCase() || null;
  const matcheado = (x: FathomTranscriptEntry) => norm(x.speaker?.matched_calendar_invitee_email);

  const e = norm(email);
  if (e && t.some((x) => matcheado(x) === e)) return true;

  // No aparece con SU email → ¿el transcript prueba que solo habló gente de casa?
  const deCasa = new Set<string>();
  for (const i of p.calendar_invitees ?? []) {
    const em = norm(i.email);
    if (em && i.is_external === false) deCasa.add(em);
  }
  const host = norm(p.recorded_by?.email);
  if (host) deCasa.add(host);

  const soloDeCasa = t.every((x) => { const m = matcheado(x); return !!m && deCasa.has(m); });
  return soloDeCasa ? false : null;
}

/** Duración de la reunión en minutos (del payload del webhook), o null. */
export function webhookDurationMin(p: FathomWebhookPayload): number | null {
  if (!p.recording_start_time || !p.recording_end_time) return null;
  const a = new Date(p.recording_start_time).getTime();
  const b = new Date(p.recording_end_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}
