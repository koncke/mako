// =============================================================================
// /api/anthropic-usage — resumen de gasto de IA + saldo manual
// =============================================================================
// GET  → resumen (gasto del mes, gasto desde el saldo cargado, restante, última
//        operación, desglose por feature). POST { saldoUsd } → guarda el saldo
//        actual que el usuario lee de la consola de Anthropic (la API no lo da).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsageSummary, setSaldo, agregarCarga } from '@/lib/anthropic-usage';
import { esWorkspaceDueno, getRolWsEfectivo } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// El gasto/saldo de IA es de las cuentas de IA de la AGENCIA (globales). Lo ven el
// DUEÑO (workspace principal) Y el ADMIN de la agencia (que también consume esas
// keys). Un cliente closer/setter NO debe leer el gasto de toda la agencia — OJO:
// un closer/setter del PROPIO workspace dueño (ws1) también pasa esWorkspaceDueno,
// así que además exigimos rol_ws 'admin' cuando el gate se apoya en el workspace.
async function soloDueno(): Promise<Response | null> {
  if (await getSesionAdmin()) return null; // admin de agencia (aunque no impersone)
  if ((await esWorkspaceDueno()) && (await getRolWsEfectivo()) === 'admin') return null;
  return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
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
  let body: { saldoUsd?: unknown; cargaUsd?: unknown; provider?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  // Solo las que se pagan con dinero llevan saldo. OJO: antes 'gemini' no estaba y se
  // coercía a 'anthropic' → cargar créditos de Gemini pisaba el saldo de Claude.
  const provider = ['anthropic', 'openai', 'gemini'].includes(String(body.provider)) ? String(body.provider) : 'anthropic';
  try {
    if (body.cargaUsd !== undefined) {
      // ADITIVO: "cargué X créditos" → suma al total (el input arranca vacío).
      const usd = Number(body.cargaUsd);
      if (!Number.isFinite(usd) || usd <= 0) return Response.json({ ok: false, error: 'monto inválido' }, { status: 400 });
      await agregarCarga(usd, provider);
    } else {
      // REEMPLAZO (corrección del total): setea el saldo total a lo enviado.
      const usd = Number(body.saldoUsd);
      if (!Number.isFinite(usd) || usd < 0) return Response.json({ ok: false, error: 'saldo inválido' }, { status: 400 });
      await setSaldo(usd, new Date().toISOString(), provider);
    }
    return Response.json({ ok: true, ...(await getUsageSummary()) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
