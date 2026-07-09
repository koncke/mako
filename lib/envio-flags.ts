// =============================================================================
// envio-flags — habilitación del envío REAL por canal, POR WORKSPACE
// =============================================================================
// Reemplaza los flags globales de deploy (NUTRICION_SEND_ENABLED /
// EMAIL_SEND_ENABLED) por una setting por workspace: cada cliente prende su
// canal desde la UI sin tocar Vercel, y prender un canal en un workspace no
// afecta a los demás (riesgo anotado en el rediseño doer: los flags globales
// hacían commit del cron para TODOS a la vez).
//
// Compatibilidad: si el workspace no tiene la setting, SOLO el dueño hereda el
// env de deploy (comportamiento histórico); un cliente sin setting = apagado
// (fail-closed, jamás enviar por un canal que el cliente no activó).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';

export const KEY_ENVIO_EMAIL = 'envio_email_enabled';
export const KEY_ENVIO_WHATSAPP = 'envio_whatsapp_enabled';

async function flag(key: string, envDeploy: string | undefined): Promise<boolean> {
  const v = await getSetting(key);
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Sin setting → herencia del env SOLO para el dueño (o contexto sistema, que
  // getSetting ya resuelve al dueño). Cliente sin setting → apagado.
  const ws = await getWorkspaceActual();
  return (ws === OWNER_WS || ws == null) && envDeploy === 'true';
}

/** ¿Este workspace tiene habilitado el envío REAL de email (Resend)? */
export function envioEmailHabilitado(): Promise<boolean> {
  return flag(KEY_ENVIO_EMAIL, process.env.EMAIL_SEND_ENABLED);
}

/** ¿Este workspace tiene habilitado el envío REAL de WhatsApp (Chatwoot)? */
export function envioWhatsappHabilitado(): Promise<boolean> {
  return flag(KEY_ENVIO_WHATSAPP, process.env.NUTRICION_SEND_ENABLED);
}

export async function setEnvioEmail(on: boolean): Promise<void> {
  await setSetting(KEY_ENVIO_EMAIL, on ? 'true' : 'false');
}

export async function setEnvioWhatsapp(on: boolean): Promise<void> {
  await setSetting(KEY_ENVIO_WHATSAPP, on ? 'true' : 'false');
}
