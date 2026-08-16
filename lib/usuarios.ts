// =============================================================================
// usuarios — cuentas del dashboard (tabla usuarios, migración 0053)
// =============================================================================
// CRUD server-side. El login con Google resuelve el email acá; /admin gestiona
// las filas. Regla dura: nunca dejar la tabla sin un admin activo (los guards
// están en el API, pero eliminarUsuario/actualizarUsuario no la re-chequean —
// son primitivas).

import 'server-only';
import { getSupabaseServer } from './supabase';
import type { Rol, RolWorkspace } from './auth-session';

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
  /** workspace al que pertenece (null para admins que cruzan workspaces). */
  workspace_id: number | null;
  /** rol dentro del negocio del cliente ('admin'|'closer'|'setter'); null = admin de agencia. */
  rol_ws: RolWorkspace | null;
  /**
   * Cuándo se le mandó el mail de acceso. NULL = nunca se le avisó que tenía cuenta.
   *
   * No es lo mismo que `estado: 'invitado'`, que solo dice «nunca entró»: sin esto no se
   * distingue «le llegó y no entró» de «nunca supo que existía», que son dos problemas
   * con dos arreglos distintos. Ver lib/invitaciones.ts (mig 0138).
   */
  invitacion_enviada_at: string | null;
  /**
   * Todo lo demás de la persona (teléfono, cargo, bio, sus preferencias de
   * notificaciones dentro de la app…). Ver lib/perfil.ts.
   *
   * Estuvo fuera de este SELECT y nadie lo notó porque falla en silencio: getPerfil
   * leía `u.perfil` (undefined → todo vacío) y setPerfil reescribía el jsonb desde
   * ese vacío, así que guardar el perfil borraba lo que no venía en el formulario.
   */
  perfil?: Record<string, unknown> | null;
};

const COLS = 'id, email, nombre, rol, estado, foto_url, invitado_por, ultimo_login, created_at, workspace_id, rol_ws, perfil, invitacion_enviada_at';

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

/**
 * El usuario que se llama así, cuando NO tenemos su email.
 *
 * Hace falta porque media agenda son Meets improvisados: sin evento de calendario,
 * Fathom no devuelve invitados y lo único que queda es el nombre con el que habla en
 * la transcripción ("Mauricio"). Sin esto, las 30 tareas que MaKo le atribuyó a
 * Mauricio no se le podían mandar a Mauricio — el botón directamente no aparecía.
 *
 * REGLA DURA: solo si el match es ÚNICO entre las cuentas a las que de verdad se les
 * puede mandar algo. Mandarle el trabajo de uno al tablero de otro es peor que no
 * mandarlo, así que con dos candidatos reales se devuelve null y el que llama avisa.
 *
 * Dos cosas que la primera versión hacía mal y por las que NO funcionaba en producción:
 *
 *  1. NO filtraba por estado. En la base hay dos filas con el nombre «Mauricio Bustos
 *     Eguia»: su cuenta real (activa) y el usuario del workspace «Cliente de Prueba»
 *     (invitado, nunca entró). Eran dos candidatos, así que devolvía null SIEMPRE. Se
 *     miran primero las ACTIVAS: a una cuenta que nunca aceptó la invitación no se le
 *     puede dejar un borrador igual.
 *  2. Buscaba por PREFIJO. La cuenta de Leila se llama «Team Leila Fittipaldi», así
 *     que "Leila" no empezaba el nombre y no matcheaba nada. Ahora el nombre buscado
 *     tiene que aparecer como PALABRA COMPLETA adentro del nombre de la cuenta.
 */
export async function buscarUsuarioPorNombre(nombre: string): Promise<Usuario | null> {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const n = norm(nombre);
  if (n.length < 3) return null;
  const { data, error } = await getSupabaseServer().from('usuarios').select(COLS);
  if (error) throw new Error(`usuarios: ${error.message}`);
  const todos = (data ?? []) as Usuario[];

  /** Las palabras del nombre buscado tienen que estar TODAS en el de la cuenta. */
  const matchea = (u: Usuario): boolean => {
    const un = ` ${norm(u.nombre ?? '').replace(/[^a-z0-9ñ]+/g, ' ')} `;
    const piezas = n.replace(/[^a-z0-9ñ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
    return piezas.length > 0 && piezas.every((w) => un.includes(` ${w} `));
  };

  // Primero entre las ACTIVAS; solo si ahí no hay ninguna se mira el resto (una cuenta
  // invitada igual sirve para nombrarla, aunque no se le pueda dejar el borrador).
  const activos = todos.filter((u) => u.estado === 'activo');
  const porEstado = [activos, todos];
  for (const grupo of porEstado) {
    const exactos = grupo.filter((u) => norm(u.nombre ?? '') === n);
    if (exactos.length === 1) return exactos[0];
    if (exactos.length > 1) return null;      // dos cuentas con el MISMO nombre completo: no se elige
    const parciales = grupo.filter(matchea);
    if (parciales.length === 1) return parciales[0];
    if (parciales.length > 1) return null;    // ambiguo de verdad: que el que llama avise
  }
  return null;
}

/**
 * Teléfono del perfil de un usuario (el jsonb `perfil`, mig 0056). Se usa para
 * mandarle por WhatsApp las tareas que asumió en una reunión. '' si no lo cargó.
 */
export async function telefonoDeUsuario(email: string): Promise<string> {
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('perfil').eq('email', email.trim().toLowerCase()).maybeSingle();
  if (error) return '';
  const perfil = (data as { perfil?: Record<string, unknown> } | null)?.perfil ?? {};
  const tel = perfil.telefono;
  return typeof tel === 'string' ? tel.trim() : '';
}

export async function crearUsuario(u: {
  email: string; nombre?: string; rol?: Rol; estado?: EstadoUsuario; invitado_por?: string | null; workspace_id?: number | null; rol_ws?: RolWorkspace | null;
}): Promise<Usuario> {
  const { data, error } = await getSupabaseServer()
    .from('usuarios')
    .insert({
      email: u.email.trim().toLowerCase(),
      nombre: u.nombre?.trim() ?? '',
      rol: u.rol ?? 'usuario',
      estado: u.estado ?? 'invitado',
      invitado_por: u.invitado_por ?? null,
      workspace_id: u.workspace_id ?? null,
      rol_ws: u.rol_ws ?? null,
    })
    .select(COLS).single();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return data as Usuario;
}

export async function actualizarUsuario(
  id: number,
  patch: Partial<Pick<Usuario, 'nombre' | 'rol' | 'estado' | 'foto_url' | 'workspace_id' | 'rol_ws'>>,
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

/**
 * El email del DUEÑO de un workspace (su admin-cliente, o el primer miembro si no
 * hay ninguno marcado). Sirve para saber "de quién es el tablero que estoy mirando",
 * que no es lo mismo que "quién está logueado" cuando un admin impersona.
 */
export async function emailDuenoWorkspace(ws: number | null): Promise<string> {
  if (ws == null) return '';
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('email, rol_ws').eq('workspace_id', ws).neq('estado', 'suspendido')
    .order('rol_ws', { ascending: true }).limit(20);
  if (error) return '';
  const filas = (data ?? []) as Array<{ email: string; rol_ws: string | null }>;
  const admin = filas.find((f) => f.rol_ws === 'admin') ?? filas[0];
  return (admin?.email ?? '').trim().toLowerCase();
}

/**
 * Admins-de-cliente NO suspendidos de un workspace. Guard análogo a
 * contarAdminsActivos pero por-negocio: evita dejar a un cliente sin un
 * admin-cliente (rol_ws='admin') al suspender/eliminar/degradar un miembro.
 */
export async function contarAdminsClienteActivos(ws: number): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('usuarios').select('id', { head: true, count: 'exact' })
    .eq('workspace_id', ws).eq('rol_ws', 'admin').neq('estado', 'suspendido');
  if (error) throw new Error(`usuarios: ${error.message}`);
  return count ?? 0;
}
