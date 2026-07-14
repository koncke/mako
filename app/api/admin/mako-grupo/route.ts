// =============================================================================
// /api/admin/mako-grupo — crear / refrescar / adoptar el grupo de un cliente
// =============================================================================
// Solo admin. GET ?ws=N → estado (JID guardado). POST { ws, action } donde
// action = 'asegurar' (crea o refresca marca) | 'adoptar' (registra un JID ya
// existente y le pone la marca). El nombre del grupo sale del workspace.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getWorkspace } from '@/lib/workspace';
import { asegurarGrupoMaKo, getGrupoJidMaKo } from '@/lib/mako-grupo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const ws = Number(new URL(req.url).searchParams.get('ws'));
  if (!Number.isInteger(ws) || ws <= 0) return NextResponse.json({ ok: false, error: 'ws inválido' }, { status: 400 });
  return NextResponse.json({ ok: true, ws, jid: await getGrupoJidMaKo(ws) });
}

type Body = { ws?: number; action?: 'asegurar' | 'adoptar'; jid?: string; participantes?: string[] };

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const ws = Number(body.ws);
  if (!Number.isInteger(ws) || ws <= 0) return NextResponse.json({ ok: false, error: 'ws inválido' }, { status: 400 });
  const wsRow = await getWorkspace(ws);
  if (!wsRow) return NextResponse.json({ ok: false, error: 'workspace no encontrado' }, { status: 404 });

  const r = await asegurarGrupoMaKo(ws, {
    nombre: wsRow.nombre,
    participantes: Array.isArray(body.participantes) ? body.participantes : undefined,
    adoptarJid: body.action === 'adoptar' ? body.jid : undefined,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
