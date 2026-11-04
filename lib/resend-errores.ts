// =============================================================================
// resend-errores — una key de Resend de SÓLO ENVÍO, dicha en palabras (tarjeta #875, 17/10/2026)
// =============================================================================
// Mauricio, conectando elevate.com.mx (Fathom 863534245, 42:02): «This API key is restricted to only send emails», en
// inglés y crudo. Martín: «esto es un error de MaKo». Lo era: el alta de un dominio («Opción A», la cuenta de Resend de
// MaKo) usa la key de la PLATAFORMA, y la que está guardada en la fila del ws1 —la que el arranque pone en el entorno,
// pisando la de Vercel— es de sólo envío (medido el 17/10: `restricted_api_key` en GET /domains). Manda bien los
// correos de MaKo, pero no puede dar de alta ni verificar un dominio de nadie.
//
// Dos dueños, dos mensajes: si la key es la de MaKo, el problema es nuestro y la persona no tiene nada que tocar; si es
// la del negocio, le decimos cuál crear. PURO: lo leen lib/resend.ts y la verificación de Integraciones.
// =============================================================================

import { EMAIL_MAKO } from './app-url';

/** ¿Resend dijo que la key sólo puede enviar? (401 `restricted_api_key`, en GET o POST de /domains). */
export function esKeySoloEnvio(body: unknown): boolean {
  return typeof body === 'object' && body != null && (body as { name?: unknown }).name === 'restricted_api_key';
}

/** La key de MaKo no administra dominios: no es de la persona, y se lo decimos así. */
export const KEY_SOLO_ENVIO_DE_MAKO = `La key de correo de MaKo sólo puede enviar: no puede dar de alta ni verificar tu dominio. Es un problema de MaKo, no tuyo: escríbenos a ${EMAIL_MAKO}.`;

/** La key del negocio no administra dominios: cuál crear y dónde pegarla. */
export const KEY_SOLO_ENVIO_TUYA = 'Tu key de Resend sólo puede enviar. Crea una con «Full access» en resend.com/api-keys y pégala en Integraciones → Email.';

// =============================================================================
// La clave que ADMINISTRA dominios y el tope de dominios del plan (4/11/2026)
// =============================================================================
// Medido ese día desde la PC (el Cerebro): la key de producción con que MaKo MANDA es de sólo envío, y así se queda. Dar de
// alta, leer y verificar dominios usa otra, `RESEND_ADMIN_API_KEY` (lib/resend-dominios.ts). Sin ella, el alta se frena
// ANTES de crear nada, y el texto dice de quién es el problema.

/** Falta la clave de administración de MaKo: no es de la persona, y se lo decimos así. */
export const SIN_CLAVE_DE_DOMINIOS = `MaKo todavía no puede dar de alta ni verificar dominios de correo: le falta su clave para administrarlos. Es un problema de MaKo, no tuyo: escríbenos a ${EMAIL_MAKO}.`;

/** La cuenta de MaKo llegó al tope de dominios de su plan. No dice nada del dominio de la persona: no se llegó a mirar. */
export const TOPE_DOMINIOS_DE_MAKO = `La cuenta de correo de MaKo llegó al tope de dominios de su plan, así que no se pudo dar de alta el tuyo. No es por tu dominio: es un problema de MaKo. Escríbenos a ${EMAIL_MAKO}.`;

/** La cuenta de Resend del negocio llegó al tope de dominios de su plan. */
export const TOPE_DOMINIOS_TUYO = 'Tu cuenta de Resend llegó al tope de dominios de su plan. No es por tu dominio: sube el plan en resend.com o borra un dominio que no uses.';

// Los errores tipados que NO son el tope: con éstos, el texto no se lee (un 401 de key que dice «domain» no es un tope).
const NO_ES_TOPE = new Set(['restricted_api_key', 'invalid_api_key', 'missing_api_key', 'not_found', 'invalid_region', 'method_not_allowed']);

/**
 * ¿Resend rechazó el ALTA porque la cuenta llegó al tope de dominios de su plan? ⚠️ NO MEDIDO: la forma exacta de ese error
 * no se pudo leer (resend.com no resuelve desde la nube y el SDK no tiene un código para esto). Se reconoce por el texto,
 * con DOS condiciones juntas —nombra el dominio Y nombra un tope o el plan— para que un «invalid domain name» no cuente.
 * Cuando se vea el cuerpo real, se suma a tests/resend-clave-admin.test.ts. Sólo se pregunta sobre el alta (POST /domains).
 */
export function esTopeDeDominios(status: number, body: unknown): boolean {
  if (status < 400 || status >= 500) return false;
  const o = typeof body === 'object' && body != null ? (body as { name?: unknown; message?: unknown }) : null;
  if (o && typeof o.name === 'string' && NO_ES_TOPE.has(o.name)) return false;
  const texto = (o ? String(o.message ?? '') : typeof body === 'string' ? body : '').toLowerCase();
  return /\bdomains?\b/.test(texto) && /\b(limit|limits|plan|upgrade|maximum|max|quota|allowed|allows)\b/.test(texto);
}
