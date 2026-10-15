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
import { guardarRespuesta } from '@/lib/admin-decisiones';
import type { EstadoRespuesta } from './decisiones';

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
