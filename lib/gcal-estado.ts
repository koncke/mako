// =============================================================================
// gcal-estado — el `state` del OAuth de Google Calendar: nonce + workspace
// =============================================================================
// SIN `server-only` a propósito: es la frontera de aislamiento del token de
// agenda (decide EN QUÉ WORKSPACE se escribe el refresh_token de alguien), y una
// condición así tiene que poder importarla un test. Misma razón que
// `exigirClienteDePrueba` en lib/auth-session.ts.
//
// Por qué el workspace viaja acá y no en la URL: el `redirect_uri` está
// registrado FIJO en Google Cloud —cualquier parámetro extra da
// redirect_uri_mismatch— y en la vuelta de Google no hay `?ws=` ni pestaña que
// leer. Sin esto, el callback resolvía el workspace de quien tuviera la sesión:
// un admin de agencia conectando parado adentro de un cliente le guardaba la
// agenda a SU propio workspace, sin ningún error y con el tile en verde.
//
// El nonce sigue siendo lo único que Google ve (va como `state`); el workspace
// vive en la cookie httpOnly que escribe el paso 1.

/** Valor de la cookie `gcal_state`: el nonce anti-CSRF y el workspace destino. */
export function armarEstadoGcal(nonce: string, ws: number): string {
  return `${nonce}.${ws}`;
}

export type EstadoGcal = { nonce: string; ws: number };

/**
 * Lee la cookie. null si está vacía, si es del formato viejo (sin `.ws`) o si el
 * workspace no es un entero positivo.
 *
 * El formato viejo NO se tolera cayendo al workspace de la sesión: eso sería
 * exactamente el misrouting que este módulo existe para cerrar. Se pierde el
 * intento —de quien arrancó el OAuth en los 10 minutos previos a un deploy— y se
 * le pide reintentar, que es una molestia y no un dato en el lugar equivocado.
 */
export function leerEstadoGcal(cookie: string | null | undefined): EstadoGcal | null {
  if (!cookie) return null;
  const punto = cookie.indexOf('.');
  if (punto <= 0) return null;
  const nonce = cookie.slice(0, punto);
  const ws = Number(cookie.slice(punto + 1));
  if (!Number.isInteger(ws) || ws <= 0) return null;
  return { nonce, ws };
}

/**
 * ¿Esta sesión puede escribir la agenda del workspace `wsDestino`?
 *
 * El super-admin de agencia sí, en cualquiera: configurar integraciones es parte
 * del onboarding, y en el callback su `wsActual` puede venir null porque no hay
 * pestaña que leer. Cualquier otro, SOLO en el suyo — el permiso se re-chequea
 * contra la sesión y no se hereda de la cookie, que es lo único que el navegador
 * podría haber tocado.
 */
export function puedeEscribirAgenda(esSuperAdmin: boolean, wsActual: number | null, wsDestino: number): boolean {
  if (esSuperAdmin) return true;
  return wsActual != null && wsActual === wsDestino;
}
