// =============================================================================
// EL DUEÑO DE UN WORKSPACE (módulo CHICO a propósito: lo importa lib/seguir-en-pc.ts, y a ése el guard del layout raíz)
// =============================================================================
// «De quién es el tablero que estoy mirando», que no es lo mismo que «quién está logueado» cuando un administrador mira un negocio.
// Lo usa también lib/usuarios.ts (`emailDuenoWorkspace`). Sólo la base: nada pesado (AGENTS.md, «Lo que importa el layout raíz…»).
// =============================================================================
import 'server-only';
import { getSupabaseServer } from './supabase';

/** El email del DUEÑO de un workspace (su admin-cliente, o el primer miembro si no hay ninguno marcado). '' si no hay o no se pudo leer. */
export async function emailDelDuenoDelWs(ws: number | null): Promise<string> {
  if (ws == null) return '';
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('email, rol_ws').eq('workspace_id', ws).neq('estado', 'suspendido')
    .order('rol_ws', { ascending: true }).limit(20);
  if (error) return '';
  const filas = (data ?? []) as Array<{ email: string; rol_ws: string | null }>;
  const admin = filas.find((f) => f.rol_ws === 'admin') ?? filas[0];
  return (admin?.email ?? '').trim().toLowerCase();
}
