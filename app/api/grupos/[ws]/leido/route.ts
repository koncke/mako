// =============================================================================
// /api/grupos/[ws]/leido — hasta dónde leyó esta persona (3/11/2026)
// =============================================================================
// Sube y nunca baja (`marcarLeido`): una pestaña vieja no le baja la marca al otro dispositivo. Lo pide la pantalla sólo con lo que dibujó, visible y con la pestaña al frente.

import { NextResponse, type NextRequest } from 'next/server';
import { accesoAlGrupo } from '@/lib/grupo-puerta';
import { marcarLeido } from '@/lib/grupo-app';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ ws: string }> }) {
  const crudo = (await params).ws;
  const ws = /^\d{1,15}$/.test(crudo) ? Number(crudo) : null;
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  if (ws == null || !quien) return NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
  const b = (await req.json().catch(() => null)) as { hastaId?: unknown } | null;
  const hasta = Number(b?.hastaId);
  if (!Number.isSafeInteger(hasta) || hasta <= 0) return NextResponse.json({ ok: false, error: 'Falta hasta dónde.' }, { status: 400 });
  try {
    await marcarLeido(ws, quien.usuarioId, hasta);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'No pude anotarlo.' }, { status: 503 });
  }
}
