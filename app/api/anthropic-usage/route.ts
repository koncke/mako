// =============================================================================
// /api/anthropic-usage — resumen de gasto de IA + saldo manual
// =============================================================================
// GET  → resumen (gasto del mes, gasto desde el saldo cargado, restante, última
//        operación, desglose por feature). POST { saldoUsd } → guarda el saldo
//        actual que el usuario lee de la consola de Anthropic (la API no lo da).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsageSummary, setSaldo, agregarCarga } from '@/lib/anthropic-usage';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Quién puede ver el gasto de IA: el super-admin de agencia, y **el admin de CADA
 * workspace para el suyo**.
 *
 * ⚠️ Este guard decía `soloDueno` y ese nombre describía un mundo que ya no existe.
 * Se escribió cuando la IA era una sola cuenta de la agencia; hoy es BYOK — cada
 * cliente pone SU key, la gasta él y la paga él. El resultado era que una clienta
 * con tres cuentas de Gemini y 24 llamadas hechas veía **«0 operaciones recientes»,
 * $0.0000 y ningún historial**: no era un panel vacío, era un 403 que la UI pintaba
 * como cero. Un permiso denegado y un dato en cero se ven igual, y ese es
 * exactamente el motivo por el que nadie lo detectó antes.
 *
 * El aislamiento no lo pone este guard sino `getUsageSummary()`, que lee SOLO el
 * workspace del request (ver ahí el porqué de que ya no mezcle las filas del dueño).
 * Un closer/setter sigue afuera: el gasto no es asunto suyo.
 */
async function soloAdmin(): Promise<Response | null> {
  if (await getSesionAdmin()) return null; // admin de agencia (aunque no impersone)
  if ((await getRolWsEfectivo()) === 'admin') return null; // admin de SU workspace
  return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
}

export async function GET() {
  const no = await soloAdmin();
  if (no) return no;
  try {
    return Response.json({ ok: true, ...(await getUsageSummary()) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const no = await soloAdmin();
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
