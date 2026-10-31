'use server';

// =============================================================================
// «Nombres de tus leads»: las acciones (31/10/2026, ./NombresModal.tsx). Sesión y admin del negocio.
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { guardarNoSon, nombresDelNegocio, noSonDelNegocio } from '@/lib/nombres-negocio';
import { normalizarNoSon, type ResumenNombres } from '@/lib/nombre-partes';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function esAdmin(): Promise<boolean> {
  await exigirSesion();
  return (await getRolWsEfectivo()) === 'admin';
}

export async function leerNombresAction(): Promise<{ ok: true; resumen: ResumenNombres } | { ok: false; error: string }> {
  try {
    if (!(await esAdmin())) return { ok: false, error: 'Sólo el administrador del negocio puede ver esto.' };
    return { ok: true, resumen: await nombresDelNegocio() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Marca o desmarca UNA palabra, sobre lo guardado AHORA: dos pestañas no se pisan la lista entera. */
export async function marcarPalabraAction(palabra: string, noEs: boolean): Promise<{ ok: true; resumen: ResumenNombres } | { ok: false; error: string }> {
  try {
    if (!(await esAdmin())) return { ok: false, error: 'Sólo el administrador del negocio puede cambiar esto.' };
    const [k] = normalizarNoSon([palabra]);
    if (!k) return { ok: false, error: 'Esa palabra no sirve.' };
    const hoy = new Set(await noSonDelNegocio());
    if (noEs) hoy.add(k); else hoy.delete(k);
    await guardarNoSon([...hoy]);
    return { ok: true, resumen: await nombresDelNegocio() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
