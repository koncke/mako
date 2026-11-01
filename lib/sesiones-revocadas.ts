// =============================================================================
// Cerrar las sesiones abiertas de una persona (01/11/2026, auditoría de seguridad)
// =============================================================================
// La cookie de sesión es una firma que dura 30 días y el server no guarda nada de ella. Para poder
// cerrarla, `usuarios.sesiones_desde` (mig 0360) marca desde cuándo valen sus sesiones: lo lee
// `leerSesion` (lib/auth.ts) en cada pedido, y lo escriben cambiar o restablecer la contraseña y
// «Cerrar las otras sesiones». Hasta que la 0360 esté aplicada, las dos puntas se abstienen solas
// (42703) y todo se porta como antes.

import 'server-only';
import { getSupabaseServer } from './supabase';

const COLUMNA_FALTA = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /sesiones_desde/.test(e.message ?? ''));

/**
 * La hora del corte de esa persona, o null si no hay. TIRA si la base no contesta: quien decide si una
 * sesión vale no puede leer «no pude» como «no hay corte» (lib/auth.ts lo trata como sesión inválida).
 */
export async function sesionesDesde(usuarioId: number): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('usuarios').select('sesiones_desde').eq('id', usuarioId).maybeSingle();
  if (COLUMNA_FALTA(error)) return null;
  if (error) throw new Error(`usuarios.sesiones_desde: ${error.message}`);
  return ((data as { sesiones_desde?: string | null } | null)?.sesiones_desde) ?? null;
}

/**
 * Cierra TODAS las sesiones de esa persona firmadas hasta ahora. Quien lo pide desde una sesión
 * abierta tiene que recibir una cookie nueva en la misma respuesta (`ponerSesion`), o se cierra la
 * suya también. Devuelve false si no se pudo escribir (o la 0360 todavía no está aplicada).
 */
export async function revocarSesiones(usuarioId: number): Promise<boolean> {
  const { error } = await getSupabaseServer().from('usuarios').update({ sesiones_desde: new Date().toISOString() }).eq('id', usuarioId);
  if (COLUMNA_FALTA(error)) {
    console.warn('[sesiones] usuarios.sesiones_desde no existe todavía (mig 0360): no se cerraron las sesiones');
    return false;
  }
  if (error) {
    console.error('[sesiones] no se pudieron cerrar las sesiones:', error.message);
    return false;
  }
  return true;
}
