'use server';

// =============================================================================
// Admin › Products › Templates — retirar de la galería lo que publicó un negocio (la moderación, 18/11/2026)
// =============================================================================
// Martín (13/10/2026): «para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles… luego la comunidad se va
// a encargar». Lo que la comunidad comparte lo modera la plataforma: `retirarCreacion` (lib/creaciones.ts) ya deja retirar a
// su autor O al workspace de la plataforma (`puedeRetirar`). Retirar no borra: quien ya la usó conserva su copia.
//
// ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA: el id de una server action viaja en el bundle y Next la ejecuta por cualquier puerta
//    que lo tenga (molde: app/admin/cobros/actions.ts). Y el workspace es `wsSuperAdmin()`, nunca el de la cookie: el super
//    admin puede estar mirando a un cliente (`?ws=`), y con su ws el cliente no podría retirar lo de otro.

import { revalidatePath } from 'next/cache';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { CreacionError, FaltaTablaCreacionesError, retirarCreacion } from '@/lib/creaciones';

export async function retirarPlantillaAction(id: number): Promise<{ ok: boolean; resumen: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, resumen: 'Sólo el super admin modera las plantillas.' };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, resumen: 'Esa plantilla no existe.' };
  try {
    const r = await retirarCreacion(await wsSuperAdmin(), id);
    revalidatePath('/admin/products/templates');
    return { ok: true, resumen: r.yaEstaba ? `«${r.titulo}» ya estaba retirada.` : `«${r.titulo}» ya no está en la galería.` };
  } catch (e) {
    if (e instanceof CreacionError || e instanceof FaltaTablaCreacionesError) return { ok: false, resumen: e.message };
    console.error('[admin/templates] retirar:', e instanceof Error ? e.message : e);
    return { ok: false, resumen: 'No pude retirar la plantilla. Prueba de nuevo.' };
  }
}
