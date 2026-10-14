'use server';

// =============================================================================
// calificacion-actions — a dónde va lo que se marca en «¿Era calificado?»
// =============================================================================
// Martín (13/10/2026, Resumen punto 2): «¿Cómo el usuario alimenta X pixel, o X evento
// del pixel?... Revisa como funciona Meta CAPI». Lo medido al revisarlo está en
// docs/hallazgos-crm.md; lo que la ficha necesita es una sola cosa: si llega o no.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { adondeVaLaCalificacion } from '@/lib/meta-capi';
import type { AdondeVaLaCalificacion } from '@/lib/meta-capi-payload';

/** null = sin sesión o no se pudo leer: la tarjeta no afirma nada distinto de lo de siempre. */
export async function adondeVaLaCalificacionAction(): Promise<AdondeVaLaCalificacion | null> {
  try {
    // Sin sesión, `getWorkspaceActual()` cae al ws1, un cliente: no se contesta nada.
    if (!(await getUsuarioActual())) return null;
    const ws = await getWorkspaceActual();
    return ws == null ? null : await adondeVaLaCalificacion(ws);
  } catch {
    return null;
  }
}
