// =============================================================================
// google-login-agenda — la agenda de Google se pide AL ENTRAR con Google, detrás de un interruptor
// =============================================================================
// 25/10/2026, Martín (docs/feedback-25-10-tarde.md): «Elimina la de Google Calendar, entiendo que cuando se registran con
// Google ya le podríamos preguntar esos permisos». La tarjeta salió de /integraciones (`oculto`, la agenda se conecta en
// Calendario y en el CRM) y el login con Google PUEDE pedir el calendario. Va APAGADO (`GOOGLE_LOGIN_CON_AGENDA` sin poner)
// hasta que Google verifique la app (docs/verificacion-google.md): calendar.readonly y calendar.events son scopes SENSIBLES,
// y con la app sin verificar Google le muestra «Google no verificó esta app» a TODO el que entra con Google y cuenta a cada
// uno contra el tope de 100 usuarios. Prenderlo es poner GOOGLE_LOGIN_CON_AGENDA=1 en Vercel el día que la verificación
// salga aprobada, y antes cambiar la política de privacidad (app/privacidad/page.tsx promete dos consentimientos separados).
//
// Con el interruptor prendido:
//   · el login suma los scopes de la agenda y `access_type=offline` (sin eso Google no manda el refresh_token);
//   · el callback guarda el token SÓLO si Google dice que se otorgaron TODOS los scopes de la agenda: con el consentimiento
//     granular la persona puede destildar el calendario, y un token sin ese permiso guardado como «conectada» revienta al
//     primer uso (el mismo estado «solo lectura» que ya mide el tablero, pero sin que nadie lo haya elegido).
// Sin `server-only`: lo leen los tests (tests/integraciones-limpieza-25-10.test.ts).
// =============================================================================

/** La variable de entorno que prende el pedido de la agenda en el login. Sólo `'1'` la prende. */
export const INTERRUPTOR_AGENDA_EN_LOGIN = 'GOOGLE_LOGIN_CON_AGENDA';

export const loginPideAgenda = (env: Record<string, string | undefined> = process.env): boolean =>
  env[INTERRUPTOR_AGENDA_EN_LOGIN] === '1';

/** Los scopes del login: identidad siempre; la agenda (`scopeAgenda`, el GCAL_SCOPE de lib/google-calendar.ts) sólo prendido. */
export function scopesDelLogin(conAgenda: boolean, scopeAgenda: string): string {
  return conAgenda ? `openid email profile ${scopeAgenda}`.trim() : 'openid email profile';
}

/** ¿Google otorgó TODOS los scopes de la agenda? `otorgados` es el `scope` de la respuesta del token (separado por espacios). */
export function otorgoLaAgenda(otorgados: string | null | undefined, scopeAgenda: string): boolean {
  const tiene = new Set((otorgados ?? '').split(/\s+/).filter(Boolean));
  const pide = scopeAgenda.split(/\s+/).filter(Boolean);
  return pide.length > 0 && pide.every((s) => tiene.has(s));
}
