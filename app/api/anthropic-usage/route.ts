// =============================================================================
// /api/anthropic-usage — resumen de gasto de IA + saldo manual
// =============================================================================
// GET  → resumen (gasto del mes, gasto desde el saldo cargado, restante, última
//        operación, desglose por feature). POST { saldoUsd } → guarda el saldo
//        actual que el usuario lee de la consola de Anthropic (la API no lo da).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsageSummary, setSaldo } from '@/lib/anthropic-usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ ok: true, ...(await getUsageSummary()) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { saldoUsd?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const usd = Number(body.saldoUsd);
  if (!Number.isFinite(usd) || usd < 0) return Response.json({ ok: false, error: 'saldo inválido' }, { status: 400 });
  try {
    await setSaldo(usd, new Date().toISOString());
    return Response.json({ ok: true, ...(await getUsageSummary()) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
