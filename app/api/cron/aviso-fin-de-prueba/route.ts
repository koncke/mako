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
import { avisarPlanesAManoVencidos } from '@/lib/plan-a-mano';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (auth) return auth;
  const enSeco = req.nextUrl.searchParams.get('seco') === '1';
  try {
    const r = await avisarFinDePruebas({ enSeco });
    console.log(`[cron:aviso-fin-de-prueba] ${r.avisadas} de ${r.revisadas} avisadas, ${r.errores} errores${r.sinMarca ? ' (sin la mig 0334: ventana de un día)' : ''}`);
    // Y los planes dados A MANO que vencieron (28/10/2026, lib/plan-a-mano.ts): un aviso a la persona y a Martín, sin pausar
    // nada. Aparte: si falla, las pruebas por la pasarela ya se avisaron.
    const aMano = await avisarPlanesAManoVencidos({ enSeco }).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    if ('error' in aMano) console.error('[cron:aviso-fin-de-prueba] planes a mano:', aMano.error);
    else if (aMano.avisados || aMano.errores) console.log(`[cron:aviso-fin-de-prueba] planes a mano: ${aMano.avisados} avisados, ${aMano.errores} errores`);
    return Response.json({ ok: true, ...r, aMano });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[cron:aviso-fin-de-prueba]', error);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
