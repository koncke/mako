// =============================================================================
// invitacion-aviso — qué se le dice EN LA PANTALLA a quien dio de alta a alguien
// =============================================================================
// ⚠️ ESTE MÓDULO NO LLEVA `server-only`, A PROPÓSITO. Lo importan las pantallas de
// /admin y de /equipo, que son client components — y además así se puede testear, que
// es la otra mitad de la regla de la casa: una condición encerrada adentro del módulo
// que hace el trabajo sucio es la única sin red, justo donde más duele.
//
// POR QUÉ EXISTE. La pantalla de alta afirmaba, en verde: «Cliente creado. Cuando su
// admin entre con Google usando ese email, la cuenta se activa sola». Cada palabra era
// cierta y el mensaje entero era falso — daba por hecho que el cliente iba a entrar por
// su cuenta a una URL que nadie le pasó. Es la forma de mentira más cara que hay:
// afirmar la mitad verdadera de un proceso de dos pasos. Nadie la audita.
//
// La regla que gobierna esto: el estado sale del paso que FALTA, no del que se cumplió.

/** Lo que devuelve un intento de aviso. `enlace` viene SIEMPRE, incluso si falló. */
export type ResultadoInvitacion = {
  enviado: boolean;
  /** Legible para una persona: se pinta en pantalla cuando el mail no salió. */
  error?: string;
  /** El link que hay que pasarle a mano si el mail falló. */
  enlace: string;
};

export type AvisoInvitacion = {
  /** `ok` = se avisó y no queda nada por hacer · `warn` = falta un paso HUMANO. */
  tono: 'ok' | 'warn';
  texto: string;
};

/**
 * Traduce el resultado del envío a lo que lee la persona que dio el alta.
 *
 * Las tres salidas son distintas a propósito:
 *  · se envió        → terminó, y se dice a qué dirección (el error más común es tipear mal).
 *  · falló           → el alta ESTÁ HECHA, falta avisar a mano, y va el link para hacerlo.
 *  · no había email  → no hay a quién avisarle; no es una falla, es un alta sin dueño todavía.
 */
export function avisoInvitacion(inv: ResultadoInvitacion | null | undefined, email: string): AvisoInvitacion {
  const e = (email ?? '').trim();
  if (!e) return { tono: 'ok', texto: 'Listo. Sin email todavía: cuando le asignes un dueño, MaKo le manda el acceso.' };

  if (inv?.enviado) return { tono: 'ok', texto: `Listo. MaKo le mandó el acceso a ${e}. Entra con Google desde ese mismo email.` };

  // ⚠️ ACÁ NO SE DICE «ERROR» A SECAS. El alta salió bien: lo único que falta es un
  // mensaje, y quien está mirando la pantalla lo puede mandar en 10 segundos si le damos
  // el link. Un cartel rojo que no dice qué hacer convierte un trámite en un incidente.
  const porque = inv?.error ? ` (${inv.error})` : '';
  const link = inv?.enlace ? ` Pasale este link: ${inv.enlace}` : '';
  return { tono: 'warn', texto: `Creado, pero el mail de acceso NO salió${porque}. Avisale vos a ${e}.${link}` };
}
