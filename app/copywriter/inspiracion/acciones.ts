'use server';

// =============================================================================
// Las acciones de la bandeja de Inspiración (Copywriting › Inspiración, 19/11/2026, docs/inspiracion/diseno.md §6)
// =============================================================================
// Todo con el negocio de la sesión (`getTenantDb` en lib/inspiracion/servidor.ts) y detrás del interruptor
// (lib/inspiracion/revision.ts), preguntado acá, del lado del servidor: el navegador no decide quién lo ve.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { veInspiracion } from '@/lib/inspiracion/revision';
import { borrarPieza, crearCarpeta, devolverABandeja, leerInspiracion, ponerEnCarpeta, type Carpeta, type Pieza } from '@/lib/inspiracion/servidor';

const APAGADA = 'Inspiración todavía no está prendida para este negocio.';

async function puede(): Promise<boolean> {
  const sesion = await getUsuarioActual().catch(() => null);
  if (!sesion) return false;
  const ws = await getWorkspaceActual().catch(() => null);
  return ws != null && veInspiracion({ email: sesion.email, ws });
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type LecturaInspiracion = { ok: true; carpetas: Carpeta[]; piezas: Pieza[] } | { ok: false; error: string };

export async function leerInspiracionAction(): Promise<LecturaInspiracion> {
  if (!(await puede())) return { ok: false, error: APAGADA };
  try { return { ok: true, ...(await leerInspiracion()) }; } catch (e) {
    const m = mensaje(e);
    return { ok: false, error: /relation|does not exist|schema cache/i.test(m) ? 'Falta aplicar la migración 0422 (las tablas de Inspiración).' : m };
  }
}

/** La persona decide: a una carpeta que existe, o a una nueva que crea en el momento. */
export async function decidirInspiracionAction(
  piezaId: number, d: { carpetaId: number } | { nueva: { nombre: string; descripcion: string } },
): Promise<{ ok: true; carpeta: Carpeta | null } | { ok: false; error: string }> {
  if (!(await puede())) return { ok: false, error: APAGADA };
  try {
    let carpeta: Carpeta | null = null;
    let id: number;
    if ('nueva' in d) { carpeta = await crearCarpeta(d.nueva.nombre, d.nueva.descripcion, 'persona'); id = carpeta.id; }
    else id = d.carpetaId;
    await ponerEnCarpeta(piezaId, id);
    return { ok: true, carpeta };
  } catch (e) { return { ok: false, error: mensaje(e) }; }
}

/** «Volver»: la pieza vuelve a la bandeja. */
export async function volverInspiracionAction(piezaId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await puede())) return { ok: false, error: APAGADA };
  try { await devolverABandeja(piezaId); return { ok: true }; } catch (e) { return { ok: false, error: mensaje(e) }; }
}

export async function borrarInspiracionAction(piezaId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await puede())) return { ok: false, error: APAGADA };
  try { await borrarPieza(piezaId); return { ok: true }; } catch (e) { return { ok: false, error: mensaje(e) }; }
}
