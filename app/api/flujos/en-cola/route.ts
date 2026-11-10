// =============================================================================
// GET /api/flujos/en-cola?sec=<id> — cuántos esperan en cada tarjeta y por qué no les sale (23/10/2026, P0 de #289)
// =============================================================================
// Lo pide el lienzo de Automations para el chip de cada tarjeta («2 esperando · Sale mañana 9:00», con el porqué entero
// al pasar). La lectura vive en lib/en-cola-automatizacion.ts (la usa también la API de MaKo, `espera_por_tarjeta`); lo puro,
// en lib/en-cola-por-paso.ts y lib/por-que-no-sale.ts. Sólo el admin del workspace, como las otras rutas del lienzo. Si lo del
// negocio no se puede leer, vuelve vacío: sin chip, nunca un motivo inventado.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { enColaDeAutomatizacion } from '@/lib/en-cola-automatizacion';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null) return Response.json({ ok: false, error: 'Entra al workspace de un cliente.' }, { status: 400 });
  if (rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get('sec'));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta la automatización.' }, { status: 400 });
  try {
    // La MISMA lectura que la API de MaKo (`espera_por_tarjeta`): lib/en-cola-automatizacion.ts.
    const r = await enColaDeAutomatizacion(id);
    if (!r) return Response.json({ ok: false, error: 'Esa automatización no es de este negocio.' }, { status: 404 });
    return Response.json({ ok: true, porPaso: r.porPaso });
  } catch (e) {
    console.error('[api/flujos/en-cola]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: 'No pude leer quién espera.' }, { status: 500 });
  }
}
