'use server';

// =============================================================================
// /admin/runway — contestar una decisión
// =============================================================================
// ⚠️ getSesionAdmin() EN LA PRIMERA LÍNEA: el id de una server action viaja en el bundle y
// Next la ejecuta por cualquier puerta que lo tenga (AGENTS.md). Que la página sea de admin
// no protege nada.
// ⚠️ En un archivo 'use server' sólo se exportan funciones async (el tipo del estado vive en
// decisiones.ts): un export const o un type con valor tira el build sin nombrar la línea.

import { revalidatePath } from 'next/cache';
import { getSesionAdmin } from '@/lib/auth';
import { deshacerRespuesta, guardarRespuesta } from '@/lib/admin-decisiones';
import type { EstadoDeshacer, EstadoRespuesta } from './decisiones';

export async function responderDecision(
  _prev: EstadoRespuesta,
  formData: FormData,
): Promise<EstadoRespuesta> {
  const admin = await getSesionAdmin();
  if (!admin) return { error: 'Sólo el super admin', ok: false };
  const id = Number(formData.get('id'));
  const clave = String(formData.get('clave') ?? '');
  const texto = String(formData.get('texto') ?? '');
  const r = await guardarRespuesta(id, clave, texto);
  if (!r.ok) return { error: r.error, ok: false };
  // La lista de la Ticketera, en la computadora y en el teléfono. El mazo no: arma su cola una
  // vez y lleva la cuenta él (Mazo.tsx); rehacerla al contestar traería de vuelta las «después».
  revalidatePath('/tickets/decisiones/lista');
  revalidatePath('/m/decisiones');
  return { error: null, ok: true };
}

/**
 * «Volver» en la Ticketera (Martín, 14/10/2026: «arrastré sin querer una tarjeta y ya no tengo
 * forma de volver»). Deshacer en la pantalla no alcanza: si la respuesta no se borra también acá,
 * el chat que preguntó se lleva una respuesta que él ya deshizo.
 */
export async function deshacerDecision(formData: FormData): Promise<EstadoDeshacer> {
  const admin = await getSesionAdmin();
  if (!admin) return { error: 'Sólo el super admin', ok: false, yaRecogida: false };
  const r = await deshacerRespuesta(Number(formData.get('id')));
  if (!r.ok) return { error: r.error, ok: false, yaRecogida: false };
  revalidatePath('/tickets/decisiones/lista');
  revalidatePath('/m/decisiones');
  return { error: null, ok: true, yaRecogida: r.yaRecogida };
}
