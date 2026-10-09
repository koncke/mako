// =============================================================================
// Cron: reporte DIARIO (digest de la mañana)
// =============================================================================
// Vercel lo invoca ~7:00 AM Tijuana (14:00 UTC): compone el digest diario y lo
// despacha (feed + email según prefs).
// (Hasta el 09/10/2026 antes aseguraba la plantilla «reporte_mako» y mandaba la apertura
// del día por el WhatsApp oficial, para abrir la ventana de 24 h; se fue con Chatwoot:
// ver lib/notify.ts.)
// Auth: Bearer CRON_SECRET.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getContactoReportes, getNotifPrefs } from '@/lib/perfil';
import { buildReporteDiario } from '@/lib/reportes';
import { despacharReporte } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const t0 = Date.now();
  try {
    const [perfil, prefs] = await Promise.all([getContactoReportes(), getNotifPrefs()]);
    if (!prefs.diario.activo) {
      return Response.json({ ok: true, skip: 'diario desactivado', ms: Date.now() - t0 });
    }

    const rep = await buildReporteDiario(prefs);
    const despacho = await despacharReporte(rep, prefs.diario, perfil);

    return Response.json({ ok: true, despacho, ms: Date.now() - t0 });
  } catch (err) {
    console.error(`[cron:reporte-diario] ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
