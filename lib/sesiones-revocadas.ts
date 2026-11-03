// =============================================================================
// Cerrar las sesiones abiertas de una persona (01/11/2026, auditoría de seguridad)
// =============================================================================
// La cookie de sesión es una firma que dura 30 días y el server no guarda nada de ella. Para poder
// cerrarla, `usuarios.sesiones_desde` (mig 0366) marca desde cuándo valen sus sesiones: lo escriben
// cambiar o restablecer la contraseña y «Cerrar las otras sesiones».
// ⚠️ TODAVÍA NO CIERRA NADA (03/11/2026): acá se ANOTA el corte, y lo único que podría respetarlo es
// `leerSesion` (lib/auth.ts), que quedó como estaba a propósito (docs/hallazgos-seguridad.md, «Cerrar sesiones:
// el corte se anota y nadie lo lee»). Hasta que la 0366 esté aplicada, tampoco se anota (42703).

import 'server-only';
import { getSupabaseServer } from './supabase';

const COLUMNA_FALTA = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /sesiones_desde/.test(e.message ?? ''));

/**
 * Anota el corte: toda sesión de esa persona firmada hasta ahora queda del lado que no vale. Quien lo pide
 * desde una sesión abierta recibe una cookie nueva en la misma respuesta (`ponerSesion`), para que el día
 * que `leerSesion` lo respete no se cierre la suya también. Devuelve false si no se pudo escribir (o la 0366
 * todavía no está aplicada).
 */
export async function revocarSesiones(usuarioId: number): Promise<boolean> {
  const { error } = await getSupabaseServer().from('usuarios').update({ sesiones_desde: new Date().toISOString() }).eq('id', usuarioId);
  if (COLUMNA_FALTA(error)) {
    console.warn('[sesiones] usuarios.sesiones_desde no existe todavía (mig 0366): no se anotó el corte');
    return false;
  }
  if (error) {
    console.error('[sesiones] no se pudo anotar el corte:', error.message);
    return false;
  }
  return true;
}
