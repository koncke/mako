// =============================================================================
// Cron: reporte HORARIO (lo urgente) — cada hora 8–21h Tijuana
// =============================================================================
// Vercel lo invoca cada hora en la franja (schedule en vercel.json, UTC). Chequea
// "lo urgente" (semáforo rojo, cuotas vencidas, fatiga de ads, datos sin marcar) y
// solo despacha push si hay algo (no spamea con "todo bien").
// (Hasta el 09/10/2026 además reintentaba los WhatsApp que habían quedado pendientes por
// la ventana de 24 h del oficial; se fue con Chatwoot: ver lib/notify.ts.)
// Auth: Bearer CRON_SECRET.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getContactoReportes, getNotifPrefs } from '@/lib/perfil';
import { buildReporteHorario } from '@/lib/reportes';
import { despacharReporte } from '@/lib/notify';
import { getMetaAccountHealth } from '@/lib/meta-health';
import { registrarEstadoMeta } from '@/lib/meta-health-history';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const t0 = Date.now();
  try {
    const [perfil, prefs] = await Promise.all([getContactoReportes(), getNotifPrefs()]);
    // Historial de estados de Meta (registra si está negativo y cambió).
    try { await registrarEstadoMeta(await getMetaAccountHealth()); } catch { /* no-op */ }
    if (!prefs.horario.activo) {
      return Response.json({ ok: true, skip: 'horario desactivado', ms: Date.now() - t0 });
    }

    const rep = await buildReporteHorario(prefs);
    const despacho = rep.urgente ? await despacharReporte(rep, prefs.horario, perfil) : null;

    return Response.json({ ok: true, urgente: rep.urgente, despacho, ms: Date.now() - t0 });
  } catch (err) {
    console.error(`[cron:reporte-horario] ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
