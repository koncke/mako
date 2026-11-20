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

/**
 * Los negocios de la revisión: el Cliente de Prueba (ws 3) y Leila (ws 11). Leila entró el 20/11/2026: Martín pidió reiniciarle el
 * onboarding para que lo haga entero, y que haga el NUEVO (el Cerebro). Es un cliente de verdad: NO va en `WS_PRUEBA_COMO_CLIENTE`
 * (mirándola como administrador se lee lo suyo, pero no se anota en su perfil). Con ella se prenden también el reto por WhatsApp
 * (`retoPorWhatsApp`), el clip de regalo y el AI Avatar en cubos, que cuelgan de esta misma lista.
 */
export const WS_REVISION_V2: readonly number[] = [3, 11];

/**
 * LOS NEGOCIOS DONDE MARTÍN PRUEBA COMO SI FUERA EL CLIENTE (el Cerebro, 20/11/2026, la decisión sobre la D7): el ws 3 y el ws 9, las
 * cuentas de prueba (nunca el ws 1, que es un cliente). Mirándolos como administrador, lo que se ve y se cierra del onboarding y de los
 * recorridos se ANOTA en su dueño. En cualquier otro negocio se lee del dueño (lo mismo que ve el cliente) pero no se escribe: si
 * soporte mira una cuenta, el cliente no puede perder sus tutoriales.
 */
export const WS_PRUEBA_COMO_CLIENTE: readonly number[] = [3, 9];
export const escribeComoElCliente = (ws: number | null | undefined): boolean => ws != null && WS_PRUEBA_COMO_CLIENTE.includes(ws);

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
 * Sólo en las cuentas de Martín (20/11, la verificación de V10): el Cliente de Prueba (ws 3) ve el V2 como lo vería un cliente, sin
 * la placa «Todavía no está grabado». El navegador lo sabe por el motor (`useEsRevision`, app/_ui/tutorial/store.ts).
 */
export const esRevision = (ve: boolean, email?: string | null): boolean =>
  ve && !PARA_TODOS && EMAILS_REVISION.includes((email ?? '').trim().toLowerCase());
