// =============================================================================
// POST /api/ia-pc/turno/<id> — la PC del cliente contesta un turno que tomó (docs/ia-del-cliente.md §4)
// =============================================================================
// Con el token de la PC. Sólo un turno SUYO, tomado y no vencido: lo de otra PC o de otro negocio da 404. Lo que dice
// se trata como lo que dice un modelo: turnoApp lo pasa por las mismas guardas antes de mostrarlo.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { contestarTurno, dispositivoDelToken } from '@/lib/ia-pc';
import { bearer } from '@/lib/ia-pc-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const d = await dispositivoDelToken(bearer(req.headers.get('authorization'))).catch(() => null);
  if (!d) return NextResponse.json({ ok: false, error: 'token inválido o desconectado' }, { status: 401 });
  const id = Number((await params).id);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  const ok = await contestarTurno(d, id, body).catch(() => false);
  if (!ok) return NextResponse.json({ ok: false, error: 'ese turno no es tuyo, ya se contestó o venció' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
