// =============================================================================
// POST /api/ia-pc/soltar — la PC suelta SU propia conexión (docs/ia-del-cliente.md §3, 21/10/2026)
// =============================================================================
// Con el token de la PC: sólo la suya. La usa el programa al conectarse de nuevo (la conexión de antes se suelta, y no
// queda una tarjeta «Sin conexión» para siempre) y cuando la persona contesta que NO es su negocio (revisión del Cerebro,
// 21/10/2026: el código de otro negocio se llevaba su suscripción sin decirle nada).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { soltar } from '@/lib/ia-pc';
import { pcDelPedido, respuestaDe } from '@/lib/ia-pc-ruta';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  // También una PENDIENTE (mig 0322): «no es mi negocio» la suelta antes de confirmarla.
  const p = await pcDelPedido(req, 'soltar', { pendientesTambien: true });
  if ('respuesta' in p) return p.respuesta;
  const { d } = p;
  const frenado = limitePorClave('ia-pc-soltar', d.id, 5, 60_000);
  if (frenado) return frenado;
  try { await soltar(d); } catch (e) {
    console.error(`[ia-pc/soltar] ws=${d.ws} pc=${d.id}:`, e instanceof Error ? e.message : String(e));
    return respuestaDe('no-pude-leer');
  }
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
