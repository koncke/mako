'use server';

// =============================================================================
// curso-al-ganar-actions — el interruptor «Invitar al curso al ganar» de un embudo
// =============================================================================
// Pedido de Martín (07/10/2026): «automatizar la invitación al curso cuando un lead cae a
// Ganado... Pero que sea opcional, activar esa automatización». Vive en el «⋯» de la columna
// Ganado del tablero, que es donde se ve a quién le va a llegar. Lo que hace al ganar, en
// lib/crm-curso-al-ganar.ts.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getRolWsEfectivo } from '@/lib/workspace';
import { idDelFunnelDefault, listarFunnels } from '@/lib/funnels';
import { cambiarCursoAlGanar, estadoCursoAlGanar } from '@/lib/crm-curso-al-ganar';

/**
 * Prende o apaga la invitación automática de UN embudo. `funnelId` null = el del negocio.
 *
 * ⚠️ SÓLO EL ADMIN, como editar el embudo: es una decisión que le escribe a los clientes del
 * negocio. Y PRENDER exige que el producto tenga clases — apagar no exige nada: lo que no
 * puede pasar es quedar prendido sin poder apagarlo.
 */
export async function cambiarCursoAlGanarAction(
  funnelId: number | null,
  prendido: boolean,
): Promise<{ ok: true; prendido: boolean } | { ok: false; error: string }> {
  try {
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede cambiarlo.' };
    const real = funnelId ?? (await idDelFunnelDefault());
    if (real == null || !(await listarFunnels()).some((f) => f.id === real)) return { ok: false, error: 'Ese funnel no existe.' };
    if (prendido && !(await estadoCursoAlGanar(real))) return { ok: false, error: 'Ese funnel no tiene clases.' };
    const lista = await cambiarCursoAlGanar(real, prendido === true);
    revalidatePath('/crm');
    return { ok: true, prendido: lista.includes(real) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
