// =============================================================================
// /api/admin/mako-chats/grupo — detalle + gestión de un grupo de MaKo
// =============================================================================
// Solo admin. GET ?jid= → info (nombre, descripción, foto, participantes).
// POST { jid, action }: 'nombre' {subject} | 'descripcion' {descripcion} |
//   'foto' {base64} | 'add' {numeros[]} | 'remove' {numeros[]}.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  infoGrupoMaKo, renombrarGrupoMaKo, descripcionGrupoMaKoSet, fotoGrupoMaKo,
  agregarParticipantesMaKo, quitarParticipantesMaKo,
} from '@/lib/mako-chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const jid = new URL(req.url).searchParams.get('jid') || '';
  if (!jid) return NextResponse.json({ ok: false, error: 'falta jid' }, { status: 400 });
  const info = await infoGrupoMaKo(jid);
  return info ? NextResponse.json({ ok: true, info }) : NextResponse.json({ ok: false, error: 'grupo no encontrado' }, { status: 404 });
}

type Body = { jid?: string; action?: string; subject?: string; descripcion?: string; base64?: string; numeros?: string[] };

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let b: Body;
  try { b = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const jid = (b.jid || '').trim();
  if (!jid) return NextResponse.json({ ok: false, error: 'falta jid' }, { status: 400 });

  switch (b.action) {
    case 'nombre': return NextResponse.json(await renombrarGrupoMaKo(jid, (b.subject || '').trim()));
    case 'descripcion': return NextResponse.json(await descripcionGrupoMaKoSet(jid, b.descripcion ?? ''));
    case 'foto': return NextResponse.json(b.base64 ? await fotoGrupoMaKo(jid, b.base64) : { ok: false, error: 'falta base64' });
    case 'add': return NextResponse.json(await agregarParticipantesMaKo(jid, b.numeros ?? []));
    case 'remove': return NextResponse.json(await quitarParticipantesMaKo(jid, b.numeros ?? []));
    default: return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
