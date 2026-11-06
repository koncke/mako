// =============================================================================
// calendario-equipo-server — quién mira el Calendario y quiénes son su equipo (6/11/2026)
// =============================================================================
// La promesa a la agencia de Thiago: «gestionar las reuniones de tu equipo». Un closer o un setter entra a «Llamadas» con
// sus propias llamadas, y el admin filtra por persona. La regla es pura (`miradaDeRol`, `llamadasDeLaPersona`,
// lib/calendario-llamadas.ts); acá la sesión y el equipo del negocio. Lo usan app/calendario/page.tsx y app/m/calendario.
// =============================================================================

import 'server-only';
import { getUsuarioActual } from './auth';
import { getRolWsEfectivo, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { miradaDeRol, type MiradaCalendario } from './calendario-llamadas';

/** Lo que ve quien abre el Calendario. Sin rol legible, lo mínimo (sólo «Llamadas»). */
export async function quienMiraElCalendario(): Promise<MiradaCalendario> {
  const [rol, sesion] = await Promise.all([getRolWsEfectivo().catch(() => null), getUsuarioActual().catch(() => null)]);
  return miradaDeRol(rol, sesion?.nombre ?? null);
}

/**
 * Los nombres del equipo del negocio (closers, setters y admins activos), para el filtro por persona: alguien sin llamadas
 * en la ventana igual se puede elegir. Si la base no contesta, vacío: el filtro sigue con los nombres de las llamadas.
 */
export async function equipoDelCalendario(): Promise<string[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const { data, error } = await getSupabaseServer().from('usuarios').select('nombre, estado').eq('workspace_id', ws).neq('estado', 'suspendido');
  if (error) return [];
  return ((data ?? []) as Array<{ nombre: string | null }>).map((u) => (u.nombre ?? '').trim()).filter(Boolean);
}
