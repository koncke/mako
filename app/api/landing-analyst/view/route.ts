// =============================================================================
// GET /api/landing-analyst/view — el estado de la tab, para refrescar sin recargar
// =============================================================================
// La page ya trae los datos server-side; esto lo usa el cliente después de un
// análisis o un sync para volver a pintar sin un full reload.
// DELETE ?url=… saca un análisis de la lista (no toca el tracking).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getLandingViewData, borrarAnalisis } from '@/lib/landing-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  try {
    return Response.json({ ok: true, data: await getLandingViewData() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:view] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
