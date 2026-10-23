// =============================================================================
// ¿Hay por dónde escribirle a este lead? — la regla única del contacto mínimo
// =============================================================================
// La usan las tres puertas que crean leads a mano o en lote: el alta de «Nuevo lead»
// (cliente y server), el importador (`recalcular`) y la prospección (`contactable`).
// Sin `server-only` y sin imports de valores: la carga el navegador y la ejecuta el test.
//
// ⚠️ EL @ DE INSTAGRAM CUENTA COMO CONTACTO (23/10/2026, criterio pasado por el Cerebro):
// «un lead sin teléfono es un lead al que todavía no le escribiste, no un lead inválido».
// Hasta ese día las tres puertas exigían email o teléfono, y casi ningún prospecto de
// Instagram podía pasar al CRM: un perfil público no da ninguno de los dos. La lista los
// encontraba y después no se podían usar.
//
// ⚠️ Y NADA SE RELLENA: un lead con sólo el @ se guarda con el email y el teléfono VACÍOS.
// Un teléfono inventado matchearía el chat de otra persona en WhatsApp.
//
// El @ llega YA normalizado (`usuarioInstagram`, app/crm/campo-inline.ts): esta función no
// decide qué es un usuario de Instagram, sólo si hay alguno.

export type ContactoMinimo = {
  email?: string | null;
  telefono?: string | null;
  instagram?: string | null;
};

/** Hay al menos un canal: un email, un teléfono con dígitos o un usuario de Instagram. */
export function tieneContacto(c: ContactoMinimo): boolean {
  return !!(c.email ?? '').trim() || /\d/.test(c.telefono ?? '') || !!(c.instagram ?? '').trim();
}

/** Lo que se le dice a quien da de alta un lead sin ningún canal. Arranca con la acción. */
export const PEDIR_CONTACTO = 'Carga un email, un teléfono o su Instagram para poder escribirle.';
