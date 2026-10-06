// =============================================================================
// curso-acceso — el link personal del cliente a su portal del curso (la firma)
// =============================================================================
// «Quiero que los clientes de Mauricio puedan ingresar a MaKo con un nivel de acceso especial
// que solo ellos tienen, donde solo ven las clases de Mauricio y las tareas» (Martín, 06/10/2026).
//
// ⚠️ ES UN LINK FIRMADO Y NO UNA CUENTA, y está medido (relevo del 06/10): el login de MaKo es
// sólo con Google y 10 de los 14 clientes de Mauricio no tienen Gmail; y una sesión de MaKo,
// para el proxy, pasa a TODAS las rutas que no son /admin — el aislamiento dependería de que
// cada ruta revise el rol, y varias no lo hacen. Sin `mako_session`, el proxy corta con 401 todo
// lo interno: el alumno sólo llega a lo que el link abre (`/compartido/curso/<token>` y tres
// rutas exactas). Revocar = subir la versión (`curso_accesos`, mig 0202).
//
// Forma: `c1.<ws>.<lead>.<version>.<firma>`. La firma lleva un prefijo propio («curso:») para
// que ninguna otra firma de la casa (sesión, impersonación, agencia) sirva como ésta.
//
// ⚠️ SIN `server-only`, a propósito: la regla (formato, firma, verificación) es lo que hay que
// poder testear. Lo que lo mantiene fuera del navegador es el `node:crypto` de abajo — el mismo
// criterio que lib/gravatar.ts y lib/auth-session.ts.

import crypto from 'node:crypto';

export type AccesoCurso = { ws: number; leadId: number; version: number };

const PREFIJO = 'c1';
const firmar = (cuerpo: string, secreto: string) =>
  crypto.createHmac('sha256', secreto).update(`curso:${cuerpo}`).digest('base64url');

const entero = (s: string | undefined) => (s && /^\d{1,12}$/.test(s) ? Number(s) : null);

/** El token de un cliente. `null` sin secreto configurado (nunca se firma con un secreto vacío). */
export function firmarAccesoCurso(a: AccesoCurso, secreto: string | null | undefined = process.env.AUTH_SECRET): string | null {
  if (!secreto?.trim()) return null;
  if (![a.ws, a.leadId, a.version].every((n) => Number.isInteger(n) && n > 0)) return null;
  const cuerpo = `${a.ws}.${a.leadId}.${a.version}`;
  return `${PREFIJO}.${cuerpo}.${firmar(cuerpo, secreto)}`;
}

/**
 * Lee un token y verifica SU FIRMA. No mira la base: que la versión siga vigente y que el
 * acceso no esté revocado lo decide `resolverAcceso` (lib/curso-datos.ts). Nunca tira.
 */
export function leerAccesoCurso(token: string | null | undefined, secreto: string | null | undefined = process.env.AUTH_SECRET): AccesoCurso | null {
  if (!token || !secreto?.trim() || token.length > 200) return null;
  const p = token.split('.');
  if (p.length !== 5 || p[0] !== PREFIJO) return null;
  const ws = entero(p[1]), leadId = entero(p[2]), version = entero(p[3]);
  if (!ws || !leadId || !version) return null;
  const esperada = firmar(`${p[1]}.${p[2]}.${p[3]}`, secreto);
  const a = Buffer.from(p[4]);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { ws, leadId, version };
}
