// =============================================================================
// POST /api/landing-analyst/sync — descubre y analiza las landings del beacon
// =============================================================================
// No hay que cargar URLs a mano: el beacon de MaKo ya reporta a qué páginas
// llega el tráfico (landing_visits.landing_url). El sync toma las que todavía no
// tienen análisis, las corre por lote con presupuesto de tiempo, y reintenta al
// final las que fallaron. Devuelve `restantes` para que la UI pueda repetir.
//
// ⚠️ SÓLO ADMIN (tanda 6 del editor de landings, 14/10/2026; pendiente de la tanda 2: «las rutas
// analyze, sync y pulso del Landing Analyst no miran el rol»). Analiza por lote, o sea que gasta IA, y no
// tenía guarda. La misma puerta que /view y /mapa. El análisis automático NO pasa por acá (el cron
// llama a lib/landing-analyst-auto.ts directo), así que esto no lo frena.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { syncLandings } from '@/lib/landing-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
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
