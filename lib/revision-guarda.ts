// =============================================================================
// revision-guarda — lo que la cuenta de revisión de las tiendas NO manda, en el punto de envío (4/11/2026)
// =============================================================================
// La lista de lo permitido del proxy (lib/cuenta-revision-reglas.ts) corta por dónde ENTRA un pedido. Esto corta por dónde SALE: un mail
// de `sendEmail` (lib/resend.ts) y un WhatsApp de `enviarTexto` / `enviarMedia` / `enviarAudio` (lib/evolution.ts), de toda escritura a
// Evolution que pase por `antesDeEscribir` (lib/linea-freno.ts: la voz de MaKo, los grupos) y del bot (`salidaPara`, lib/mako-salida.ts).
// Cubre lo que la lista no ve: una acción que MaKo confirma, un flujo, una ruta que todavía no existe.
//
// En revisión sólo sale un correo a la casilla del equipo (`EMAIL_MAKO`): nada a otra persona, ningún WhatsApp. Cuándo es «en
// revisión», en `enRevision`. Un cron de otro negocio manda como siempre.
// =============================================================================

import 'server-only';
import { EMAIL_MAKO } from './app-url';
import { MOTIVO_ENVIO_EN_REVISION, WS_REVISION, envioPermitidoEnRevision } from './cuenta-revision-reglas';
import { getWorkspaceActual, wsEnContexto } from './workspace';
import { SESSION_COOKIE, verificarToken } from './auth-session';

/**
 * ¿Lo que corre ahora es de la cuenta de revisión? Tres preguntas, cualquiera alcanza:
 *   · el negocio del contexto (`runWithWorkspace`: un cron o un flujo de SU negocio);
 *   · la COOKIE del pedido, por su firma y sin la base: con la base caída `getUsuarioActual` devuelve null para esta sesión, y un
 *     «no sé quién es» acá no puede volverse un «manda»;
 *   · el negocio del pedido (el super admin mirándolo con `?ws=` tampoco le escribe a nadie desde ahí).
 * Sin pedido (`cookies()` tira afuera de uno) sólo vale la primera.
 */
export async function enRevision(): Promise<boolean> {
  if (wsEnContexto() === WS_REVISION) return true;
  try {
    const { cookies } = await import('next/headers');
    if (verificarToken((await cookies()).get(SESSION_COOKIE)?.value)?.mfa === 'revision') return true;
  } catch {
    return false; // sin pedido (un cron de otro negocio): no es el revisor
  }
  try {
    return (await getWorkspaceActual()) === WS_REVISION;
  } catch {
    return false;
  }
}

/** null = sale; un texto = no sale, y ése es el error del envío. */
export async function bloqueoDeEnvioEnRevision(canal: 'email' | 'whatsapp', destinos: string | readonly string[]): Promise<string | null> {
  if (!(await enRevision())) return null;
  if (envioPermitidoEnRevision(canal, destinos, EMAIL_MAKO)) return null;
  console.warn(`[revision] no sale un ${canal} de la cuenta de revisión de las tiendas`);
  return MOTIVO_ENVIO_EN_REVISION;
}
