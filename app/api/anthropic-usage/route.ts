// =============================================================================
// /api/anthropic-usage — resumen de gasto de IA + saldo manual
// =============================================================================
// GET  → resumen (gasto del mes, gasto desde el saldo cargado, restante, última
//        operación, desglose por feature). POST { saldoUsd | cargaUsd, provider } → guarda
//        el saldo actual que el usuario lee de la consola del proveedor (la API no lo da).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsageSummary, setSaldo, agregarCarga, type UsageSummary } from '@/lib/anthropic-usage';
import { getRolWsEfectivo, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { credDelCliente } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';

/** Los proveedores que llevan saldo cargado a mano: los que se pagan con dinero. OpenRouter
 *  lee el suyo solo (lib/openrouter-saldo.ts) y Groq es gratis. */
const CON_SALDO: readonly string[] = ['anthropic', 'openai', 'gemini'];

/**
 * ¿El saldo de Claude de este request es DE ESTE workspace?
 *
 * ⚠️ POR QUÉ EXISTE (auditoría de seguridad, 14/10/2026). lib/anthropic-usage.ts guarda el saldo
 * de Claude en el workspace de la key que lo paga (`wsDeProveedor`): un cliente SIN su propia
 * ANTHROPIC_API_KEY cae a OWNER_WS, que es el ws1 de Mauricio (un CLIENTE, no la plataforma). Así
 * el admin de cualquier otro workspace VEÍA el saldo y las cargas del ws1 en su panel, y con un
 * POST { saldoUsd: 0 } los PISABA. Es suyo sólo si el workspace es el 1 o si tiene su propia key
 * (la misma regla que `ver_gasto_ia` de la API de MaKo, lib/api-mako/areas/integraciones.run.ts).
 */
async function claudeEsSuyo(ws: number): Promise<boolean> {
  if (ws === OWNER_WS) return true;
  return !!(await credDelCliente('ANTHROPIC_API_KEY', ws).catch(() => null));
}

/** Quién VE el saldo de Claude: la agencia, que es la dueña de la key compartida (esté o no
 *  adentro de un cliente, como siempre), y el workspace del que es. ESCRIBIRLO es otra cosa:
 *  sólo desde el workspace del que es (ver `POST`). */
async function veSaldoDeClaude(ws: number | null): Promise<boolean> {
  if ((await getSesionAdmin()) != null) return true;
  return ws != null && claudeEsSuyo(ws);
}

/** El resumen sin el saldo de Claude cuando quien pide no lo ve (ver `veSaldoDeClaude`). */
function sinSaldoAjeno(u: UsageSummary, ve: boolean): UsageSummary {
  if (ve) return u;
  return {
    ...u,
    saldo: null,
    restanteUsd: null,
    porProveedor: u.porProveedor.map((p) => (p.provider === 'anthropic' ? { ...p, saldo: null, restanteUsd: null } : p)),
  };
}

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
    const ws = await getWorkspaceActual();
    const [u, ve] = await Promise.all([getUsageSummary(), veSaldoDeClaude(ws)]);
    return Response.json({ ok: true, ...sinSaldoAjeno(u, ve) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const no = await soloAdmin();
  if (no) return no;
  let body: { saldoUsd?: unknown; cargaUsd?: unknown; provider?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  // Solo las que se pagan con dinero llevan saldo, y el proveedor se valida EN POSITIVO: uno
  // desconocido o ausente es un 400, nunca 'anthropic'. OJO: antes se coercía — 'gemini' no
  // estaba y cargar créditos de Gemini pisaba el saldo de Claude; y un `provider: 'groq'` (o
  // ninguno) escribía el de Claude, que en un cliente sin key propia es el del ws1.
  const provider = typeof body.provider === 'string' && CON_SALDO.includes(body.provider) ? body.provider : null;
  if (!provider) return Response.json({ ok: false, error: 'Proveedor inválido.' }, { status: 400 });
  // ⚠️ UNA ESCRITURA NUNCA CAE A OWNER_WS. Sin workspace, lib/anthropic-usage.ts escribe en el
  // ws1 (`wsDeProveedor`), sea cual sea el proveedor: hay que entrar al cliente primero.
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ ok: false, error: 'Elige un cliente para cargar su saldo.' }, { status: 400 });
  // Y el saldo de Claude de un cliente sin key propia es el del ws1: no se toca desde acá, ni
  // siquiera la agencia metida en ese cliente (lo carga entrando al ws1).
  if (provider === 'anthropic' && !(await claudeEsSuyo(ws))) {
    return Response.json({ ok: false, error: 'Claude corre con la cuenta de la agencia: su saldo no es de este negocio.' }, { status: 403 });
  }
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
    const [u, ve] = await Promise.all([getUsageSummary(), veSaldoDeClaude(ws)]);
    return Response.json({ ok: true, ...sinSaldoAjeno(u, ve) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
