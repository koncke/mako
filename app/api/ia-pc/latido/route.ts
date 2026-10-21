// =============================================================================
// POST /api/ia-pc/latido — la PC del cliente avisa que está prendida, con sus cuentas (docs/ia-del-cliente.md §3)
// =============================================================================
// Con el token de la PC (`mkopc_`). Sin latido en 90 s, la PC está «Sin conexión» (lib/ia-pc-reglas.ts → `enLinea`).
// Sin PC para el token, 401 `revocado`; si la base no pudo, 503 y la PC reintenta (lib/ia-pc-ruta.ts).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { latir } from '@/lib/ia-pc';
import { pcDelPedido, respuestaDe } from '@/lib/ia-pc-ruta';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const p = await pcDelPedido(req, 'latido');
  if ('respuesta' in p) return p.respuesta;
  const { d } = p;
  // Late cada 30 s: 10 por minuto alcanzan con margen.
  const frenado = limitePorClave('ia-pc-latido', d.id, 10, 60_000);
  if (frenado) return frenado;
  let body: unknown = {};
  try { body = await req.json(); } catch { /* un latido sin cuerpo también vale */ }
  try { await latir(d, body); } catch (e) {
    console.error(`[ia-pc/latido] ws=${d.ws} pc=${d.id}:`, e instanceof Error ? e.message : String(e));
    return respuestaDe('no-pude-leer');
  }
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
