// =============================================================================
// Cron: la mensualidad de las agencias — los PDF al grupo, y «Paga para entrar» (Martín, 5/11/2026)
// =============================================================================
// Una vez por día (vercel.json: `7 14 * * *`, o sea 14:07 UTC ≈ 8:07 en Tijuana y 11:07 en Buenos Aires), a cada agencia con la
// mensualidad prendida (lib/agencia-mes.ts, `avisarMensualidades`):
//   · del 1 al 5, el PDF del mes al grupo de WhatsApp de MaKo con la agencia (una vez; otra vez si el total cambió y todavía no
//     se pagó), y MaKo pide ahí el comprobante de Binance. Nunca a los clientes de la agencia;
//   · el PDF de la entrada de cada cliente al que le quedan 1 o 2 días sin costo (o vence hoy): sus días hasta el próximo 5;
//   · «Paga para entrar»: pausa al cliente cuya entrada venció sin pagar y, desde el día 6 sin el total del mes, a la agencia y
//     a todos sus clientes; reabre a quien ya pagó. ⚠️ Si una lectura falla, esa agencia no se pausa ni se reabre.
// El comprobante que mandan al grupo lo lee lib/agencia-mes-comprobante.ts al llegar (no este cron), y reabre en el acto.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: la mensualidad no depende de una integración: recorre las agencias que la tienen
// prendida (un setting de la plataforma). Cada una con su `try`, así una rota no le apaga la corrida a las demás.
//
//   GET /api/cron/agencia-mensualidad          → corre, manda y pausa (lo que agenda Vercel)
//   GET /api/cron/agencia-mensualidad?dry=1    → qué saldría y a quién pausaría, sin mandar ni escribir nada
//
// COSTO: cero tokens (lecturas, aritmética y un PDF). MaKo no cobra por la pasarela acá. Auth: Bearer ${CRON_SECRET}.
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
