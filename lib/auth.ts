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
import { cookies, headers } from 'next/headers';
import {
  OWNER_WS, SESSION_COOKIE,
  gateConfigurado, verificarToken, sinLoginPermitido, type Rol, type Sesion,
} from './auth-session';
import { buscarUsuarioPorEmail } from './usuarios';
import { requiereSegundoFactor } from './mfa-reglas';
import { esCuentaDeRevision, sesionDeRevisionVigente } from './cuenta-revision-reglas';
import { obligatorioDesdeDe } from './mfa-obligatorio';
// La sesión se lee UNA vez por pedido, también en una ruta /api (23/10/2026): ver lib/sesion-por-pedido.ts.
import { enElPedido } from './sesion-por-pedido';

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
  const token = store.get(SESSION_COOKIE)?.value;
  return enElPedido(store, token ?? '', () => leerSesion(token));
});

async function leerSesion(token: string | undefined): Promise<Sesion | null> {
  const firmada = verificarToken(token);
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
        // La cuenta de revisión de las tiendas: su sesión vale sólo mientras la FILA siga siendo esa (lib/cuenta-revision-reglas.ts). Una cookie vieja no
        // sobrevive a mudarla de negocio, cambiarle el correo o subirla a admin.
        if (firmada.mfa === 'revision') {
          if (!esCuentaDeRevision(u)) return null;
          // Y rotar la contraseña cierra lo que estaba abierto.
          const { getSupabaseServer } = await import('./supabase');
          const { data } = await getSupabaseServer().from('usuario_contrasena').select('cambiada_at').eq('usuario_id', u.id).maybeSingle();
          if (!sesionDeRevisionVigente(firmada.iat, (data as { cambiada_at?: string } | null)?.cambiada_at)) return null;
        }
        // El rol, el workspace y el rol-de-workspace de la base ganan sobre lo firmado.
        return { ...firmada, rol: u.rol, ws: u.workspace_id ?? null, rolWs: u.rol_ws ?? null };
      } catch {
        // Con la base caída no se desloguea a nadie, salvo a la única sesión sin segundo factor: sin poder mirar su fila, no vale.
        return firmada.mfa === 'revision' ? null : firmada;
      }
    }
    return firmada;
  }

  // Acá vivía la cookie compartida (mako_auth === AUTH_COOKIE_VALUE), que daba
  // admin sobre el workspace del dueño. Se fue, y no solo porque el login ahora
  // es con Google: su valor ERA el secreto, así que viajaba al browser, y como
  // además firmaba las sesiones, cualquiera que la tuviera se fabricaba un token
  // de admin a mano. Una cookie no puede ser su propia llave.

  // Gate sin configurar (local/dev): la sesión dev del dueño, SÓLO con el permiso explícito y desde
  // la máquina (`sinLoginPermitido`, lib/auth-session.ts). Antes bastaba con que faltara AUTH_SECRET,
  // y `next dev` escucha en toda la red con la base de producción detrás (15/10/2026).
  if (!gateConfigurado()) {
    let host: string | null = null;
    try { host = (await headers()).get('host'); } catch { host = null; }
    if (sinLoginPermitido(host)) {
      return { sub: 'dev', email: '', nombre: 'Dev', rol: 'admin', exp: 0, legacy: true, ws: OWNER_WS, rolWs: 'admin' };
    }
  }

  return null;
}

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
