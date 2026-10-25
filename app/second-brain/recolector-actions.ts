'use server';

// =============================================================================
// El interruptor del recolector del Second Brain (25/10/2026): «Aprende solo», en el Mapa
// =============================================================================
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC (un 'use server' con un `export const` tira el build, AGENTS.md).
// La puerta: el ADMIN del negocio (o el super admin parado en él), como el Mapa. Esconder el botón no protege nada.

import { revalidatePath } from 'next/cache';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { cambiarRecolector } from '@/lib/recolector';

export async function cambiarRecolectorAction(prendido: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await adminDeWorkspaceActual()) == null) return { ok: false, error: 'Sólo el admin del negocio puede cambiar esto.' };
  try {
    await cambiarRecolector(prendido === true);
    revalidatePath('/second-brain');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
