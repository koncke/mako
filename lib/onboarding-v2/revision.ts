// =============================================================================
// EL INTERRUPTOR DEL ONBOARDING V2, DEL RETO EN SU CHAT Y DEL MOTOR DE LOS TUTORIALES (18/11/2026)
// =============================================================================
// Martín, 18/11: «despleguemos todo esto ya en la app, de verdad… yo luego simplemente voy cuando ya esté desplegado y lo voy
// revisando absolutamente todo». Lo nuevo lo ve SÓLO su revisión hasta que lo apruebe: sus cuentas y el Cliente de Prueba
// (ws 3). Vive en el CÓDIGO, sin escrituras en la base: prenderlo para todos es UN cambio, `PARA_TODOS = true`.
//
// Lo preguntan el layout (el motor de los tutoriales, el chat del reto) y el onboarding, siempre del lado del server: el
// navegador no decide quién lo ve.
// =============================================================================

/** Un solo cambio lo prende para todos (cuando Martín lo apruebe). */
export const PARA_TODOS = false;

/** Las cuentas de la revisión de Martín (en minúsculas). */
export const EMAILS_REVISION: readonly string[] = ['martinkoncke@gmail.com', 'tejadomartin@gmail.com'];

/** Los negocios de la revisión: el Cliente de Prueba. */
export const WS_REVISION_V2: readonly number[] = [3];

/** ¿Esta persona, en este negocio, ve el onboarding V2 y los tutoriales nuevos? */
export function veOnboardingV2(q: { email?: string | null; ws?: number | null }): boolean {
  if (PARA_TODOS) return true;
  const email = (q.email ?? '').trim().toLowerCase();
  if (email && EMAILS_REVISION.includes(email)) return true;
  return q.ws != null && WS_REVISION_V2.includes(q.ws);
}

/**
 * ¿Lo está viendo como REVISIÓN (todavía no está para todos)? Lo que sólo sirve para revisar —el lugar marcado «tu video de
 * esta pestaña» donde todavía no hay video grabado— se muestra sólo así: a un cliente nunca le aparece un hueco.
 */
export const esRevision = (ve: boolean): boolean => ve && !PARA_TODOS;
