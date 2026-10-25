// =============================================================================
// La app de escritorio pide SIEMPRE el login de la persona (25/10/2026)
// =============================================================================
// Martín, 25/10 ~12:00: «Revisa que la app de desktop jamás me pidió login, eso esta muy mal, entró directo a la cuenta de
// Mauricio cuando yo estaba en mi cuenta de super admin». Lo que entró era una app web de Chrome instalada en el perfil de
// Chrome de Mauricio (docs/hallazgos-seguridad.md): una app instalada comparte las cookies con su perfil, así que abre con la
// sesión que haya ahí, sea de quien sea, sin preguntar.
//
// La regla: cada VENTANA NUEVA de la app pide el login de la persona (el mismo de la web: Google o contraseña, con su segundo
// paso) y sólo pasa con una sesión EMITIDA después de que la ventana se abrió (`iat`, firmado en la sesión). Sin desloguear el
// navegador: si entra con su cuenta, la cookie del perfil pasa a ser la suya; si cierra la ventana sin entrar, la próxima vez
// pregunta de nuevo. Cerrar sesión no toca la computadora conectada para la IA (otro token, otro lugar).
//
// Qué es «la app»: la app web instalada (Chrome o Edge la abren en su ventana, `display-mode: standalone`) y lo que abre el
// acceso «MaKo» que deja el instalador (`mako-pc abrir`, con `?app=1`). El teléfono NO: la TWA y Capacitor también corren
// «instaladas», y ésa es otra app con su propia entrada.
// =============================================================================

/** Dónde guarda la ventana desde cuándo espera el login (sessionStorage: es de ESA ventana y se va al cerrarla). */
export const CLAVE_PUERTA = 'mako-app-entrada';
/** El parámetro con el que el acceso «MaKo» (scripts/ia-pc/mako-pc.mjs → destinoDeAbrir) marca su ventana. */
export const PARAM_APP = 'app';
/** Margen para el reloj: la sesión nace en otro pedido que la marca de la ventana (los dos con la hora del servidor). */
export const MARGEN_PUERTA_S = 5;

/** El teléfono tiene su app: esta regla es de la computadora. */
export const esTelefono = (ua: string): boolean => /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

/**
 * ¿Esta ventana es la app de escritorio? `marcada`: ya empezó a esperar el login (tiene `CLAVE_PUERTA`). Sigue siendo de la app
 * hasta cerrarse aunque la próxima pantalla venga sin `?app=1` (medido en el navegador, 25/10/2026: el acceso «MaKo» volvía del
 * login sin el parámetro y la puerta la tomaba por una pestaña común; quien escribía otra dirección pasaba con la sesión vieja).
 */
export function esVentanaDeApp(p: { instalada: boolean; conParam: boolean; marcada?: boolean; ua: string }): boolean {
  return (p.instalada || p.conParam || !!p.marcada) && !esTelefono(p.ua);
}

/** Lo que la ventana tiene guardado: desde cuándo (segundos del servidor) espera el login, o que ya entró. */
export type Puerta = { desde: number } | 'adentro' | null;

export function leerPuerta(x: string | null | undefined): Puerta {
  if (x === 'adentro') return 'adentro';
  const n = Number(x);
  return x && Number.isFinite(n) && n > 0 ? { desde: n } : null;
}
export const escribirPuerta = (p: Exclude<Puerta, null>): string => (p === 'adentro' ? 'adentro' : String(p.desde));

/**
 * Qué hace la ventana con lo que sabe:
 *   · 'pasar': ya entró en esta ventana;
 *   · 'entro': la sesión nació después de que la ventana empezó a esperar → se marca y pasa;
 *   · 'pedir-login': ventana nueva, o una sesión de antes (del perfil, de otro, sin `iat`) → al login.
 * `emitida` es el `iat` de la sesión (null: sin sesión, o de antes del 25/10/2026, que no lo trae).
 */
export function decidirPuerta(p: { puerta: Puerta; emitida: number | null }): 'pasar' | 'entro' | 'pedir-login' {
  if (p.puerta === 'adentro') return 'pasar';
  if (p.puerta && p.emitida != null && p.emitida >= p.puerta.desde - MARGEN_PUERTA_S) return 'entro';
  return 'pedir-login';
}

/** Adónde vuelve después del login: la misma pantalla, sin el `?app=1` (ya no hace falta: la ventana quedó marcada). */
export function destinoTrasLogin(pathname: string, search: string): string {
  const q = new URLSearchParams(search);
  q.delete(PARAM_APP);
  const resto = q.toString();
  return `${pathname}${resto ? `?${resto}` : ''}`;
}

/** El login de la app: el de siempre, con `app=1` para que no diga «Ya tienes la sesión abierta» y lleve adentro. */
export const loginDeLaApp = (destino: string): string => `/login?${new URLSearchParams({ [PARAM_APP]: '1', next: destino }).toString()}`;
