// =============================================================================
// admin-usuarios-reglas — Admin › Users: las personas de todos los negocios y su estado de alta (5/11/2026)
// =============================================================================
// Martín: «gestión de usuarios, estado de alta». Copiado de la tabla de usuarios de shadcn-admin (MIT,
// src/features/users: los cuatro estados con su color, filtros por estado y por rol) y del perfil de Clerk (entrar como esa
// persona, suspender). Qué se copió de dónde, en docs/investigacion-admin.md. Sin `server-only`: lo ejecutan los tests.
//
// LOS CUATRO ESTADOS (los de shadcn-admin, con lo que significan en MaKo):
//   · suspendido: `usuarios.estado = 'suspendido'`. Es el único corte de acceso por PERSONA (AGENTS.md).
//   · invitado: nunca entró (`ultimo_login` null). Si además nunca se le mandó el acceso (`invitacion_enviada_at` null), se
//     dice: «no le llegó y no entró» y «nunca supo que tenía cuenta» son dos problemas con dos arreglos (lib/usuarios.ts).
//   · activo: entró en los últimos `DIAS_ACTIVO` días. `ultimo_login` lo marca cada pantalla (lib/ultimo-uso.ts).
//   · inactivo: entró alguna vez, hace más.
// =============================================================================

export const DIAS_ACTIVO = 30;
const DIA_MS = 86_400_000;

export const ESTADOS_ALTA = ['activo', 'inactivo', 'invitado', 'suspendido'] as const;
export type EstadoAlta = (typeof ESTADOS_ALTA)[number];

export const ROTULO_ESTADO_ALTA: Record<EstadoAlta, { rotulo: string; tono: 'good' | 'neutral' | 'info' | 'bad' }> = {
  activo: { rotulo: 'Activo', tono: 'good' },
  inactivo: { rotulo: 'Inactivo', tono: 'neutral' },
  invitado: { rotulo: 'Invitado', tono: 'info' },
  suspendido: { rotulo: 'Suspendido', tono: 'bad' },
};

/** Lo que hace falta de una fila de `usuarios`, más el nombre de su negocio. */
export type FilaUsuario = {
  id: number;
  email: string;
  nombre: string;
  /** 'admin' = super admin global; 'usuario' = de un negocio. */
  rol: string;
  rolWs: string | null;
  /** El de la base: 'activo' | 'invitado' | 'suspendido'. */
  estado: string;
  ultimoLogin: string | null;
  creado: string;
  invitacionEnviada: string | null;
  workspaceId: number | null;
  negocio: string | null;
  mfa: boolean;
  foto: string | null;
};

export function estadoDeAlta(u: Pick<FilaUsuario, 'estado' | 'ultimoLogin'>, ahoraMs: number): EstadoAlta {
  if (u.estado === 'suspendido') return 'suspendido';
  const t = u.ultimoLogin ? Date.parse(u.ultimoLogin) : NaN;
  if (!Number.isFinite(t)) return 'invitado';
  return ahoraMs - t <= DIAS_ACTIVO * DIA_MS ? 'activo' : 'inactivo';
}

/** El rol como se lee: «Super admin», «Admin», «Closer», «Setter». */
export function rolTxt(u: Pick<FilaUsuario, 'rol' | 'rolWs' | 'workspaceId'>): string {
  if (u.rol === 'admin') return 'Super admin';
  return { admin: 'Admin', closer: 'Closer', setter: 'Setter' }[u.rolWs ?? ''] ?? 'Sin rol';
}

/** La segunda línea del estado: cuándo entró, o qué pasa con su acceso. */
export function detalleDeAlta(u: Pick<FilaUsuario, 'estado' | 'ultimoLogin' | 'invitacionEnviada'>, ahoraMs: number): string {
  const e = estadoDeAlta(u, ahoraMs);
  if (e === 'invitado') return u.invitacionEnviada ? `Se le mandó el acceso ${haceTxt(u.invitacionEnviada, ahoraMs)}` : 'Nunca se le mandó el acceso';
  if (e === 'suspendido') return 'No puede entrar';
  return `Entró ${haceTxt(u.ultimoLogin, ahoraMs)}`;
}

/** «hoy», «ayer», «hace 3 días», «hace 2 meses». */
export function haceTxt(iso: string | null, ahoraMs: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 'nunca';
  const dias = Math.max(0, Math.floor((ahoraMs - t) / DIA_MS));
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

export type FiltroUsuarios = { estado: EstadoAlta | 'todos'; q: string };

/** Cuántos hay en cada estado (para los chips: Todos 18 · Activos 9 · …). */
export function conteosDeAlta(filas: readonly FilaUsuario[], ahoraMs: number): Record<EstadoAlta | 'todos', number> {
  const out: Record<EstadoAlta | 'todos', number> = { todos: filas.length, activo: 0, inactivo: 0, invitado: 0, suspendido: 0 };
  for (const f of filas) out[estadoDeAlta(f, ahoraMs)] += 1;
  return out;
}

/**
 * Los que se ven, en el orden de PostHog («Last seen», el más reciente primero): los activos y los inactivos por su última
 * vez; después los invitados (los más nuevos primero) y los suspendidos al final. La búsqueda mira nombre, email y negocio,
 * sin tildes ni mayúsculas.
 */
export function usuariosVisibles(filas: readonly FilaUsuario[], f: FiltroUsuarios, ahoraMs: number): FilaUsuario[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(f.q.trim());
  const peso: Record<EstadoAlta, number> = { activo: 0, inactivo: 0, invitado: 1, suspendido: 2 };
  return filas
    .filter((u) => f.estado === 'todos' || estadoDeAlta(u, ahoraMs) === f.estado)
    .filter((u) => !q || norm(`${u.nombre} ${u.email} ${u.negocio ?? ''}`).includes(q))
    .slice()
    .sort((a, b) => {
      const ea = estadoDeAlta(a, ahoraMs);
      const eb = estadoDeAlta(b, ahoraMs);
      if (peso[ea] !== peso[eb]) return peso[ea] - peso[eb];
      const ta = Date.parse((ea === 'invitado' ? a.creado : a.ultimoLogin) ?? '') || 0;
      const tb = Date.parse((eb === 'invitado' ? b.creado : b.ultimoLogin) ?? '') || 0;
      return tb - ta || a.email.localeCompare(b.email);
    });
}

/** Qué ofrece el menú de una persona (el de la fila de shadcn-admin y las acciones del perfil de Clerk). */
export function accionesDe(u: Pick<FilaUsuario, 'estado' | 'ultimoLogin' | 'workspaceId' | 'rol'>, ahoraMs: number): Array<'inspeccionar' | 'reenviar' | 'suspender' | 'reactivar'> {
  const e = estadoDeAlta(u, ahoraMs);
  const out: Array<'inspeccionar' | 'reenviar' | 'suspender' | 'reactivar'> = [];
  if (u.workspaceId != null) out.push('inspeccionar');
  if (e === 'invitado') out.push('reenviar');
  out.push(e === 'suspendido' ? 'reactivar' : 'suspender');
  return out;
}
