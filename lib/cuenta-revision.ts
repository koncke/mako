// =============================================================================
// cuenta-revision — lo que se MIDE en la base antes de darle la sesión a la cuenta de revisión de las tiendas (4/11/2026)
// =============================================================================
// La regla es pura (`negocioDeRevisionLimpio`, lib/cuenta-revision-reglas.ts); acá se cuenta. Lo usan la entrada con contraseña
// (app/api/auth/contrasena/route.ts: si no está limpio, 503) y scripts/tiendas-cuenta-revision.mts (frena con el MISMO chequeo).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { WS_REVISION, negocioDeRevisionLimpio, type ConteosNegocioDeRevision } from './cuenta-revision-reglas';

/** Cuántas filas tiene esa tabla en el negocio de revisión. null = no se pudo contar (y eso no es cero). */
export async function contarEnRevision(tabla: string, columna = 'workspace_id'): Promise<number | null> {
  try {
    const { count, error } = await getSupabaseServer().from(tabla).select('*', { count: 'exact', head: true }).eq(columna, WS_REVISION);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

export async function conteosDelNegocioDeRevision(): Promise<ConteosNegocioDeRevision> {
  const [lineas, credenciales, cartera] = await Promise.all([
    contarEnRevision('evolution_instancias'),
    contarEnRevision('credenciales'),
    contarEnRevision('agencia_clientes', 'agencia_ws'),
  ]);
  return { lineas, credenciales, cartera };
}

/** ¿Se le puede dar la sesión? Lo que falta (o lo que no se pudo contar) vuelve en `falta`. */
export async function revisarNegocioDeRevision(): Promise<ReturnType<typeof negocioDeRevisionLimpio>> {
  return negocioDeRevisionLimpio(await conteosDelNegocioDeRevision());
}
