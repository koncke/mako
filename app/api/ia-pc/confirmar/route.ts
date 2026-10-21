// =============================================================================
// POST /api/ia-pc/confirmar — la persona dijo que SÍ a «¿Es tu negocio?»: la PC pendiente pasa a confirmada (mig 0322)
// =============================================================================
// Con el token de la PC PENDIENTE (lo acaba de recibir de /api/ia-pc/emparejar). Hasta acá la PC no recibía turnos, no
// se listaba ni contaba para D6b: una instalación abandonada en la pregunta dejaba una PC fantasma que le sacaba la IA a
// todo el negocio (segunda revisión del Cerebro, 21/10/2026). Pasa a ACTIVA con su primer latido con una cuenta con sesión.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { confirmar } from '@/lib/ia-pc';
import { pcDelPedido, respuestaDe } from '@/lib/ia-pc-ruta';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const p = await pcDelPedido(req, 'confirmar', { pendientesTambien: true });
  if ('respuesta' in p) return p.respuesta;
  const { d } = p;
  const frenado = limitePorClave('ia-pc-confirmar', d.id, 5, 60_000);
  if (frenado) return frenado;
  let ok: boolean;
  try { ok = await confirmar(d); } catch (e) {
    console.error(`[ia-pc/confirmar] ws=${d.ws} pc=${d.id}:`, e instanceof Error ? e.message : String(e));
    return respuestaDe('no-pude-leer');
  }
  if (!ok) return respuestaDe('revocado');
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
