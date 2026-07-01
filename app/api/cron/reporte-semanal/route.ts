// =============================================================================
// Cron: reporte SEMANAL — lunes ~7:00 AM Tijuana (14:00 UTC)
// =============================================================================
// Resumen de la semana pasada (ads, wins, cobranza). Se despacha por WhatsApp +
// email (según prefs). Auth: Bearer CRON_SECRET.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getPerfil, getNotifPrefs } from '@/lib/perfil';
import { buildReporteSemanal } from '@/lib/reportes';
import { despacharReporte } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const t0 = Date.now();
  try {
    const [perfil, prefs] = await Promise.all([getPerfil(), getNotifPrefs()]);
    if (!prefs.semanal.activo) {
      return Response.json({ ok: true, skip: 'semanal desactivado', ms: Date.now() - t0 });
    }

    const rep = await buildReporteSemanal(prefs);
    const despacho = await despacharReporte(rep, prefs.semanal, perfil);

    return Response.json({ ok: true, despacho, ms: Date.now() - t0 });
  } catch (err) {
    console.error(`[cron:reporte-semanal] ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
