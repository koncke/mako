// =============================================================================
// GET /api/landing-analyst/view — el estado de la tab, para refrescar sin recargar
// =============================================================================
// La page ya trae los datos server-side; esto lo usa el cliente después de un
// análisis o un sync para volver a pintar sin un full reload.
// DELETE ?url=… saca un análisis de la lista (no toca el tracking). Lo usa el Panel del Landing
// Generator (el «⋯ → Eliminar» de una página de afuera).
// ⚠️ SÓLO ADMIN (integración de la tanda 2 del editor de landings, 12/10/2026): no tenía guard
// adentro y la ruta no está en ningún gate por rol, así que cualquier sesión del workspace (un
// closer, un setter) podía leer y BORRAR los diagnósticos. La misma puerta que /mapa.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getLandingViewData, borrarAnalisis } from '@/lib/landing-analyst';

async function soloAdmin(): Promise<Response | null> {
  if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
  return null;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const cerrada = await soloAdmin();
  if (cerrada) return cerrada;
  try {
    return Response.json({ ok: true, data: await getLandingViewData() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:view] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const cerrada = await soloAdmin();
  if (cerrada) return cerrada;
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return Response.json({ ok: false, error: 'Falta la url.' }, { status: 400 });
  try {
    await borrarAnalisis(url);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:delete] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
