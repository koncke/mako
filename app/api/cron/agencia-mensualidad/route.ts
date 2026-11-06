// =============================================================================
// Cron: la mensualidad de las agencias — el aviso del mes y el de los plazos por vencer (acuerdo del 30/10/2026)
// =============================================================================
// Una vez por día (vercel.json: `7 14 * * *`, o sea 14:07 UTC ≈ 8:07 en CDMX; el minuto 7 no lo usa otro cron):
//   · del 1 al 5 de cada mes, a cada agencia con la mensualidad prendida, el total del mes y su detalle (una vez por mes,
//     y no si ya está marcado pagado). Si el del día 1 no salió por ningún lado, lo intenta al día siguiente;
//   · el aviso de que a un cliente le quedan 1 o 2 días sin costo, para que la agencia lo dé de baja si no le pagó (una
//     vez por cliente y por fecha: si se corrige su fecha, se avisa la nueva).
// Por las notificaciones de la app (las ven los admins de la agencia) y por correo. ⚠️ POR WHATSAPP NO: los grupos
// automáticos están apagados desde el ban del 3/11 (docs/relevo/nube-whatsapp.md). Lo que se arma y se dice, en
// lib/agencia-mes.ts y lib/agencia-mes-reglas.ts.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: ese helper recorre los negocios con una integración conectada, y la mensualidad
// no depende de ninguna: recorre las agencias que la tienen prendida (un setting de la plataforma). Cada una con su `try`,
// así una rota no le apaga la corrida a las demás.
//
//   GET /api/cron/agencia-mensualidad          → corre y avisa (lo que agenda Vercel)
//   GET /api/cron/agencia-mensualidad?dry=1    → qué saldría, sin mandar nada
//
// COSTO: cero tokens (lecturas de la base y aritmética). MaKo no cobra nada acá. Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { avisarMensualidades } from '@/lib/agencia-mes';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  try {
    const resultados = await avisarMensualidades(new Date(), { dry });
    // Sin agencias con la mensualidad prendida no hay nada que hacer: eso es un 200, no un fallo.
    const algunoOk = resultados.length === 0 || resultados.some((r) => r.ok);
    return Response.json({ ok: algunoOk, dry, resultados }, { status: algunoOk ? 200 : 500 });
  } catch (e) {
    // No se pudo ni leer qué agencias la tienen prendida: el monitoreo del cron lo tiene que ver.
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
