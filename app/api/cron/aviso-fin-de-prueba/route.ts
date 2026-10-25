// =============================================================================
// GET /api/cron/aviso-fin-de-prueba — «tu prueba gratis termina en 2 días», una vez por día (25/10/2026)
// =============================================================================
// Schedule (vercel.json): «0 13 * * *» (10:00 en Argentina). El Cerebro (25/10): «Recordatorio por email 2 días antes del
// cobro». Lo hace lib/prueba-plan.ts (`avisarFinDePruebas`): las pruebas autorizadas cuyo primer cobro cae en los próximos 2
// días, un aviso cada una. `?seco=1` cuenta a quiénes les tocaría, sin mandar nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { avisarFinDePruebas } from '@/lib/prueba-plan';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (auth) return auth;
  try {
    const r = await avisarFinDePruebas({ enSeco: req.nextUrl.searchParams.get('seco') === '1' });
    console.log(`[cron:aviso-fin-de-prueba] ${r.avisadas} de ${r.revisadas} avisadas, ${r.errores} errores${r.sinMarca ? ' (sin la mig 0334: ventana de un día)' : ''}`);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[cron:aviso-fin-de-prueba]', error);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
