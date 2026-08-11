'use server';

// =============================================================================
// Confirmar o descartar los contactos que propuso un canal
// =============================================================================
// ⚠️ NO CREA LOS LEADS ACÁ: delega en `importarLeadsRevisadosAction`, la MISMA acción
// que usa el importador del CRM. No es reuso por elegancia — esa función ya sanea cada
// campo, vuelve a resolver los duplicados CONTRA LA BASE (no contra lo que dijo el
// cliente), respeta el tope por lote y devuelve el mismo resumen. Una segunda ruta de
// alta con sus propias validaciones es exactamente donde las dos se separan, y el día
// que se separen una va a dejar entrar lo que la otra rechaza.
//
// Lo único propio de acá es cerrar la propuesta.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getPropuesta, marcarAplicada, descartarPropuesta } from '@/lib/propuestas';
import { importarLeadsRevisadosAction } from '@/app/crm/actions';
import { getUsuarioActual } from '@/lib/auth';
import type { FilaImport } from '@/app/crm/leads-importar';

export type ResultadoConfirmar =
  | { ok: true; creados: number; omitidos: number; errores: string[] }
  | { ok: false; error: string };

export async function confirmarLeadsAction(id: string, filas: FilaImport[]): Promise<ResultadoConfirmar> {
  if (!(await getUsuarioActual())) return { ok: false, error: 'sin sesión' };

  const prop = await getPropuesta(id);
  if (!prop) return { ok: false, error: 'esa propuesta no existe' };
  if (prop.estado !== 'pendiente') return { ok: false, error: 'esa propuesta ya se resolvió' };

  const r = await importarLeadsRevisadosAction(filas);
  if (!r.creados && r.errores.length) return { ok: false, error: r.errores.join(' · ') };

  // ⚠️ Se marca DESPUÉS de crear, con la guarda de `pendiente` adentro: dos pestañas o
  // un doble click crean UN solo lote. Si devuelve false es que otra la ganó — los
  // leads ya están creados, así que no es un error que el usuario tenga que ver.
  await marcarAplicada(id, { creados: r.creados, omitidos: r.omitidos });

  revalidatePath('/crm');
  return { ok: true, creados: r.creados, omitidos: r.omitidos, errores: r.errores };
}

export async function descartarLeadsAction(id: string): Promise<{ ok: boolean }> {
  if (!(await getUsuarioActual())) return { ok: false };
  await descartarPropuesta(id);
  return { ok: true };
}
