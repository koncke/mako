'use server';

// =============================================================================
// El NOMBRE DEL NEGOCIO — leer y guardar (Configuración del negocio › Tu negocio, 21/10/2026)
// =============================================================================
// Florencia (ws21) no podía cambiar el nombre de su negocio en ningún lado (lib/nombre-negocio.ts). Lo cambia el admin
// del negocio, como el horario (horario-actions.ts): `requireSesion` da el rol en ESTE negocio. Se guarda en
// workspaces.nombre, que es lo que leen la tarjeta de /admin, el encabezado y MaKo.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).

import { revalidatePath } from 'next/cache';
import { requireSesion } from '@/lib/tab-access';
import { actualizarWorkspace, getWorkspace, getWorkspaceActual } from '@/lib/workspace';
import { limpiarNombreNegocio } from '@/lib/nombre-negocio';

export async function nombreDelNegocioAction(): Promise<{ nombre: string | null; puedeEditar: boolean }> {
  const rol = await requireSesion();
  const ws = await getWorkspaceActual();
  const w = ws == null ? null : await getWorkspace(ws).catch(() => null);
  return { nombre: w?.nombre ?? null, puedeEditar: rol === 'admin' && ws != null };
}

export async function guardarNombreNegocioAction(crudo: unknown): Promise<{ ok: true; nombre: string } | { ok: false; error: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Solo quien administra el negocio puede cambiar su nombre.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No encontré tu negocio.' };
  const r = limpiarNombreNegocio(crudo);
  if (!r.ok) return r;
  try {
    await actualizarWorkspace(ws, { nombre: r.nombre });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
  // El nombre se ve en toda la app (el encabezado, la barra, el Ops Center): se vuelve a dibujar todo.
  revalidatePath('/', 'layout');
  return { ok: true, nombre: r.nombre };
}
