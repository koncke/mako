// =============================================================================
// /api/anthropic-usage — resumen de gasto de IA + saldo manual
// =============================================================================
// GET  → resumen (gasto del mes, gasto desde el saldo cargado, restante, última
//        operación, desglose por feature). POST { saldoUsd } → guarda el saldo
//        actual que el usuario lee de la consola de Anthropic (la API no lo da).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsageSummary, setSaldo } from '@/lib/anthropic-usage';
import { esWorkspaceDueno } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// El gasto/saldo de IA es de la cuenta de Anthropic de la AGENCIA (una sola,
// global). Solo el dueño puede verlo y ajustar el saldo — un cliente no debe leer
// el gasto de toda la agencia ni sobrescribir el saldo global.
async function soloDueno(): Promise<Response | null> {
  return (await esWorkspaceDueno()) ? null : Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
}

export async function GET() {
  const no = await soloDueno();
  if (no) return no;
  try {
    return Response.json({ ok: true, ...(await getUsageSummary()) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const no = await soloDueno();
  if (no) return no;
  let body: { saldoUsd?: unknown; provider?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const usd = Number(body.saldoUsd);
  if (!Number.isFinite(usd) || usd < 0) return Response.json({ ok: false, error: 'saldo inválido' }, { status: 400 });
  const provider = ['anthropic', 'openai', 'groq'].includes(String(body.provider)) ? String(body.provider) : 'anthropic';
  try {
    await setSaldo(usd, new Date().toISOString(), provider);
    return Response.json({ ok: true, ...(await getUsageSummary()) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
