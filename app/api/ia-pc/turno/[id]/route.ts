// =============================================================================
// POST /api/ia-pc/turno/<id> — la PC del cliente contesta un turno que tomó (docs/ia-del-cliente.md §4)
// =============================================================================
// Con el token de la PC. Sólo un turno SUYO, tomado y no vencido: lo de otra PC o de otro negocio da 404. Lo que dice
// se trata como lo que dice un modelo: turnoApp lo pasa por las mismas guardas antes de mostrarlo. 503 = la base no
// pudo: la PC lo vuelve a mandar.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { contestarTurno } from '@/lib/ia-pc';
import { pcDelPedido, respuestaDe } from '@/lib/ia-pc-ruta';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await pcDelPedido(req, 'contestar');
  if ('respuesta' in p) return p.respuesta;
  const { d } = p;
  const frenado = limitePorClave('ia-pc-contestar', d.id, 30, 60_000);
  if (frenado) return frenado;
  const id = Number((await params).id);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  let ok: boolean;
  try { ok = await contestarTurno(d, id, body); } catch (e) {
    console.error(`[ia-pc/contestar] ws=${d.ws} pc=${d.id}:`, e instanceof Error ? e.message : String(e));
    return respuestaDe('no-pude-leer');
  }
  if (!ok) return NextResponse.json({ ok: false, error: 'ese turno no es tuyo, ya se contestó o venció' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
