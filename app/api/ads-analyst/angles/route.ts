// =============================================================================
// /api/ads-analyst/angles — vocabulario de ángulos (CRUD = lista completa)
// =============================================================================
// GET  → { ok, angles }            lista vigente (custom o los 5 default).
// POST → body { angles: Angle[] }  reemplaza la lista entera (crear/editar/borrar
//        = mandar la lista nueva). Valida y persiste en app_settings.
// El override por anuncio (angle_override) sobrevive; los ads ya clasificados con
// un ángulo que se borró siguen mostrando su clave (gris) hasta re-analizarse.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAngles, setAngles } from '@/lib/script-angles';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const angles = await getAngles();
    return Response.json({ ok: true, angles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { angles?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    const angles = await setAngles(body.angles);
    console.log(`[ads-analyst:angles] guardados ${angles.length} ángulos`);
    return Response.json({ ok: true, angles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
