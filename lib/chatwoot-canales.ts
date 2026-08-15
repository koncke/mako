// =============================================================================
// Los canales de Chatwoot — de qué bandeja salió un mensaje entrante
// =============================================================================
// El webhook de Chatwoot es UNO para toda la cuenta: WhatsApp, Instagram, email
// y webchat entran por la MISMA URL. Lo único que los distingue en el payload es
// `conversation.channel`; el objeto `inbox` trae solo `{id, name}`.
//
// Vive acá y NO en `lib/chatwoot.ts` a propósito: aquel tiene `server-only`, así
// que ningún test lo puede importar — y una condición que decide si un mensaje
// se procesa o se descarta es justo la que no puede quedarse sin red (mismo
// criterio que `exigirClienteDePrueba` y `lib/formatos-archivo.ts`).
// =============================================================================

/**
 * Los canales que ESTA integración procesa como WhatsApp.
 *
 * Positivo a propósito (AGENTS.md → «un guard sobre algo destructivo se escribe
 * en POSITIVO»): la lista de lo que NO es WhatsApp se queda vieja sola — cada
 * canal nuevo de Chatwoot entra por el hueco sin que nada avise.
 *
 * Es UNO solo porque es el único que la app conecta: el inbox oficial de
 * WhatsApp (`CHATWOOT_WA_INBOX_ID`, ver `lib/chatwoot.ts`). El WhatsApp NO
 * oficial va por Evolution, que tiene su propio webhook y no pasa por acá.
 * Si algún día un cliente conecta un inbox de WhatsApp por Twilio
 * (`Channel::TwilioSms`), se agrega ACÁ a mano — el `console.warn` del webhook
 * nombra el canal descartado justamente para que se vea cuál falta.
 */
export const CANALES_WHATSAPP: readonly string[] = ['Channel::Whatsapp'];

/**
 * Los DOS valores con los que llega un DM de Instagram.
 *
 * No es paranoia: los inboxes creados por el flujo legacy «Instagram via
 * Facebook Login» emiten `Channel::FacebookPage`, no `Channel::Instagram`. El
 * propio Chatwoot los desambigua con
 * `instagram? = (facebook? || instagram_direct?) && channel.instagram_id.present?`,
 * y ese `instagram_id` **no viaja en el webhook** — así que desde afuera los dos
 * valores son indistinguibles de un Instagram real. Matchear solo
 * `Channel::Instagram` pierde los DMs de todo inbox legacy.
 *
 * Hoy no lo consume el webhook de WhatsApp (que filtra en positivo por
 * `CANALES_WHATSAPP` y no necesita enumerar lo que descarta). Vive acá escrito
 * para el receptor de Instagram, que es donde la omisión cuesta.
 */
export const CANALES_INSTAGRAM: readonly string[] = ['Channel::Instagram', 'Channel::FacebookPage'];

/** ¿Este `conversation.channel` es el WhatsApp que esta integración maneja? */
export function esCanalWhatsapp(canal: string | null | undefined): boolean {
  return CANALES_WHATSAPP.includes((canal ?? '').trim());
}

/** ¿Este `conversation.channel` es un DM de Instagram, incluido el inbox legacy? */
export function esCanalInstagram(canal: string | null | undefined): boolean {
  return CANALES_INSTAGRAM.includes((canal ?? '').trim());
}
