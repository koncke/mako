// =============================================================================
// usuarios — cuentas del dashboard (tabla usuarios, migración 0053)
// =============================================================================
// CRUD server-side. El login con Google resuelve el email acá; /admin gestiona
// las filas. Regla dura: nunca dejar la tabla sin un admin activo (los guards
// están en el API, pero eliminarUsuario/actualizarUsuario no la re-chequean —
// son primitivas).

import 'server-only';
import { getSupabaseServer } from './supabase';
import type { Rol } from './auth-session';

export type EstadoUsuario = 'invitado' | 'activo' | 'suspendido';

export type Usuario = {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  estado: EstadoUsuario;
  foto_url: string | null;
  invitado_por: string | null;
  ultimo_login: string | null;
  created_at: string;
};

const COLS = 'id, email, nombre, rol, estado, foto_url, invitado_por, ultimo_login, created_at';

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select(COLS).order('created_at', { ascending: true });
  if (error) throw new Error(`usuarios: ${error.message}`);
  return (data ?? []) as Usuario[];
}

export async function buscarUsuarioPorEmail(email: string): Promise<Usuario | null> {
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select(COLS).eq('email', email.trim().toLowerCase()).maybeSingle();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return (data as Usuario | null) ?? null;
}

export async function crearUsuario(u: {
  email: string; nombre?: string; rol?: Rol; estado?: EstadoUsuario; invitado_por?: string | null;
}): Promise<Usuario> {
  const { data, error } = await getSupabaseServer()
    .from('usuarios')
    .insert({
      email: u.email.trim().toLowerCase(),
      nombre: u.nombre?.trim() ?? '',
      rol: u.rol ?? 'usuario',
      estado: u.estado ?? 'invitado',
      invitado_por: u.invitado_por ?? null,
    })
    .select(COLS).single();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return data as Usuario;
}

export async function actualizarUsuario(
  id: number,
  patch: Partial<Pick<Usuario, 'nombre' | 'rol' | 'estado' | 'foto_url'>>,
): Promise<Usuario> {
  const { data, error } = await getSupabaseServer()
    .from('usuarios')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS).single();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return data as Usuario;
}

export async function eliminarUsuario(id: number): Promise<void> {
  const { error } = await getSupabaseServer().from('usuarios').delete().eq('id', id);
  if (error) throw new Error(`usuarios: ${error.message}`);
}

/** Marca el login: invitado → activo, actualiza nombre/foto si Google los trae. */
export async function registrarLogin(
  email: string,
  datos: { nombre?: string; foto_url?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    estado: 'activo',
    ultimo_login: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (datos.nombre?.trim()) patch.nombre = datos.nombre.trim();
  if (datos.foto_url?.trim()) patch.foto_url = datos.foto_url.trim();
  const { error } = await getSupabaseServer()
    .from('usuarios').update(patch).eq('email', email.trim().toLowerCase()).neq('estado', 'suspendido');
  if (error) console.error(`[usuarios] registrarLogin(${email}): ${error.message}`);
}

export async function contarUsuarios(): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('usuarios').select('id', { head: true, count: 'exact' });
  if (error) throw new Error(`usuarios: ${error.message}`);
  return count ?? 0;
}

/** Admins NO suspendidos. Guard de "no te quedes afuera" en el API de /admin. */
export async function contarAdminsActivos(): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('usuarios').select('id', { head: true, count: 'exact' })
    .eq('rol', 'admin').neq('estado', 'suspendido');
  if (error) throw new Error(`usuarios: ${error.message}`);
  return count ?? 0;
}
