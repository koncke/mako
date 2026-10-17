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
