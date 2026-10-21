'use server';

// =============================================================================
// Cambiarle el nombre a una columna del Plan (20/10/2026, docs/pedidos-crm.md B1)
// =============================================================================
// La regla está en lib/plan-columnas.ts. Acá la puerta: como editar el funnel en el CRM (`editarEtapaAction`), sólo
// el administrador del negocio; y la clave tiene que ser una columna que existe.
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { esEstado } from '@/lib/todo-estados';
import { renombrarColumnaPlan } from '@/lib/plan-columnas-server';
import type { NombresColumnasPlan } from '@/lib/plan-columnas';

export async function renombrarColumnaPlanAction(estado: string, nombre: string | null): Promise<{ ok: true; nombres: NombresColumnasPlan } | { ok: false; error: string }> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Sólo el administrador del negocio puede cambiarle el nombre a una columna.' };
  if (!esEstado(estado)) return { ok: false, error: 'Esa columna no existe.' };
  try {
    return await renombrarColumnaPlan(estado, typeof nombre === 'string' ? nombre : null);
  } catch (e) {
    console.error('[plan] renombrar columna:', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No pude guardar el nombre. Prueba de nuevo.' };
  }
}
