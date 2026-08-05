// =============================================================================
// POST /api/landing-analyst/sync — descubre y analiza las landings del beacon
// =============================================================================
// No hay que cargar URLs a mano: el beacon de MaKo ya reporta a qué páginas
// llega el tráfico (landing_visits.landing_url). El sync toma las que todavía no
// tienen análisis, las corre por lote con presupuesto de tiempo, y reintenta al
// final las que fallaron. Devuelve `restantes` para que la UI pueda repetir.
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncLandings } from '@/lib/landing-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { max?: number; force?: boolean } = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  try {
    const res = await syncLandings({ max: body.max, force: body.force });
    console.log(
      `[landing-analyst:sync] descubiertas=${res.descubiertas} analizadas=${res.analizadas} ` +
      `err=${res.errores} restantes=${res.restantes} ms=${res.ms}`,
    );
    return Response.json({ ok: true, ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:sync] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
