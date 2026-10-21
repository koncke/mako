// =============================================================================
// GET /api/ia-pc/turno — la PC del cliente pide su próximo turno (long-poll, docs/ia-del-cliente.md §4)
// =============================================================================
// Con el token de la PC. Sólo los turnos de SU negocio y SU persona (los encola turnoApp para la PC de quien escribió).
// Al tomarlo se acuña el token de las herramientas de ese turno, que recibe sólo esta PC. 204 = no hay ninguno; 503 = la
// base no pudo (la PC espera y reintenta: con 204 volvía a pedir al instante).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { tomarTurno } from '@/lib/ia-pc';
import { modeloPc } from '@/lib/ia-pc-reglas';
import { pcDelPedido, respuestaDe } from '@/lib/ia-pc-ruta';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const p = await pcDelPedido(req, 'turno');
  if ('respuesta' in p) return p.respuesta;
  const { d } = p;
  // Espera 25 s por pedido: 30 por minuto es un programa roto, no uno que espera.
  const frenado = limitePorClave('ia-pc-turno', d.id, 30, 60_000);
  if (frenado) return frenado;
  let t: Awaited<ReturnType<typeof tomarTurno>>;
  try { t = await tomarTurno(d); } catch (e) {
    console.error(`[ia-pc/turno] ws=${d.ws} pc=${d.id}:`, e instanceof Error ? e.message : String(e));
    return respuestaDe('no-pude-leer');
  }
  if (!t) return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return NextResponse.json({
    ok: true, id: t.id, system: t.pedido.system, prompt: t.pedido.prompt, token: t.token,
    // El modelo lo elige el negocio en «Tus cuentas de IA»; la PC lo vuelve a pasar por su lista (MODELOS_PC).
    modelo: modeloPc(t.pedido.modelo),
  }, { headers: { 'cache-control': 'no-store' } });
}
