'use server';

// Server actions del modal de confirmaciones de MaKo (MakoConfirmGate).

import { revalidatePath } from 'next/cache';
import { listPendientes, resolverConfirmacion, type MakoConfirmacion } from '@/lib/mako-confirmaciones';
import { getUsuarioActual } from '@/lib/auth';

async function autorActual(): Promise<string> {
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/** Confirmaciones pendientes del workspace actual. */
export async function listConfirmacionesAction(): Promise<MakoConfirmacion[]> {
  return listPendientes();
}

/** Resuelve una confirmación: 'confirmar' | 'rechazar' | 'op:<key>'. */
export async function resolverConfirmacionAction(id: number, decision: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const autor = await autorActual();
    await resolverConfirmacion(id, decision, autor);
    revalidatePath('/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
