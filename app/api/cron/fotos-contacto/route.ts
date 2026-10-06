// =============================================================================
// /api/cron/fotos-contacto — copia las fotos de WhatsApp de los leads a nuestro bucket
// =============================================================================
// Una vez por día. La URL que da WhatsApp vence a los 10 días; con una pasada diaria cada
// foto vigente se copia mucho antes de vencer. El trabajo vive en lib/fotos-contacto.ts.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { guardarFotosDelWorkspace, type ResultadoFotos } from '@/lib/fotos-contacto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Fotos por workspace y por vuelta. Cada una es una descarga de ~80 KB y una subida; lo
 *  que no entra queda para el día siguiente, que la URL todavía vale. */
const TOPE = 200;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    console.error('[cron:fotos-contacto] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
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
  console.log(`[cron:fotos-contacto] ${JSON.stringify({ porWs: porWs.map(({ errores: _e, ...x }) => x), errores })}`);
  return Response.json({ ok: true, porWs, errores });
}
