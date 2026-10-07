// =============================================================================
// invitacion-aviso — qué se le dice EN LA PANTALLA a quien dio de alta a alguien
// (y, abajo, el texto del mail que invita a un cliente al curso de un servicio)
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
  const link = inv?.enlace ? ` Pásale este link: ${inv.enlace}` : '';
  return { tono: 'warn', texto: `Creado, pero el mail de acceso NO salió${porque}. Avísale tú a ${e}.${link}` };
}

// ── La invitación al CURSO de un servicio ─────────────────────────────────────
// Pedido de Martín (06/10/2026): «Al igual que en la vista de Agencia, se debería poder
// INVITAR al cliente a MaKo para que tenga acceso al curso». El acceso al curso NO es una
// cuenta (lib/curso-acceso.ts): es un link firmado. Este mail le lleva ESE link.
//
// ⚠️ EL TEXTO VIVE ACÁ Y NO ADENTRO DE lib/invitaciones.ts porque ese módulo es `server-only`
// y ningún test lo puede ejecutar: lo único que se le podía pedir era una regex sobre el
// fuente. Acá se arma y se PRUEBA (tests/curso-invitar.test.ts): el asunto, el neutro con tú
// y que el link de entrada esté adentro.
//
// ⚠️ LO LEE UN CLIENTE MEXICANO DE OTRO NEGOCIO (Mauricio). Español neutro con TÚ, nunca
// voseo, y SIN JERGA de MaKo: no sabe qué es MaKo ni le importa. Sí dice de qué negocio es el
// programa, o lo más razonable que puede hacer con un mail de una marca que no conoce es
// tratarlo como spam.
//
// ⚠️ Y EL LINK VA EN EL CUERPO, no en un botón, igual que el mail de acceso a una cuenta: el
// botón de `renderEmailHtml` se dibuja DESPUÉS de todo el cuerpo, así que la línea de Google
// quedaba ARRIBA del botón principal. Con el link en el texto, el orden es el de lectura y la
// versión de texto plano dice exactamente lo mismo que la HTML.

/** El mail de la invitación al curso. `entrarConGoogle` es la URL del login (linkApp('/login')). */
export function textoInvitacionCurso(p: {
  nombre?: string | null;
  /** El nombre del producto, o los productos con curso unidos con «y». */
  programa: string;
  /** El negocio que lo imparte (el nombre del workspace). */
  negocio?: string | null;
  /** El link de ENTRADA de la versión vigente del acceso. */
  enlace: string;
  entrarConGoogle: string;
}): { asunto: string; preheader: string; cuerpo: string } {
  const primer = (p.nombre ?? '').trim().split(/\s+/)[0] ?? '';
  const programa = p.programa.trim() || 'tu programa';
  const de = p.negocio?.trim() ? ` de ${p.negocio.trim()}` : '';
  const cuerpo = [
    primer ? `Hola ${primer},` : 'Hola,',
    '',
    `Tu acceso al programa ${programa}${de} ya está listo.`,
    '',
    'Entra desde aquí:',
    p.enlace,
    '',
    `También puedes entrar en ${p.entrarConGoogle} con Google si este correo es de Google.`,
  ].join('\n');
  return { asunto: `Tu acceso a ${programa}`, preheader: `Tu acceso a ${programa} ya está listo.`, cuerpo };
}

/**
 * El mail al LÍDER de un área (#665): le llega el link de SUS tareas, las del área que le tocó.
 *
 * ⚠️ SIN LA LÍNEA DE GOOGLE, a propósito: el líder no tiene cuenta ni cookie de alumno — entra
 * SÓLO con este link (lib/curso-acceso.ts). Ofrecerle «entra con Google» lo mandaría a un login que
 * le contesta «no autorizado», o peor, si su correo fuera el del cliente, a la puerta del cliente.
 * Por eso tampoco se ofrece reenviarlo «como si fuera» la invitación del cliente: es otro texto.
 */
export function textoInvitacionLider(p: {
  /** El área, tal como la escribió el cliente en su tabla de áreas. */
  area: string;
  programa: string;
  negocio?: string | null;
  /** El link del portal de su área (el `c2.` firmado). */
  enlace: string;
}): { asunto: string; preheader: string; cuerpo: string } {
  const area = p.area.trim() || 'tu área';
  const programa = p.programa.trim() || 'el programa';
  const de = p.negocio?.trim() ? ` de ${p.negocio.trim()}` : '';
  const cuerpo = [
    'Hola,',
    '',
    `Te toca contestar las tareas de ${area} en el programa ${programa}${de}.`,
    '',
    'Entra desde aquí:',
    p.enlace,
    '',
    'Este enlace es personal. No lo compartas.',
  ].join('\n');
  return { asunto: `Tus tareas de ${area}`, preheader: `Tus tareas de ${area} en ${programa}.`, cuerpo };
}
