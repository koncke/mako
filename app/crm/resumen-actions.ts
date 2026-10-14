'use server';

// =============================================================================
// resumen-actions — qué muestra el Resumen de la ficha del lead (13/10/2026, Resumen punto 1)
// =============================================================================
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { resumenDelNegocio, guardarResumen } from '@/lib/resumen-ficha-config';
import type { ResumenElegido } from '@/lib/resumen-ficha';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

/** Lo que eligió el negocio, y si quien mira lo puede cambiar. */
export async function resumenFichaAction(): Promise<{ elegido: ResumenElegido; puedeEditar: boolean }> {
  if (!(await haySesion())) return { elegido: {}, puedeEditar: false };
  const [elegido, rol] = await Promise.all([resumenDelNegocio(), getRolWsEfectivo().catch(() => null)]);
  return { elegido, puedeEditar: rol === 'admin' };
}

/** Guarda qué muestra el Resumen. Sólo el admin: es la ficha de todo el equipo. */
export async function guardarResumenFichaAction(v: unknown): Promise<{ ok: true; elegido: ResumenElegido } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede cambiarlo.' };
    const elegido = await guardarResumen(v);
    revalidatePath('/crm');
    return { ok: true, elegido };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
