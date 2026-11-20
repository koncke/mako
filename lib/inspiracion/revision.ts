// =============================================================================
// EL INTERRUPTOR DE INSPIRACIÓN (19/11/2026, docs/inspiracion/diseno.md §7)
// =============================================================================
// El molde de lib/onboarding-v2/revision.ts: lo nuevo lo ve SÓLO la revisión de Martín hasta que lo apruebe. Vive en el
// CÓDIGO, sin escrituras en la base: prenderlo para todos es UN cambio, `PARA_TODOS = true`.
//
// ⚠️ En el doer de WhatsApp no hay sesión ni email: ahí la puerta es por negocio (`ws`). La pantalla pregunta las dos cosas.
// ⛔ Nunca el ws 1: es un cliente.
// =============================================================================

/** Un solo cambio lo prende para todos (cuando Martín lo apruebe). */
export const PARA_TODOS = false;

/** Las cuentas de la revisión de Martín (en minúsculas). */
export const EMAILS_REVISION: readonly string[] = ['martinkoncke@gmail.com', 'tejadomartin@gmail.com'];

/** Los negocios de la revisión: las cuentas de prueba. */
export const WS_REVISION: readonly number[] = [3, 9];

/** ¿Este negocio (o esta persona) tiene Inspiración? */
export function veInspiracion(q: { email?: string | null; ws?: number | null }): boolean {
  if (PARA_TODOS) return true;
  const email = (q.email ?? '').trim().toLowerCase();
  if (email && EMAILS_REVISION.includes(email)) return true;
  return q.ws != null && WS_REVISION.includes(q.ws);
}
