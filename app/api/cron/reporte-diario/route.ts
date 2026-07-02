// =============================================================================
// Cron: reporte DIARIO (digest de la mañana) + apertura de la ventana de WhatsApp
// =============================================================================
// Vercel lo invoca ~7:00 AM Tijuana (14:00 UTC). Flujo:
//   1) asegura la plantilla "reporte_mako" en Meta (idempotente).
//   2) si está aprobada, manda la apertura del día (abre la ventana de 24h al tocar).
//   3) compone el digest diario y lo despacha (feed + WhatsApp/Telegram/email según prefs).
// Auth: Bearer CRON_SECRET.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getContactoReportes, getNotifPrefs } from '@/lib/perfil';
import { buildReporteDiario } from '@/lib/reportes';
import { despacharReporte } from '@/lib/notify';
import { asegurarPlantillaReporte, enviarAperturaDiaria } from '@/lib/reporte-template';

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

    // Plantilla + apertura de la ventana (solo si el reporte diario va por WhatsApp).
    let plantilla = 'skip';
    let apertura: { ok: boolean; error?: string } = { ok: false, error: 'no aplica' };
    if (prefs.diario.wa && perfil.telefono) {
      const pl = await asegurarPlantillaReporte();
      plantilla = pl.ok ? pl.estado : `error: ${pl.error ?? pl.estado}`;
      if (pl.ok && pl.estado === 'approved') apertura = await enviarAperturaDiaria(perfil);
      else apertura = { ok: false, error: `plantilla ${pl.estado}` };
    }

    const rep = await buildReporteDiario(prefs);
    const despacho = await despacharReporte(rep, prefs.diario, perfil);

    return Response.json({ ok: true, plantilla, apertura, despacho, ms: Date.now() - t0 });
  } catch (err) {
    console.error(`[cron:reporte-diario] ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
