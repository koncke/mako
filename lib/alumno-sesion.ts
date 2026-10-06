// =============================================================================
// alumno-sesion — la cookie del cliente que entra a su curso (la firma, pura)
// =============================================================================
// «Al igual que en la vista de Agencia, se debería poder INVITAR al cliente a MaKo para que tenga
// acceso al curso» (Martín, 06/10/2026).
//
// ⚠️ EL ALUMNO NUNCA RECIBE `mako_session` NI UNA FILA EN `usuarios`, y está medido (relevo del
// 06/10, scratchpad/relevo2/auth-roles-proxy.json): para el proxy, una sesión válida pasa por
// TODAS las rutas que no son /admin; `requireRolWs` manda un rol desconocido a /crm, que no mira el
// rol; 98 APIs y las 53 acciones de crm/actions.ts no miran el rol; `getRolWsEfectivo` cae a
// 'admin'; el Sidebar filtra en negativo y NotificationsProvider lee el WhatsApp del ws1. Con una
// fila en `usuarios`, el alumno leía el CRM de Mauricio.
//
// Por eso tiene SU cookie, `mako_alumno`, que el proxy no toma por sesión de MaKo: todo lo interno
// le sigue dando 401 / «a /login» POR CONSTRUCCIÓN, sin auditar ruta por ruta. Lo único que abre
// es `/mi-curso` (rama propia del proxy), que se autentica sola con esta cookie.
//
// Forma: `al1.<ws>.<lead>.<version>.<exp>.<firma>`, con la firma sobre `alumno:<cuerpo>`. El
// prefijo propio hace que ninguna otra firma de la casa (la sesión, la impersonación, la agencia,
// el token `c1.` del link del curso) sirva como ésta, y al revés.
//
// ⚠️ LA FIRMA NO ALCANZA: dice quién era el alumno el día que entró. Si el acceso sigue vigente
// (versión, no revocado, lead ganado) lo contesta la base EN CADA PEDIDO (lib/alumno-acceso.ts →
// `resolverAcceso`). Revocar sube la versión y corta la cookie en el pedido siguiente, no a los 30
// días como pasa con `mako_session`.
//
// ⚠️ SIN `server-only`, a propósito (el mismo criterio que lib/curso-acceso.ts): la regla —formato,
// firma, vencimiento— es lo que hay que poder testear. Lo que la mantiene fuera del navegador es el
// `node:crypto` de abajo.

import crypto from 'node:crypto';
import type { AccesoCurso } from './curso-acceso';
import { linkApp } from './app-url';

export const ALUMNO_COOKIE = 'mako_alumno';
/** Lo que vale la cookie. El `exp` va FIRMADO: reescribir la cookie a mano no la estira. */
export const ALUMNO_DIAS = 30;

const PREFIJO = 'al1';
const firmar = (cuerpo: string, secreto: string) =>
  crypto.createHmac('sha256', secreto).update(`alumno:${cuerpo}`).digest('base64url');

const entero = (s: string | undefined) => (s && /^\d{1,12}$/.test(s) ? Number(s) : null);

/**
 * El valor de la cookie para un acceso. `null` sin secreto (nunca se firma con un secreto vacío)
 * o con un acceso mal formado. `ahoraMs` y `dias` existen para el test.
 */
export function firmarSesionAlumno(
  a: AccesoCurso,
  secreto: string | null | undefined = process.env.AUTH_SECRET,
  ahoraMs: number = Date.now(),
  dias: number = ALUMNO_DIAS,
): string | null {
  if (!secreto?.trim()) return null;
  if (![a.ws, a.leadId, a.version].every((n) => Number.isInteger(n) && n > 0)) return null;
  const exp = Math.floor(ahoraMs / 1000) + Math.round(dias * 24 * 60 * 60);
  const cuerpo = `${a.ws}.${a.leadId}.${a.version}.${exp}`;
  return `${PREFIJO}.${cuerpo}.${firmar(cuerpo, secreto)}`;
}

/**
 * Lee la cookie y verifica SU FIRMA y su vencimiento. No mira la base: que el acceso siga vigente
 * lo decide `resolverAcceso`. Nunca tira.
 */
export function leerSesionAlumno(
  cookie: string | null | undefined,
  secreto: string | null | undefined = process.env.AUTH_SECRET,
  ahoraMs: number = Date.now(),
): AccesoCurso | null {
  if (!cookie || !secreto?.trim() || cookie.length > 240) return null;
  const p = cookie.split('.');
  if (p.length !== 6 || p[0] !== PREFIJO) return null;
  const ws = entero(p[1]), leadId = entero(p[2]), version = entero(p[3]), exp = entero(p[4]);
  if (!ws || !leadId || !version || !exp) return null;
  const a = Buffer.from(p[5]);
  const b = Buffer.from(firmar(`${p[1]}.${p[2]}.${p[3]}.${p[4]}`, secreto));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (exp * 1000 <= ahoraMs) return null;
  return { ws, leadId, version };
}

/**
 * Las opciones de la cookie, en UN lugar: la ponen el link de entrada y el callback de Google, y
 * la borra el logout. Si divergieran (otro `path`, otro `sameSite`), borrar no borraría.
 */
export function opcionesCookieAlumno(prod: boolean = process.env.NODE_ENV === 'production') {
  return { httpOnly: true, secure: prod, sameSite: 'lax' as const, path: '/' };
}

/**
 * El link que va en el MAIL de invitación: pasa por `/api/compartido/curso/entrar`, que deja la
 * cookie puesta y lleva a `/mi-curso`. Recibe el token `c1.` del curso (lib/curso-acceso.ts), el
 * mismo del link de WhatsApp: no hay una segunda credencial que revocar.
 *
 * Sin `?ws=`: el workspace viaja adentro de la firma (igual que `urlDeToken`).
 */
export const urlDeEntrada = (token: string): string =>
  linkApp(`/api/compartido/curso/entrar?t=${encodeURIComponent(token)}`, null);
