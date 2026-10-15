// =============================================================================
// auth — quién está logueado (lado server: pages y route handlers)
// =============================================================================
// Lee la cookie de sesión firmada (mako_session) y cae a la legacy compartida
// (mako_auth) para sesiones anteriores al sistema de usuarios. En local sin
// gate configurado devuelve una sesión dev-admin, igual que el gate del proxy
// que deja pasar todo — así /admin y /metodo son navegables en desarrollo.
//
// Nota de revocación: el gate del proxy es cripto puro (sin DB), así que una
// suspensión NO frena el render de páginas hasta 30 días. Acá SÍ re-chequeamos
// contra la tabla en cada llamada para las sesiones con fila real, de modo que
// las APIs sensibles (/api/admin, /api/metodo, /api/auth/me) reflejan el estado
// vigente de inmediato.

import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  OWNER_WS, SESSION_COOKIE,
  gateConfigurado, verificarToken, type Rol, type Sesion,
} from './auth-session';
import { buscarUsuarioPorEmail } from './usuarios';
import { requiereSegundoFactor } from './mfa-reglas';
import { obligatorioDesdeDe } from './mfa-obligatorio';

export type { Rol, Sesion };

/** true si el sub del token corresponde a una fila real de la tabla usuarios. */
function tieneFila(sesion: Sesion): boolean {
  return !sesion.legacy && sesion.sub !== 'password' && /^\d+$/.test(sesion.sub);
}

/**
 * Sesión del request actual, o null si no hay nadie logueado. Memoizada por
 * request (React cache) porque el scoping por workspace la consulta muchas veces.
 */
export const getUsuarioActual = cache(async (): Promise<Sesion | null> => {
  const store = await cookies();

  const firmada = verificarToken(store.get(SESSION_COOKIE)?.value);
  if (firmada) {
    // Sesión con fila real: re-chequear estado/rol/workspace vigente. Suspender
    // o eliminar al usuario invalida su sesión de inmediato (fail-open ante DB
    // caída para no desloguear a todos por un error transitorio).
    if (tieneFila(firmada)) {
      try {
        const u = await buscarUsuarioPorEmail(firmada.email);
        if (!u || u.estado === 'suspendido') return null;
        // ⛔ Segunda capa del segundo factor, con lo que dice la BASE. `verificarToken` ya
        // cortó a todo token de admin sin segundo factor; esto cubre lo que el token no
        // sabe: a quien la base dice admin aunque el token diga usuario (lo ascendieron
        // después de entrar), y a quien activó el 2FA después de entrar — una cookie
        // vieja suya, robada, no puede seguir valiendo sin el segundo paso.
        // Y a quien su NEGOCIO se lo exige desde una fecha ya pasada (el 2FA obligatorio, 14/10/2026):
        // desde esa hora, su sesión sin segundo factor deja de valer y el login le pide enrolar uno.
        // La fecha se lee sólo si la sesión NO trae `mfa`: con `mfa` no hay nada que decidir.
        if (!firmada.mfa && requiereSegundoFactor(u.rol, !!u.mfa_activo, await obligatorioDesdeDe(u.workspace_id))) return null;
        // El rol, el workspace y el rol-de-workspace de la base ganan sobre lo firmado.
        return { ...firmada, rol: u.rol, ws: u.workspace_id ?? null, rolWs: u.rol_ws ?? null };
      } catch {
        return firmada;
      }
    }
    return firmada;
  }

  // Acá vivía la cookie compartida (mako_auth === AUTH_COOKIE_VALUE), que daba
  // admin sobre el workspace del dueño. Se fue, y no solo porque el login ahora
  // es con Google: su valor ERA el secreto, así que viajaba al browser, y como
  // además firmaba las sesiones, cualquiera que la tuviera se fabricaba un token
  // de admin a mano. Una cookie no puede ser su propia llave.

  // Gate sin configurar (local/dev): el proxy deja pasar todo → sesión dev dueño.
  const esProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (!gateConfigurado() && !esProd) {
    return { sub: 'dev', email: '', nombre: 'Dev', rol: 'admin', exp: 0, legacy: true, ws: OWNER_WS, rolWs: 'admin' };
  }

  return null;
});

/**
 * Sesión admin verificada, o null. getUsuarioActual ya re-chequeó la fila real
 * contra la base; acá solo confirmamos el rol resultante. Las sesiones sin fila
 * (legacy / contraseña maestra / dev) valen por su origen: son el break-glass.
 */
export async function getSesionAdmin(): Promise<Sesion | null> {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol !== 'admin') return null;
  return sesion;
}
