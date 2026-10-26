// =============================================================================
// ultimo-uso — «la última vez que entró» de verdad: cada pantalla la marca, como mucho una vez cada 12 horas (26/10/2026)
// =============================================================================
// La revisión del tren (hallazgo 2): `usuarios.ultimo_login` sólo lo escribía `registrarLogin` (al loguearse con Google,
// con contraseña o con el 2FA), y la sesión dura 30 días sin renovarse. Un equipo que entró el 1/10 y trabaja todos los
// días quedaba «Hace 15 días» y «En riesgo» en Customers entre el día 14 y el 30 de su sesión. Lo mismo mentía la columna
// «La última vez que entró» de Equipo.
//
// Lo marca GET /api/auth/me, que corre en cada pantalla (la Sidebar y el shell del teléfono la piden al navegar). Sin
// esperarlo: la respuesta no espera una escritura.
//   · ⚠️ `.lt(...)` NO COINCIDE CON NULL: quien nunca entró conserva `ultimo_login` null, que es de lo que dependen
//     app/pagar/acceso.ts y app/api/pagar/email/route.ts (sólo se puede cambiar el email de quien todavía no entró).
//   · El tope de 12 horas va en la consulta (`.lt`), no en memoria: con varias instancias del servidor, una memoria por
//     instancia escribiría de más. Una pantalla de más es un UPDATE que no toca ninguna fila.
//   · El super admin mirando a un cliente marca SU fila, no la del cliente: el `sub` de la sesión es suyo.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

/** Horas entre dos marcas del mismo usuario. */
export const HORAS_ENTRE_MARCAS = 12;

/** Marca que esta sesión está usando MaKo. Nunca tira y nunca espera nada de quien la llama. */
export function marcarUso(sesion: { sub: string; email: string }, ahoraMs: number = Date.now()): void {
  if (!/^\d+$/.test(sesion.sub)) return; // las sesiones sin usuario en la tabla (la vieja de contraseña) no tienen fila
  const ahora = new Date(ahoraMs).toISOString();
  const antes = new Date(ahoraMs - HORAS_ENTRE_MARCAS * 3_600_000).toISOString();
  void Promise.resolve(getSupabaseServer().from('usuarios')
    .update({ ultimo_login: ahora })
    .eq('id', Number(sesion.sub)).eq('email', sesion.email).neq('estado', 'suspendido')
    .lt('ultimo_login', antes))
    .then(({ error }) => { if (error) console.error('[ultimo-uso] no pude marcar el uso:', error.message); })
    .catch((e: unknown) => console.error('[ultimo-uso] no pude marcar el uso:', e instanceof Error ? e.message : e));
}
