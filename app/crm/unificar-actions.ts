'use server';

// =============================================================================
// unificar-actions — «Unificar» desde «Hay otra ficha parecida» (23/10/2026)
// =============================================================================
// Martín: «En el CRM si me dice "Hay otra ficha parecida", que me de la opción ahí mismo de unificarlas». La previa la
// puede ver cualquiera del negocio; unificar es del admin (no se deshace: la otra ficha deja de existir). Lo que se
// decide vive en lib/leads-unificar-reglas.ts y la lectura y la escritura en lib/leads-unificar.ts.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): los tipos viven en lib.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { aplicarUnificar, planParaUnificar } from '@/lib/leads-unificar';
import type { PreviaUnificar } from '@/lib/leads-unificar-reglas';

const idOk = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/** Invalida los tableros. Copia de la de app/crm/actions.ts: un 'use server' sólo exporta acciones. */
function bust() {
  try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
  revalidatePath('/crm');
}

/** Lo que queda de cada una si se unen (sin escribir nada). `queda`: la que eligió la persona (null = la regla). */
export async function previaDeUnificarAction(aId: number, bId: number, queda: number | null): Promise<{ ok: true; previa: PreviaUnificar } | { ok: false; error: string }> {
  await exigirSesion();
  if (!idOk(aId) || !idOk(bId)) return { ok: false, error: 'Faltan las dos fichas.' };
  if (queda != null && queda !== aId && queda !== bId) return { ok: false, error: 'La que queda tiene que ser una de las dos.' };
  try {
    const plan = await planParaUnificar(aId, bId, queda);
    return plan.ok ? { ok: true, previa: plan.previa } : plan;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude armar la previa.' };
  }
}

/**
 * Une las dos: queda `quedaId`, se va `seVaId`. `version` es la de la previa que vio la persona (si alguna cambió desde
 * entonces, no se hace nada). Sólo el admin.
 */
export async function unificarFichasAction(quedaId: number, seVaId: number, version: { queda: string | null; seVa: string | null }): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Sólo el administrador puede unificar fichas.' };
  if (!idOk(quedaId) || !idOk(seVaId) || quedaId === seVaId) return { ok: false, error: 'Faltan las dos fichas.' };
  try {
    // Se vuelve a armar el plan con lo de HOY: la previa sólo dice qué vio la persona.
    const plan = await planParaUnificar(quedaId, seVaId, quedaId);
    if (!plan.ok) return plan;
    await aplicarUnificar(plan, version ?? { queda: null, seVa: null }, await autorActual());
    bust();
    revalidatePath(`/crm/${quedaId}`);
    return { ok: true, resumen: `Listo: «${plan.previa.seVa.nombre}» quedó unida a «${plan.previa.queda.nombre}».` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo unificar.' };
  }
}
