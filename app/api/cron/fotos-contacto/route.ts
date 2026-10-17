// =============================================================================
// /api/cron/fotos-contacto — copia las fotos de WhatsApp de los leads a nuestro bucket
// =============================================================================
// Una vez por día. La URL que da WhatsApp vence a los 10 días; con una pasada diaria cada
// foto vigente se copia mucho antes de vencer. El trabajo vive en lib/fotos-contacto.ts.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { guardarFotosDelWorkspace, renombrarFotosAdivinables, type ResultadoFotos, type ResultadoRenombre } from '@/lib/fotos-contacto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Fotos por workspace y por vuelta. Cada una es una descarga de ~80 KB y una subida; lo
 *  que no entra queda para el día siguiente, que la URL todavía vale. */
const TOPE = 200;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  let todos;
  try {
    todos = await listarWorkspaces();
  } catch (e) {
    console.error('[cron:fotos-contacto] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
  }

  const workspaces = todos.filter((w) => w.estado === 'activo');

  // Primero, las copias con nombre ADIVINABLE (lib/fotos-contacto-ruta.ts), en TODOS los negocios:
  // en uno pausado la foto está igual de a la vista. Cuando no queda ninguna, son lecturas vacías.
  const renombres: Array<{ ws: number } & ResultadoRenombre> = [];
  for (const w of todos) {
    try {
      const r = await renombrarFotosAdivinables(w.id);
      if (r.viejas || r.fallaron || r.errores.length) renombres.push({ ws: w.id, ...r });
    } catch (e) {
      renombres.push({ ws: w.id, viejas: 0, renombradas: 0, fallaron: 1, errores: [e instanceof Error ? e.message : String(e)] });
    }
  }

  const porWs: Array<{ ws: number } & ResultadoFotos> = [];
  const errores: Array<{ ws: number; error: string }> = [];
  for (const w of workspaces) {
    try {
      const r = await runWithWorkspace(w.id, () => guardarFotosDelWorkspace(w.id, TOPE));
      // Un workspace sin nada que copiar no entra al resumen: serían filas de ceros.
      if (r.aGuardar || r.fallaron) porWs.push({ ws: w.id, ...r });
    } catch (e) {
      errores.push({ ws: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  console.log(`[cron:fotos-contacto] ${JSON.stringify({ renombres, porWs: porWs.map(({ errores: _e, ...x }) => x), errores })}`);
  return Response.json({ ok: true, renombres, porWs, errores });
}
