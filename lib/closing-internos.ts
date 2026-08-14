// =============================================================================
// closing-internos — quién es "de casa" en ESTE workspace
// =============================================================================
// El Closing Analyst descarta una llamada como «interna» cuando no queda ningún
// invitado externo. Hasta el 14/08/2026 la lista de quién era «de casa» estaba
// hardcodeada en `lib/closing.ts` con la identidad del DUEÑO —dos gmails de la
// agencia y `elevate.com.mx`— y se le aplicaba a TODOS los clientes:
//
//   · A otra clienta, una llamada con alguien de `elevate.com.mx` se le borraba
//     de la lista de externos y la reunión se descartaba en silencio.
//   · Y su PROPIO dominio no se excluía nunca, así que sus juntas de equipo
//     entraban como candidatas a venta y se le pagaba el modelo.
//
// ⚠️ POR QUÉ VIVE ACÁ Y NO ADENTRO DE closing.ts: la regla de la casa es que la
// condición que gobierna algo destructivo va en un módulo SIN `server-only`, para
// que se pueda testear. Descartar una llamada lo es — se pierde el análisis de una
// venta y no queda ni un error.
//
// ⚠️ Y LA TRAMPA QUE HACE FALTA CUBRIR: la cuenta que graba puede ser un gmail
// (la de la agencia lo es). Derivar «mi dominio» de ahí sin guarda convertiría a
// TODOS los leads con gmail en internos y los descartaría a todos, en silencio.
// De ahí DOMINIOS_PUBLICOS: un dominio público nunca identifica a un equipo.
// =============================================================================

/** Quién es «de casa»: emails exactos + dominios propios. */
export type Internos = { emails: Set<string>; dominios: Set<string> };

/**
 * Nadie es interno.
 *
 * Es el FALLBACK cuando no se pudo averiguar de quién es el workspace, y la
 * dirección del error está elegida: con la lista vacía no se descarta ninguna
 * llamada por error —a lo sumo se analiza de más, que se ve y cuesta plata— y
 * nunca se hereda la identidad de otro cliente, que es el bug que esto vino a
 * cerrar. Caer al dueño acá sería el mismo agujero servido por el camino de error.
 */
export const SIN_INTERNOS: Internos = { emails: new Set(), dominios: new Set() };

/**
 * Dominios de correo PÚBLICO: no identifican a ninguna empresa.
 *
 * Un dominio de acá jamás entra como «dominio propio», por más que la cuenta que
 * graba las reuniones sea justamente un gmail. Sin esta lista, un negocio que
 * graba desde su cuenta personal descartaría como internos a todos sus leads.
 */
export const DOMINIOS_PUBLICOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'hotmail.com.mx',
  'outlook.com', 'outlook.es', 'live.com', 'live.com.mx', 'msn.com',
  'yahoo.com', 'yahoo.com.mx', 'yahoo.es', 'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'aol.com', 'gmx.com', 'gmx.es',
  'yandex.com', 'zoho.com', 'mail.com', 'prodigy.net.mx', 'terra.com.mx',
]);

const norm = (email: string | null | undefined): string => (email ?? '').trim().toLowerCase();

/** El dominio de un email, o null si está vacío o es de correo público. */
export function dominioPropio(email: string | null | undefined): string | null {
  const e = norm(email);
  const dom = e.includes('@') ? e.split('@')[1] : '';
  if (!dom || DOMINIOS_PUBLICOS.has(dom)) return null;
  return dom;
}

/**
 * Arma la identidad de un workspace a partir de los emails que se le conozcan:
 * la cuenta que graba en Fathom y las cuentas de la gente del workspace.
 *
 * Los emails entran SIEMPRE (un gmail personal del equipo sigue siendo del
 * equipo); los dominios solo si no son públicos.
 */
export function internosDe(emails: Array<string | null | undefined>): Internos {
  const out: Internos = { emails: new Set(), dominios: new Set() };
  for (const raw of emails) {
    const e = norm(raw);
    if (!e.includes('@')) continue;
    out.emails.add(e);
    const dom = dominioPropio(e);
    if (dom) out.dominios.add(dom);
  }
  return out;
}

/** ¿Este email es de casa? */
export function esInterno(email: string | null | undefined, internos: Internos): boolean {
  const e = norm(email);
  if (!e.includes('@')) return false;
  if (internos.emails.has(e)) return true;
  return internos.dominios.has(e.split('@')[1] ?? '');
}
