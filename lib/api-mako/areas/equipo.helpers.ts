// =============================================================================
// api-mako/areas/equipo.helpers — lo que el área `equipo` necesita y lib/ no exporta
// =============================================================================
// Tres piezas, las tres DEUDA:
//
//  1. EL EQUIPO DE UN WORKSPACE. `usuarios` NO es tabla por-cliente (no está en
//     TENANT_TABLES): listarUsuarios, buscarUsuarioPorEmail y buscarUsuarioPorNombre
//     devuelven filas de TODOS los negocios y de la agencia. El filtro
//     `rol === 'usuario' && workspace_id === ws` vive solo en app/api/equipo/route.ts
//     (equipoDe); se repite aquí. buscarUsuarioPorNombre además es GLOBAL: un
//     homónimo en otro negocio lo vuelve «ambiguo» y devuelve null, así que la
//     búsqueda por nombre se hace sobre el equipo ya filtrado.
//  2. EL GUARD «NO DEJAR AL NEGOCIO SIN ADMIN». Vive inline en la ruta y usa
//     contarAdminsClienteActivos, que cuenta `estado != 'suspendido'`: un admin
//     INVITADO que nunca entró cuenta como activo, y el único admin real se podía
//     degradar. Aquí cuenta solo `estado === 'activo'` y excluye al propio miembro.
//  3. IDENTIDADES FISCALES. El CRUD vive solo en server actions de
//     app/crm/[id]/deal-actions.ts. Se replica con getTenantDb (la tabla sí está en
//     TENANT_TABLES). El día que exista lib/identidades-fiscales.ts, esto se borra.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { listarUsuarios, type Usuario } from '@/lib/usuarios';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Equipo ───────────────────────────────────────────────────────────────────

/** Miembros del workspace `ws` (usuarios-cliente; nunca admins de agencia). */
export async function equipoDe(ws: number): Promise<Usuario[]> {
  const todos = await listarUsuarios();
  return todos.filter((u) => u.rol === 'usuario' && u.workspace_id === ws);
}

export async function miembroDe(ws: number, id: number): Promise<Usuario | null> {
  return (await equipoDe(ws)).find((u) => u.id === id) ?? null;
}

/** El rol EFECTIVO de un miembro: getRolWsEfectivo (lib/workspace.ts) resuelve un
 *  rol_ws null como 'admin' (filas de antes del backfill), así que el guard también. */
export const esAdminEfectivo = (u: Usuario): boolean => (u.rol_ws ?? 'admin') === 'admin';

/** ¿Quedaría el negocio sin un admin ACTIVO si este miembro deja de serlo? */
export async function esUltimoAdminActivo(ws: number, miembro: Usuario): Promise<boolean> {
  if (!esAdminEfectivo(miembro)) return false;
  const otros = (await equipoDe(ws)).filter((u) => u.id !== miembro.id && esAdminEfectivo(u) && u.estado === 'activo');
  return otros.length === 0;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Por email exacto o por nombre (todas las palabras de 3+ letras presentes). */
export async function buscarEnEquipo(ws: number, q: { email?: string | null; nombre?: string | null }): Promise<Usuario[]> {
  const equipo = await equipoDe(ws);
  if (q.email) {
    const e = q.email.trim().toLowerCase();
    return equipo.filter((u) => (u.email ?? '').toLowerCase() === e);
  }
  const n = norm(q.nombre ?? '');
  const piezas = n.replace(/[^a-z0-9ñ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
  if (!piezas.length) return [];
  const exactos = equipo.filter((u) => norm(u.nombre ?? '') === n);
  if (exactos.length) return exactos;
  return equipo.filter((u) => {
    const un = ` ${norm(u.nombre ?? '').replace(/[^a-z0-9ñ]+/g, ' ')} `;
    return piezas.every((w) => un.includes(` ${w} `));
  });
}

// ── Identidades fiscales ─────────────────────────────────────────────────────

export type IdentidadFiscal = {
  id: number; nombre: string; id_fiscal: string | null; domicilio: string | null;
  correo: string | null; es_default: boolean; created_at: string;
};

const COLS_IF = 'id, nombre, id_fiscal, domicilio, correo, es_default, created_at';

export async function listarIdentidadesFiscales(): Promise<IdentidadFiscal[]> {
  const { data, error } = await (await getTenantDb()).from('identidades_fiscales').select(COLS_IF)
    .order('es_default', { ascending: false }).order('created_at', { ascending: true });
  if (error) throw new Error(`api-mako: identidades fiscales: ${error.message}`);
  return (data ?? []) as IdentidadFiscal[];
}

export async function identidadFiscalPorId(id: number): Promise<IdentidadFiscal | null> {
  const { data, error } = await (await getTenantDb()).from('identidades_fiscales').select(COLS_IF).eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: identidades fiscales: ${error.message}`);
  return (data as IdentidadFiscal | null) ?? null;
}

export type IdentidadFiscalFila = { nombre: string; id_fiscal: string | null; domicilio: string | null; correo: string | null; es_default: boolean };

/** La misma regla que saveIdentidadFiscalAction: un solo default por workspace. */
export async function guardarIdentidadFiscal(id: number | null, fila: IdentidadFiscalFila): Promise<number | null> {
  const db = await getTenantDb();
  if (fila.es_default) {
    const { error } = await db.from('identidades_fiscales').update({ es_default: false }).eq('es_default', true);
    if (error) throw new Error(`api-mako: desmarcar el default anterior: ${error.message}`);
  }
  if (id) {
    const { error } = await db.from('identidades_fiscales').update(fila).eq('id', id);
    if (error) throw new Error(`api-mako: editar identidad fiscal: ${error.message}`);
    return id;
  }
  const { data, error } = await db.from('identidades_fiscales').insert([fila]).select('id').single();
  if (error) throw new Error(`api-mako: crear identidad fiscal: ${error.message}`);
  return (data as { id: number } | null)?.id ?? null;
}

export async function borrarIdentidadFiscal(id: number): Promise<void> {
  const { error } = await (await getTenantDb()).from('identidades_fiscales').delete().eq('id', id);
  if (error) throw new Error(`api-mako: borrar identidad fiscal: ${error.message}`);
}
